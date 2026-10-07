import React, { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { localDate, invoiceRevenue, invoiceCollected, paymentBreakdown } from '../../utils/hotelLogic';
import { formatCurrency, formatDate, getPaymentMethodName } from '../../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  CalendarRange,
  DollarSign,
  BedDouble,
  CreditCard,
  BarChart2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Ticket,
  Sparkles,
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const { invoices, rooms, debts, today } = useHotel();

  // Tab mode: DAILY (Ngày), WEEKLY (Tuần), MONTHLY (Tháng), YEARLY (Năm)
  const [subTab, setSubTab] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('DAILY');

  // Filter state for each mode
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedWeekDate, setSelectedWeekDate] = useState<string>(today);
  const [selectedMonth, setSelectedMonth] = useState<string>(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(today.slice(0, 4));

  const totalRoomsCount = rooms.length;

  // Available years from invoice data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(today.slice(0, 4));
    invoices.forEach(inv => {
      if (inv.date && inv.date.length >= 4) {
        years.add(inv.date.slice(0, 4));
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [invoices, today]);

  // Date navigation helpers
  const changeDay = (offset: number) => {
    const d = new Date(`${selectedDate}T12:00:00+07:00`);
    d.setDate(d.getDate() + offset);
    setSelectedDate(localDate(d));
  };

  const changeWeek = (offsetDays: number) => {
    const d = new Date(`${selectedWeekDate}T12:00:00+07:00`);
    d.setDate(d.getDate() + offsetDays);
    setSelectedWeekDate(localDate(d));
  };

  const changeMonth = (offsetMonths: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const changeYear = (offsetYears: number) => {
    setSelectedYear(prev => String(Number(prev) + offsetYears));
  };

  // =========================================================================
  // 1. DATA THEO NGÀY (DAILY)
  // =========================================================================
  const dailyData = useMemo(() => {
    const dayInvoices = invoices.filter(inv => inv.date === selectedDate);
    const totalRevenue = dayInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0);
    const roomRevenue = dayInvoices.reduce((sum, i) => sum + i.roomCharge, 0);
    const massageRevenue = dayInvoices.reduce((sum, i) => sum + (i.massageCharge || 0), 0);
    const serviceRevenue = dayInvoices.reduce((sum, i) => sum + i.serviceCharge, 0);
    const surchargeRevenue = dayInvoices.reduce((sum, i) => sum + i.surcharge, 0);
    const paidAmount = dayInvoices.reduce((sum, i) => sum + invoiceCollected(i), 0);
    const debtAmount = dayInvoices.reduce((sum, i) => sum + i.debtAmount, 0);

    // Yesterday comparison
    const curD = new Date(`${selectedDate}T12:00:00+07:00`);
    curD.setDate(curD.getDate() - 1);
    const prevDateStr = localDate(curD);
    const prevInvoices = invoices.filter(inv => inv.date === prevDateStr);
    const prevRevenue = prevInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0);

    const growth = prevRevenue > 0
      ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : null;

    const methods = paymentBreakdown(dayInvoices, debts);

    return {
      date: selectedDate,
      prevDate: prevDateStr,
      invoices: dayInvoices,
      totalRevenue,
      prevRevenue,
      growth,
      roomRevenue,
      massageRevenue,
      serviceRevenue,
      surchargeRevenue,
      paidAmount,
      debtAmount,
      cashTotal: methods.CASH,
      transferTotal: methods.TRANSFER,
      cardTotal: methods.CARD,
      depositTotal: methods.deposit,
      count: dayInvoices.length,
    };
  }, [invoices, selectedDate, debts]);

  // 14-day trend for Daily view
  const recentDaysChart = useMemo(() => {
    const days: { date: string; label: string; revenue: number }[] = [];
    const base = new Date(`${today}T12:00:00+07:00`);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const dateStr = localDate(d);
      const rev = invoices
        .filter(inv => inv.date === dateStr)
        .reduce((sum, inv) => sum + invoiceRevenue(inv), 0);
      days.push({
        date: dateStr,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: rev,
      });
    }
    return days;
  }, [invoices, today]);

  const maxRecentRev = Math.max(...recentDaysChart.map(d => d.revenue), 1000000);

  // =========================================================================
  // 2. DATA THEO TUẦN (WEEKLY)
  // =========================================================================
  const weeklyData = useMemo(() => {
    const d = new Date(`${selectedWeekDate}T12:00:00+07:00`);
    const day = d.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    const weekStart = localDate(mon);
    const weekEnd = localDate(sun);

    // Previous week
    const prevMon = new Date(mon);
    prevMon.setDate(prevMon.getDate() - 7);
    const prevSun = new Date(prevMon);
    prevSun.setDate(prevMon.getDate() + 6);
    const prevWeekStart = localDate(prevMon);
    const prevWeekEnd = localDate(prevSun);

    const weekInvoices = invoices.filter(inv => inv.date >= weekStart && inv.date <= weekEnd);
    const prevWeekInvoices = invoices.filter(inv => inv.date >= prevWeekStart && inv.date <= prevWeekEnd);

    const totalRevenue = weekInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0);
    const prevRevenue = prevWeekInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0);
    const roomRevenue = weekInvoices.reduce((sum, i) => sum + i.roomCharge, 0);
    const massageRevenue = weekInvoices.reduce((sum, i) => sum + (i.massageCharge || 0), 0);
    const serviceRevenue = weekInvoices.reduce((sum, i) => sum + i.serviceCharge + i.surcharge, 0);
    const paidAmount = weekInvoices.reduce((sum, i) => sum + invoiceCollected(i), 0);
    const debtAmount = weekInvoices.reduce((sum, i) => sum + i.debtAmount, 0);

    const growth = prevRevenue > 0
      ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : null;

    const methods = paymentBreakdown(weekInvoices, debts);

    // 7 days breakdown (Mon -> Sun)
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const daysBreakdown = Array.from({ length: 7 }).map((_, idx) => {
      const cur = new Date(mon);
      cur.setDate(cur.getDate() + idx);
      const curDateStr = localDate(cur);
      const dayInvs = weekInvoices.filter(i => i.date === curDateStr);
      const dayRev = dayInvs.reduce((sum, i) => sum + invoiceRevenue(i), 0);
      const dayRoom = dayInvs.reduce((sum, i) => sum + i.roomCharge, 0);
      const dayMassage = dayInvs.reduce((sum, i) => sum + (i.massageCharge || 0), 0);
      const dayPaid = dayInvs.reduce((sum, i) => sum + invoiceCollected(i), 0);
      const dayDebt = dayInvs.reduce((sum, i) => sum + i.debtAmount, 0);

      // Prev week corresponding day
      const prevCur = new Date(cur);
      prevCur.setDate(prevCur.getDate() - 7);
      const prevDateStr = localDate(prevCur);
      const prevDayRev = prevWeekInvoices
        .filter(i => i.date === prevDateStr)
        .reduce((sum, i) => sum + invoiceRevenue(i), 0);

      return {
        date: curDateStr,
        dayName: dayNames[idx],
        shortDate: `${cur.getDate()}/${cur.getMonth() + 1}`,
        revenue: dayRev,
        prevRevenue: prevDayRev,
        roomCharge: dayRoom,
        massageCharge: dayMassage,
        paid: dayPaid,
        debt: dayDebt,
        count: dayInvs.length,
      };
    });

    const maxDayRevenue = Math.max(1, ...daysBreakdown.map(d => Math.max(d.revenue, d.prevRevenue)));

    return {
      weekStart,
      weekEnd,
      prevWeekStart,
      prevWeekEnd,
      label: `Thứ 2 (${mon.getDate()}/${mon.getMonth() + 1}) → CN (${sun.getDate()}/${sun.getMonth() + 1}/${sun.getFullYear()})`,
      shortLabel: `${mon.getDate()}/${mon.getMonth() + 1} - ${sun.getDate()}/${sun.getMonth() + 1}`,
      prevShortLabel: `${prevMon.getDate()}/${prevMon.getMonth() + 1} - ${prevSun.getDate()}/${prevSun.getMonth() + 1}`,
      invoices: weekInvoices,
      totalRevenue,
      prevRevenue,
      roomRevenue,
      massageRevenue,
      serviceRevenue,
      paidAmount,
      debtAmount,
      growth,
      methods,
      daysBreakdown,
      maxDayRevenue,
      count: weekInvoices.length,
    };
  }, [invoices, selectedWeekDate, debts]);

  // =========================================================================
  // 3. DATA THEO THÁNG (MONTHLY)
  // =========================================================================
  const monthlyData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(Date.UTC(year, month - 2, 1));
    const prevMonth = prevDate.toISOString().slice(0, 7);

    const daysThisMonth = new Date(year, month, 0).getDate();
    const daysLastMonth = new Date(year, month - 1, 0).getDate();

    const thisMonthInvoices = invoices.filter(inv => inv.date.startsWith(selectedMonth));
    const lastMonthInvoices = invoices.filter(inv => inv.date.startsWith(prevMonth));

    const calcMonth = (invs: typeof invoices, daysInMonth: number) => {
      const totalRevenue = invs.reduce((sum, i) => sum + invoiceRevenue(i), 0);
      const roomRevenue = invs.reduce((sum, i) => sum + i.roomCharge, 0);
      const massageRevenue = invs.reduce((sum, i) => sum + (i.massageCharge || 0), 0);
      const serviceRevenue = invs.reduce((sum, i) => sum + i.serviceCharge, 0);
      const surchargeRevenue = invs.reduce((sum, i) => sum + i.surcharge, 0);
      const paidTotal = invs.reduce((sum, i) => sum + invoiceCollected(i), 0);
      const debtTotal = invs.reduce((sum, i) => sum + i.debtAmount, 0);
      const count = invs.length;

      // Group by day (1..31)
      const dayMap: { [day: number]: number } = {};
      invs.forEach(i => {
        const d = parseInt(i.date.split('-')[2], 10);
        dayMap[d] = (dayMap[d] || 0) + invoiceRevenue(i);
      });

      // Occupancy approximation
      const estimatedRoomNights = invs.reduce((sum, i) => sum + (i.kind !== 'SERVICE' && i.pricingType === 'NIGHT' ? Math.max(1, i.durationNightsOrHours) : 0), 0);
      const totalAvailableRoomNights = totalRoomsCount * daysInMonth;
      const occupancyRate = totalAvailableRoomNights > 0 ? Math.min(100, Math.round((estimatedRoomNights / totalAvailableRoomNights) * 100)) : 0;

      const nightRoomRevenue = invs.filter(i => i.pricingType === 'NIGHT').reduce((sum, i) => sum + i.roomCharge, 0);
      const adr = estimatedRoomNights > 0 ? Math.round(nightRoomRevenue / estimatedRoomNights) : 0;
      const revPar = totalAvailableRoomNights > 0 ? Math.round(roomRevenue / totalAvailableRoomNights) : 0;

      return {
        totalRevenue,
        roomRevenue,
        massageRevenue,
        serviceRevenue,
        surchargeRevenue,
        paidTotal,
        debtTotal,
        count,
        dayMap,
        occupancyRate,
        adr,
        revPar,
      };
    };

    const thisMonthStats = calcMonth(thisMonthInvoices, daysThisMonth);
    const lastMonthStats = calcMonth(lastMonthInvoices, daysLastMonth);

    const revenueGrowth = lastMonthStats.totalRevenue > 0
      ? (((thisMonthStats.totalRevenue - lastMonthStats.totalRevenue) / lastMonthStats.totalRevenue) * 100).toFixed(1)
      : null;

    const chartDays = Math.max(daysThisMonth, daysLastMonth);
    const maxMonthlyDayRevenue = Math.max(1, ...Object.values(thisMonthStats.dayMap), ...Object.values(lastMonthStats.dayMap));

    return {
      selectedMonth,
      prevMonth,
      labelThisMonth: selectedMonth.split('-').reverse().join('/'),
      labelLastMonth: prevMonth.split('-').reverse().join('/'),
      thisMonth: thisMonthStats,
      lastMonth: lastMonthStats,
      revenueGrowth,
      chartDays,
      maxMonthlyDayRevenue,
      invoices: thisMonthInvoices,
    };
  }, [invoices, selectedMonth, totalRoomsCount]);

  // =========================================================================
  // 4. DATA THEO NĂM (YEARLY)
  // =========================================================================
  const yearlyData = useMemo(() => {
    const curYear = selectedYear;
    const prevYear = String(Number(selectedYear) - 1);

    const curYearInvoices = invoices.filter(inv => inv.date.startsWith(curYear));
    const prevYearInvoices = invoices.filter(inv => inv.date.startsWith(prevYear));

    const totalRevenue = curYearInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0);
    const prevRevenue = prevYearInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0);
    const roomRevenue = curYearInvoices.reduce((sum, i) => sum + i.roomCharge, 0);
    const massageRevenue = curYearInvoices.reduce((sum, i) => sum + (i.massageCharge || 0), 0);
    const serviceRevenue = curYearInvoices.reduce((sum, i) => sum + i.serviceCharge + i.surcharge, 0);
    const paidAmount = curYearInvoices.reduce((sum, i) => sum + invoiceCollected(i), 0);
    const debtAmount = curYearInvoices.reduce((sum, i) => sum + i.debtAmount, 0);

    const growth = prevRevenue > 0
      ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : null;

    // 12 months breakdown (Tháng 1 -> Tháng 12)
    const monthsBreakdown = Array.from({ length: 12 }).map((_, idx) => {
      const monthNum = idx + 1;
      const monthPrefix = `${curYear}-${String(monthNum).padStart(2, '0')}`;
      const prevMonthPrefix = `${prevYear}-${String(monthNum).padStart(2, '0')}`;

      const mInvs = curYearInvoices.filter(i => i.date.startsWith(monthPrefix));
      const prevMInvs = prevYearInvoices.filter(i => i.date.startsWith(prevMonthPrefix));

      const mRevenue = mInvs.reduce((sum, i) => sum + invoiceRevenue(i), 0);
      const mPrevRevenue = prevMInvs.reduce((sum, i) => sum + invoiceRevenue(i), 0);
      const mRoom = mInvs.reduce((sum, i) => sum + i.roomCharge, 0);
      const mMassage = mInvs.reduce((sum, i) => sum + (i.massageCharge || 0), 0);
      const mService = mInvs.reduce((sum, i) => sum + i.serviceCharge + i.surcharge, 0);
      const mPaid = mInvs.reduce((sum, i) => sum + invoiceCollected(i), 0);
      const mDebt = mInvs.reduce((sum, i) => sum + i.debtAmount, 0);

      return {
        month: monthNum,
        label: `Tháng ${monthNum}`,
        revenue: mRevenue,
        prevRevenue: mPrevRevenue,
        roomCharge: mRoom,
        massageCharge: mMassage,
        serviceCharge: mService,
        paid: mPaid,
        debt: mDebt,
        count: mInvs.length,
      };
    });

    const maxMonthRevenue = Math.max(1, ...monthsBreakdown.map(m => Math.max(m.revenue, m.prevRevenue)));

    return {
      curYear,
      prevYear,
      totalRevenue,
      prevRevenue,
      roomRevenue,
      massageRevenue,
      serviceRevenue,
      paidAmount,
      debtAmount,
      growth,
      monthsBreakdown,
      maxMonthRevenue,
      invoices: curYearInvoices,
      count: curYearInvoices.length,
    };
  }, [invoices, selectedYear]);

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* HEADER & 4-PERIOD SEGMENTED CONTROL */}
      {/* ===================================================================== */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-teal-700" />
            <h2 className="text-base font-bold text-slate-900">Trung tâm Thống kê & Hiệu quả kinh doanh</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân tích đa chiều doanh thu theo Ngày · Tuần · Tháng · Năm (Tiền phòng, Massage, Dịch vụ & Công nợ)
          </p>
        </div>

        {/* 4 Tabs: Ngày, Tuần, Tháng, Năm */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl w-full lg:w-auto">
          <button
            onClick={() => setSubTab('DAILY')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              subTab === 'DAILY'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Theo Ngày</span>
          </button>

          <button
            onClick={() => setSubTab('WEEKLY')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              subTab === 'WEEKLY'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Theo Tuần</span>
          </button>

          <button
            onClick={() => setSubTab('MONTHLY')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              subTab === 'MONTHLY'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Theo Tháng</span>
          </button>

          <button
            onClick={() => setSubTab('YEARLY')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              subTab === 'YEARLY'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Theo Năm</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: THỐNG KÊ THEO NGÀY (DAILY) */}
      {/* ===================================================================== */}
      {subTab === 'DAILY' && (
        <div className="space-y-6">
          {/* Daily Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Chọn ngày:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeDay(-1)}
                  title="Ngày trước"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  onClick={() => changeDay(1)}
                  title="Ngày tiếp theo"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setSelectedDate(today)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedDate === today
                    ? 'bg-teal-700 text-white font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Hôm nay
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Tổng số phiếu thu phát sinh: <strong className="font-mono text-slate-900 font-bold">{dailyData.count}</strong> lượt
            </div>
          </div>

          {/* Daily KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Tổng doanh thu ngày */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Tổng doanh thu ngày</span>
                {dailyData.growth !== null && (
                  <span className={`text-[11px] font-bold flex items-center gap-0.5 ${
                    Number(dailyData.growth) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {Number(dailyData.growth) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {dailyData.growth}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(dailyData.totalRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                <span>Hôm trước ({formatDate(dailyData.prevDate).slice(0, 5)}):</span>
                <span className="font-mono font-semibold text-slate-700">{formatCurrency(dailyData.prevRevenue)}</span>
              </div>
            </div>

            {/* 2. Tiền phòng */}
            <div className="bg-white p-4 rounded-xl border border-blue-200/70 shadow-2xs">
              <span className="text-xs font-semibold text-blue-700 block">Doanh thu Tiền Phòng</span>
              <p className="text-2xl font-bold font-mono text-blue-800 mt-1">
                {formatCurrency(dailyData.roomRevenue)}
              </p>
              <div className="mt-2 text-[11px] pt-2 border-t border-blue-100 text-blue-600">
                Nguồn thu lưu trú phòng khách sạn
              </div>
            </div>

            {/* 3. Vé Massage & Dịch vụ */}
            <div className="bg-white p-4 rounded-xl border border-teal-200/70 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-800">Vé Massage & Dịch vụ</span>
                <Ticket className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-teal-900 mt-1">
                {formatCurrency(dailyData.massageRevenue + dailyData.serviceRevenue + dailyData.surchargeRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-teal-100 text-teal-700">
                <span>Massage: <strong className="font-mono">{formatCurrency(dailyData.massageRevenue)}</strong></span>
                <span>DV/Khác: <strong className="font-mono">{formatCurrency(dailyData.serviceRevenue + dailyData.surchargeRevenue)}</strong></span>
              </div>
            </div>

            {/* 4. Đã thu & Công nợ */}
            <div className="bg-white p-4 rounded-xl border border-emerald-200/70 shadow-2xs">
              <span className="text-xs font-semibold text-emerald-800 block">Thực thu & Công nợ</span>
              <p className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                {formatCurrency(dailyData.paidAmount)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-emerald-100">
                <span className="text-slate-500">Khách nợ mới:</span>
                <span className={`font-mono font-bold ${dailyData.debtAmount > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                  {formatCurrency(dailyData.debtAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown Pill Grid */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-700">Hình thức thanh toán ngày {formatDate(selectedDate)}:</span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-mono font-semibold border border-emerald-200">
              Chuyển khoản: {formatCurrency(dailyData.transferTotal)}
            </span>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg font-mono font-semibold border border-blue-200">
              Tiền mặt: {formatCurrency(dailyData.cashTotal)}
            </span>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-800 rounded-lg font-mono font-semibold border border-purple-200">
              Thẻ: {formatCurrency(dailyData.cardTotal)}
            </span>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg font-mono font-semibold border border-amber-200">
              Trừ tiền cọc: {formatCurrency(dailyData.depositTotal)}
            </span>
          </div>

          {/* 14-day Trend Mini Chart */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-700" />
                Xu hướng doanh thu 14 ngày gần nhất
              </h3>
              <span className="text-[11px] text-slate-400">Bấm vào cột để xem chi tiết ngày đó</span>
            </div>

            <p className="sm:hidden text-[11px] text-slate-500">Vuốt ngang để xem đủ 14 ngày.</p>
            <div className="overflow-x-auto">
              <div className="min-w-[500px] h-44 flex items-end gap-2 pt-4 pb-2 border-b border-slate-200">
                {recentDaysChart.map(item => {
                  const heightPercent = Math.min(100, Math.round((item.revenue / maxRecentRev) * 100));
                  const isCurrent = item.date === selectedDate;

                  return (
                    <div
                      key={item.date}
                      onClick={() => setSelectedDate(item.date)}
                      className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group relative"
                    >
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-30 pointer-events-none bg-slate-900 text-white text-[10px] p-1.5 rounded shadow whitespace-nowrap">
                        {item.label}: {formatCurrency(item.revenue)}
                      </div>

                      <div
                        style={{ height: `${item.revenue > 0 ? Math.max(4, heightPercent) : 2}%` }}
                        className={`w-full rounded-t-md transition-all ${
                          isCurrent
                            ? 'bg-teal-700 ring-2 ring-teal-400'
                            : 'bg-teal-100 hover:bg-teal-300'
                        }`}
                      ></div>

                      <span
                        className={`text-[10px] mt-1.5 font-mono ${
                          isCurrent ? 'font-bold text-teal-800' : 'text-slate-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Invoices List Table for Selected Date */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-500" />
                Danh sách phiếu thu phát sinh ngày {formatDate(selectedDate)} ({dailyData.count})
              </h4>
            </div>

            {dailyData.invoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Không có phiếu thu nào phát sinh trong ngày {formatDate(selectedDate)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Mã PT</th>
                      <th className="px-4 py-2.5">Phòng</th>
                      <th className="px-4 py-2.5">Khách hàng</th>
                      <th className="px-4 py-2.5 text-right">Tiền phòng</th>
                      <th className="px-4 py-2.5 text-right">Vé Massage</th>
                      <th className="px-4 py-2.5 text-right">Minibar/DV</th>
                      <th className="px-4 py-2.5 text-right">Tổng cộng</th>
                      <th className="px-4 py-2.5 text-right">Đã thu</th>
                      <th className="px-4 py-2.5 text-right">Ghi nợ</th>
                      <th className="px-4 py-2.5 text-center">Hình thức</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyData.invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                          {inv.code}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {inv.time}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-bold font-mono text-teal-800">
                          {inv.kind === 'SERVICE' ? 'Khách ngoài' : `P.${inv.roomNumber}`}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">
                          {inv.customerName}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                          {formatCurrency(inv.roomCharge)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-teal-700">
                          {formatCurrency(inv.massageCharge || 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                          {formatCurrency(inv.serviceCharge + inv.surcharge)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(invoiceRevenue(inv))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-semibold">
                          {formatCurrency(invoiceCollected(inv))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-rose-700 font-semibold">
                          {inv.debtAmount > 0 ? formatCurrency(inv.debtAmount) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {getPaymentMethodName(inv.paymentMethod)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: THỐNG KÊ THEO TUẦN (WEEKLY) */}
      {/* ===================================================================== */}
      {subTab === 'WEEKLY' && (
        <div className="space-y-6">
          {/* Week Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Chọn tuần:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeWeek(-7)}
                  title="Tuần trước"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={selectedWeekDate}
                  onChange={e => setSelectedWeekDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  onClick={() => changeWeek(7)}
                  title="Tuần kế tiếp"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setSelectedWeekDate(today)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Tuần hiện tại
              </button>
            </div>

            <div className="text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
              {weeklyData.label}
            </div>
          </div>

          {/* Weekly KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Doanh thu tuần ({weeklyData.shortLabel})</span>
                {weeklyData.growth !== null && (
                  <span className={`text-[11px] font-bold flex items-center gap-0.5 ${
                    Number(weeklyData.growth) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {Number(weeklyData.growth) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {weeklyData.growth}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(weeklyData.totalRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                <span>Tuần trước ({weeklyData.prevShortLabel}):</span>
                <span className="font-mono font-semibold text-slate-700">{formatCurrency(weeklyData.prevRevenue)}</span>
              </div>
            </div>

            {/* Room Revenue */}
            <div className="bg-white p-4 rounded-xl border border-blue-200/70 shadow-2xs">
              <span className="text-xs font-semibold text-blue-700 block">Doanh thu Tiền Phòng tuần</span>
              <p className="text-2xl font-bold font-mono text-blue-800 mt-1">
                {formatCurrency(weeklyData.roomRevenue)}
              </p>
              <div className="mt-2 text-[11px] pt-2 border-t border-blue-100 text-blue-600">
                Chiếm {weeklyData.totalRevenue > 0 ? Math.round((weeklyData.roomRevenue / weeklyData.totalRevenue) * 100) : 0}% tổng doanh thu tuần
              </div>
            </div>

            {/* Massage Revenue */}
            <div className="bg-white p-4 rounded-xl border border-teal-200/70 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-800">Vé Massage & Dịch vụ tuần</span>
                <Ticket className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-teal-900 mt-1">
                {formatCurrency(weeklyData.massageRevenue + weeklyData.serviceRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-teal-100 text-teal-700">
                <span>Massage: <strong className="font-mono">{formatCurrency(weeklyData.massageRevenue)}</strong></span>
                <span>DV khác: <strong className="font-mono">{formatCurrency(weeklyData.serviceRevenue)}</strong></span>
              </div>
            </div>

            {/* Paid & Debt */}
            <div className="bg-white p-4 rounded-xl border border-emerald-200/70 shadow-2xs">
              <span className="text-xs font-semibold text-emerald-800 block">Thực thu & Khách nợ tuần</span>
              <p className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                {formatCurrency(weeklyData.paidAmount)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-emerald-100">
                <span className="text-slate-500">Khách nợ mới tuần:</span>
                <span className={`font-mono font-bold ${weeklyData.debtAmount > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                  {formatCurrency(weeklyData.debtAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* 7-Day Chart of Selected Week */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-teal-700" />
                  Biểu đồ doanh thu 7 ngày trong tuần: Thứ 2 → Chủ Nhật
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  So sánh doanh thu từng ngày của tuần này với cùng ngày tuần trước
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-slate-300"></span>
                  <span className="text-slate-600">Tuần trước ({weeklyData.prevShortLabel})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-teal-700"></span>
                  <span className="font-semibold text-slate-900">Tuần này ({weeklyData.shortLabel})</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto pt-4">
              <div className="min-w-[600px]">
                <div className="h-60 flex items-end gap-3 pb-6 border-b border-slate-200">
                  {weeklyData.daysBreakdown.map((item, idx) => {
                    const prevHeight = Math.min(100, Math.round((item.prevRevenue / weeklyData.maxDayRevenue) * 100));
                    const curHeight = Math.min(100, Math.round((item.revenue / weeklyData.maxDayRevenue) * 100));

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-16 z-30 pointer-events-none bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg whitespace-nowrap">
                          <p className="font-bold text-teal-400">{item.dayName} ({item.shortDate})</p>
                          <p>Tuần này: {formatCurrency(item.revenue)}</p>
                          <p className="text-slate-400">Tuần trước: {formatCurrency(item.prevRevenue)}</p>
                        </div>

                        {/* Dual Bars */}
                        <div className="w-full flex items-end justify-center gap-1 h-full">
                          <div
                            style={{ height: `${item.prevRevenue > 0 ? Math.max(4, prevHeight) : 2}%` }}
                            className="w-3 bg-slate-200 rounded-t-xs hover:bg-slate-300 transition-all"
                          ></div>
                          <div
                            style={{ height: `${item.revenue > 0 ? Math.max(4, curHeight) : 2}%` }}
                            className="w-4 bg-teal-700 hover:bg-teal-800 rounded-t-xs transition-all"
                          ></div>
                        </div>

                        <div className="text-center mt-2">
                          <span className="block text-[11px] font-bold text-slate-800">{item.dayName}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">{item.shortDate}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Summary Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Bảng phân tích doanh thu chi tiết 7 ngày trong tuần
              </h4>
              <span className="text-xs text-slate-500 font-mono font-bold">
                Tổng cộng: {formatCurrency(weeklyData.totalRevenue)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Thứ / Ngày</th>
                    <th className="py-2.5 px-4 text-right">Tiền phòng</th>
                    <th className="py-2.5 px-4 text-right">Vé Massage</th>
                    <th className="py-2.5 px-4 text-right">Tổng doanh thu</th>
                    <th className="py-2.5 px-4 text-right">Đã thu</th>
                    <th className="py-2.5 px-4 text-right">Ghi nợ</th>
                    <th className="py-2.5 px-4 text-center">Số phiếu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weeklyData.daysBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <strong className="text-slate-900">{row.dayName}</strong>
                        <span className="ml-2 text-slate-400 font-mono">{row.shortDate}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-blue-700">
                        {formatCurrency(row.roomCharge)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-teal-700 font-bold">
                        {formatCurrency(row.massageCharge)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-700">
                        {formatCurrency(row.paid)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-700 font-bold">
                        {row.debt > 0 ? formatCurrency(row.debt) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-semibold text-slate-600">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-slate-100/70 font-bold text-slate-900 border-t-2 border-slate-200">
                    <td className="py-3 px-4">CẢ TUẦN</td>
                    <td className="py-3 px-4 text-right font-mono text-blue-800">
                      {formatCurrency(weeklyData.roomRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-teal-800">
                      {formatCurrency(weeklyData.massageRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-950 text-sm">
                      {formatCurrency(weeklyData.totalRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-800">
                      {formatCurrency(weeklyData.paidAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-800">
                      {weeklyData.debtAmount > 0 ? formatCurrency(weeklyData.debtAmount) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {weeklyData.count}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoices List Table for Week */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-500" />
                Danh sách phiếu thu phát sinh trong tuần ({weeklyData.count})
              </h4>
            </div>

            {weeklyData.invoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Không có phiếu thu nào phát sinh trong tuần {weeklyData.shortLabel}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Ngày</th>
                      <th className="px-4 py-2.5">Mã PT</th>
                      <th className="px-4 py-2.5">Phòng</th>
                      <th className="px-4 py-2.5">Khách hàng</th>
                      <th className="px-4 py-2.5 text-right">Tiền phòng</th>
                      <th className="px-4 py-2.5 text-right">Vé Massage</th>
                      <th className="px-4 py-2.5 text-right">Tổng cộng</th>
                      <th className="px-4 py-2.5 text-right">Đã thu</th>
                      <th className="px-4 py-2.5 text-right">Ghi nợ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weeklyData.invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                          {formatDate(inv.date).slice(0, 5)}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                          {inv.code}
                        </td>
                        <td className="px-4 py-2.5 font-bold font-mono text-teal-800">
                          {inv.kind === 'SERVICE' ? 'Khách ngoài' : `P.${inv.roomNumber}`}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">
                          {inv.customerName}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                          {formatCurrency(inv.roomCharge)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-teal-700 font-bold">
                          {formatCurrency(inv.massageCharge || 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(invoiceRevenue(inv))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-semibold">
                          {formatCurrency(invoiceCollected(inv))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-rose-700 font-semibold">
                          {inv.debtAmount > 0 ? formatCurrency(inv.debtAmount) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: THỐNG KÊ THEO THÁNG (MONTHLY) */}
      {/* ===================================================================== */}
      {subTab === 'MONTHLY' && (
        <div className="space-y-6">
          {/* Month Selector Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Chọn tháng:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeMonth(-1)}
                  title="Tháng trước"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  onClick={() => changeMonth(1)}
                  title="Tháng tiếp theo"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setSelectedMonth(today.slice(0, 7))}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Tháng hiện tại
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Tổng số phiếu thu trong tháng: <strong className="font-mono text-slate-900 font-bold">{monthlyData.thisMonth.count}</strong> lượt
            </div>
          </div>

          {/* Comparison KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 block">
                  Doanh thu tháng ({monthlyData.labelThisMonth})
                </span>
                {monthlyData.revenueGrowth !== null && (
                  <span className={`text-[11px] font-bold flex items-center gap-0.5 ${
                    Number(monthlyData.revenueGrowth) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {Number(monthlyData.revenueGrowth) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {monthlyData.revenueGrowth}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(monthlyData.thisMonth.totalRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-600">
                <span>Tháng trước ({monthlyData.labelLastMonth}):</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(monthlyData.lastMonth.totalRevenue)}
                </span>
              </div>
            </div>

            {/* Room Revenue */}
            <div className="bg-white p-4 rounded-xl border border-blue-200/70 shadow-2xs">
              <span className="text-xs font-semibold text-blue-700 block">
                Doanh thu tiền phòng (Room Rev)
              </span>
              <p className="text-2xl font-bold font-mono text-blue-800 mt-1">
                {formatCurrency(monthlyData.thisMonth.roomRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-blue-100 text-slate-600">
                <span>Tháng trước ({monthlyData.labelLastMonth}):</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(monthlyData.lastMonth.roomRevenue)}
                </span>
              </div>
            </div>

            {/* Massage & Minibar & F&B */}
            <div className="bg-white p-4 rounded-xl border border-teal-200/70 shadow-2xs">
              <span className="text-xs font-semibold text-teal-800 block">
                Doanh thu Massage & Dịch vụ
              </span>
              <p className="text-2xl font-bold font-mono text-teal-900 mt-1">
                {formatCurrency(monthlyData.thisMonth.massageRevenue + monthlyData.thisMonth.serviceRevenue + monthlyData.thisMonth.surchargeRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-teal-100 text-slate-600">
                <span>Massage: <strong className="font-mono">{formatCurrency(monthlyData.thisMonth.massageRevenue)}</strong></span>
                <span>DV khác: <strong className="font-mono">{formatCurrency(monthlyData.thisMonth.serviceRevenue + monthlyData.thisMonth.surchargeRevenue)}</strong></span>
              </div>
            </div>

            {/* ADR & Occupancy */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">
                Giá phòng bình quân (ADR)
              </span>
              <p className="text-2xl font-bold font-mono text-blue-700 mt-1">
                {formatCurrency(monthlyData.thisMonth.adr)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-600">
                <span>Công suất phòng:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {monthlyData.thisMonth.occupancyRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Comparative Month-over-Month Visual Bar Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-teal-700" />
                  Biểu đồ so sánh doanh thu từng ngày: {monthlyData.labelLastMonth} và {monthlyData.labelThisMonth}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi tiến độ doanh thu hàng ngày để so sánh tương quan chu kỳ kinh doanh
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-slate-300"></span>
                  <span className="text-slate-600">Tháng trước ({monthlyData.labelLastMonth})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-teal-700"></span>
                  <span className="font-semibold text-slate-900">Tháng này ({monthlyData.labelThisMonth})</span>
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <p className="sm:hidden text-[11px] text-slate-500">Vuốt ngang để xem đủ các ngày trong tháng.</p>
            <div className="overflow-x-auto pt-4">
              <div className="min-w-[700px]">
                <div className="h-64 flex items-end gap-1.5 pb-6 border-b border-slate-200">
                  {Array.from({ length: monthlyData.chartDays }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const prevRev = monthlyData.lastMonth.dayMap[dayNum] || 0;
                    const curRev = monthlyData.thisMonth.dayMap[dayNum] || 0;
                    const maxVal = monthlyData.maxMonthlyDayRevenue;

                    const prevHeight = Math.min(100, Math.round((prevRev / maxVal) * 100));
                    const curHeight = Math.min(100, Math.round((curRev / maxVal) * 100));

                    return (
                      <div key={dayNum} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        {/* Hover Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-16 z-30 pointer-events-none bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg whitespace-nowrap">
                          <p className="font-bold text-teal-400">Ngày {dayNum}</p>
                          <p>{monthlyData.labelThisMonth}: {formatCurrency(curRev)}</p>
                          <p className="text-slate-400">{monthlyData.labelLastMonth}: {formatCurrency(prevRev)}</p>
                        </div>

                        {/* Twin Bars */}
                        <div className="w-full flex items-end justify-center gap-0.5 h-full">
                          <div
                            style={{ height: `${prevHeight}%` }}
                            className="w-1.5 bg-slate-200 rounded-t-xs hover:bg-slate-300 transition-all"
                          ></div>
                          <div
                            style={{ height: `${curHeight}%` }}
                            className={`w-2 rounded-t-xs transition-all ${
                              curRev > 0 ? 'bg-teal-700 hover:bg-teal-800' : 'bg-transparent'
                            }`}
                          ></div>
                        </div>

                        <span className="text-[10px] text-slate-400 mt-2 font-mono">
                          {dayNum % 3 === 1 ? dayNum : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 pt-2 font-mono">
                  <span>Ngày 01</span>
                  <span>Ngày 15</span>
                  <span>Ngày {monthlyData.chartDays}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown & Performance Table */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Category breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-teal-700" />
                Cơ cấu nguồn thu trong tháng
              </h4>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">1. Tiền phòng (15 phòng · 2 Tầng)</span>
                    <span className="font-mono font-bold text-slate-900">
                      {monthlyData.thisMonth.totalRevenue > 0
                        ? Math.round((monthlyData.thisMonth.roomRevenue / monthlyData.thisMonth.totalRevenue) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${monthlyData.thisMonth.totalRevenue > 0
                          ? Math.round((monthlyData.thisMonth.roomRevenue / monthlyData.thisMonth.totalRevenue) * 100)
                          : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-teal-900 font-bold">2. Vé Massage Thư Giãn</span>
                    <span className="font-mono font-bold text-teal-800">
                      {monthlyData.thisMonth.totalRevenue > 0
                        ? Math.round((monthlyData.thisMonth.massageRevenue / monthlyData.thisMonth.totalRevenue) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-teal-600 h-2 rounded-full"
                      style={{
                        width: `${monthlyData.thisMonth.totalRevenue > 0
                          ? Math.round((monthlyData.thisMonth.massageRevenue / monthlyData.thisMonth.totalRevenue) * 100)
                          : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">3. Minibar & Dịch vụ phụ trợ</span>
                    <span className="font-mono font-bold text-slate-900">
                      {monthlyData.thisMonth.totalRevenue > 0
                        ? Math.round(((monthlyData.thisMonth.serviceRevenue + monthlyData.thisMonth.surchargeRevenue) / monthlyData.thisMonth.totalRevenue) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{
                        width: `${monthlyData.thisMonth.totalRevenue > 0
                          ? Math.round(((monthlyData.thisMonth.serviceRevenue + monthlyData.thisMonth.surchargeRevenue) / monthlyData.thisMonth.totalRevenue) * 100)
                          : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance comparison matrix */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 md:col-span-2 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Bảng đối soát chỉ số hiệu quả kinh doanh
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Chỉ số đo lường</th>
                      <th className="py-2.5 px-3 text-right">Tháng trước ({monthlyData.labelLastMonth})</th>
                      <th className="py-2.5 px-3 text-right">Tháng này ({monthlyData.labelThisMonth})</th>
                      <th className="py-2.5 px-3 text-right">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">Tổng doanh thu</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(monthlyData.lastMonth.totalRevenue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(monthlyData.thisMonth.totalRevenue)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-medium flex items-center justify-end gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        {monthlyData.revenueGrowth ? `${monthlyData.revenueGrowth}%` : 'Tăng trưởng'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">Công suất phòng bình quân</td>
                      <td className="py-2.5 px-3 text-right font-mono">{monthlyData.lastMonth.occupancyRate}%</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{monthlyData.thisMonth.occupancyRate}%</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">Ổn định mức cao</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">Giá phòng bình quân (ADR)</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(monthlyData.lastMonth.adr)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(monthlyData.thisMonth.adr || monthlyData.lastMonth.adr)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">Đạt chỉ tiêu</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">Tiền khách nợ mới phát sinh</td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600">{formatCurrency(monthlyData.lastMonth.debtTotal)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatCurrency(monthlyData.thisMonth.debtTotal)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-700 font-medium">Trong hạn kiểm soát</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: THỐNG KÊ THEO NĂM (YEARLY) */}
      {/* ===================================================================== */}
      {subTab === 'YEARLY' && (
        <div className="space-y-6">
          {/* Year Selector Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Chọn năm:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeYear(-1)}
                  title="Năm trước"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>
                      Năm {yr}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => changeYear(1)}
                  title="Năm kế tiếp"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setSelectedYear(today.slice(0, 4))}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Năm nay ({today.slice(0, 4)})
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Tổng số phiếu thu trong năm {yearlyData.curYear}: <strong className="font-mono text-slate-900 font-bold">{yearlyData.count}</strong> lượt
            </div>
          </div>

          {/* Yearly KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 block">
                  Tổng doanh thu cả năm {yearlyData.curYear}
                </span>
                {yearlyData.growth !== null && (
                  <span className={`text-[11px] font-bold flex items-center gap-0.5 ${
                    Number(yearlyData.growth) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {Number(yearlyData.growth) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {yearlyData.growth}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(yearlyData.totalRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-600">
                <span>Năm trước ({yearlyData.prevYear}):</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(yearlyData.prevRevenue)}
                </span>
              </div>
            </div>

            {/* Room Revenue */}
            <div className="bg-white p-4 rounded-xl border border-blue-200/70 shadow-2xs">
              <span className="text-xs font-semibold text-blue-700 block">
                Doanh thu Tiền Phòng cả năm
              </span>
              <p className="text-2xl font-bold font-mono text-blue-800 mt-1">
                {formatCurrency(yearlyData.roomRevenue)}
              </p>
              <div className="mt-2 text-[11px] pt-2 border-t border-blue-100 text-blue-600">
                Chiếm {yearlyData.totalRevenue > 0 ? Math.round((yearlyData.roomRevenue / yearlyData.totalRevenue) * 100) : 0}% tổng doanh thu năm
              </div>
            </div>

            {/* Massage Revenue */}
            <div className="bg-white p-4 rounded-xl border border-teal-200/70 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-800">Vé Massage & Dịch vụ cả năm</span>
                <Ticket className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-teal-900 mt-1">
                {formatCurrency(yearlyData.massageRevenue + yearlyData.serviceRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-teal-100 text-teal-700">
                <span>Massage: <strong className="font-mono">{formatCurrency(yearlyData.massageRevenue)}</strong></span>
                <span>DV khác: <strong className="font-mono">{formatCurrency(yearlyData.serviceRevenue)}</strong></span>
              </div>
            </div>

            {/* Paid & Debt */}
            <div className="bg-white p-4 rounded-xl border border-emerald-200/70 shadow-2xs">
              <span className="text-xs font-semibold text-emerald-800 block">Thực thu & Khách nợ cả năm</span>
              <p className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                {formatCurrency(yearlyData.paidAmount)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-emerald-100">
                <span className="text-slate-500">Tổng khách nợ năm:</span>
                <span className={`font-mono font-bold ${yearlyData.debtAmount > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                  {formatCurrency(yearlyData.debtAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* 12-Month Bar Chart of the Year */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-teal-700" />
                  Biểu đồ doanh thu 12 tháng năm {yearlyData.curYear} so với năm {yearlyData.prevYear}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phân tích diễn biến doanh thu qua từng tháng trong năm tài chính
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-slate-300"></span>
                  <span className="text-slate-600">Năm {yearlyData.prevYear}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-teal-700"></span>
                  <span className="font-semibold text-slate-900">Năm {yearlyData.curYear}</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto pt-4">
              <div className="min-w-[650px]">
                <div className="h-64 flex items-end gap-2.5 pb-6 border-b border-slate-200">
                  {yearlyData.monthsBreakdown.map(item => {
                    const prevHeight = Math.min(100, Math.round((item.prevRevenue / yearlyData.maxMonthRevenue) * 100));
                    const curHeight = Math.min(100, Math.round((item.revenue / yearlyData.maxMonthRevenue) * 100));

                    return (
                      <div key={item.month} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-16 z-30 pointer-events-none bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg whitespace-nowrap">
                          <p className="font-bold text-teal-400">Tháng {item.month}/{yearlyData.curYear}</p>
                          <p>Năm {yearlyData.curYear}: {formatCurrency(item.revenue)}</p>
                          <p className="text-slate-400">Năm {yearlyData.prevYear}: {formatCurrency(item.prevRevenue)}</p>
                        </div>

                        {/* Dual Bars */}
                        <div className="w-full flex items-end justify-center gap-1 h-full">
                          <div
                            style={{ height: `${item.prevRevenue > 0 ? Math.max(4, prevHeight) : 2}%` }}
                            className="w-3 bg-slate-200 rounded-t-xs hover:bg-slate-300 transition-all"
                          ></div>
                          <div
                            style={{ height: `${item.revenue > 0 ? Math.max(4, curHeight) : 2}%` }}
                            className="w-4 bg-teal-700 hover:bg-teal-800 rounded-t-xs transition-all"
                          ></div>
                        </div>

                        <span className="text-[10px] font-bold text-slate-700 mt-2 font-mono">
                          T{item.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 12-Month Table Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Bảng phân tích doanh thu 12 tháng năm {yearlyData.curYear}
              </h4>
              <span className="text-xs text-slate-500 font-mono font-bold">
                Tổng cả năm: {formatCurrency(yearlyData.totalRevenue)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Tháng</th>
                    <th className="py-2.5 px-4 text-right">Tiền phòng</th>
                    <th className="py-2.5 px-4 text-right">Vé Massage</th>
                    <th className="py-2.5 px-4 text-right">Dịch vụ khác</th>
                    <th className="py-2.5 px-4 text-right">Tổng doanh thu</th>
                    <th className="py-2.5 px-4 text-right">Đã thu</th>
                    <th className="py-2.5 px-4 text-right">Ghi nợ</th>
                    <th className="py-2.5 px-4 text-center">Số phiếu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yearlyData.monthsBreakdown.map(row => (
                    <tr key={row.month} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-blue-700">
                        {formatCurrency(row.roomCharge)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-teal-700 font-bold">
                        {formatCurrency(row.massageCharge)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                        {formatCurrency(row.serviceCharge)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-700">
                        {formatCurrency(row.paid)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-700 font-bold">
                        {row.debt > 0 ? formatCurrency(row.debt) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-semibold text-slate-600">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-slate-100/70 font-bold text-slate-900 border-t-2 border-slate-200">
                    <td className="py-3 px-4">CẢ NĂM {yearlyData.curYear}</td>
                    <td className="py-3 px-4 text-right font-mono text-blue-800">
                      {formatCurrency(yearlyData.roomRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-teal-800">
                      {formatCurrency(yearlyData.massageRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800">
                      {formatCurrency(yearlyData.serviceRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-950 text-sm">
                      {formatCurrency(yearlyData.totalRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-800">
                      {formatCurrency(yearlyData.paidAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-800">
                      {yearlyData.debtAmount > 0 ? formatCurrency(yearlyData.debtAmount) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {yearlyData.count}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
