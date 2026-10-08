import { localDate, periodKeys, invoiceRevenue, invoiceCollected, sortRooms } from '../../utils/hotelLogic';
import React, { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Room, RoomStatus, Invoice } from '../../types/hotel';
import { formatCurrency, formatDate, getRoomStatusMeta } from '../../utils/formatters';
import {
  Building2,
  PhoneCall,
  DollarSign,
  TrendingUp,
  BedDouble,
  BadgeAlert,
  Users,
  CalendarCheck,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  BarChart3,
  MapPin,
  X,
  Eye,
  Receipt,
  Layers,
  ChevronRight,
  PieChart,
  Calendar,
  Trophy,
  BarChart2,
} from 'lucide-react';
import { HotelLogo } from '../common/HotelLogo';
import { AccessGuard } from '../common/AccessGuard';
import { useAccess } from '../../context/AccessContext';
import { InvoiceListTable } from '../invoices/InvoiceListTable';

interface HomeDashboardProps {
  onSelectRoom: (room: Room) => void;
  onCheckInRoom: (room: Room) => void;
  onCheckOutRoom: (room: Room) => void;
  onBookRoom: (room: Room) => void;
  onOpenQuickCheckIn: () => void;
  onOpenQuickBooking: () => void;
  onOpenAddRoom: () => void;
  onEditRoom: (room: Room) => void;
}

type DetailModalType =
  | 'TODAY_REVENUE'
  | 'WEEK_REVENUE'
  | 'MONTH_REVENUE'
  | 'YEAR_REVENUE'
  | 'MASSAGE_REVENUE'
  | 'ROOM_OCCUPANCY'
  | 'DEBT_LIST'
  | null;

