import React, { useEffect, useState } from 'react';
import { useAccess } from '../../context/AccessContext';
import { cloudEnabled, cloudRequest } from '../../utils/cloudHotel';
type Alert = { id: string; created_at: string; actor_name: string; device: string };
export function SecurityAlerts() {
  const { isAdmin } = useAccess();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isAdmin || !cloudEnabled) return;
    let active = true;
    const load = async () => {
      try { const rows = await cloudRequest<Alert[]>('security.alerts'); if (active) { setAlerts(rows); setError(''); } }
      catch { if (active) setError('Chưa kiểm tra được cảnh báo đăng nhập. Hệ thống sẽ thử lại.'); }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [isAdmin]);
  if (!isAdmin || !cloudEnabled || (!alerts.length && !error)) return null;
  return <div role="alert" className="fixed top-20 left-3 right-3 sm:left-auto sm:w-96 z-[65] max-h-[60vh] overflow-y-auto rounded-xl border border-amber-400 bg-amber-50 p-4 shadow-xl text-sm text-amber-950">
    <strong>Đăng nhập từ thiết bị mới</strong>
    <p className="mt-1 text-xs">Thiết bị mới chưa chắc là truy cập trái phép. Hãy kiểm tra người đăng nhập; lần đầu dùng trình duyệt này cũng sẽ có cảnh báo.</p>
    {error && <p className="mt-2 text-xs">{error}</p>}
    {alerts.map(alert => <div key={alert.id} className="mt-3 border-t border-amber-200 pt-3">
      <p className="font-semibold">{alert.actor_name}</p>
      <p className="text-xs">{new Date(alert.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
      <p className="mt-1 break-words text-xs">{alert.device}</p>
      <button className="mt-2 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white" onClick={async () => {
        try { setAlerts(await cloudRequest<Alert[]>('security.alerts', { ack: alert.id })); setError(''); }
        catch { setError('Chưa xác nhận được cảnh báo. Vui lòng thử lại.'); }
      }}>Đã kiểm tra</button>
    </div>)}
  </div>;
}
