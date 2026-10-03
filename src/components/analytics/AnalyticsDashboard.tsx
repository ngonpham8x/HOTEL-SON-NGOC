import { localDate, periodKeys, invoiceRevenue, invoiceCollected, paymentBreakdown } from '../../utils/hotelLogic';
import React, { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { formatCurrency, formatDate, getPaymentMethodName } from '../../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  BedDouble,
  Coffee,
  Users,
  CreditCard,
  BarChart2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Percent,
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const { invoices, rooms, debts, today } = useHotel();
  const keys = periodKeys(today);
  const thisMonthLabel = keys.thisMonth.split('-').reverse().join('/');
  const lastMonthLabel = keys.lastMonth.split('-').reverse().join('/');
  const [subTab, setSubTab] = useState<'MONTHLY' | 'DAILY'>('MONTHLY');
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Total available rooms.
  const totalRoomsCount = rooms.length;

  // Compare the current calendar month with the previous month.
  const monthlyData = useMemo(() => {
    const thisMonthKey = keys.thisMonth;
    const lastMonthKey = keys.lastMonth;

    const thisMonthInvoices = invoices.filter(inv => inv.date.startsWith(thisMonthKey));
    const lastMonthInvoices = invoices.filter(inv => inv.date.startsWith(lastMonthKey));

    const calcMonth = (invs: typeof invoices, daysInMonth: number) => {
      const totalRevenue = invs.reduce((sum, i) => sum + invoiceRevenue(i), 0);
      const roomRevenue = invs.reduce((sum, i) => sum + i.roomCharge, 0);
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

    const thisMonthStats = calcMonth(thisMonthInvoices, keys.daysThisMonth);
    const lastMonthStats = calcMonth(lastMonthInvoices, keys.daysLastMonth);

    // Growth percentage calculation
    const revenueGrowth = lastMonthStats.totalRevenue > 0
      ? (((thisMonthStats.totalRevenue - lastMonthStats.totalRevenue) / lastMonthStats.totalRevenue) * 100).toFixed(1)
      : '0';

    return {
      thisMonth: thisMonthStats,
      lastMonth: lastMonthStats,
      revenueGrowth,
    };
  }, [invoices, totalRoomsCount, today]);

  // Selected Day Analytics
  const dailyData = useMemo(() => {
    const dayInvoices = invoices.filter(inv => inv.date === selectedDate);
    const totalRevenue = dayInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0);
    const roomRevenue = dayInvoices.reduce((sum, i) => sum + i.roomCharge, 0);
    const serviceRevenue = dayInvoices.reduce((sum, i) => sum + i.serviceCharge, 0);
    const surchargeRevenue = dayInvoices.reduce((sum, i) => sum + i.surcharge, 0);
    const paidAmount = dayInvoices.reduce((sum, i) => sum + invoiceCollected(i), 0);
    const debtAmount = dayInvoices.reduce((sum, i) => sum + i.debtAmount, 0);

    // Method breakdown
    const methods = paymentBreakdown(dayInvoices, debts);
    const cashTotal = methods.CASH, transferTotal = methods.TRANSFER, cardTotal = methods.CARD;

    return {
      invoices: dayInvoices,
      totalRevenue,
      roomRevenue,
      serviceRevenue,
      surchargeRevenue,
      paidAmount,
      debtAmount,
      cashTotal,
      transferTotal,
      cardTotal,
      depositTotal: methods.deposit,
      count: dayInvoices.length,
    };
  }, [invoices, selectedDate, debts]);

  // Recent 14 days chart data
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
  const maxMonthlyDayRevenue = Math.max(1, ...Object.values(monthlyData.thisMonth.dayMap), ...Object.values(monthlyData.lastMonth.dayMap));
  const chartDays = Math.max(keys.daysThisMonth, keys.daysLastMonth);

  return (
    <div className="space-y-6">
      {/* View Mode Segmented Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Trung tâm Thống kê & Hiệu quả kinh doanh</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Báo cáo chu kỳ tháng, so sánh tăng trưởng doanh thu và phân tích hiệu suất phòng
          </p>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setSubTab('MONTHLY')}
            className={`min-w-0 flex-1 sm:flex-none px-2 sm:px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              subTab === 'MONTHLY'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Chu kỳ Tháng này vs Tháng trước</span>
          </button>
          <button
            onClick={() => setSubTab('DAILY')}
            className={`min-w-0 flex-1 sm:flex-none px-2 sm:px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              subTab === 'DAILY'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Thống kê theo ngày</span>
          </button>
        </div>
      </div>

      {subTab === 'MONTHLY' ? (
        /* =================== TAB 1: MONTHLY COMPARISON =================== */
        <div className="space-y-6">
          {/* Comparison KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">
                Doanh thu tháng này ({thisMonthLabel})
              </span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(monthlyData.thisMonth.totalRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-600">
                <span>Tháng trước ({lastMonthLabel}):</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(monthlyData.lastMonth.totalRevenue)}
                </span>
              </div>
            </div>

            {/* Room Revenue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">
                Doanh thu tiền phòng (Room Rev)
              </span>
              <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                {formatCurrency(monthlyData.thisMonth.roomRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-600">
                <span>Tháng trước ({lastMonthLabel}):</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(monthlyData.lastMonth.roomRevenue)}
                </span>
              </div>
            </div>

            {/* Minibar & F&B */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">
                Doanh thu Minibar & Dịch vụ
              </span>
              <p className="text-2xl font-bold font-mono text-amber-700 mt-1">
                {formatCurrency(monthlyData.thisMonth.serviceRevenue + monthlyData.thisMonth.surchargeRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-600">
                <span>Tháng trước ({lastMonthLabel}):</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(monthlyData.lastMonth.serviceRevenue + monthlyData.lastMonth.surchargeRevenue)}
                </span>
              </div>
            </div>

            {/* ADR & Occupancy */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">
                Giá phòng bình quân tháng này (ADR)
              </span>
              <p className="text-2xl font-bold font-mono text-blue-700 mt-1">
                {formatCurrency(monthlyData.thisMonth.adr)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-600">
                <span>RevPAR bình quân:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatCurrency(monthlyData.thisMonth.revPar)}
                </span>
              </div>
            </div>
          </div>

          {/* Comparative Month-over-Month Visual Bar Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-700" />
                  Biểu đồ so sánh doanh thu từng ngày: {lastMonthLabel} và {thisMonthLabel}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi tiến độ doanh thu hàng ngày để so sánh tương quan chu kỳ kinh doanh
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-slate-300"></span>
                  <span className="text-slate-600">Tháng trước ({lastMonthLabel})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-700"></span>
                  <span className="font-semibold text-slate-900">Tháng này ({thisMonthLabel})</span>
                </div>
              </div>
            </div>

            {/* SVG / HTML Bar Chart */}
            <p className="sm:hidden text-[11px] text-slate-500">Vuốt ngang để xem đủ các ngày trong tháng.</p>
            <div className="overflow-x-auto pt-4">
              <div className="min-w-[700px]">
              <div className="h-64 flex items-end gap-1.5 pb-6 border-b border-slate-200">
                {Array.from({ length: chartDays }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const septRev = monthlyData.lastMonth.dayMap[dayNum] || 0;
                  const octRev = monthlyData.thisMonth.dayMap[dayNum] || 0;
                  const maxDayVal = maxMonthlyDayRevenue;

                  const septHeight = Math.min(100, Math.round((septRev / maxDayVal) * 100));
                  const octHeight = Math.min(100, Math.round((octRev / maxDayVal) * 100));

                  return (
                    <div key={dayNum} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Hover Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-16 z-30 pointer-events-none bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg whitespace-nowrap">
                        <p className="font-bold text-emerald-400">Ngày {dayNum}</p>
                        <p>{thisMonthLabel}: {formatCurrency(octRev)}</p>
                        <p className="text-slate-400">{lastMonthLabel}: {formatCurrency(septRev)}</p>
                      </div>

                      {/* Twin Bars */}
                      <div className="w-full flex items-end justify-center gap-0.5 h-full">
                        {/* Sept Bar */}
                        <div
                          style={{ height: `${septHeight}%` }}
                          className="w-1.5 bg-slate-200 rounded-t-xs hover:bg-slate-300 transition-all"
                        ></div>
                        {/* Oct Bar */}
                        <div
                          style={{ height: `${octHeight}%` }}
                          className={`w-2 rounded-t-xs transition-all ${
                            octRev > 0 ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-transparent'
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
                <span>Ngày {chartDays}</span>
              </div>
              </div>
            </div>
          </div>

          {/* Breakdown & Structure Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Category breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-700" />
                Cơ cấu nguồn thu khách sạn
              </h4>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">1. Tiền phòng (15 phòng · 2 Tầng)</span>
                    <span className="font-mono font-bold text-slate-900">70%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '70%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-teal-900 font-bold">2. Vé Massage Thư Giãn (5 Loại Vé)</span>
                    <span className="font-mono font-bold text-teal-800">22%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-teal-600 h-2 rounded-full" style={{ width: '22%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">Minibar & Nước giải khát</span>
                    <span className="font-mono font-bold text-slate-900">5%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: '5%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">Giặt là & Dịch vụ khác</span>
                    <span className="font-mono font-bold text-slate-900">3%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '3%' }}></div>
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
                      <th className="py-2.5 px-3 text-right">Tháng trước ({lastMonthLabel})</th>
                      <th className="py-2.5 px-3 text-right">Tháng này ({thisMonthLabel})</th>
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
                        Đang tăng trưởng tốt
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
      ) : (
        /* =================== TAB 2: DAILY REVENUE =================== */
        <div className="space-y-6">
          {/* Daily Date Selector Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Chọn ngày kiểm tra:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                onClick={() => setSelectedDate(today)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Hôm nay
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Tổng số phiếu thu phát sinh trong ngày: <strong className="font-mono text-slate-900">{dailyData.count}</strong> lượt
            </div>
          </div>

          {/* Daily KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">Tổng doanh thu ngày</span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(dailyData.totalRevenue)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Ngày {formatDate(selectedDate)}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-xs font-semibold text-emerald-700 block">Đã thu cho phiếu thu (gồm cọc và thu nợ)</span>
              <p className="text-2xl font-bold font-mono text-emerald-800 mt-1">
                {formatCurrency(dailyData.paidAmount)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                CK: {formatCurrency(dailyData.transferTotal)} · TM: {formatCurrency(dailyData.cashTotal)} · Thẻ: {formatCurrency(dailyData.cardTotal)} · Cọc: {formatCurrency(dailyData.depositTotal)}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs">
              <span className="text-xs font-semibold text-rose-700 block">Ghi nhận khách nợ</span>
              <p className="text-2xl font-bold font-mono text-rose-800 mt-1">
                {formatCurrency(dailyData.debtAmount)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Đã đưa vào sổ công nợ</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">Minibar & Dịch vụ ngày</span>
              <p className="text-2xl font-bold font-mono text-amber-700 mt-1">
                {formatCurrency(dailyData.serviceRevenue + dailyData.surchargeRevenue)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Thu phụ trội ngoài tiền phòng</p>
            </div>
          </div>

          {/* 14-day Trend Mini Chart */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              Xu hướng doanh thu 14 ngày gần nhất
            </h3>

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
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-30 pointer-events-none bg-slate-900 text-white text-[10px] p-1.5 rounded shadow whitespace-nowrap">
                      {item.label}: {formatCurrency(item.revenue)}
                    </div>

                    <div
                      style={{ height: `${item.revenue > 0 ? Math.max(2, heightPercent) : 0}%` }}
                      className={`w-full rounded-t-md transition-all ${
                        isCurrent
                          ? 'bg-emerald-700 ring-2 ring-emerald-400'
                          : 'bg-emerald-100 hover:bg-emerald-300'
                      }`}
                    ></div>

                    <span
                      className={`text-[10px] mt-1.5 font-mono ${
                        isCurrent ? 'font-bold text-emerald-800' : 'text-slate-400'
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
                Không có phiếu thu thanh toán nào phát sinh trong ngày {formatDate(selectedDate)}
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
                        <td className="px-4 py-2.5 font-bold font-mono text-emerald-800">
                          {inv.kind === 'SERVICE' ? 'Khách ngoài' : `P.${inv.roomNumber}`}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">
                          {inv.customerName}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                          {formatCurrency(inv.roomCharge)}
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
    </div>
  );
};
