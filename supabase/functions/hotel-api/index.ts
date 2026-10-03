import { validateHotelData } from '../_shared/hotelStorage.ts';
import { validatePeriod, bookingConflict } from '../_shared/hotelLogic.ts';

type Credential = { salt: string; iterations: number; hash: string };
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
      const [primary, fixed] = await Promise.all([matches(input.password, credential.primary_credential), matches(input.password, credential.fixed_credential)]);
      if (!primary && !fixed) return response({ error: 'Mật khẩu chưa đúng. Vui lòng nhập lại.' }, 400);
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      if (!await db('rpc/hotel_open_session', { p_version: credential.version, p_hash: await digest(token) })) return response({ error: 'Mật khẩu vừa thay đổi. Hãy đăng nhập lại.' }, 409);
      return response({ token });
    }
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) return response({ error: 'Vui lòng đăng nhập.' }, 401);
    const hash = await digest(token), credential = (await db('hotel_auth?id=eq.true'))[0];
    const session = (await db(`hotel_sessions?token_hash=eq.${hash}&auth_version=eq.${credential?.version}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`))[0];
    if (!session) return response({ error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' }, 401);
    if (action === 'session') return response({ expiresAt: session.expires_at });
    if (action === 'logout') { await db(`hotel_sessions?token_hash=eq.${hash}`, undefined, 'DELETE'); return response({}); }
    if (action === 'read') { const state = (await db('hotel_state?id=eq.true&select=revision,data'))[0]; if (!state) return response({ error: 'Dữ liệu chưa khởi tạo.' }, 503); return response(state); }
    if (action === 'write') {
      const data = validateHotelData(input.data);
      for (const reservation of data.reservations.filter(r => r.status === 'CONFIRMED')) {
        const { start, end } = validatePeriod(reservation.checkInDate, reservation.checkInTime, reservation.checkOutDate, reservation.checkOutTime);
        // Static overlap is always invalid. PostgreSQL checks overdue guests only
        // for changed schedules, so elapsed time cannot block unrelated sales.
        if (bookingConflict(reservation.roomId, start, end, data.reservations, data.stays, reservation.id, -Infinity)) return response({ error: 'Lịch giữ phòng bị trùng. Kiểm tra lại trước khi nhận cọc.' }, 409);
      }
      if (!Number.isSafeInteger(input.revision) || input.revision < 0) return response({ error: 'Phiên bản dữ liệu không hợp lệ.' }, 400);
      if (typeof input.requestId !== 'string' || !/^[a-f0-9-]{32,64}$/.test(input.requestId)) return response({ error: 'Mã thao tác không hợp lệ.' }, 400);
      return response(await db('rpc/hotel_save', { p_revision: input.revision, p_data: data, p_hash: hash, p_request_id: input.requestId }));
    }
    if (action === 'password') {
      const { current, next, confirmation } = input;
      if (typeof next !== 'string' || next.length < 8 || next.length > 128 || next !== next.trim()) return response({ error: 'Mật khẩu mới cần 8–128 ký tự, không có khoảng trắng đầu/cuối.' }, 400);
      if (next !== confirmation) return response({ error: 'Mật khẩu xác nhận chưa khớp.' }, 400);
      const [primary, fixed] = await Promise.all([matches(current, credential.primary_credential), matches(current, credential.fixed_credential)]);
      if (!primary && !fixed) return response({ error: 'Mật khẩu hiện tại chưa đúng.' }, 400);
      if (next === current || await matches(next, credential.primary_credential)) return response({ error: 'Mật khẩu mới cần khác mật khẩu hiện tại.' }, 400);
      if (await matches(next, credential.fixed_credential)) return response({ error: 'Mật khẩu mới không hợp lệ. Vui lòng chọn mật khẩu khác.' }, 400);
      const updated = { salt: hex(crypto.getRandomValues(new Uint8Array(16))), iterations: 210000, hash: '' }; updated.hash = await derive(next, updated);
      await db('rpc/hotel_change_password', { p_version: credential.version, p_credential: updated, p_hash: hash });
      return response({});
    }
    return response({ error: 'Thao tác không hợp lệ.' }, 400);
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return response({ error: 'Mất kết nối máy chủ dữ liệu. Chưa xác nhận được kết quả; hãy tải lại kiểm tra trước khi thử lại.' }, 503);
    const message = error instanceof Error ? error.message : '';
    if (message.includes('SESSION_EXPIRED')) return response({ error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' }, 401);
    if (message.includes('STALE_')) return response({ error: 'Dữ liệu vừa thay đổi trên thiết bị khác. Đã tải lịch mới; hãy kiểm tra và thử lại. Thao tác chưa được ghi nhận.' }, 409);
    if (message.includes('conflicting key') || message.includes('exclusion constraint')) return response({ error: 'Phòng đã có lịch trùng. Phiếu đặt và tiền cọc chưa được ghi nhận.' }, 409);
    if (message.includes('OVERDUE_STAY')) return response({ error: 'Khách đang ở chưa trả phòng dù đã quá giờ dự kiến. Hãy xác nhận trả phòng trước khi giữ lịch mới.' }, 409);
    return response({ error: 'Không lưu được dữ liệu. Kiểm tra nội dung và kết nối rồi thử lại; thao tác chưa được ghi nhận.' }, 400);
  }
});
