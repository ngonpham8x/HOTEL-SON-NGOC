import { useEffect, useState, type ReactNode } from 'react';
import { cloudRequest, clearCloudSession, hasCloudSession } from '../../utils/cloudHotel';
import { LoginScreen } from './LoginScreen';
export function CloudAuthGate({ children }: { children: (logout: () => void, changed: () => void) => ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(hasCloudSession);
  const [notice, setNotice] = useState('');
  const logout = () => { void cloudRequest('logout').catch(() => {}); clearCloudSession(); setAuthorized(false); };
  useEffect(() => {
    let mounted = true;
    if (hasCloudSession()) cloudRequest('session').then(() => { if (mounted) setAuthorized(true); }).catch(() => { clearCloudSession(); }).finally(() => { if (mounted) setLoading(false); });
    const expired = () => { clearCloudSession(); setAuthorized(false); setNotice('Phiên đăng nhập đã hết hạn hoặc mật khẩu đã thay đổi. Hãy đăng nhập lại.'); };
    window.addEventListener('son-ngoc-cloud-logout', expired);
    return () => { mounted = false; window.removeEventListener('son-ngoc-cloud-logout', expired); };
  }, []);
  if (loading) return <p role="status" className="p-6 text-teal-900">Đang kiểm tra phiên đăng nhập…</p>;
  return authorized ? children(logout, () => { logout(); setNotice('Đổi mật khẩu thành công. Tất cả thiết bị cần đăng nhập lại.'); }) : <LoginScreen notice={notice} onSuccess={() => { setNotice(''); setAuthorized(true); }} />;
}
