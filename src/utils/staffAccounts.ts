import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import type { AccessActor, PasswordVerifier, StaffAccount, StaffAccountInput, StoredStaffAccount } from '../types/access';
import { validatePermissions } from './permissions';
import { PasswordChangeError, SESSION_DURATION } from './authSession';

export const STAFF_ACCOUNTS_KEY = 'son_ngoc_staff_accounts_v1';
export const STAFF_SESSION_KEY = 'son_ngoc_staff_session_v1';
export const STAFF_ACCOUNTS_EVENT = 'son-ngoc-staff-accounts-changed';
const ITERATIONS = 210000;
type StaffStorage = Pick<Storage, 'getItem' | 'setItem'>;
interface StaffStore { version: 1; revision: number; accounts: StoredStaffAccount[] }
export interface StaffSession { version: 1; actorId: string; actorVersion: number; issuedAt: number; expiresAt: number }

function browserStorage(): StaffStorage {
  try { if (typeof window !== 'undefined') return window.localStorage; } catch { /* Fail closed below. */ }
  throw new Error('Không đọc được tài khoản lễ tân. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.');
}
function validVerifier(value: unknown): value is PasswordVerifier {
  const credential = value as PasswordVerifier;
  return !!credential && /^[a-f0-9]{32}$/.test(credential.salt) && /^[a-f0-9]{64}$/.test(credential.hash) && credential.iterations === ITERATIONS;
}
function readStore(storage: StaffStorage): { raw: string | null; store: StaffStore } {
  let raw: string | null;
  try { raw = storage.getItem(STAFF_ACCOUNTS_KEY); } catch { throw new Error('Không đọc được tài khoản lễ tân đã lưu.'); }
  if (raw === null) return { raw, store: { version: 1, revision: 0, accounts: [] } };
  try {
    const store = JSON.parse(raw) as StaffStore;
    if (store?.version !== 1 || !Number.isSafeInteger(store.revision) || store.revision < 0 || !Array.isArray(store.accounts)) throw new Error();
    const usernames = new Set<string>(), ids = new Set<string>();
    for (const account of store.accounts) {
      if (!account || account.role !== 'RECEPTION' || typeof account.id !== 'string' || !account.id.startsWith('staff-') || typeof account.username !== 'string' || normalizeUsername(account.username) !== account.username || typeof account.displayName !== 'string' || !account.displayName.trim() || typeof account.active !== 'boolean' || !Number.isSafeInteger(account.version) || account.version < 1 || !validVerifier(account.credential) || !Number.isFinite(Date.parse(account.createdAt)) || !Number.isFinite(Date.parse(account.updatedAt)) || usernames.has(account.username) || ids.has(account.id)) throw new Error();
      validatePermissions(account.permissions);
      usernames.add(account.username); ids.add(account.id);
    }
    return { raw, store };
  } catch { throw new Error('Thông tin tài khoản lễ tân bị lỗi. Dữ liệu được giữ nguyên; vui lòng kiểm tra bộ nhớ trình duyệt.'); }
}
function normalizeUsername(username: string) {
  const value = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(value) || ['admin', 'administrator', 'manager'].includes(value)) throw new Error('Tên đăng nhập cần 3–40 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang; không dùng tên quản lý.');
  return value;
}
function publicAccount(account: StoredStaffAccount): StaffAccount {
  const { credential: _credential, ...result } = account;
  return { ...result, permissions: { views: [...result.permissions.views], actions: [...result.permissions.actions] } };
}
function asActor(account: StoredStaffAccount): AccessActor {
  const { active: _active, createdAt: _createdAt, updatedAt: _updatedAt, ...actor } = publicAccount(account);
  return actor;
}
function passwordRules(password: string) {
  if (password.length < 8 || password.length > 128 || password.trim().length < 8) throw new PasswordChangeError('Mật khẩu cần từ 8 đến 128 ký tự.', 'new');
  if (password !== password.trim()) throw new PasswordChangeError('Mật khẩu không có khoảng trắng ở đầu hoặc cuối.', 'new');
}
async function derive(password: string, credential: Pick<PasswordVerifier, 'salt' | 'iterations'>) {
  const bytes = new TextEncoder().encode(password), salt = hexToBytes(credential.salt);
  try {
    if (globalThis.crypto?.subtle) {
      const key = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits']);
      return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: credential.iterations, hash: 'SHA-256' }, key, 256));
    }
    return await pbkdf2Async(sha256, bytes, salt, { c: credential.iterations, dkLen: 32, asyncTick: 10 });
  } finally { bytes.fill(0); }
}
async function matches(password: string, credential: PasswordVerifier) {
  if (!password || password.length > 128) return false;
  const derived = await derive(password, credential), expected = hexToBytes(credential.hash);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ derived[index];
  derived.fill(0);
  return difference === 0;
}
async function verifier(password: string): Promise<PasswordVerifier> {
  passwordRules(password);
  if (!globalThis.crypto?.getRandomValues) throw new Error('Trình duyệt chưa hỗ trợ tạo tài khoản. Hãy mở app bằng Chrome, Edge hoặc Safari mới.');
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const derived = await derive(password, { salt, iterations: ITERATIONS });
  const hash = bytesToHex(derived); derived.fill(0);
  return { salt, iterations: ITERATIONS, hash };
}
function writeStore(storage: StaffStorage, previous: string | null, store: StaffStore) {
  if (storage.getItem(STAFF_ACCOUNTS_KEY) !== previous) throw new Error('Tài khoản vừa được cập nhật ở cửa sổ khác. Hãy tải lại danh sách rồi thử lại.');
  try { storage.setItem(STAFF_ACCOUNTS_KEY, JSON.stringify(store)); }
  catch { throw new Error('Không lưu được tài khoản lễ tân. Dữ liệu hiện tại vẫn giữ nguyên.'); }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STAFF_ACCOUNTS_EVENT));
}
export function listStaffAccounts(storage = browserStorage()): StaffAccount[] { return readStore(storage).store.accounts.map(publicAccount); }
export async function saveStaffAccount(input: StaffAccountInput, storage = browserStorage()): Promise<StaffAccount> {
  const { raw, store } = readStore(storage);
  const username = normalizeUsername(input.username);
  if (typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.trim().length > 80 || typeof input.active !== 'boolean') throw new Error('Nhập tên lễ tân từ 1–80 ký tự và trạng thái tài khoản hợp lệ.');
  const permissions = validatePermissions(input.permissions);
  const previous = input.id ? store.accounts.find(account => account.id === input.id) : undefined;
  if (input.id && !previous) throw new Error('Tài khoản lễ tân không còn tồn tại. Hãy tải lại danh sách.');
  if (previous && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion !== previous.version)) throw new Error('Tài khoản vừa được cập nhật ở cửa sổ khác. Hãy tải lại danh sách rồi thử lại.');
  if (store.accounts.some(account => account.username === username && account.id !== input.id)) throw new Error('Tên đăng nhập đã được sử dụng.');
  if (!previous && !input.password) throw new PasswordChangeError('Nhập mật khẩu cho tài khoản mới.', 'new');
  const credential = input.password ? await verifier(input.password) : previous!.credential;
  const now = new Date().toISOString();
  const account: StoredStaffAccount = { id: previous?.id || `staff-${crypto.randomUUID()}`, role: 'RECEPTION', username, displayName: input.displayName.trim(), active: input.active, permissions, version: (previous?.version || 0) + 1, createdAt: previous?.createdAt || now, updatedAt: now, credential };
  writeStore(storage, raw, { version: 1, revision: store.revision + 1, accounts: previous ? store.accounts.map(item => item.id === account.id ? account : item) : [...store.accounts, account] });
  return publicAccount(account);
}
export async function verifyStaffLogin(username: string, password: string, storage = browserStorage()): Promise<AccessActor | null> {
  let normalized: string;
  try { normalized = normalizeUsername(username); } catch { return null; }
  const account = readStore(storage).store.accounts.find(item => item.username === normalized && item.active);
  if (!account || !(await matches(password, account.credential))) return null;
  const current = readStore(storage).store.accounts.find(item => item.id === account.id);
  return current?.active && current.version === account.version ? asActor(current) : null;
}
export function freshStaffActor(actor: AccessActor, storage = browserStorage()): AccessActor {
  if (actor.role !== 'RECEPTION') throw new Error('Tài khoản lễ tân không hợp lệ.');
  const account = readStore(storage).store.accounts.find(item => item.id === actor.id);
  if (!account?.active || account.version !== actor.version) throw new Error('Tài khoản hoặc quyền truy cập đã thay đổi. Hãy đăng nhập lại.');
  return asActor(account);
}
export function makeStaffSession(actor: AccessActor, now = Date.now()): StaffSession {
  if (actor.role !== 'RECEPTION') throw new Error('Tài khoản lễ tân không hợp lệ.');
  return { version: 1, actorId: actor.id, actorVersion: actor.version, issuedAt: now, expiresAt: now + SESSION_DURATION };
}
export function parseStaffSession(raw: string | null, now = Date.now(), storage = browserStorage()): { session: StaffSession; actor: AccessActor } | null {
  try {
    const session = JSON.parse(raw || 'null') as StaffSession;
    if (session?.version !== 1 || typeof session.actorId !== 'string' || !Number.isSafeInteger(session.actorVersion) || !Number.isSafeInteger(session.issuedAt) || !Number.isSafeInteger(session.expiresAt) || session.issuedAt > now || session.expiresAt <= now || session.expiresAt !== session.issuedAt + SESSION_DURATION) return null;
    const account = readStore(storage).store.accounts.find(item => item.id === session.actorId);
    return account?.active && account.version === session.actorVersion ? { session, actor: asActor(account) } : null;
  } catch { return null; }
}
export async function changeStaffPassword(actor: AccessActor, current: string, next: string, confirmation: string, storage = browserStorage()) {
  passwordRules(next);
  if (next !== confirmation) throw new PasswordChangeError('Mật khẩu xác nhận chưa khớp.', 'confirmation');
  if (next === current) throw new PasswordChangeError('Mật khẩu mới cần khác mật khẩu hiện tại.', 'new');
  freshStaffActor(actor, storage);
  const { raw, store } = readStore(storage), account = store.accounts.find(item => item.id === actor.id)!;
  if (!(await matches(current, account.credential))) throw new PasswordChangeError('Mật khẩu hiện tại chưa đúng.', 'current');
  const credential = await verifier(next);
  const updated = { ...account, credential, version: account.version + 1, updatedAt: new Date().toISOString() };
  writeStore(storage, raw, { version: 1, revision: store.revision + 1, accounts: store.accounts.map(item => item.id === account.id ? updated : item) });
}
export function deleteStaffAccount(id: string, storage = browserStorage()) {
  const { raw, store } = readStore(storage);
  const previous = store.accounts.find(account => account.id === id);
  if (!previous) throw new Error('Tài khoản lễ tân không tồn tại.');
  writeStore(storage, raw, {
    version: 1,
    revision: store.revision + 1,
    accounts: store.accounts.filter(account => account.id !== id),
  });
}
