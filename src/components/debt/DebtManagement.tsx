import { AccessGuard } from '../common/AccessGuard';
import { useAccess } from '../../context/AccessContext';
import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { DebtRecord, PaymentMethod } from '../../types/hotel';
import { formatCurrency, formatDate, getDebtStatusMeta, getPaymentMethodName } from '../../utils/formatters';
import { exportDebtsToExcel } from '../../utils/exportExcel';
import {
  BadgeAlert,
  Search,
  DollarSign,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  History,
  X,
  CreditCard,
  User,
  Phone,
  AlertTriangle,
} from 'lucide-react';

export const DebtManagement: React.FC = () => {
  const { canAct } = useAccess();
  const { debts, recordDebtPayment, showToast } = useHotel();
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE_DEBT');
  const [search, setSearch] = useState<string>('');

  // Selected debt for collecting payment modal
  const [collectingDebt, setCollectingDebt] = useState<DebtRecord | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('TRANSFER');
  const [collectorName, setCollectorName] = useState<string>('Lễ tân ca sáng');
  const [payNotes, setPayNotes] = useState<string>('');

  // Selected debt for viewing history
  const [viewingHistoryDebt, setViewingHistoryDebt] = useState<DebtRecord | null>(null);

  // Filter logic
  const filteredDebts = debts.filter(d => {
    if (filterStatus === 'ACTIVE_DEBT' && d.remainingAmount === 0) return false;
    if (filterStatus === 'SETTLED' && d.status !== 'SETTLED') return false;
    if (filterStatus === 'OVERDUE' && d.status !== 'OVERDUE') return false;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = d.customerName.toLowerCase().includes(q);
      const matchPhone = d.phone.includes(q);
      const matchCode = d.invoiceCode.toLowerCase().includes(q);
      const matchRoom = d.roomNumber.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchCode && !matchRoom) return false;
    }
    return true;
  });

  // Aggregate stats
  const totalOriginalDebt = debts.reduce((sum, d) => sum + d.originalDebt, 0);
  const totalPaid = debts.reduce((sum, d) => sum + d.paidAmount, 0);
  const totalRemaining = debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const activeDebtorsCount = debts.filter(d => d.remainingAmount > 0).length;
  const overdueCount = debts.filter(d => d.status === 'OVERDUE').length;

  const handleOpenCollectModal = (debt: DebtRecord) => {
    setCollectingDebt(debt);
    setPayAmount(debt.remainingAmount);
    setPayNotes(`Thu nợ hóa đơn ${debt.invoiceCode}`);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingDebt || payAmount <= 0) return;

    try {
    await recordDebtPayment(
      collectingDebt.id,
      payAmount,
      payMethod,
      collectorName,
      payNotes
    );

    showToast(`Đã thu nợ ${formatCurrency(payAmount)} từ ${collectingDebt.customerName} thành công!`, 'success');
    setCollectingDebt(null);
    } catch (err) { showToast(err instanceof Error ? err.message : 'Không thu được công nợ.', 'error'); }
  };

  const handleExportExcel = async () => {
    try {
      showToast('Đang kết xuất sổ công nợ bằng ExcelJS...');
      await exportDebtsToExcel(debts);
      showToast('Đã xuất file Excel Sổ công nợ thành công!', 'success');
    } catch {
      showToast('Lỗi khi xuất file Excel', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-semibold">Tổng nợ cần thu hồi</span>
            <BadgeAlert className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-800 mt-1">
            {formatCurrency(totalRemaining)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Từ <strong>{activeDebtorsCount}</strong> khách hàng / đơn vị nợ
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold">Đã thu hồi được</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-800 mt-1">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Tỷ lệ thu hồi: <strong>{totalOriginalDebt > 0 ? Math.round((totalPaid / totalOriginalDebt) * 100) : 0}%</strong>
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold">Nợ quá hạn</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-800 mt-1">
            {overdueCount} hồ sơ
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Cần liên hệ nhắc nợ gấp
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-semibold">Báo cáo & Đối soát</span>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </div>
          <AccessGuard action="data.export"><button
            onClick={handleExportExcel}
            className="mt-2 w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel sổ công nợ</span>
          </button></AccessGuard>
        </div>
      </div>

      {/* Control Bar & Filter Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('ACTIVE_DEBT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'ACTIVE_DEBT'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Đang còn nợ ({activeDebtorsCount})
          </button>
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả hồ sơ ({debts.length})
          </button>
          <button
            onClick={() => setFilterStatus('OVERDUE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'OVERDUE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Quá hạn ({overdueCount})
          </button>
          <button
            onClick={() => setFilterStatus('SETTLED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'SETTLED'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Đã thanh toán đủ ({debts.filter(d => d.status === 'SETTLED').length})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên khách, SĐT, số phòng..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Debt Records Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {filteredDebts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-800">Không có công nợ nào trong danh sách</p>
            <p className="text-xs text-slate-400 mt-1">Toàn bộ khách hàng đã thanh toán đầy đủ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Mã HĐ & Ngày lập</th>
                  <th className="px-4 py-3">Khách hàng / Đơn vị</th>
                  <th className="px-4 py-3">Phòng đã ở</th>
                  <th className="px-4 py-3">Hạn thanh toán</th>
                  <th className="px-4 py-3 text-right">Tổng nợ ban đầu</th>
                  <th className="px-4 py-3 text-right">Đã thu hồi</th>
                  <th className="px-4 py-3 text-right">Còn phải thu</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDebts.map(debt => {
                  const meta = getDebtStatusMeta(debt.status);
                  const isSettled = debt.remainingAmount === 0;

                  return (
                    <tr key={debt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-slate-900 block">
                          {debt.invoiceCode}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(debt.createdDate)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{debt.customerName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{debt.phone}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium text-slate-700">
                        {debt.roomNumber}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(debt.dueDate)}</span>
                        </div>
                        {debt.status === 'OVERDUE' && (
                          <span className="text-[10px] text-rose-600 font-semibold block">
                            Đã quá hạn
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {formatCurrency(debt.originalDebt)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">
                        {formatCurrency(debt.paidAmount)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-extrabold text-sm text-rose-700">
                        {formatCurrency(debt.remainingAmount)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {debt.paymentHistory.length > 0 && (
                            <button
                              onClick={() => setViewingHistoryDebt(debt)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Xem lịch sử thu hồi nợ"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}

                          {!isSettled && (
                            <AccessGuard action="debt.collect"><button
                              onClick={() => handleOpenCollectModal(debt)}
                              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors shadow-xs"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Thu nợ</span>
                            </button></AccessGuard>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collect Payment Modal */}
      {collectingDebt && canAct('debt.collect') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <h3 className="text-sm font-bold">Thu hồi công nợ khách hàng</h3>
                <p className="text-xs text-slate-300">
                  {collectingDebt.customerName} · {collectingDebt.invoiceCode}
                </p>
              </div>
              <button
                onClick={() => setCollectingDebt(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <AccessGuard action="debt.collect"><form onSubmit={handleConfirmPayment} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-900">
                <div className="flex justify-between">
                  <span>Số tiền nợ còn lại:</span>
                  <span className="font-mono font-bold text-base">
                    {formatCurrency(collectingDebt.remainingAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>Hạn trả nợ:</span>
                  <span>{formatDate(collectingDebt.dueDate)}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Số tiền thu đợt này (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={collectingDebt.remainingAmount}
                  value={payAmount}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-base text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPayAmount(collectingDebt.remainingAmount)}
                    className="text-[11px] text-emerald-700 font-semibold underline hover:text-emerald-900"
                  >
                    Thu đủ toàn bộ ({formatCurrency(collectingDebt.remainingAmount)})
                  </button>
                  {collectingDebt.remainingAmount > 1000000 && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(Math.round(collectingDebt.remainingAmount / 2))}
                      className="text-[11px] text-slate-500 underline hover:text-slate-800"
                    >
                      Thu 50%
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Phương thức thanh toán
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value="TRANSFER">Chuyển khoản ngân hàng (VietQR)</option>
                  <option value="CASH">Tiền mặt tại quầy lễ tân</option>
                  <option value="CARD">Quẹt thẻ ngân hàng POS</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Người thực hiện thu tiền
                </label>
                <input
                  type="text"
                  value={collectorName}
                  onChange={e => setCollectorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Ghi chú chứng từ thanh toán
                </label>
                <input
                  type="text"
                  placeholder="Mã giao dịch ngân hàng hoặc số phiếu thu..."
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCollectingDebt(null)}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 rounded-lg font-semibold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác nhận đã thu</span>
                </button>
              </div>
            </form></AccessGuard>
          </div>
        </div>
      )}

      {/* View Debt History Modal */}
      {viewingHistoryDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <h3 className="text-sm font-bold">Lịch sử thu nợ</h3>
                <p className="text-xs text-slate-300">
                  {viewingHistoryDebt.customerName} · {viewingHistoryDebt.invoiceCode}
                </p>
              </div>
              <button
                onClick={() => setViewingHistoryDebt(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div>
                  <span className="text-slate-400 block text-[10px]">Nợ ban đầu</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(viewingHistoryDebt.originalDebt)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Đã thu</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatCurrency(viewingHistoryDebt.paidAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Còn lại</span>
                  <span className="font-mono font-bold text-rose-700">
                    {formatCurrency(viewingHistoryDebt.remainingAmount)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Các đợt đã thanh toán ({viewingHistoryDebt.paymentHistory.length})
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {viewingHistoryDebt.paymentHistory.map((h, idx) => (
                    <div key={h.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">
                          Đợt {idx + 1}: {formatCurrency(h.amount)}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatDate(h.date)} {h.time} · {getPaymentMethodName(h.method)}
                        </span>
                        {h.notes && (
                          <span className="text-[11px] text-slate-400 block italic">
                            Ghi chú: {h.notes}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        Thu bởi: {h.collectedBy}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 text-right">
                <button
                  onClick={() => setViewingHistoryDebt(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
