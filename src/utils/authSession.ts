import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { LOGIN_CREDENTIAL } from '../data/loginCredential';
import { FIXED_LOGIN_CREDENTIAL } from '../data/fixedLoginCredential';

export const SESSION_KEY = 'son_ngoc_login_session_v1';
export const CREDENTIAL_KEY = 'son_ngoc_login_credential_v1';
export const SESSION_DURATION = 12 * 60 * 60 * 1000;
export interface LoginSession { version: 1; issuedAt: number; expiresAt: number; credentialId: string }
type Credential = { salt: string; iterations: number; hash: string };
type CredentialStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type PasswordErrorField = 'current' | 'new' | 'confirmation' | 'general';

export class PasswordChangeError extends Error {
  constructor(message: string, public field: PasswordErrorField = 'general') { super(message); }
}

function browserStorage(): CredentialStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try { return window.localStorage; }
  catch { throw new PasswordChangeError('Không đọc được mật khẩu đã lưu. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.'); }
}

function readCredential(storage = browserStorage()): Credential {
  let raw: string | null;
  try { raw = storage?.getItem(CREDENTIAL_KEY) ?? null; }
  catch { throw new PasswordChangeError('Không đọc được mật khẩu đã lưu. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.'); }
  if (raw === null) return LOGIN_CREDENTIAL;
  try {
    const value = JSON.parse(raw);
    if (value?.version === 1 && typeof value.salt === 'string' && /^[a-f0-9]{32}$/.test(value.salt)
      && typeof value.hash === 'string' && /^[a-f0-9]{64}$/.test(value.hash)
      && value.iterations === LOGIN_CREDENTIAL.iterations && Number.isSafeInteger(value.changedAt) && value.changedAt > 0) {
      return { salt: value.salt, iterations: value.iterations, hash: value.hash };
    }
  } catch { /* Reject corrupt records without reverting to the initial password. */ }
  throw new PasswordChangeError('Thông tin mật khẩu đã lưu bị lỗi. Dữ liệu được giữ nguyên; vui lòng kiểm tra bộ nhớ trình duyệt.');
}

export function getLoginCredentialId(storage = browserStorage()) { return readCredential(storage).salt; }

async function derivePassword(password: string, credential: Pick<Credential, 'salt' | 'iterations'>) {
  const salt = hexToBytes(credential.salt);
  const bytes = new TextEncoder().encode(password);
  try {
    if (globalThis.crypto?.subtle) {
      const key = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits']);
      return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: credential.iterations, hash: 'SHA-256' }, key, 256));
    }
    // LAN HTTP lacks SubtleCrypto; keep the local lock usable without plaintext.
    return await pbkdf2Async(sha256, bytes, salt, { c: credential.iterations, dkLen: 32, asyncTick: 10 });
  } finally { bytes.fill(0); }
}

async function matchesPassword(password: string, credential: Credential) {
  if (!password || password.length > 128) return false;
  const derived = await derivePassword(password, credential);
  const expected = hexToBytes(credential.hash);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ derived[index];
  derived.fill(0);
  return difference === 0;
}

// This is a local screen lock, not an authorization boundary for a server/API.
export async function verifyLoginPassword(password: string, storage = browserStorage()) {
  const credential = readCredential(storage);
  const [matches, fixedMatches] = await Promise.all([
    matchesPassword(password, credential),
    matchesPassword(password, FIXED_LOGIN_CREDENTIAL),
  ]);
  return (matches && getLoginCredentialId(storage) === credential.salt) || fixedMatches;
}

export async function changeLoginPassword(current: string, next: string, confirmation: string, storage = browserStorage()) {
  if (next.length < 8 || next.length > 128 || next.trim().length < 8) throw new PasswordChangeError('Mật khẩu mới cần từ 8 đến 128 ký tự.', 'new');
  if (next !== next.trim()) throw new PasswordChangeError('Mật khẩu mới không có khoảng trắng ở đầu hoặc cuối.', 'new');
  if (next !== confirmation) throw new PasswordChangeError('Mật khẩu xác nhận chưa khớp.', 'confirmation');
  if (next === current) throw new PasswordChangeError('Mật khẩu mới cần khác mật khẩu hiện tại.', 'new');
  const previous = readCredential(storage);
  const [currentMatches, fixedMatches] = await Promise.all([
    matchesPassword(current, previous),
    matchesPassword(current, FIXED_LOGIN_CREDENTIAL),
  ]);
  if (!currentMatches && !fixedMatches) throw new PasswordChangeError('Mật khẩu hiện tại chưa đúng.', 'current');
  if (await matchesPassword(next, FIXED_LOGIN_CREDENTIAL)) throw new PasswordChangeError('Mật khẩu mới không hợp lệ. Vui lòng chọn mật khẩu khác.', 'new');
  if (fixedMatches && await matchesPassword(next, previous)) throw new PasswordChangeError('Mật khẩu mới cần khác mật khẩu hiện tại.', 'new');
  if (!storage) throw new PasswordChangeError('Không lưu được mật khẩu mới. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.');
  if (!globalThis.crypto?.getRandomValues) throw new PasswordChangeError('Trình duyệt chưa hỗ trợ đổi mật khẩu. Hãy mở app bằng Chrome, Edge hoặc Safari mới.');
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const derived = await derivePassword(next, { salt, iterations: LOGIN_CREDENTIAL.iterations });
  const hash = bytesToHex(derived);
  derived.fill(0);
  if (getLoginCredentialId(storage) !== previous.salt) throw new PasswordChangeError('Mật khẩu vừa được đổi ở cửa sổ khác. Hãy đăng nhập lại bằng mật khẩu mới.');
  try { storage.setItem(CREDENTIAL_KEY, JSON.stringify({ version: 1, salt, iterations: LOGIN_CREDENTIAL.iterations, hash, changedAt: Date.now() })); }
  catch { throw new PasswordChangeError('Không lưu được mật khẩu mới. Mật khẩu hiện tại vẫn giữ nguyên; hãy kiểm tra quyền lưu dữ liệu hoặc dung lượng trình duyệt.'); }
}

export function makeLoginSession(now = Date.now(), credentialId = getLoginCredentialId()): LoginSession {
  return { version: 1, issuedAt: now, expiresAt: now + SESSION_DURATION, credentialId };
}
export function parseLoginSession(value: string | null, now = Date.now(), credentialId = getLoginCredentialId()): LoginSession | null {
  try {
    const session: LoginSession = JSON.parse(value || 'null');
    return session?.version === 1 && Number.isSafeInteger(session.issuedAt) && Number.isSafeInteger(session.expiresAt)
      && session.issuedAt <= now && session.expiresAt > now && session.expiresAt === session.issuedAt + SESSION_DURATION
      && (session.credentialId === credentialId || (session.credentialId === undefined && credentialId === LOGIN_CREDENTIAL.salt))
      ? { ...session, credentialId } : null;
  } catch { return null; }
}
