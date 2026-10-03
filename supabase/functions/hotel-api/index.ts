import { validateHotelData } from '../_shared/hotelStorage.ts';
import { validatePeriod, bookingConflict } from '../_shared/hotelLogic.ts';
import { ADMIN_ACTOR, canAct, validatePermissions } from '../_shared/permissions.ts';
import type { AccessActor, ActionId, StaffAccount } from '../_shared/access.ts';
import { authorizeHotelMutation, projectHotelData, mergeProjectedHotelData, HotelPermissionError } from '../_shared/authorizeHotelMutation.ts';

type Credential = { salt: string; iterations: number; hash: string };
type StaffRow = { id: string; username: string; display_name: string; active: boolean; version: number; permissions: AccessActor['permissions']; credential: Credential; created_at: string; updated_at: string };
function staffActor(row: StaffRow): AccessActor { return { id: row.id, role: 'RECEPTION', username: row.username, displayName: row.display_name, version: row.version, permissions: validatePermissions(row.permissions) }; }
function publicStaff(row: StaffRow): StaffAccount { return { ...staffActor(row), active: row.active, createdAt: row.created_at, updatedAt: row.updated_at }; }
function validNewPassword(value: unknown): value is string { return typeof value === 'string' && value.length >= 8 && value.length <= 128 && value === value.trim(); }
class DatabaseUnavailableError extends Error {}
const bytes = (hex: string) => Uint8Array.from(hex.match(/.{2}/g) || [], part => parseInt(part, 16));
const hex = (value: Uint8Array) => Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
const digest = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
async function derive(password: string, credential: Credential) {
  const data = new TextEncoder().encode(password);
  try { const key = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits']); return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes(credential.salt), iterations: credential.iterations, hash: 'SHA-256' }, key, 256))); }
  finally { data.fill(0); }
}
async function matches(password: unknown, credential: Credential) {
  if (typeof password !== 'string' || !password || password.length > 128) return false;
  const actual = await derive(password, credential); let difference = actual.length ^ credential.hash.length;
  for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ credential.hash.charCodeAt(index);
  return difference === 0;
}
async function newCredential(password: string): Promise<Credential> { const credential = { salt: hex(crypto.getRandomValues(new Uint8Array(16))), iterations: 210000, hash: '' }; credential.hash = await derive(password, credential); return credential; }

// The gateway JWT check is disabled; opaque server-issued tokens are checked here.
Deno.serve(async (request: Request) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
  if (request.method === 'OPTIONS') return response({});
  if (request.method !== 'POST') return response({ error: 'Phương thức không hợp lệ.' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return response({ error: 'Máy chủ chưa được cấu hình.' }, 503);
  const db = async (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const unavailable = (): never => { throw new DatabaseUnavailableError(); };
    const result = await fetch(`${url}/rest/v1/${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) }).catch(unavailable);
    if (result.status >= 500) unavailable();
    const text = await result.text().catch(unavailable);
    let value;
    try { value = text ? JSON.parse(text) : null; } catch { unavailable(); }
    if (!result.ok) throw new Error(value?.message || 'DATABASE_ERROR');
    return value;
  };
  try {
    const raw = await request.text(); if (raw.length > 5_000_000) return response({ error: 'Dữ liệu quá lớn.' }, 413);
    const input = JSON.parse(raw), action = input.action;
    if (action === 'login') {
      const bucket = await digest('ip:' + (request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'));
      if (!await db('rpc/hotel_rate_limit', { p_bucket: bucket })) return response({ error: 'Đã thử nhiều lần. Vui lòng đợi một phút.' }, 429);
      const credential = (await db('hotel_auth?id=eq.true'))[0];
      if (!credential) return response({ error: 'Hệ thống chưa khởi tạo.' }, 503);
      if (input.username !== undefined) {
        if (typeof input.username !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(input.username.trim().toLowerCase())) return response({ error: 'Tên đăng nhập hoặc mật khẩu chưa đúng.' }, 400);
        const account = (await db(`hotel_staff?username=eq.${encodeURIComponent(input.username.trim().toLowerCase())}`))[0] as StaffRow | undefined;
        // Perform the same expensive derivation for an unknown name to avoid a
        // fast username-enumeration path. Manager credentials never log staff in.
        const valid = await matches(input.password, account?.credential || credential.primary_credential);
        if (!account?.active || !valid) return response({ error: 'Tên đăng nhập hoặc mật khẩu chưa đúng.' }, 400);
        const token = hex(crypto.getRandomValues(new Uint8Array(32)));
        if (!await db('rpc/hotel_open_staff_session', { p_id: account.id, p_version: account.version, p_auth_version: credential.version, p_hash: await digest(token) })) return response({ error: 'Tài khoản vừa thay đổi. Hãy đăng nhập lại.' }, 409);
        return response({ token, actor: staffActor(account) });
      }
      const [primary, fixed] = await Promise.all([matches(input.password, credential.primary_credential), matches(input.password, credential.fixed_credential)]);
      if (!primary && !fixed) return response({ error: 'Mật khẩu chưa đúng. Vui lòng nhập lại.' }, 400);
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      if (!await db('rpc/hotel_open_session', { p_version: credential.version, p_hash: await digest(token) })) return response({ error: 'Mật khẩu vừa thay đổi. Hãy đăng nhập lại.' }, 409);
      return response({ token, actor: { ...ADMIN_ACTOR, version: credential.version } });
    }
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) return response({ error: 'Vui lòng đăng nhập.' }, 401);
    const hash = await digest(token), credential = (await db('hotel_auth?id=eq.true'))[0];
    const session = (await db(`hotel_sessions?token_hash=eq.${hash}&auth_version=eq.${credential?.version}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`))[0];
    if (!session) return response({ error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' }, 401);
    let account: StaffRow | undefined;
    if (session.staff_id) {
      account = (await db(`hotel_staff?id=eq.${encodeURIComponent(session.staff_id)}`))[0];
      if (!account?.active || account.version !== session.staff_version) return response({ error: 'Tài khoản hoặc quyền truy cập vừa thay đổi. Hãy đăng nhập lại.' }, 401);
    }
    const actor: AccessActor = account ? staffActor(account) : { ...ADMIN_ACTOR, version: credential.version };
    if (action === 'session') return response({ expiresAt: session.expires_at, actor });
    if (action === 'logout') { await db(`hotel_sessions?token_hash=eq.${hash}`, undefined, 'DELETE'); return response({}); }
    if (action === 'staff.list') {
      if (actor.role !== 'ADMIN') return response({ error: 'Chỉ quản lý được cấp quyền cho tài khoản lễ tân.' }, 403);
      return response({ accounts: (await db('hotel_staff?order=created_at.asc')).map(publicStaff) });
    }
    if (action === 'staff.save') {
      if (actor.role !== 'ADMIN') return response({ error: 'Chỉ quản lý được cấp quyền cho tài khoản lễ tân.' }, 403);
      if (typeof input.username !== 'string' || typeof input.displayName !== 'string' || typeof input.active !== 'boolean' || input.id !== undefined && (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)) return response({ error: 'Thông tin tài khoản không hợp lệ.' }, 400);
      const username = input.username.trim().toLowerCase(), displayName = input.displayName.trim();
      if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username) || ['admin', 'manager', 'quanly'].includes(username) || !displayName || displayName.length > 80) return response({ error: 'Tên đăng nhập cần 3–40 ký tự chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới.' }, 400);
      const permissions = validatePermissions(input.permissions);
      if ((!input.id || input.password) && !validNewPassword(input.password)) return response({ error: 'Mật khẩu cần 8–128 ký tự, không có khoảng trắng đầu/cuối.' }, 400);
      const updated = await db('rpc/hotel_staff_save', { p_hash: hash, p_id: input.id || crypto.randomUUID(), p_create: !input.id, p_username: username, p_display_name: displayName, p_permissions: permissions, p_active: input.active, p_credential: input.password ? await newCredential(input.password) : null, p_expected_version: input.id ? input.expectedVersion : null });
      return response({ account: publicStaff(updated) });
    }
    if (action === 'read') { const state = (await db('hotel_state?id=eq.true&select=revision,data'))[0]; if (!state) return response({ error: 'Dữ liệu chưa khởi tạo.' }, 503); return response({ revision: state.revision, data: projectHotelData(actor, validateHotelData(state.data)) }); }
    if (action === 'write') {
      if (!canAct(actor, input.operation as ActionId)) return response({ error: 'Bạn chưa được cấp quyền thực hiện thao tác này.' }, 403);
      if (!Number.isSafeInteger(input.revision) || input.revision < 0) return response({ error: 'Phiên bản dữ liệu không hợp lệ.' }, 400);
      if (typeof input.requestId !== 'string' || !/^[a-f0-9-]{32,64}$/.test(input.requestId)) return response({ error: 'Mã thao tác không hợp lệ.' }, 400);
      const state = (await db('hotel_state?id=eq.true&select=revision,data'))[0];
      if (!state) return response({ error: 'Dữ liệu chưa khởi tạo.' }, 503);
      const before = validateHotelData(state.data);
      // A retry must remain valid even after the first request committed its
      // invoice. Only return a receipt after authenticating current permissions.
      if ((await db(`hotel_mutations?request_id=eq.${input.requestId}&select=request_id`)).length) return response({ revision: state.revision, data: projectHotelData(actor, before) });
      if (state.revision !== input.revision) return response({ error: 'Dữ liệu vừa thay đổi trên thiết bị khác. Hãy tải lại rồi thử lại; thao tác chưa được ghi nhận.' }, 409);
      const submitted = validateHotelData(input.data);
      const beforeInvoiceIds = new Set(before.invoices.map(invoice => invoice.id));
      if (input.operation !== 'data.restore') submitted.invoices = submitted.invoices.map(invoice => beforeInvoiceIds.has(invoice.id) ? invoice : { ...invoice, createdBy: actor.id });
      const data = mergeProjectedHotelData(actor, before, submitted);
      authorizeHotelMutation(actor, before, data, input.operation as ActionId);
      for (const reservation of data.reservations.filter(r => r.status === 'CONFIRMED')) {
        const { start, end } = validatePeriod(reservation.checkInDate, reservation.checkInTime, reservation.checkOutDate, reservation.checkOutTime);
        // Static overlap is always invalid. PostgreSQL checks overdue guests only
        // for changed schedules, so elapsed time cannot block unrelated sales.
        if (bookingConflict(reservation.roomId, start, end, data.reservations, data.stays, reservation.id, -Infinity)) return response({ error: 'Lịch giữ phòng bị trùng. Kiểm tra lại trước khi nhận cọc.' }, 409);
      }
      const saved = await db('rpc/hotel_save_authorized', { p_revision: input.revision, p_data: data, p_hash: hash, p_request_id: input.requestId, p_operation: input.operation, p_actor_version: actor.version });
      return response({ revision: saved.revision, data: projectHotelData(actor, validateHotelData(saved.data)) });
    }
    if (action === 'password') {
      const { current, next, confirmation } = input;
      if (!validNewPassword(next)) return response({ error: 'Mật khẩu mới cần 8–128 ký tự, không có khoảng trắng đầu/cuối.' }, 400);
      if (next !== confirmation) return response({ error: 'Mật khẩu xác nhận chưa khớp.' }, 400);
      if (account) {
        if (!await matches(current, account.credential)) return response({ error: 'Mật khẩu hiện tại chưa đúng.' }, 400);
        if (next === current || await matches(next, account.credential)) return response({ error: 'Mật khẩu mới cần khác mật khẩu hiện tại.' }, 400);
        await db('rpc/hotel_staff_change_password', { p_hash: hash, p_version: account.version, p_credential: await newCredential(next) });
        return response({});
      }
      const [primary, fixed] = await Promise.all([matches(current, credential.primary_credential), matches(current, credential.fixed_credential)]);
      if (!primary && !fixed) return response({ error: 'Mật khẩu hiện tại chưa đúng.' }, 400);
      if (next === current || await matches(next, credential.primary_credential)) return response({ error: 'Mật khẩu mới cần khác mật khẩu hiện tại.' }, 400);
      if (await matches(next, credential.fixed_credential)) return response({ error: 'Mật khẩu mới không hợp lệ. Vui lòng chọn mật khẩu khác.' }, 400);
      const updated = await newCredential(next);
      await db('rpc/hotel_change_password', { p_version: credential.version, p_credential: updated, p_hash: hash });
      return response({});
    }
    return response({ error: 'Thao tác không hợp lệ.' }, 400);
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return response({ error: 'Mất kết nối máy chủ dữ liệu. Chưa xác nhận được kết quả; hãy tải lại kiểm tra trước khi thử lại.' }, 503);
    const message = error instanceof Error ? error.message : '';
    if (error instanceof HotelPermissionError || message.includes('PERMISSION_DENIED')) return response({ error: error instanceof HotelPermissionError ? message : 'Bạn chưa được cấp quyền thực hiện thao tác này.' }, 403);
    if (message.includes('hotel_staff_username_key')) return response({ error: 'Tên đăng nhập đã được sử dụng.' }, 400);
    if (message.includes('STALE_STAFF')) return response({ error: 'Tài khoản vừa được sửa ở nơi khác. Hãy tải lại danh sách trước khi cập nhật quyền hoặc mật khẩu.' }, 409);
    if (message.includes('SESSION_EXPIRED')) return response({ error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' }, 401);
    if (message.includes('STALE_')) return response({ error: 'Dữ liệu vừa thay đổi trên thiết bị khác. Đã tải lịch mới; hãy kiểm tra và thử lại. Thao tác chưa được ghi nhận.' }, 409);
    if (message.includes('conflicting key') || message.includes('exclusion constraint')) return response({ error: 'Phòng đã có lịch trùng. Phiếu đặt và tiền cọc chưa được ghi nhận.' }, 409);
    if (message.includes('OVERDUE_STAY')) return response({ error: 'Khách đang ở chưa trả phòng dù đã quá giờ dự kiến. Hãy xác nhận trả phòng trước khi giữ lịch mới.' }, 409);
    return response({ error: 'Không lưu được dữ liệu. Kiểm tra nội dung và kết nối rồi thử lại; thao tác chưa được ghi nhận.' }, 400);
  }
});
