import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LoginScreen } from './LoginScreen';
import { CREDENTIAL_KEY, SESSION_KEY, makeLoginSession, parseLoginSession, type LoginSession } from '../../utils/authSession';

function loadSession() {
  try { return parseLoginSession(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export function AuthGate({ children }: { children: (logout: () => void, passwordChanged: () => void) => ReactNode }) {
  const [session, setSession] = useState<LoginSession | null>(loadSession);
  const [notice, setNotice] = useState('');
  const logout = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* The in-memory session is cleared too. */ }
    setSession(null);
  }, []);
  const passwordChanged = useCallback(() => {
    logout();
    setNotice('Đổi mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.');
  }, [logout]);
  const unlock = () => {
    const next = makeLoginSession();
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* Allow this window's session if storage is unavailable. */ }
    setNotice('');
    setSession(next);
  };
  useEffect(() => {
    if (!session) return;
    const checkExpiry = () => {
      try { if (!parseLoginSession(JSON.stringify(session))) logout(); }
      catch { logout(); }
    };
    const credentialChanged = (event: StorageEvent) => {
      if (event.key !== CREDENTIAL_KEY && event.key !== null) return;
      logout();
      setNotice('Mật khẩu đã thay đổi ở cửa sổ khác. Hãy đăng nhập lại.');
    };
    const timer = window.setTimeout(checkExpiry, Math.max(0, session.expiresAt - Date.now()));
    document.addEventListener('visibilitychange', checkExpiry);
    window.addEventListener('pageshow', checkExpiry);
    window.addEventListener('storage', credentialChanged);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', checkExpiry);
      window.removeEventListener('pageshow', checkExpiry);
      window.removeEventListener('storage', credentialChanged);
    };
  }, [session, logout]);
  return session ? children(logout, passwordChanged) : <LoginScreen onSuccess={unlock} notice={notice} />;
}
