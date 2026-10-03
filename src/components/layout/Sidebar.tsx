import React, { lazy, Suspense, useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { useAccess } from '../../context/AccessContext';
import {
  Home,
  LayoutGrid,
  CalendarCheck2,
  Users,
  BadgeAlert,
  BarChart3,
  FileSpreadsheet,
  Coffee,
  PhoneCall,
  X,
  LogOut,
  KeyRound,
  Ticket,
  ShieldCheck,
} from 'lucide-react';
import { HotelLogo } from '../common/HotelLogo';
import { PWAInstallButton } from '../common/PWAInstallButton';

const ChangePasswordDialog = lazy(() => import('../auth/ChangePasswordDialog'));

export const Sidebar: React.FC<{ onLogout: () => void; onPasswordChanged: () => void }> = ({ onLogout, onPasswordChanged }) => {
  const [changingPassword, setChangingPassword] = useState(false);
  const { actor, isAdmin, canView } = useAccess();
  const {
    activeTab,
    setActiveTab,
    rooms,
    reservations,
    stays,
    debts,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  } = useHotel();

  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;
  const pendingReservations = reservations.filter(r => r.status === 'CONFIRMED').length;
  const activeStaysCount = stays.filter(s => s.status === 'ACTIVE').length;
  const unpaidDebts = debts.filter(d => d.remainingAmount > 0).length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Trang chủ',
      icon: Home,
    },
    { id: 'sales', label: 'Bán vé / khách ngoài', icon: Ticket },
    {
      id: 'rooms',
      label: 'Sơ đồ phòng',
      icon: LayoutGrid,
      count: rooms.length,
      badgeColor: 'bg-teal-950 text-teal-300 border border-teal-800',
    },
    {
      id: 'reservations',
      label: 'Đặt phòng',
      icon: CalendarCheck2,
      count: pendingReservations,
      badgeColor: 'bg-amber-950 text-amber-300 border border-amber-800',
    },
    {
      id: 'stays',
      label: 'Khách đang ở',
      icon: Users,
      count: activeStaysCount,
      badgeColor: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
    },
    {
      id: 'debt',
      label: 'Quản lý công nợ',
      icon: BadgeAlert,
      count: unpaidDebts,
      badgeColor: unpaidDebts > 0 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-teal-950 text-teal-400',
    },
    {
      id: 'analytics',
      label: 'Thống kê doanh thu',
      icon: BarChart3,
    },
    {
      id: 'reports',
      label: 'Xuất Excel / PDF',
      icon: FileSpreadsheet,
    },
    {
      id: 'services',
      label: 'Bảng giá & Dịch vụ',
      icon: Coffee,
    },
    { id: 'staff', label: 'Phân quyền lễ tân', icon: ShieldCheck },
  ].filter(item => item.id === 'staff' ? isAdmin : canView(item.id));

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container: Slide drawer on mobile, static sidebar on desktop */}
      <aside
        className={`no-print fixed lg:static top-0 lg:top-auto bottom-0 left-0 z-50 lg:z-auto w-[min(18rem,90vw)] lg:w-64 bg-[#092228] border-r border-teal-900/60 flex flex-col shrink-0 text-teal-100 shadow-2xl lg:shadow-none transition-transform duration-300 ease-in-out h-dvh lg:h-[calc(100dvh-56px)] lg:sticky lg:top-14 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile-only Header inside drawer */}
        <div className="lg:hidden flex items-center justify-between p-3.5 border-b border-teal-900/60 bg-[#071b20]">
          <div className="flex items-center gap-2.5">
            <HotelLogo size="sm" />
            <div>
              <h2 className="text-xs font-bold text-white tracking-tight">Hotel Sơn Ngọc</h2>
              <p className="text-[10px] text-teal-300 font-medium">0392.089.960 (Ms Trinh)</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-teal-300 hover:text-white hover:bg-teal-900/60 transition-colors"
            title="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
          <div className="mx-1 mb-3 flex items-center gap-2 rounded-xl border border-teal-800/60 bg-teal-950/50 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-400" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white" title={actor.displayName}>{actor.displayName}</p>
              <p className="mt-0.5 text-[10px] text-teal-300">{isAdmin ? 'Quản lý hệ thống' : 'Lễ tân'}{!isAdmin && ` · ${actor.username}`}</p>
            </div>
          </div>
          <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-400/80">
            Chức năng nghiệp vụ
          </p>
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-sm font-bold border border-teal-400/40'
                      : 'text-teal-200/90 hover:text-white hover:bg-teal-900/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-teal-400/90'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.badgeColor}`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick summary footer in sidebar */}
        <div className="p-2.5 shrink-0 border-t border-teal-900/60 bg-[#06181d] space-y-2">
          {/* Compact 3-item status row */}
          {(canView('rooms') || canView('dashboard')) && <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div className="bg-teal-950/60 border border-teal-800/60 py-1 px-1 rounded-lg">
              <span className="text-teal-400 block font-medium">Trống</span>
              <span className="font-mono font-bold text-teal-200 text-xs">
                {rooms.filter(r => r.status === 'AVAILABLE').length}
              </span>
            </div>
            <div className="bg-rose-950/40 border border-rose-900/60 py-1 px-1 rounded-lg">
              <span className="text-rose-400 block font-medium">Đang ở</span>
              <span className="font-mono font-bold text-rose-200 text-xs">{occupiedRooms}</span>
            </div>
            <div className="bg-cyan-950/40 border border-cyan-900/60 py-1 px-1 rounded-lg">
              <span className="text-cyan-400 block font-medium">Cần dọn</span>
              <span className="font-mono font-bold text-cyan-200 text-xs">
                {rooms.filter(r => r.status === 'CLEANING').length}
              </span>
            </div>
          </div>}

          {/* PWA Install Button on Mobile/Sidebar */}
          <PWAInstallButton variant="sidebar" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-label="Đổi mật khẩu" onClick={() => { setChangingPassword(true); setIsMobileMenuOpen(false); }} className="min-h-10 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold text-teal-200 hover:bg-teal-900/60 hover:text-white border border-teal-900/70 focus-visible:outline-2 focus-visible:outline-teal-400"><KeyRound className="w-3.5 h-3.5 shrink-0" />Đổi mật khẩu</button>
            <button type="button" aria-label="Đăng xuất" onClick={onLogout} className="min-h-10 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold text-teal-200 hover:bg-teal-900/60 hover:text-white border border-teal-900/70 focus-visible:outline-2 focus-visible:outline-teal-400"><LogOut className="w-3.5 h-3.5 shrink-0" />Đăng xuất</button>
          </div>

          <div className="pt-1.5 border-t border-teal-900/60 text-[10px] space-y-0.5 text-teal-300/80">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-semibold text-teal-200">
                <PhoneCall className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                <span>0392.089.960 (Ms Trinh)</span>
              </span>
              <span className="text-[9px] text-teal-400/60">Lâm Đồng</span>
            </div>
          </div>
        </div>
      </aside>
      {changingPassword && <Suspense fallback={null}><ChangePasswordDialog onClose={() => setChangingPassword(false)} onChanged={onPasswordChanged} /></Suspense>}
    </>
  );
};
