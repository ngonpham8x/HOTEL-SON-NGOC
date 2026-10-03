import { useEffect, useState, type ReactNode } from 'react';
import { cloudRequest, clearCloudSession, hasCloudSession } from '../../utils/cloudHotel';
import { LoginScreen } from './LoginScreen';
import type { AccessActor } from '../../types/access';
import { AccessProvider } from '../../context/AccessContext';
export function CloudAuthGate({ children }: { children: (logout: () => void, changed: () => void) => ReactNode }) {
  const [actor, setActor] = useState<AccessActor | null>(null);
  const [loading, setLoading] = useState(hasCloudSession);
  const [notice, setNotice] = useState('');
  const logout = () => { void cloudRequest('logout').catch(() => {}); clearCloudSession(); setActor(null); };
  useEffect(() => {
    let mounted = true;
    if (hasCloudSession()) cloudRequest<{ actor: AccessActor }>('session').then(session => { if (mounted) setActor(session.actor); }).catch(() => { clearCloudSession(); }).finally(() => { if (mounted) setLoading(false); });
    const expired = () => { clearCloudSession(); setActor(null); setNotice('Phiên đăng nhập đã hết hạn hoặc tài khoản/quyền đã thay đổi. Hãy đăng nhập lại.'); };
    window.addEventListener('son-ngoc-cloud-logout', expired);
    return () => { mounted = false; window.removeEventListener('son-ngoc-cloud-logout', expired); };
  }, []);
  if (loading) return <p role="status" className="p-6 text-teal-900">Đang kiểm tra phiên đăng nhập…</p>;
  return actor ? <AccessProvider actor={actor}>{children(logout, () => { logout(); setNotice('Đổi mật khẩu thành công. Các phiên của tài khoản này cần đăng nhập lại.'); })}</AccessProvider> : <LoginScreen notice={notice} onSuccess={nextActor => { setNotice(''); setActor(nextActor); }} />;
}
