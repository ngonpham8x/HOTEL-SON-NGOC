import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import type { Invoice, PaymentMethod } from '../../types/hotel';
import { formatCurrency, getPaymentMethodName } from '../../utils/formatters';
import {
  X,
  Trash2,
  User,
  Phone,
  FileText,
  CreditCard,
  Check,
  AlertTriangle,
  Receipt,
  DoorOpen,
} from 'lucide-react';

interface EditRoomInvoiceModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export const EditRoomInvoiceModal: React.FC<EditRoomInvoiceModalProps> = ({
  invoice,
  onClose,
}) => {
  const { updateRoomInvoice, cancelRoomInvoice, requestConfirm } = useHotel();

  const [customerName, setCustomerName] = useState(invoice.customerName || '');
  const [phone, setPhone] = useState(invoice.phone || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(invoice.paymentMethod || 'CASH');
  const [notes, setNotes] = useState(invoice.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerName.trim()) {
      setError('Vui lòng nhập tên khách hàng.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateRoomInvoice(invoice.id, {
        customerName: customerName.trim(),
        phone: phone.trim(),
        paymentMethod,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu phiếu thu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvoice = () => {
    requestConfirm({
      title: `Hủy phiếu thu ${invoice.code}?`,
      message: `Bạn có chắc chắn muốn hủy phiếu thu phòng ${invoice.roomNumber} của khách ${invoice.customerName}? Doanh thu ${formatCurrency(invoice.totalAmount)} của phiếu thu này sẽ được điều chỉnh về 0 và chuyển sang trạng thái ĐÃ HỦY.`,
      confirmLabel: 'Xác nhận hủy phiếu thu',
      cancelLabel: 'Đóng',
      isDanger: true,
      onConfirm: async () => {
        try {
          await cancelRoomInvoice(invoice.id);
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Không thể hủy phiếu thu.');
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden my-auto animate-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Sửa Phiếu Thu Phòng
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                  {invoice.code}
                </span>
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                Phòng {invoice.roomNumber} · Lập lúc: {invoice.time} {invoice.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Snapshot Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 block">Tiền phòng</span>
              <strong className="font-mono text-slate-800">{formatCurrency(invoice.roomCharge)}</strong>
            </div>
            <div>
              <span className="text-[11px] text-teal-700 block">Vé Massage</span>
              <strong className="font-mono text-teal-800">{formatCurrency(invoice.massageCharge || 0)}</strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Dịch vụ & Phụ thu</span>
              <strong className="font-mono text-slate-800">{formatCurrency(invoice.serviceCharge + invoice.surcharge)}</strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Tổng cộng</span>
              <strong className="font-mono text-slate-900 font-bold">{formatCurrency(invoice.totalAmount)}</strong>
            </div>
            <div>
              <span className="text-[11px] text-emerald-700 block">Đã thu</span>
              <strong className="font-mono text-emerald-800 font-bold">{formatCurrency(invoice.paidAmount)}</strong>
            </div>
            <div>
              <span className="text-[11px] text-rose-700 block">Ghi nợ</span>
              <strong className="font-mono text-rose-800 font-bold">{invoice.debtAmount > 0 ? formatCurrency(invoice.debtAmount) : '0 ₫'}</strong>
            </div>
          </div>

          {/* Khách hàng */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Tên khách hàng <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-medium"
              placeholder="Nhập tên khách hàng..."
            />
          </div>

          {/* Số điện thoại */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              Số điện thoại
            </label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono"
              placeholder="Số điện thoại liên hệ..."
            />
          </div>

          {/* Phương thức thanh toán */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              Hình thức thanh toán
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['CASH', 'TRANSFER', 'CARD', 'DEBT'] as PaymentMethod[]).map(method => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                    paymentMethod === method
                      ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {getPaymentMethodName(method)}
                </button>
              ))}
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Ghi chú phiếu thu
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              placeholder="Ghi chú thêm nếu có..."
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleCancelInvoice}
              className="w-full sm:w-auto px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa / Hủy phiếu thu</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors text-center"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs shadow-teal-700/20"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
