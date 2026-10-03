import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LoginScreen } from './LoginScreen';
import { CREDENTIAL_KEY, SESSION_KEY, makeLoginSession, parseLoginSession, type LoginSession } from '../../utils/authSession';
import type { AccessActor } from '../../types/access';
import { ADMIN_ACTOR } from '../../utils/permissions';
import { makeStaffSession, parseStaffSession, STAFF_ACCOUNTS_EVENT, STAFF_ACCOUNTS_KEY, STAFF_SESSION_KEY, type StaffSession } from '../../utils/staffAccounts';
import { AccessProvider } from '../../context/AccessContext';

function loadSession() {
  try {
    const staff = parseStaffSession(sessionStorage.getItem(STAFF_SESSION_KEY));
    if (staff) return { ...staff, role: 'RECEPTION' as const };
    const session = parseLoginSession(sessionStorage.getItem(SESSION_KEY));
    return session ? { session, actor: ADMIN_ACTOR, role: 'ADMIN' as const } : null;
  } catch { return null; }
}
type AuthorizedSession = { session: LoginSession; actor: AccessActor; role: 'ADMIN' } | { session: StaffSession; actor: AccessActor; role: 'RECEPTION' };

export function AuthGate({ children }: { children: (logout: () => void, passwordChanged: () => void) => ReactNode }) {
  const [authorized, setAuthorized] = useState<AuthorizedSession | null>(loadSession);
  const [notice, setNotice] = useState('');
  const logout = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(STAFF_SESSION_KEY); } catch { /* The in-memory session is cleared too. */ }
    setAuthorized(null);
  }, []);
  const passwordChanged = useCallback(() => {
    logout();
    setNotice('Đổi mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.');
  }, [logout]);
  const unlock = (actor: AccessActor) => {
    const next: AuthorizedSession = actor.role === 'ADMIN'
      ? { session: makeLoginSession(), actor: ADMIN_ACTOR, role: 'ADMIN' }
      : { session: makeStaffSession(actor), actor, role: 'RECEPTION' };
    try {
      sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(STAFF_SESSION_KEY);
      sessionStorage.setItem(next.role === 'ADMIN' ? SESSION_KEY : STAFF_SESSION_KEY, JSON.stringify(next.session));
    } catch {
      if (next.role === 'RECEPTION') { setNotice('Không lưu được phiên đăng nhập lễ tân. Hãy cho phép trình duyệt lưu dữ liệu.'); return; }
      // Preserve the existing manager window session when storage is unavailable.
    }
    setNotice('');
    setAuthorized(next);
  };
  useEffect(() => {
    if (!authorized) return;
    const checkExpiry = () => {
      try {
        const valid = authorized.role === 'ADMIN' ? parseLoginSession(JSON.stringify(authorized.session)) : parseStaffSession(JSON.stringify(authorized.session));
        if (!valid) { logout(); setNotice('Phiên đăng nhập hoặc quyền truy cập đã thay đổi. Hãy đăng nhập lại.'); }
      }
      catch { logout(); }
    };
    const credentialChanged = (event: StorageEvent) => {
      if (event.key === null || (authorized.role === 'ADMIN' && event.key === CREDENTIAL_KEY)) {
        logout(); setNotice('Thông tin đăng nhập đã thay đổi ở cửa sổ khác. Hãy đăng nhập lại.');
      } else if (authorized.role === 'RECEPTION' && event.key === STAFF_ACCOUNTS_KEY) checkExpiry();
    };
    const timer = window.setTimeout(checkExpiry, Math.max(0, authorized.session.expiresAt - Date.now()));
    document.addEventListener('visibilitychange', checkExpiry);
    window.addEventListener('pageshow', checkExpiry);
    window.addEventListener('storage', credentialChanged);
    window.addEventListener(STAFF_ACCOUNTS_EVENT, checkExpiry);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', checkExpiry);
      window.removeEventListener('pageshow', checkExpiry);
      window.removeEventListener('storage', credentialChanged);
      window.removeEventListener(STAFF_ACCOUNTS_EVENT, checkExpiry);
    };
  }, [authorized, logout]);
  return authorized ? <AccessProvider actor={authorized.actor}>{children(logout, passwordChanged)}</AccessProvider> : <LoginScreen onSuccess={unlock} notice={notice} />;
}
