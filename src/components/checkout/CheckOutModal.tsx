import { localDate, localTime, stayDuration, dateTime } from '../../utils/hotelLogic';
import React, { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Room, PaymentMethod } from '../../types/hotel';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  X,
  Receipt,
  CreditCard,
  QrCode,
  Banknote,
  BadgeAlert,
  Printer,
  CheckCircle2,
  Calendar,
  Coffee,
} from 'lucide-react';

interface CheckOutModalProps {
  room: Room;
  onClose: () => void;
  onPrintInvoice?: (invoiceData: any) => void;
}

export const CheckOutModal: React.FC<CheckOutModalProps> = ({ room, onClose, onPrintInvoice }) => {
  const { stays, checkOutStay, requestConfirm, showToast } = useHotel();

  const activeStay = stays.find(
    s => s.status === 'ACTIVE' && (s.roomId === room.id || s.roomNumber === room.number)
  );

  const [surcharge, setSurcharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFER');
  const [isSplitDebt, setIsSplitDebt] = useState<boolean>(false);
  const [customPaidAmount, setCustomPaidAmount] = useState<number>(0);
  const [debtDueDate, setDebtDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return localDate(d);
  });
  const [notes, setNotes] = useState<string>('');

  const [checkOutDate, setCheckOutDate] = useState(localDate);
  const [checkOutTime, setCheckOutTime] = useState(localTime);

  // Calculations
  const serviceCharge = useMemo(() => {
    if (!activeStay) return 0;
    return activeStay.services.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [activeStay]);

  let duration = 0;
  try { if (activeStay) duration = stayDuration(activeStay, checkOutDate, checkOutTime); } catch {}
  const durationUnit = activeStay?.pricingType === 'HOUR' ? 'giờ' : 'đêm';
  const baseRoomCharge = duration * (activeStay?.rateApplied || 0);
  const subtotalBeforeDeposit = baseRoomCharge + serviceCharge + surcharge - discount;
  const depositDeducted = Math.min(activeStay?.deposit || 0, Math.max(0, subtotalBeforeDeposit));
  const refundAmount = Math.max(0, (activeStay?.deposit || 0) - subtotalBeforeDeposit);
  const netPayable = Math.max(0, subtotalBeforeDeposit - depositDeducted);

  // Paid & Debt breakdown
  let finalPaidAmount = netPayable;
  let finalDebtAmount = 0;

  if (paymentMethod === 'DEBT') {
    finalPaidAmount = 0;
    finalDebtAmount = netPayable;
  } else if (isSplitDebt) {
    finalPaidAmount = Math.min(netPayable, Math.max(0, customPaidAmount));
    finalDebtAmount = Math.max(0, netPayable - finalPaidAmount);
  }

  const handleConfirmCheckout = () => {
    if (!activeStay) return;
    if (!duration || surcharge < 0 || discount < 0 || discount > baseRoomCharge + serviceCharge + surcharge || dateTime(checkOutDate, checkOutTime) > Date.now() + 60000) { showToast('Kiểm tra thời gian trả phòng, phụ thu và giảm giá.', 'error'); return; }

    requestConfirm({
      title: 'Xác nhận thanh toán & Trả phòng',
      message: `Xác nhận thanh toán cho Phòng ${room.number} (Khách: ${activeStay.customerName})? Tổng thanh toán: ${formatCurrency(netPayable)}${refundAmount > 0 ? ` · Hoàn cọc: ${formatCurrency(refundAmount)}` : ''} (${finalPaidAmount > 0 ? `Thu: ${formatCurrency(finalPaidAmount)}` : ''}${finalDebtAmount > 0 ? ` · Ghi nợ: ${formatCurrency(finalDebtAmount)}` : ''}).`,
      confirmLabel: 'Xác nhận trả phòng',
      onConfirm: async () => {
        const invoice = await checkOutStay({
          stayId: activeStay.id,
          checkOutDate, checkOutTime,
          roomCharge: baseRoomCharge,
          serviceCharge,
          surcharge: Number(surcharge || 0),
          discount: Number(discount || 0),
          depositDeducted,
          totalAmount: netPayable,
          paidAmount: finalPaidAmount,
          debtAmount: finalDebtAmount,
          paymentMethod,
          notes,
          dueDateForDebt: debtDueDate,
        });

        showToast(`Đã hoàn tất trả Phòng ${room.number} và tạo hóa đơn ${invoice.code}!`, 'success');

        if (onPrintInvoice) {
          onPrintInvoice(invoice);
        }
        onClose();
      },
    });
  };

  if (!activeStay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
          <p className="font-semibold text-slate-800">Không tìm thấy thông tin lượt lưu trú của phòng này</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold leading-tight">
                Thanh toán & Trả phòng {room.number}
              </h3>
              <p className="text-xs text-slate-300">
                Khách: <strong className="text-white">{activeStay.customerName}</strong> · SĐT: {activeStay.phone}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Breakdown */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Stay Info Card */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 block font-medium">Thời gian nhận</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {formatDateTime(activeStay.checkInDate, activeStay.checkInTime)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Thời gian trả</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {formatDateTime(checkOutDate, checkOutTime)} ({duration} {durationUnit})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Tiền cọc trước</span>
              <span className="font-mono font-bold text-emerald-700 mt-0.5 block">
                {formatCurrency(depositDeducted)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>Ngày trả thực tế<input aria-label="Ngày trả thực tế" type="date" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} className="mt-1 w-full p-2 border border-slate-300 rounded-lg" /></label>
            <label>Giờ trả thực tế<input aria-label="Giờ trả thực tế" type="time" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} className="mt-1 w-full p-2 border border-slate-300 rounded-lg" /></label>
          </div>
          <p className="text-slate-500">Theo giờ: làm tròn lên mỗi giờ. Theo đêm: tính theo ngày nhận và ngày trả, tối thiểu 1 đêm.</p>
          {refundAmount > 0 && <p className="p-3 rounded-lg bg-amber-50 text-amber-900">Hoàn lại tiền cọc cho khách: <strong>{formatCurrency(refundAmount)}</strong></p>}
          {/* Detailed Bill Breakdown */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-700 uppercase text-[11px] tracking-wider flex items-center justify-between">
              <span>Khoản mục thanh toán</span>
              <span>Số tiền (VNĐ)</span>
            </div>
            <div className="divide-y divide-slate-100 p-2 space-y-1">
              <div className="flex items-center justify-between px-2 py-1.5">
                <div>
                  <span className="font-semibold text-slate-800">Tiền phòng ({room.typeName})</span>
                  <span className="block text-[11px] text-slate-500">
                    {duration} {durationUnit} × {formatCurrency(activeStay.rateApplied)}
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(baseRoomCharge)}
                </span>
              </div>

              <div className="flex items-center justify-between px-2 py-1.5">
                <div>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Coffee className="w-3.5 h-3.5 text-amber-600" />
                    Dịch vụ minibar & giặt là
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {activeStay.services.length} mặt hàng đã sử dụng
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(serviceCharge)}
                </span>
              </div>

              {/* Adjustments row */}
              <div className="grid grid-cols-2 gap-3 px-2 py-2 bg-slate-50/70 rounded-lg">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Phụ thu (quá giờ/thêm người)
                  </label>
                  <input
                    type="number"
                    step="1"
                    aria-label="Phụ thu (VNĐ)"
                    min="0"
                    placeholder="0"
                    value={surcharge || ''}
                    onChange={e => setSurcharge(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Giảm giá / Voucher
                  </label>
                  <input
                    type="number"
                    step="1"
                    aria-label="Giảm giá (VNĐ)"
                    min="0"
                    placeholder="0"
                    value={discount || ''}
                    onChange={e => setDiscount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md font-mono text-rose-600"
                  />
                </div>
              </div>

              {depositDeducted > 0 && (
                <div className="flex items-center justify-between px-2 py-1.5 text-emerald-800 font-medium">
                  <span>Trừ tiền cọc đã thu:</span>
                  <span className="font-mono">- {formatCurrency(depositDeducted)}</span>
                </div>
              )}
            </div>

            {/* Total Highlight */}
            <div className="bg-emerald-50 px-4 py-3 border-t border-emerald-100 flex items-center justify-between text-emerald-950">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider">Tổng cần thanh toán:</span>
                <span className="block text-[11px] text-emerald-700">Đã khấu trừ tiền cọc</span>
              </div>
              <span className="text-xl font-bold font-mono text-emerald-800">
                {formatCurrency(netPayable)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Phương thức thanh toán <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('TRANSFER');
                  setIsSplitDebt(false);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentMethod === 'TRANSFER' && !isSplitDebt
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold ring-2 ring-emerald-600/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-5 h-5 text-emerald-600" />
                <span>Chuyển khoản QR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('CASH');
                  setIsSplitDebt(false);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentMethod === 'CASH' && !isSplitDebt
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold ring-2 ring-emerald-600/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-5 h-5 text-emerald-600" />
                <span>Tiền mặt</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('CARD');
                  setIsSplitDebt(false);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentMethod === 'CARD' && !isSplitDebt
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold ring-2 ring-emerald-600/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Thẻ POS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('DEBT');
                  setIsSplitDebt(false);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentMethod === 'DEBT'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 font-bold ring-2 ring-rose-600/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <BadgeAlert className="w-5 h-5 text-rose-600" />
                <span>Ghi nợ 100%</span>
              </button>
            </div>
          </div>

          {/* Partial payment / debt toggle */}
          {paymentMethod !== 'DEBT' && (
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isSplitDebt}
                  onChange={e => {
                    setIsSplitDebt(e.target.checked);
                    if (e.target.checked && customPaidAmount === 0) {
                      setCustomPaidAmount(Math.round(netPayable / 2));
                    }
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Khách chỉ trả một phần, số tiền còn lại ghi vào công nợ</span>
              </label>

              {isSplitDebt && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Khách thanh toán trước (VNĐ)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={netPayable}
                        value={customPaidAmount}
                        onChange={e => setCustomPaidAmount(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <span className="block text-slate-700 font-semibold mb-1">
                        Số tiền ghi nợ còn lại
                      </span>
                      <div className="px-3 py-1.5 bg-rose-100 text-rose-800 font-mono font-bold rounded-lg border border-rose-200">
                        {formatCurrency(finalDebtAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Debt specifics if any debt incurred */}
          {(paymentMethod === 'DEBT' || finalDebtAmount > 0) && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-900">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <BadgeAlert className="w-4 h-4 text-rose-600" />
                  Ghi sổ công nợ: {formatCurrency(finalDebtAmount)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Hạn thanh toán nợ</label>
                  <input
                    type="date"
                    value={debtDueDate}
                    onChange={e => setDebtDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Ghi chú đối tác nợ</label>
                  <input
                    type="text"
                    placeholder="Đoàn công ty, tour du lịch..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
          >
            Quay lại
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleConfirmCheckout}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Xác nhận thanh toán & Trả phòng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