type PeriodScope = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onSelectRoom,
  onCheckInRoom,
  onCheckOutRoom,
  onBookRoom,
}) => {
  const { canView, canAct } = useAccess();
  const { rooms, stays, reservations, invoices, debts, setActiveTab, services, today } = useHotel();
  const keys = periodKeys(today);
  const thisMonthLabel = keys.thisMonth.split('-').reverse().join('/');
  const lastMonthLabel = keys.lastMonth.split('-').reverse().join('/');
  const [roomFilter, setRoomFilter] = useState<RoomStatus | 'ALL'>('ALL');
  const [detailModal, setDetailModal] = useState<DetailModalType>(null);
  const [splitPeriod, setSplitPeriod] = useState<PeriodScope>('DAY');

  // Today's invoice statistics.
  const todayStr = today;
  const todayInvoices = useMemo(() => invoices.filter(i => i.date === todayStr), [invoices, today]);
  const todayRevenue = useMemo(() => todayInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0), [todayInvoices]);
  const todayPaid = useMemo(() => todayInvoices.reduce((sum, i) => sum + invoiceCollected(i), 0), [todayInvoices]);
  const todayDebt = useMemo(() => todayInvoices.reduce((sum, i) => sum + i.debtAmount, 0), [todayInvoices]);
  const todayRoomRev = useMemo(() => todayInvoices.reduce((sum, i) => sum + i.roomCharge, 0), [todayInvoices]);
  const todayMassageRev = useMemo(() => todayInvoices.reduce((sum, i) => sum + (i.massageCharge || 0), 0), [todayInvoices]);

  // 2. Tuần này (This Week: Thứ 2 -> Chủ Nhật)
  const weekRange = useMemo(() => {
    const d = new Date(`${today}T12:00:00+07:00`);
    const day = d.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return {
      start: localDate(mon),
      end: localDate(sun),
      label: `${mon.getDate()}/${mon.getMonth() + 1} - ${sun.getDate()}/${sun.getMonth() + 1}`,
    };
  }, [today]);

  const thisWeekInvoices = useMemo(
    () => invoices.filter(i => i.date >= weekRange.start && i.date <= weekRange.end),
    [invoices, weekRange]
  );
  const thisWeekRev = useMemo(() => thisWeekInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0), [thisWeekInvoices]);
  const thisWeekRoomRev = useMemo(() => thisWeekInvoices.reduce((sum, i) => sum + i.roomCharge, 0), [thisWeekInvoices]);
  const thisWeekMassageRev = useMemo(() => thisWeekInvoices.reduce((sum, i) => sum + (i.massageCharge || 0), 0), [thisWeekInvoices]);
  const thisWeekPaid = useMemo(() => thisWeekInvoices.reduce((sum, i) => sum + invoiceCollected(i), 0), [thisWeekInvoices]);
  const thisWeekDebt = useMemo(() => thisWeekInvoices.reduce((sum, i) => sum + i.debtAmount, 0), [thisWeekInvoices]);

  // 3. Current and previous calendar months.
  const thisMonthInvoices = useMemo(() => invoices.filter(i => i.date.startsWith(keys.thisMonth)), [invoices, today]);
  const lastMonthInvoices = useMemo(() => invoices.filter(i => i.date.startsWith(keys.lastMonth)), [invoices, today]);

  const thisMonthRev = useMemo(() => thisMonthInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0), [thisMonthInvoices]);
  const thisMonthRoomRev = useMemo(() => thisMonthInvoices.reduce((sum, i) => sum + i.roomCharge, 0), [thisMonthInvoices]);
  const thisMonthMassageRev = useMemo(() => thisMonthInvoices.reduce((sum, i) => sum + (i.massageCharge || 0), 0), [thisMonthInvoices]);
  const lastMonthRev = useMemo(() => lastMonthInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0), [lastMonthInvoices]);

  const thisMonthPaid = useMemo(() => thisMonthInvoices.reduce((sum, i) => sum + invoiceCollected(i), 0), [thisMonthInvoices]);
  const thisMonthDebt = useMemo(() => thisMonthInvoices.reduce((sum, i) => sum + i.debtAmount, 0), [thisMonthInvoices]);

  // 4. Năm nay & Năm trước (This Year & Last Year)
  const thisYear = today.slice(0, 4);
  const lastYear = String(Number(thisYear) - 1);
  const thisYearInvoices = useMemo(
    () => invoices.filter(i => i.date.startsWith(thisYear)),
    [invoices, thisYear]
  );
  const lastYearInvoices = useMemo(
    () => invoices.filter(i => i.date.startsWith(lastYear)),
    [invoices, lastYear]
  );
  const thisYearRev = useMemo(() => thisYearInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0), [thisYearInvoices]);
  const thisYearRoomRev = useMemo(() => thisYearInvoices.reduce((sum, i) => sum + i.roomCharge, 0), [thisYearInvoices]);
  const thisYearMassageRev = useMemo(() => thisYearInvoices.reduce((sum, i) => sum + (i.massageCharge || 0), 0), [thisYearInvoices]);
  const thisYearPaid = useMemo(() => thisYearInvoices.reduce((sum, i) => sum + invoiceCollected(i), 0), [thisYearInvoices]);
  const thisYearDebt = useMemo(() => thisYearInvoices.reduce((sum, i) => sum + i.debtAmount, 0), [thisYearInvoices]);
  const lastYearRev = useMemo(() => lastYearInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0), [lastYearInvoices]);

  // Thống kê bóc tách theo chu kỳ chọn (splitPeriod)
  const splitStats = useMemo(() => {
    let invs = todayInvoices;
    let label = `Hôm nay (${formatDate(today).slice(0, 5)})`;
    if (splitPeriod === 'WEEK') {
      invs = thisWeekInvoices;
      label = `Tuần này (${weekRange.label})`;
    } else if (splitPeriod === 'MONTH') {
      invs = thisMonthInvoices;
      label = `Tháng này (${thisMonthLabel})`;
    } else if (splitPeriod === 'YEAR') {
      invs = thisYearInvoices;
      label = `Năm nay (${thisYear})`;
    }
    const roomRev = invs.reduce((sum, i) => sum + i.roomCharge, 0);
    const massageRev = invs.reduce((sum, i) => sum + (i.massageCharge || 0), 0);
    const total = invs.reduce((sum, i) => sum + invoiceRevenue(i), 0);
    const collected = invs.reduce((sum, i) => sum + invoiceCollected(i), 0);
    const debt = invs.reduce((sum, i) => sum + i.debtAmount, 0);
    return {
      label,
      invoices: invs,
      roomRev,
      massageRev,
      total,
      collected,
      debt,
      count: invs.length,
    };
  }, [splitPeriod, todayInvoices, thisWeekInvoices, thisMonthInvoices, thisYearInvoices, today, weekRange, thisMonthLabel, thisYear]);

  // Debts
  const totalRemainingDebt = useMemo(() => debts.reduce((sum, d) => sum + d.remainingAmount, 0), [debts]);
  const activeDebtorsCount = useMemo(() => debts.filter(d => d.remainingAmount > 0).length, [debts]);

  // Room Stats (Total 15 rooms: N01 - N15 on 2 floors)
  const totalRooms = rooms.length;
  const occupiedRooms = useMemo(() => rooms.filter(r => r.status === 'OCCUPIED'), [rooms]);
  const availableRooms = useMemo(() => rooms.filter(r => r.status === 'AVAILABLE'), [rooms]);
  const reservedRooms = useMemo(() => rooms.filter(r => r.status === 'RESERVED'), [rooms]);
  const cleaningRooms = useMemo(() => rooms.filter(r => r.status === 'CLEANING'), [rooms]);
  const maintenanceRooms = useMemo(() => rooms.filter(r => r.status === 'MAINTENANCE'), [rooms]);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms.length / totalRooms) * 100) : 0;

  // Filtered rooms for the live matrix
  const displayedRooms = useMemo(() => {
    if (roomFilter === 'ALL') return sortRooms(rooms);
    return sortRooms(rooms.filter(r => r.status === roomFilter));
  }, [rooms, roomFilter]);

  // Detailed Massage Tickets Analytics (Từng loại vé massage thư giãn)
  const massageTicketStats = useMemo(() => {
    const list = [
      { id: 'srv-m1', name: 'Vé Massage Toàn Thân Thư Giãn (60p)', price: 250000, count: 0, total: 0 },
      { id: 'srv-m2', name: 'Vé Massage Đá Nóng Trị Liệu (90p)', price: 350000, count: 0, total: 0 },
      { id: 'srv-m3', name: 'Vé Massage Cổ Vai Gáy Chuyên Sâu (45p)', price: 200000, count: 0, total: 0 },
      { id: 'srv-m4', name: 'Vé Massage Chân & Ngâm Thảo Dược (45p)', price: 150000, count: 0, total: 0 },
      { id: 'srv-m5', name: 'Vé Combo Massage & Xông Hơi VIP (100p)', price: 450000, count: 0, total: 0 },
    ];

    // Count from invoices
    thisMonthInvoices.forEach(inv => {
      (inv.services || []).forEach(s => {
        const item = list.find(l => l.name === s.name || l.id === s.serviceId);
        if (item) {
          item.count += s.quantity;
          item.total += s.totalPrice;
        } else if (s.name.toLowerCase().includes('massage')) {
          list[0].count += s.quantity;
          list[0].total += s.totalPrice;
        }
      });
    });

    // Count from current active stays
    stays.filter(st => st.status === 'ACTIVE').forEach(st => {
      (st.services || []).forEach(s => {
        const item = list.find(l => l.name === s.name || l.id === s.serviceId);
        if (item) {
          item.count += s.quantity;
          item.total += s.totalPrice;
        } else if (s.name.toLowerCase().includes('massage')) {
          list[0].count += s.quantity;
          list[0].total += s.totalPrice;
        }
      });
    });

    return list;
  }, [thisMonthInvoices, stays]);

  const totalMassageTicketsCount = massageTicketStats.reduce((sum, item) => sum + item.count, 0);

  // 7-day mini chart
  const recent7Days = useMemo(() => {
    const list: { label: string; date: string; revenue: number; roomRev: number; massageRev: number }[] = [];
    const base = new Date(`${today}T12:00:00+07:00`);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const dStr = localDate(d);
      const dayInvs = invoices.filter(inv => inv.date === dStr);
      const rev = dayInvs.reduce((s, inv) => s + invoiceRevenue(inv), 0);
      const roomRev = dayInvs.reduce((s, inv) => s + inv.roomCharge, 0);
      const massageRev = dayInvs.reduce((s, inv) => s + (inv.massageCharge || 0), 0);
      list.push({
        date: dStr,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: rev,
        roomRev,
        massageRev,
      });
    }
    return list;
  }, [invoices, today]);

  const max7Day = Math.max(...recent7Days.map(d => d.revenue), 2000000);

  return (
    <div className="space-y-5">
      {/* 1. Header Banner with Hotel Identity, Address & Live Status */}
      <div className="bg-white/95 backdrop-blur-xs border border-teal-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        {/* Top: Brand & Live Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <HotelLogo size="md" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                HOTEL SƠN NGỌC
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                Trung tâm quản lý khách sạn &amp; Dịch vụ thư giãn
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Trực tiếp</span>
          </div>
        </div>

        {/* Middle: Location & Hotline */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50/90 rounded-xl border border-slate-200/80 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="truncate">Số 70 Quốc lộ 20, xã Hòa Ninh, Lâm Đồng</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 shrink-0">
            <PhoneCall className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>Hotline: <strong className="text-teal-900 font-bold">0392.089.960</strong> (Ms Trinh)</span>
          </div>
        </div>

        {/* Bottom: Quick Status Badges in an evenly distributed grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-teal-50/70 border border-teal-200/80 px-3 py-2 rounded-xl text-teal-900 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <div className="leading-tight min-w-0">
              <span className="text-[10px] text-teal-700 block font-semibold">Thời gian</span>
              <span className="font-bold text-[11px] truncate block">{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${today}T12:00:00+07:00`))}</span>
            </div>
          </div>

          <div className="bg-teal-50/70 border border-teal-200/80 px-3 py-2 rounded-xl text-teal-900 flex items-center gap-2">
            <BedDouble className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <div className="leading-tight min-w-0">
              <span className="text-[10px] text-teal-700 block font-semibold">Quy mô</span>
              <span className="font-bold text-[11px] truncate block">{totalRooms} phòng ({new Set(rooms.map(r => r.floor)).size} tầng)</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-emerald-50/70 border border-emerald-200/80 px-3 py-2 rounded-xl text-emerald-950 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
            <div className="leading-tight min-w-0">
              <span className="text-[10px] text-emerald-700 block font-semibold">Tỷ lệ lấp đầy</span>
              <span className="font-bold text-[11px] truncate block">{occupiedRooms.length}/{totalRooms} phòng ({occupancyRate}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Interactive Metric Cards (Click any card to view drill-down details) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Thống Kê Doanh Thu: Ngày · Tuần · Tháng · Năm
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Bấm vào từng thẻ để xem danh sách phiếu thu chi tiết
          </span>
        </div>

        {/* 4 Revenue Cards for Day, Week, Month, Year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Doanh thu hôm nay */}
        <div
          onClick={() => setDetailModal('TODAY_REVENUE')}
          className="bg-white p-3.5 rounded-xl border border-teal-200/90 shadow-2xs hover:shadow-md hover:border-teal-500 transition-all cursor-pointer group"
          title="Bấm để xem danh sách phiếu thu và nguồn thu hôm nay"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700">Doanh thu hôm nay ({formatDate(today).slice(0, 5)})</span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">
            {formatCurrency(todayRevenue)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Phòng: <strong className="text-slate-800 font-mono">{formatCurrency(todayRoomRev)}</strong></span>
            <span>Massage: <strong className="text-teal-700 font-mono">{formatCurrency(todayMassageRev)}</strong></span>
          </div>
        </div>

        {/* Card: Doanh thu Tuần này */}
        <div
          onClick={() => setDetailModal('WEEK_REVENUE')}
          className="bg-white p-3.5 rounded-xl border border-teal-200/90 shadow-2xs hover:shadow-md hover:border-teal-500 transition-all cursor-pointer group"
          title="Bấm để xem danh sách phiếu thu tuần này"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Tuần này ({weekRange.label})</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
          </div>
          <p className="text-xl font-bold font-mono text-blue-900 mt-1">
            {formatCurrency(thisWeekRev)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Phòng: <strong className="text-slate-800 font-mono">{formatCurrency(thisWeekRoomRev)}</strong></span>
            <span>Massage: <strong className="text-teal-700 font-mono">{formatCurrency(thisWeekMassageRev)}</strong></span>
          </div>
        </div>

        {/* Card 2: Doanh thu tháng này */}
        <div
          onClick={() => setDetailModal('MONTH_REVENUE')}
          className="bg-white p-3.5 rounded-xl border border-teal-200/90 shadow-2xs hover:shadow-md hover:border-teal-500 transition-all cursor-pointer group"
          title="Bấm để xem doanh thu tháng này và so sánh với tháng trước"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700">Doanh thu tháng này</span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
          </div>
          <p className="text-xl font-bold font-mono text-teal-800 mt-1">
            {formatCurrency(thisMonthRev)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Tháng trước: <strong className="text-slate-700 font-mono">{formatCurrency(lastMonthRev)}</strong></span>
          </div>
        </div>

        {/* Card: Doanh thu Cả Năm */}
        <div
          onClick={() => setDetailModal('YEAR_REVENUE')}
          className="bg-white p-3.5 rounded-xl border border-teal-200/90 shadow-2xs hover:shadow-md hover:border-teal-500 transition-all cursor-pointer group"
          title="Bấm để xem doanh thu cả năm"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>Cả năm ({thisYear})</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-900 mt-1">
            {formatCurrency(thisYearRev)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Năm trước: <strong className="text-slate-700 font-mono">{formatCurrency(lastYearRev)}</strong></span>
          </div>
        </div>

      </div>

      {/* 3 Thẻ Vận Hành & Khách Nợ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card: Doanh thu Vé Massage Thư Giãn (Doanh thu riêng biệt) */}
        <div
          onClick={() => setDetailModal('MASSAGE_REVENUE')}
          className="bg-gradient-to-br from-teal-50 to-cyan-50/70 p-3.5 rounded-xl border border-teal-300 shadow-2xs hover:shadow-md hover:border-teal-600 transition-all cursor-pointer group"
          title="Bấm để xem thống kê từng loại vé Massage đã bán"
        >
          <div className="flex items-center justify-between text-teal-900 text-xs">
            <span className="font-bold flex items-center gap-1">
              <span>🌸 Vé Massage Thư Giãn</span>
            </span>
            <ChevronRight className="w-4 h-4 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-xl font-bold font-mono text-teal-900 mt-1">
            {formatCurrency(thisMonthMassageRev)}
          </p>
          <div className="mt-2 pt-2 border-t border-teal-200/60 flex items-center justify-between text-[11px] text-teal-800">
            <span>Hôm nay: <strong className="font-mono">{formatCurrency(todayMassageRev)}</strong></span>
            <span>Đã bán: <strong className="font-mono">{totalMassageTicketsCount} vé</strong></span>
          </div>
        </div>

        {/* Card 4: Công suất phòng (15 phòng) */}
        <div
          onClick={() => setDetailModal('ROOM_OCCUPANCY')}
          className="bg-white p-3.5 rounded-xl border border-teal-200/90 shadow-2xs hover:shadow-md hover:border-purple-500 transition-all cursor-pointer group"
          title="Bấm để xem sơ đồ hiện trạng 15 phòng (Tầng 1 & Tầng 2)"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700">Công suất phòng</span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-xl font-bold font-mono text-purple-900">
              {occupancyRate}%
            </p>
            <span className="text-xs text-slate-500">
              ({occupiedRooms.length}/{totalRooms} phòng)
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Trống sẵn sàng: <strong className="text-emerald-700">{availableRooms.length} phòng</strong></span>
          </div>
        </div>

        {/* Card 5: Tiền khách nợ */}
        <AccessGuard view="debt"><div
          onClick={() => setDetailModal('DEBT_LIST')}
          className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs hover:shadow-md hover:border-rose-500 transition-all cursor-pointer group"
          title="Bấm để xem danh sách khách nợ và xử lý thu tiền nợ"
        >
          <div className="flex items-center justify-between text-rose-700 text-xs">
            <span className="font-semibold">Tiền khách nợ cần thu</span>
            <ChevronRight className="w-4 h-4 text-rose-400 group-hover:text-rose-600 transition-colors" />
          </div>
          <p className="text-xl font-bold font-mono text-rose-800 mt-1">
            {formatCurrency(totalRemainingDebt)}
          </p>
          <div className="mt-2 pt-2 border-t border-rose-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Khách nợ: <strong className="text-rose-700">{activeDebtorsCount} đoàn</strong></span>
          </div>
        </div></AccessGuard>
      </div>
      </div>

      {/* 3. Doanh Thu Riêng Biệt 2 Loại Dịch Vụ: Tiền Phòng vs Vé Massage Thư Giãn */}
      <div className="bg-white rounded-2xl border border-teal-200/90 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-teal-600" />
              <span>Thống Kê Nguồn Thu Riêng Biệt: Tiền Phòng & Vé Massage</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Đang xem thống kê chu kỳ: <strong className="text-teal-900 font-bold">{splitStats.label}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setSplitPeriod('DAY')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  splitPeriod === 'DAY'
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => setSplitPeriod('WEEK')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  splitPeriod === 'WEEK'
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tuần này
              </button>
              <button
                type="button"
                onClick={() => setSplitPeriod('MONTH')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  splitPeriod === 'MONTH'
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tháng này
              </button>
              <button
                type="button"
                onClick={() => setSplitPeriod('YEAR')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  splitPeriod === 'YEAR'
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cả năm
              </button>
            </div>
            <button
            onClick={() => setDetailModal('MASSAGE_REVENUE')}
            className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 self-start sm:self-center bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 transition-colors"
          >
            <span>Vé Massage theo loại</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Cột 1: Doanh thu Tiền Phòng (Lưu Trú) */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-blue-600" />
                <span>1. Doanh thu Tiền Phòng (Lưu trú {totalRooms} phòng)</span>
              </span>
              <span className="text-[11px] font-mono text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">
                Tầng 1 & Tầng 2
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Tiền phòng ({splitStats.label})</span>
                <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
                  {formatCurrency(splitStats.roomRev)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Tiền phòng tháng này</span>
                <span className="text-base font-bold font-mono text-blue-800 mt-0.5 block">
                  {formatCurrency(thisMonthRoomRev)}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
              <span>Đang phục vụ: <strong>{occupiedRooms.length}/{totalRooms} phòng</strong></span>
              <span>Đặt trước: <strong>{reservedRooms.length} phòng</strong></span>
            </div>
          </div>

          {/* Cột 2: Doanh thu Vé Massage Thư Giãn (5 Loại Vé) */}
          <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-950 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>2. Doanh thu Vé Massage Thư Giãn</span>
              </span>
              <span className="text-[11px] font-mono text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded">
                5 Loại Vé
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-teal-200">
                <span className="text-[11px] text-slate-500 block">Vé Massage ({splitStats.label})</span>
                <span className="text-base font-bold font-mono text-teal-900 mt-0.5 block">
                  {formatCurrency(splitStats.massageRev)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-teal-200">
                <span className="text-[11px] text-slate-500 block">Vé Massage tháng này</span>
                <span className="text-base font-bold font-mono text-teal-800 mt-0.5 block">
                  {formatCurrency(thisMonthMassageRev)}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-teal-900 flex items-center justify-between pt-1">
              <span>Tổng số vé đã bán: <strong>{totalMassageTicketsCount} vé</strong></span>
              <button
                onClick={() => setDetailModal('MASSAGE_REVENUE')}
                className="text-teal-700 font-bold hover:underline"
              >
                Xem từng loại vé →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Main Split: Left = Revenue Chart, Right = Live 15 Rooms Grid (2 Floors) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2 Cols): Revenue 7 Days Chart */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white p-5 rounded-xl border border-teal-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  <span>Biểu Đồ Doanh Thu 7 Ngày Gần Nhất</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
              Doanh thu HOTEL SƠN NGỌC theo ngày (gồm tiền phòng và dịch vụ)
                </p>
              </div>
              <AccessGuard view="analytics"><button
                onClick={() => setActiveTab('analytics')}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                <span>Xem tháng</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button></AccessGuard>
            </div>

            {/* 7-day Bar Chart */}
            <div className="pt-4 pb-2">
              <div className="h-44 flex items-end justify-between gap-3 px-2 border-b border-slate-200">
                {recent7Days.map((item, idx) => {
                  const heightPercent = max7Day > 0 ? Math.max(12, Math.round((item.revenue / max7Day) * 100)) : 10;
                  const isToday = item.date === todayStr;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 text-white text-[10px] font-mono py-1 px-2 rounded shadow-md pointer-events-none whitespace-nowrap z-10">
                        {item.label}: {formatCurrency(item.revenue)}
                      </div>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[42px] rounded-t-lg transition-all ${
                          isToday
                            ? 'bg-gradient-to-t from-teal-600 to-cyan-500 shadow-sm'
                            : 'bg-slate-200 group-hover:bg-teal-300'
                        }`}
                      ></div>
                      <span className={`text-[11px] font-mono ${isToday ? 'font-bold text-teal-900 underline' : 'text-slate-500'}`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 15 Rooms Status Matrix (Tầng 1: N01-N07, Tầng 2: N08-N15) */}
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-teal-200/80 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-teal-600" />
                  <span>Sơ đồ {totalRooms} phòng</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {Array.from(new Set(rooms.map(r => r.floor))).sort((a,b) => a-b).map(floor => `Tầng ${floor}`).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => setDetailModal('ROOM_OCCUPANCY')}
                className="text-xs font-bold text-teal-700 hover:text-teal-900"
              >
                Xem →
              </button>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 flex-wrap text-xs">
              <button
                onClick={() => setRoomFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  roomFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({totalRooms})
              </button>
              <button
                onClick={() => setRoomFilter('OCCUPIED')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  roomFilter === 'OCCUPIED' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Đang ở ({occupiedRooms.length})
              </button>
              <button
                onClick={() => setRoomFilter('AVAILABLE')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  roomFilter === 'AVAILABLE' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Trống ({availableRooms.length})
              </button>
            </div>

            {/* Matrix of 15 Rooms */}
            <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
              {displayedRooms.map(room => {
                const isOccupied = room.status === 'OCCUPIED';
                const isAvailable = room.status === 'AVAILABLE';
                const isReserved = room.status === 'RESERVED';
                const isCleaning = room.status === 'CLEANING';

                return (
                  <button
                    key={room.id}
                    onClick={() => {
                      if (isOccupied) onSelectRoom(room);
                      else if (isAvailable && canAct('stay.checkin')) onCheckInRoom(room);
                      else onSelectRoom(room);
                    }}
                    title={`Phòng ${room.number} (Tầng ${room.floor}) - ${room.typeName}`}
                    className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center ${
                      isOccupied
                        ? 'border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100'
                        : isAvailable
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                        : isReserved
                        ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                        : isCleaning
                        ? 'border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100'
                        : 'border-slate-200 bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="font-mono font-extrabold text-xs block">
                      {room.number}
                    </span>
                    <span className="text-[9px] truncate w-full block mt-0.5 opacity-80">
                      T{room.floor} · {isOccupied ? 'Có khách' : isAvailable ? 'Trống' : isReserved ? 'Đã đặt' : 'Cần dọn'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              {canAct('stay.checkin') ? 'Bấm vào số phòng để xem hoặc thao tác phòng' : 'Bấm vào số phòng để xem thông tin'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. INTERACTIVE DETAIL DRILL-DOWN MODALS                   */}
      {/* ========================================================= */}
      {detailModal !== null && (detailModal !== 'DEBT_LIST' || canView('debt')) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-teal-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-teal-900 to-slate-900 text-white">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  {detailModal === 'TODAY_REVENUE' && `💵 Doanh thu hôm nay (${formatDate(today)})`}
                  {detailModal === 'WEEK_REVENUE' && `📊 Doanh thu tuần này (${weekRange.label})`}
                  {detailModal === 'MONTH_REVENUE' && `📈 Doanh thu tháng ${thisMonthLabel}`}
                  {detailModal === 'YEAR_REVENUE' && `🏆 Doanh thu cả năm ${thisYear}`}
                  {detailModal === 'MASSAGE_REVENUE' && '🌸 Doanh Thu Từng Loại Vé Massage Thư Giãn'}
                  {detailModal === 'ROOM_OCCUPANCY' && `🛏️ Hiện trạng ${totalRooms} phòng khách sạn`}
                  {detailModal === 'DEBT_LIST' && '⚠️ Danh Sách Khách Hàng Còn Nợ'}
                </h3>
                <p className="text-xs text-teal-200 mt-0.5">
                  HOTEL SƠN NGỌC · Số 70 Quốc lộ 20, xã Hòa Ninh, Lâm Đồng
                </p>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* MODAL 1: TODAY REVENUE */}
              {detailModal === 'TODAY_REVENUE' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Tổng doanh thu</span>
                      <strong className="text-base font-mono text-slate-900 block mt-0.5">{formatCurrency(todayRevenue)}</strong>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-700 block">Đã thu cho phiếu thu (gồm cọc)</span>
                      <strong className="text-base font-mono text-emerald-800 block mt-0.5">{formatCurrency(todayPaid)}</strong>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <span className="text-[11px] text-blue-700 block">Doanh thu Tiền Phòng</span>
                      <strong className="text-base font-mono text-blue-800 block mt-0.5">{formatCurrency(todayRoomRev)}</strong>
                    </div>
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                      <span className="text-[11px] text-teal-700 block">Vé Massage Thư Giãn</span>
                      <strong className="text-base font-mono text-teal-800 block mt-0.5">{formatCurrency(todayMassageRev)}</strong>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm pt-2">Danh sách phiếu thu trong ngày hôm nay ({todayInvoices.length} phiếu):</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <InvoiceListTable
                      invoices={todayInvoices}
                      emptyMessage="Chưa có phiếu thu nào hôm nay"
                      showDateColumn={false}
                    />
                  </div>
                </div>
              )}

              {/* MODAL: WEEK REVENUE */}
              {detailModal === 'WEEK_REVENUE' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Doanh thu tuần ({weekRange.label})</span>
                      <strong className="text-base font-mono text-blue-900 block mt-0.5">{formatCurrency(thisWeekRev)}</strong>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-700 block">Đã thu tuần này</span>
                      <strong className="text-base font-mono text-emerald-800 block mt-0.5">{formatCurrency(thisWeekPaid)}</strong>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <span className="text-[11px] text-blue-700 block">Doanh thu Tiền Phòng</span>
                      <strong className="text-base font-mono text-blue-800 block mt-0.5">{formatCurrency(thisWeekRoomRev)}</strong>
                    </div>
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                      <span className="text-[11px] text-teal-700 block">Vé Massage Thư Giãn</span>
                      <strong className="text-base font-mono text-teal-800 block mt-0.5">{formatCurrency(thisWeekMassageRev)}</strong>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm pt-2">Danh sách phiếu thu trong tuần này ({thisWeekInvoices.length} phiếu):</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <InvoiceListTable
                      invoices={thisWeekInvoices}
                      emptyMessage="Chưa có phiếu thu nào trong tuần này"
                      showDateColumn={true}
                    />
                  </div>
                </div>
              )}

              {/* MODAL 2: MONTH REVENUE */}
              {detailModal === 'MONTH_REVENUE' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-teal-50 rounded-xl border border-teal-200">
                      <span className="text-[11px] text-teal-700 block">Tổng doanh thu tháng này</span>
                      <strong className="text-xl font-mono text-teal-900 block mt-0.5">{formatCurrency(thisMonthRev)}</strong>
                      <span className="text-[10px] text-slate-500 mt-1 block">Từ {formatDate(`${keys.thisMonth}-01`)} đến nay</span>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-600 block">Doanh thu Tiền Phòng ({thisMonthLabel})</span>
                      <strong className="text-xl font-mono text-blue-800 block mt-0.5">{formatCurrency(thisMonthRoomRev)}</strong>
                      <span className="text-[10px] text-slate-500 mt-1 block">Dịch vụ lưu trú {totalRooms} phòng</span>
                    </div>
                    <div className="p-3.5 bg-cyan-50 rounded-xl border border-cyan-200">
                      <span className="text-[11px] text-cyan-800 block">Doanh thu Vé Massage ({thisMonthLabel})</span>
                      <strong className="text-xl font-mono text-teal-800 block mt-0.5">{formatCurrency(thisMonthMassageRev)}</strong>
                      <span className="text-[10px] text-slate-500 mt-1 block">5 loại vé massage thư giãn</span>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm pt-2">So sánh với Tháng trước ({lastMonthLabel}):</h4>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <span>Tổng doanh thu tháng trước: <strong className="font-mono text-slate-800">{formatCurrency(lastMonthRev)}</strong></span>
                    <AccessGuard view="analytics"><button
                      onClick={() => {
                        setDetailModal(null);
                        setActiveTab('analytics');
                      }}
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg transition-colors"
                    >
                      Mở báo cáo thống kê đầy đủ →
                    </button></AccessGuard>
                  </div>
                </div>
              )}

              {/* MODAL: YEAR REVENUE */}
              {detailModal === 'YEAR_REVENUE' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-[11px] text-amber-800 block">Tổng doanh thu cả năm {thisYear}</span>
                      <strong className="text-base font-mono text-amber-950 block mt-0.5">{formatCurrency(thisYearRev)}</strong>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-700 block">Đã thu cho phiếu thu</span>
                      <strong className="text-base font-mono text-emerald-800 block mt-0.5">{formatCurrency(thisYearPaid)}</strong>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <span className="text-[11px] text-blue-700 block">Doanh thu Tiền Phòng</span>
                      <strong className="text-base font-mono text-blue-800 block mt-0.5">{formatCurrency(thisYearRoomRev)}</strong>
                    </div>
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                      <span className="text-[11px] text-teal-700 block">Vé Massage Thư Giãn</span>
                      <strong className="text-base font-mono text-teal-800 block mt-0.5">{formatCurrency(thisYearMassageRev)}</strong>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <span>So sánh năm trước ({lastYear}): <strong className="font-mono text-slate-800">{formatCurrency(lastYearRev)}</strong></span>
                    <AccessGuard view="analytics"><button
                      onClick={() => {
                        setDetailModal(null);
                        setActiveTab('analytics');
                      }}
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg transition-colors"
                    >
                      Mở báo cáo thống kê đầy đủ →
                    </button></AccessGuard>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm pt-2">Danh sách phiếu thu trong năm {thisYear} ({thisYearInvoices.length} phiếu):</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <InvoiceListTable
                      invoices={thisYearInvoices}
                      emptyMessage={`Chưa có phiếu thu nào trong năm ${thisYear}`}
                      showDateColumn={true}
                      maxHeightClass="max-h-96"
                    />
                  </div>
                </div>
              )}

              {/* MODAL 3: MASSAGE REVENUE BY TICKET TYPE */}
              {detailModal === 'MASSAGE_REVENUE' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-teal-950 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-teal-600" />
                        <span>Doanh Thu Từng Loại Vé Massage Thư Giãn</span>
                      </h4>
                      <p className="text-xs text-teal-800 mt-0.5">
                        Thống kê số vé đã bán và doanh thu của từng dịch vụ Massage
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Tổng doanh thu vé Massage:</span>
                      <strong className="text-xl font-mono text-teal-900">{formatCurrency(thisMonthMassageRev)}</strong>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                        <tr>
                          <th className="py-2.5 px-4">Tên Vé Massage Thư Giãn</th>
                          <th className="py-2.5 px-4 text-right">Đơn giá vé</th>
                          <th className="py-2.5 px-4 text-center">Số vé đã bán</th>
                          <th className="py-2.5 px-4 text-right">Tổng thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {massageTicketStats.map(ticket => (
                          <tr key={ticket.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                              <span>{ticket.name}</span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">{formatCurrency(ticket.price)}</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-teal-700">
                              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-900">
                                {ticket.count} vé
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(ticket.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-teal-50 font-bold border-t border-teal-200">
                        <tr>
                          <td className="py-3 px-4 text-teal-950">TỔNG CỘNG VÉ MASSAGE</td>
                          <td></td>
                          <td className="py-3 px-4 text-center font-mono text-teal-900 font-extrabold">
                            {totalMassageTicketsCount} vé
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-teal-900 font-extrabold text-sm">
                            {formatCurrency(thisMonthMassageRev)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* MODAL 4: 15 ROOMS MATRIX BY 2 FLOORS */}
              {detailModal === 'ROOM_OCCUPANCY' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Hiện trạng {totalRooms} phòng khách sạn
                      </h4>
                      <p className="text-xs text-slate-500">
                        Tầng 1 (7 phòng: N01 - N07) · Tầng 2 (8 phòng: N08 - N15)
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Công suất sử dụng:</span>
                      <strong className="text-base font-mono text-purple-900">{occupancyRate}% ({occupiedRooms.length}/{totalRooms} phòng)</strong>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Phòng</th>
                          <th className="py-2.5 px-3">Tầng</th>
                          <th className="py-2.5 px-3">Hạng phòng</th>
                          <th className="py-2.5 px-3">Giá đêm / Giá giờ</th>
                          <th className="py-2.5 px-3">Trạng thái</th>
                          <th className="py-2.5 px-3">Khách đang ở / Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortRooms(rooms).map(r => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-teal-900">{r.number}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-600">Tầng {r.floor}</td>
                            <td className="py-2.5 px-3">{r.typeName}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {formatCurrency(r.pricePerNight)} / {formatCurrency(r.pricePerHour)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'OCCUPIED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : r.status === 'AVAILABLE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'RESERVED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {r.status === 'OCCUPIED' ? 'Đang có khách' : r.status === 'AVAILABLE' ? 'Trống sẵn sàng' : r.status === 'RESERVED' ? 'Đã đặt' : 'Cần dọn'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {r.currentGuestName || r.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MODAL 5: DEBT LIST */}
              {detailModal === 'DEBT_LIST' && canView('debt') && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-rose-900 block">Tổng Công Nợ Khách Hàng Cần Thu</span>
                      <span className="text-[11px] text-rose-700">Tổng cộng {activeDebtorsCount} đoàn khách chưa hoàn tất thanh toán</span>
                    </div>
                    <strong className="text-xl font-mono text-rose-800">{formatCurrency(totalRemainingDebt)}</strong>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Khách hàng</th>
                          <th className="py-2.5 px-3">Số phòng</th>
                          <th className="py-2.5 px-3">Số điện thoại</th>
                          <th className="py-2.5 px-3">Ngày nợ</th>
                          <th className="py-2.5 px-3">Hạn thanh toán</th>
                          <th className="py-2.5 px-3 text-right">Tổng PT</th>
                          <th className="py-2.5 px-3 text-right">Còn nợ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {debts.filter(d => d.remainingAmount > 0).map(debt => (
                          <tr key={debt.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{debt.customerName}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-teal-800">{debt.roomNumber}</td>
                            <td className="py-2.5 px-3 font-mono">{debt.phone}</td>
                            <td className="py-2.5 px-3 text-slate-500">{formatDate(debt.createdDate)}</td>
                            <td className="py-2.5 px-3 text-rose-600 font-semibold">{formatDate(debt.dueDate)}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(debt.totalInvoiceAmount)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatCurrency(debt.remainingAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <AccessGuard view="debt"><button
                      onClick={() => {
                        setDetailModal(null);
                        setActiveTab('debt');
                      }}
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <span>{canAct('debt.collect') ? 'Mở Sổ Quản Lý Công Nợ để Thu Tiền' : 'Xem Sổ Quản Lý Công Nợ'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button></AccessGuard>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>Bấm nút Đóng hoặc phím ESC để quay lại Trang chủ</span>
              <button
                onClick={() => setDetailModal(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
