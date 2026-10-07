import React from 'react';
import { useHotel } from '../../context/HotelContext';
import { PlusCircle, CalendarPlus, PhoneCall, Menu, X, Ticket } from 'lucide-react';
import { HotelLogo } from '../common/HotelLogo';
import { useAccess } from '../../context/AccessContext';
import { firstAllowedModule } from '../../utils/permissions';

interface HeaderProps {
  onOpenQuickCheckIn: () => void;
  onOpenQuickBooking: () => void;
  onOpenAddRoom: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenQuickCheckIn,
  onOpenQuickBooking,
  onOpenAddRoom,
}) => {
  const { actor, canView, canAct } = useAccess();
  const homeModule = firstAllowedModule(actor);
  const {
    rooms,
    debts,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    toggleSidebar,
  } = useHotel();

  const occupiedCount = rooms.filter(r => r.status === 'OCCUPIED').length;
  const totalRooms = rooms.length;
  const occupancyPercent = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;
  const activeDebtsCount = debts.filter(d => d.remainingAmount > 0).length;

  return (
    <header className="no-print bg-[#081e24] border-b border-teal-900/60 sticky top-0 z-30 min-h-14 px-2 sm:px-5 gap-2 text-white flex items-center justify-between shadow-md">
      {/* Left: Mobile Menu Toggle & Brand Wordmark */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        {/* Menu Toggle (Mobile & Desktop) */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
              toggleSidebar();
            } else {
              setIsMobileMenuOpen(!isMobileMenuOpen);
            }
          }}
          className="p-1.5 -ml-1 text-teal-300 hover:text-white hover:bg-teal-900/60 rounded-lg transition-colors focus:outline-none cursor-pointer"
          aria-label="Ẩn hiện menu"
          title="Ẩn hiện thanh menu (tăng diện tích màn hình)"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5 text-amber-300" /> : <Menu className="w-5 h-5 text-teal-300" />}
        </button>

        {/* Brand */}
        <button
          onClick={() => {
            if (homeModule) setActiveTab(homeModule);
            setIsMobileMenuOpen(false);
          }}
          className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 text-left group hover:opacity-95 transition-opacity"
          title="Về mục được cấp quyền"
        >
          <HotelLogo size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[11px] sm:text-sm whitespace-nowrap font-extrabold tracking-tight text-white leading-none group-hover:text-teal-300 transition-colors">
                HOTEL SƠN NGỌC
              </h1>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-teal-400"></span>
            </div>
            <div className="text-[9px] sm:text-[11px] text-teal-300 font-semibold mt-0.5 flex items-center gap-1">
              <PhoneCall className="w-2.5 h-2.5 text-teal-400 shrink-0" />
              <span>0392.089.960</span>
              <span className="text-teal-500">·</span>
              <span className="text-teal-200/90">Ms Trinh</span>
            </div>
          </div>
        </button>
      </div>

      {/* Middle: Compact Status Badges (Hidden on very small screens to keep bar thin) */}
      <div className="hidden xl:flex items-center gap-2 text-xs">
        {(canView('rooms') || canView('dashboard')) && <div className="flex items-center gap-1.5 bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-800/60 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          <span>Đang ở: <strong className="text-white font-mono">{occupiedCount}/{totalRooms}</strong> ({occupancyPercent}%)</span>
        </div>}
        {(canView('debt') || canView('analytics')) && activeDebtsCount > 0 && (
          <div className="hidden md:flex items-center gap-1.5 text-amber-300 font-semibold bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Nợ: <strong>{activeDebtsCount}</strong> khách</span>
          </div>
        )}
      </div>

      {/* Right: Actions (Sleek, Compact, Never Wraps) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {canView('sales') && <button
          onClick={() => { setActiveTab('sales'); setIsMobileMenuOpen(false); }}
          title="Bán vé massage / dịch vụ khách ngoài"
          className="px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-amber-100 bg-amber-900/40 hover:bg-amber-800/60 border border-amber-700/60 hover:text-white rounded-lg flex items-center gap-1 transition-colors"
        >
          <Ticket className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Bán vé</span>
        </button>}
        {canAct('booking.create') && <button
          onClick={onOpenQuickBooking}
          title="Đặt phòng trước cho khách"
          className="px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-teal-100 bg-teal-900/40 hover:bg-teal-800/60 border border-teal-700/60 hover:text-white rounded-lg flex items-center gap-1 transition-colors"
        >
          <CalendarPlus className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Đặt phòng</span>
        </button>}

        {canAct('stay.checkin') && <button
          onClick={onOpenQuickCheckIn}
          title="Nhận phòng trực tiếp ngay" aria-label="Nhận phòng"
          className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 rounded-lg flex items-center gap-1 transition-all shadow-xs"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nhận phòng</span>
        </button>}
      </div>
    </header>
  );
};
