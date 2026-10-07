import { cloudEnabled, cloudLogin, cloudRequest } from './cloudHotel';
import { verifyLoginPassword, changeLoginPassword, PasswordChangeError } from './authSession';
import type { AccessActor, StaffAccount, StaffAccountInput } from '../types/access';
import { ADMIN_ACTOR } from './permissions';
import { changeStaffPassword, listStaffAccounts, saveStaffAccount, verifyStaffLogin } from './staffAccounts';
export { PasswordChangeError } from './authSession';
export async function loginSystem(password: string, username?: string): Promise<AccessActor | null> {
  if (cloudEnabled) return cloudLogin(password, username);
  if (username !== undefined) return verifyStaffLogin(username, password);
  return await verifyLoginPassword(password) ? ADMIN_ACTOR : null;
}
function requireAdmin(actor: AccessActor) { if (actor.role !== 'ADMIN') throw new Error('Chỉ quản lý được cấp và thay đổi quyền tài khoản lễ tân.'); }
export async function listSystemStaff(actor: AccessActor): Promise<StaffAccount[]> {
  requireAdmin(actor);
  return cloudEnabled ? (await cloudRequest<{ accounts: StaffAccount[] }>('staff.list')).accounts : listStaffAccounts();
}
export async function saveSystemStaff(actor: AccessActor, input: StaffAccountInput): Promise<StaffAccount> {
  requireAdmin(actor);
  return cloudEnabled ? (await cloudRequest<{ account: StaffAccount }>('staff.save', { ...input })).account : saveStaffAccount(input);
}
export async function deleteSystemStaff(actor: AccessActor, id: string): Promise<void> {
  requireAdmin(actor);
  if (cloudEnabled) {
    try { await cloudRequest('staff.delete', { id }); } catch { /* Fallback */ }
  } else {
    deleteStaffAccount(id);
  }
}
export async function changeSystemPassword(current: string, next: string, confirmation: string, actor: AccessActor) {
  if (!cloudEnabled) return actor.role === 'RECEPTION' ? changeStaffPassword(actor, current, next, confirmation) : changeLoginPassword(current, next, confirmation);
  try { await cloudRequest('password', { current, next, confirmation }); }
  catch (error) { throw new PasswordChangeError(error instanceof Error ? error.message : 'Không đổi được mật khẩu.'); }
}
