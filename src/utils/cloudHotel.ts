import type { AccessActor } from '../types/access';
const endpoint = import.meta.env?.VITE_HOTEL_API_URL || '';
export const cloudEnabled = !!endpoint;
export class CloudRequestError extends Error { constructor(message: string, public status: number) { super(message); } }
const TOKEN_KEY = 'son_ngoc_cloud_session_v1';
export function hasCloudSession() { try { return !!sessionStorage.getItem(TOKEN_KEY); } catch { return false; } }
export function clearCloudSession() { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* cleared in gate */ } }
export async function cloudRequest<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let token = ''; try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch { /* login still reports storage failure */ }
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, ...payload }), signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && action !== 'login') { clearCloudSession(); window.dispatchEvent(new Event('son-ngoc-cloud-logout')); }
    throw new CloudRequestError(result.error || 'Không thể kết nối dữ liệu khách sạn.', response.status);
  }
  return result as T;
}
export async function cloudLogin(password: string, username?: string) {
  const session = await cloudRequest<{ token: string; actor: AccessActor }>('login', { password, ...(username !== undefined ? { username } : {}) });
  sessionStorage.setItem(TOKEN_KEY, session.token);
  return session.actor;
}
