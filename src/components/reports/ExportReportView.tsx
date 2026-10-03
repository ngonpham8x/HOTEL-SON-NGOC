import { AccessGuard } from '../common/AccessGuard';
import { localDate, periodKeys, invoiceRevenue, invoiceCollected } from '../../utils/hotelLogic';
import React, { useState, useMemo } from 'react';
import { HotelLogo } from '../common/HotelLogo';
import { useHotel } from '../../context/HotelContext';
import { exportRevenueToExcel, exportDebtsToExcel, exportRoomsToExcel } from '../../utils/exportExcel';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Building2,
  CheckCircle,
  Download,
  Filter,
} from 'lucide-react';

export const ExportReportView: React.FC = () => {
  const { invoices, debts, rooms, showToast, today, exportBackup, importBackup, requestConfirm } = useHotel();
  const keys = periodKeys(today);
  const thisMonthLabel = keys.thisMonth.split('-').reverse().join('/');
  const lastMonthLabel = keys.lastMonth.split('-').reverse().join('/');
  const [period, setPeriod] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'TODAY' | 'ALL'>('THIS_MONTH');

  // Filter invoices according to selected period
  const filteredInvoices = useMemo(() => {
    switch (period) {
      case 'THIS_MONTH':
        return invoices.filter(i => i.date.startsWith(keys.thisMonth));
      case 'LAST_MONTH':
        return invoices.filter(i => i.date.startsWith(keys.lastMonth));
      case 'TODAY':
        return invoices.filter(i => i.date === today);
      case 'ALL':
      default:
        return invoices;
    }
  }, [invoices, period, today]);

  const periodTitle = useMemo(() => {
    switch (period) {
      case 'THIS_MONTH':
        return `Tháng ${thisMonthLabel} (Tháng này)`;
      case 'LAST_MONTH':
        return `Tháng ${lastMonthLabel} (Tháng trước)`;
      case 'TODAY':
        return `Ngày hôm nay (${formatDate(today)})`;
      case 'ALL':
      default:
        return 'Toàn bộ thời gian';
    }
  }, [period, today]);

  // Aggregate values
  const totalRev = filteredInvoices.reduce((sum, i) => sum + invoiceRevenue(i), 0);
  const roomRev = filteredInvoices.reduce((sum, i) => sum + i.roomCharge, 0);
  const serviceRev = filteredInvoices.reduce((sum, i) => sum + i.serviceCharge, 0);
  const surchargeRev = filteredInvoices.reduce((sum, i) => sum + i.surcharge, 0);
  const discountTotal = filteredInvoices.reduce((sum, i) => sum + i.discount, 0);
  const paidTotal = filteredInvoices.reduce((sum, i) => sum + invoiceCollected(i), 0);
  const debtTotal = filteredInvoices.reduce((sum, i) => sum + i.debtAmount, 0);

  const handlePrintPDF = () => {
    window.print();
  };

  const handleExportExcelRevenue = async () => {
    try {
      showToast('Đang kết xuất tệp Excel bằng ExcelJS...');
      const filename = `Bao_Cao_Doanh_Thu_Hotel_Son_Ngoc_${period}.xlsx`;
      await exportRevenueToExcel(filteredInvoices, filename);
      showToast('Đã tải xuống Báo cáo Doanh thu ExcelJS thành công!', 'success');
    } catch (err) {
      showToast('Lỗi khi xuất file Excel', 'error');
    }
  };

  const handleExportExcelDebts = async () => {
    try {
      showToast('Đang kết xuất Sổ công nợ bằng ExcelJS...');
      await exportDebtsToExcel(debts, 'Bao_Cao_Cong_No_Khach_Hotel_Son_Ngoc.xlsx');
      showToast('Đã tải xuống Sổ Công nợ ExcelJS thành công!', 'success');
    } catch (err) {
      showToast('Lỗi khi xuất file Excel', 'error');
    }
  };

  const handleExportExcelRooms = async () => {
    try {
      showToast('Đang kết xuất Danh sách phòng bằng ExcelJS...');
      await exportRoomsToExcel(rooms, 'Danh_Sach_Phong_Hotel_Son_Ngoc.xlsx');
      showToast('Đã tải xuống Danh sách phòng ExcelJS thành công!', 'success');
    } catch (err) {
      showToast('Lỗi khi xuất file Excel', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Export Actions (Hidden during print) */}
      <div className="no-print bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              Trung tâm Xuất Báo cáo Tài chính & Nghiệp vụ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ kết xuất định dạng chuẩn Microsoft Excel (.xlsx) và in ấn / lưu trữ PDF
            </p>
          </div>

          <div className="flex items-center gap-2">
            <AccessGuard action="data.export"><button
              onClick={handlePrintPDF}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>In báo cáo / Lưu PDF</span>
            </button></AccessGuard>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Chu kỳ báo cáo:
          </span>
          <button
            onClick={() => setPeriod('THIS_MONTH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period === 'THIS_MONTH'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tháng này ({thisMonthLabel})
          </button>
          <button
            onClick={() => setPeriod('LAST_MONTH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period === 'LAST_MONTH'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tháng trước ({lastMonthLabel})
          </button>
          <button
            onClick={() => setPeriod('TODAY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period === 'TODAY'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Hôm nay ({formatDate(today)})
          </button>
          <button
            onClick={() => setPeriod('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period === 'ALL'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả thời gian ({invoices.length} HĐ)
          </button>
        </div>

        {/* 3 Direct Excel Download Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-xs text-slate-900">Báo cáo Doanh thu ({periodTitle})</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{filteredInvoices.length} lượt hóa đơn</p>
            </div>
            <AccessGuard action="data.export"><button
              onClick={handleExportExcelRevenue}
              className="p-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors"
              title="Tải tệp Excel .xlsx"
            >
              <Download className="w-4 h-4" />
            </button></AccessGuard>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-xs text-slate-900">Sổ theo dõi Công nợ khách</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{debts.length} hồ sơ đối soát</p>
            </div>
            <AccessGuard action="data.export"><button
              onClick={handleExportExcelDebts}
              className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
              title="Tải tệp Excel .xlsx"
            >
              <Download className="w-4 h-4" />
            </button></AccessGuard>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-xs text-slate-900">Sơ đồ & Danh sách phòng</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{rooms.length} phòng toàn khách sạn</p>
            </div>
            <AccessGuard action="data.export"><button
              onClick={handleExportExcelRooms}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              title="Tải tệp Excel .xlsx"
            >
              <Download className="w-4 h-4" />
            </button></AccessGuard>
          </div>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs">
        <AccessGuard action="data.export"><button onClick={exportBackup} className="px-3 py-2 bg-teal-700 text-white rounded-lg font-semibold">Tải bản sao lưu dữ liệu</button></AccessGuard>
        <AccessGuard action="data.restore"><label className="px-3 py-2 border border-slate-300 rounded-lg cursor-pointer font-semibold">Khôi phục từ bản sao lưu
          <input aria-label="Khôi phục từ bản sao lưu" type="file" accept=".json,application/json" className="sr-only" onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
            try { const text = await file.text(); requestConfirm({ title: 'Khôi phục bản sao lưu', message: `Thay dữ liệu hiện tại bằng bản sao lưu ${file.name}? Hãy tải bản sao lưu hiện tại trước khi tiếp tục.`, onConfirm: async () => { await importBackup(text); showToast('Đã khôi phục bản sao lưu.'); } }); } catch { showToast('Không đọc được tệp.', 'error'); }
          }} />
        </label></AccessGuard>
      </div>
      {/* Formal Printable Document Sheet */}
      <div className="bg-white report-sheet min-w-0 p-4 sm:p-8 lg:p-12 rounded-xl border border-slate-200 shadow-sm print-container space-y-6 text-slate-900 text-xs">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start border-b border-slate-900 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <HotelLogo size="sm" />
              <h1 className="text-lg font-extrabold uppercase text-slate-900 tracking-tight">
                HOTEL SƠN NGỌC
              </h1>
            </div>
            <p className="text-slate-600 mt-0.5">Địa chỉ: Số 70 Quốc lộ 20, xã Hòa Ninh, Lâm Đồng</p>
            <p className="text-emerald-800 font-semibold mt-0.5">Hotline: 0392.089.960 (Ms Trinh) · Email: sonngochotel@gmail.com</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500 uppercase block">Mẫu biểu số: 02-BCTCKH</span>
            <span className="text-[11px] text-slate-500 block">Thời gian lập: {formatDate(today)}</span>
          </div>
        </div>

        {/* Report Main Title */}
        <div className="text-center space-y-1 py-2">
          <h2 className="text-lg font-extrabold uppercase tracking-wide text-slate-900">
            BÁO CÁO DOANH THU & THANH TOÁN HÓA ĐƠN
          </h2>
          <p className="text-sm font-semibold text-emerald-800">
            Kỳ báo cáo: {periodTitle}
          </p>
        </div>

        {/* Summary Financial Matrix */}
        <div className="border border-slate-300 rounded-lg overflow-x-auto">
          <table className="report-financial w-full min-w-[460px] text-left border-collapse">
            <thead className="bg-slate-100 font-bold uppercase text-[11px] border-b border-slate-300 text-slate-800">
              <tr>
                <th className="py-2.5 px-4">Khoản mục doanh thu</th>
                <th className="py-2.5 px-4 text-center">Tỷ trọng</th>
                <th className="py-2.5 px-4 text-right">Số tiền (VNĐ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 px-4 font-semibold">1. Doanh thu tiền phòng lưu trú</td>
                <td className="py-2.5 px-4 text-center font-mono">
                  {totalRev > 0 ? Math.round((roomRev / totalRev) * 100) : 0}%
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold">{formatCurrency(roomRev)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold">2. Doanh thu dịch vụ & Massage</td>
                <td className="py-2.5 px-4 text-center font-mono">
                  {totalRev > 0 ? Math.round((serviceRev / totalRev) * 100) : 0}%
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold">{formatCurrency(serviceRev)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold">3. Phụ thu (quá giờ, thêm khách, dịch vụ khác)</td>
                <td className="py-2.5 px-4 text-center font-mono">
                  {totalRev > 0 ? Math.round((surchargeRev / totalRev) * 100) : 0}%
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold">{formatCurrency(surchargeRev)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold">4. Giảm giá</td>
                <td className="py-2.5 px-4 text-center font-mono">{totalRev > 0 ? -Math.round(discountTotal / totalRev * 100) : 0}%</td>
                <td className="py-2.5 px-4 text-right font-mono">- {formatCurrency(discountTotal)}</td>
              </tr>
              <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-400">
                <td className="py-3 px-4 uppercase">TỔNG DOANH THU TOÀN KHÁCH SẠN</td>
                <td className="py-3 px-4 text-center font-mono">100%</td>
                <td className="py-3 px-4 text-right font-mono text-base text-emerald-900">
                  {formatCurrency(totalRev)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 text-emerald-800 font-semibold pl-8">
                  - Đã thu cho hóa đơn (gồm cọc và thu nợ)
                </td>
                <td className="py-2.5 px-4 text-center font-mono text-emerald-800">
                  {totalRev > 0 ? Math.round((paidTotal / totalRev) * 100) : 0}%
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-800">
                  {formatCurrency(paidTotal)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 text-rose-800 font-semibold pl-8">
                  - Số tiền khách còn nợ (Đã chuyển tiếp vào sổ nợ công nợ)
                </td>
                <td className="py-2.5 px-4 text-center font-mono text-rose-800">
                  {totalRev > 0 ? Math.round((debtTotal / totalRev) * 100) : 0}%
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-800">
                  {formatCurrency(debtTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Invoices list preview snippet */}
        <div className="space-y-2 pt-2">
          <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-800">
            Trích lục danh sách hóa đơn kỳ báo cáo (Hiển thị 10 giao dịch gần nhất)
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[11px]">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Mã HĐ</th>
                  <th className="py-2 px-3">Ngày</th>
                  <th className="py-2 px-3">Phòng</th>
                  <th className="py-2 px-3">Khách hàng</th>
                  <th className="py-2 px-3 text-right">Tổng tiền</th>
                  <th className="py-2 px-3 text-right">Đã thanh toán</th>
                  <th className="py-2 px-3 text-right">Ghi nợ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.slice(0, 10).map(inv => (
                  <tr key={inv.id}>
                    <td className="py-2 px-3 font-mono font-bold">{inv.code}</td>
                    <td className="py-2 px-3">{formatDate(inv.date)}</td>
                    <td className="py-2 px-3 font-mono font-bold">{inv.kind === 'SERVICE' ? 'Khách ngoài' : `P.${inv.roomNumber}`}</td>
                    <td className="py-2 px-3">{inv.customerName}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{formatCurrency(invoiceRevenue(inv))}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-800">{formatCurrency(invoiceCollected(inv))}</td>
                    <td className="py-2 px-3 text-right font-mono text-rose-800">{inv.debtAmount > 0 ? formatCurrency(inv.debtAmount) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>


      </div>
    </div>
  );
};
