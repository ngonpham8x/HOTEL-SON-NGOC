import { cloudEnabled, cloudLogin, cloudRequest } from './cloudHotel';
import { verifyLoginPassword, changeLoginPassword, PasswordChangeError } from './authSession';
export { PasswordChangeError } from './authSession';
export function loginSystem(password: string) { return cloudEnabled ? cloudLogin(password) : verifyLoginPassword(password); }
export async function changeSystemPassword(current: string, next: string, confirmation: string) {
  if (!cloudEnabled) return changeLoginPassword(current, next, confirmation);
  try { await cloudRequest('password', { current, next, confirmation }); }
  catch (error) { throw new PasswordChangeError(error instanceof Error ? error.message : 'Không đổi được mật khẩu.'); }
}
