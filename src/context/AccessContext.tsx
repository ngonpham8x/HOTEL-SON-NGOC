import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AccessActor, ActionId, StaffAccount, StaffAccountInput } from '../types/access';
import { canAct as actorCanAct, canView as actorCanView, requireAction as actorRequireAction } from '../utils/permissions';
import { cloudEnabled } from '../utils/cloudHotel';
import { freshStaffActor, parseStaffSession, STAFF_SESSION_KEY } from '../utils/staffAccounts';
import { listSystemStaff, saveSystemStaff } from '../utils/systemAuth';

export interface AccessContextValue {
  actor: AccessActor;
  isAdmin: boolean;
  canView: (module: string) => boolean;
  canAct: (action: ActionId) => boolean;
  requireAction: (action: ActionId) => void;
  listStaffAccounts: () => Promise<StaffAccount[]>;
  saveStaffAccount: (input: StaffAccountInput) => Promise<StaffAccount>;
}
const AccessContext = createContext<AccessContextValue | null>(null);
export function getFreshAccessActor(actor: AccessActor): AccessActor {
  // Server authorization re-reads the real account for every cloud write.
  if (cloudEnabled || actor.role === 'ADMIN') return actor;
  let session;
  try { session = parseStaffSession(sessionStorage.getItem(STAFF_SESSION_KEY)); } catch { /* Fail closed below. */ }
  if (!session || session.actor.id !== actor.id || session.actor.version !== actor.version) throw new Error('Phiên đăng nhập lễ tân đã hết hiệu lực. Hãy đăng nhập lại.');
  return freshStaffActor(actor);
}
export function AccessProvider({ actor, children }: { actor: AccessActor; children: ReactNode }) {
  const value = useMemo<AccessContextValue>(() => ({
    actor,
    isAdmin: actor.role === 'ADMIN',
    canView: module => { try { return actorCanView(getFreshAccessActor(actor), module); } catch { return false; } },
    canAct: action => { try { return actorCanAct(getFreshAccessActor(actor), action); } catch { return false; } },
    requireAction: action => actorRequireAction(getFreshAccessActor(actor), action),
    listStaffAccounts: () => listSystemStaff(getFreshAccessActor(actor)),
    saveStaffAccount: input => saveSystemStaff(getFreshAccessActor(actor), input),
  }), [actor]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}
export function useAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error('useAccess cần được dùng trong AccessProvider.');
  return value;
}
