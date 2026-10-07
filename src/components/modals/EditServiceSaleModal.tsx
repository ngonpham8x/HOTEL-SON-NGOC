import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import type { Invoice, PaymentMethod } from '../../types/hotel';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  Plus,
  Trash2,
  Ticket,
  User,
  Phone,
  FileText,
  CreditCard,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface EditServiceSaleModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export const EditServiceSaleModal: React.FC<EditServiceSaleModalProps> = ({
  invoice,
  onClose,
}) => {
  const { services, updateServiceSale, cancelServiceSale, requestConfirm, showToast, today } = useHotel();

  const [customerName, setCustomerName] = useState(invoice.customerName || '');
  const [phone, setPhone] = useState(invoice.customerPhone || '');
  const [items, setItems] = useState<{ serviceId: string; quantity: number }[]>(() => {
    if (invoice.services && invoice.services.length > 0) {
      return invoice.services.map(s => ({
        serviceId: s.serviceId,
        quantity: s.quantity,
      }));
    }
    return [];
  });
  const [serviceIdToAdd, setServiceIdToAdd] = useState(() => services[0]?.id || '');
  const [discount, setDiscount] = useState<number>(invoice.discount || 0);
  const [paidAmount, setPaidAmount] = useState<number>(invoice.paidAmount ?? invoice.totalAmount);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(invoice.paymentMethod || 'CASH');
  const [dueDate, setDueDate] = useState<string>(today);
  const [notes, setNotes] = useState(invoice.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const subtotal = items.reduce((sum, item) => {
    const s = services.find(sv => sv.id === item.serviceId);
    return sum + (s?.price || 0) * item.quantity;
  }, 0);

  const total = Math.max(0, subtotal - discount);
  const amount = Math.min(paidAmount, total);

  const handleAddItem = () => {
    if (!services.some(s => s.id === serviceIdToAdd)) return;
    setItems(prev => {
      const exists = prev.find(i => i.serviceId === serviceIdToAdd);
      if (exists) {
        return prev.map(i =>
          i.serviceId === serviceIdToAdd ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { serviceId: serviceIdToAdd, quantity: 1 }];
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.serviceId !== id));
  };

  const handleQuantityChange = (id: string, qty: number) => {
    if (qty < 1) return;
    setItems(prev =>
      prev.map(i => (i.serviceId === id ? { ...i, quantity: qty } : i))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (items.length === 0) {
      setError('Vui lòng chọn ít nhất một vé hoặc dịch vụ.');
      return;
    }

    if (amount < total && (!customerName.trim() || !phone.trim())) {
      setError('Ghi nợ yêu cầu phải nhập đầy đủ Tên khách và Số điện thoại.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateServiceSale(invoice.id, {
        customerName: customerName.trim(),
        phone: phone.trim(),
        items,
        discount,
        paidAmount: amount,
        paymentMethod,
        dueDate: amount < total ? dueDate : undefined,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật phiếu vé.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSale = async () => {
    requestConfirm({
      title: `Hủy phiếu vé ${invoice.code}?`,
      message: `Bạn có chắc chắn muốn hủy phiếu vé này do nhập sai thông tin? Toàn bộ doanh thu và công nợ của phiếu vé sẽ được hủy bỏ mà không ảnh hưởng đến số liệu khác.`,
      confirmLabel: 'Xác nhận hủy vé',
      cancelLabel: 'Quay lại',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await cancelServiceSale(invoice.id);
          onClose();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Không thể hủy vé.', 'error');
        }
      },
    });
  };

  const inputClass = 'w-full min-w-0 mt-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs focus:outline-teal-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-teal-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-800 text-teal-200 flex items-center justify-center font-bold text-sm shrink-0 border border-teal-700">
              <Ticket className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Sửa phiếu bán vé / dịch vụ</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-800 text-teal-100 border border-teal-600">
                  {invoice.code}
                </span>
              </div>
              <p className="text-[11px] text-teal-200/90 font-medium">
                Tạo lúc: {invoice.time} {invoice.date}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-teal-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-700">
          {error && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer info */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <User className="w-3.5 h-3.5 text-teal-700" />
              <span>Thông tin người mua vé</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Tên khách</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Để trống: Khách lẻ"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-semibold focus:outline-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Số điện thoại</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0912 345 678"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-semibold focus:outline-teal-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Service items */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-teal-700" />
                Danh sách vé / dịch vụ ({items.length})
              </span>
            </h4>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <label className="flex-1 min-w-0">
                Thêm vé / dịch vụ
                <select
                  value={serviceIdToAdd}
                  onChange={e => setServiceIdToAdd(e.target.value)}
                  className={inputClass}
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {formatCurrency(s.price)}/{s.unit}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!services.length}
                className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-1 font-semibold text-xs transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                Thêm vào vé
              </button>
            </div>

            <div className="space-y-2 mt-2">
              {items.map(item => {
                const s = services.find(sv => sv.id === item.serviceId);
                return (
                  <div
                    key={item.serviceId}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-[120px]">
                      <strong className="text-slate-800">{s?.name || 'Dịch vụ đã xóa'}</strong>
                      <p className="text-slate-500 text-[11px]">
                        {formatCurrency(s?.price || 0)} / {s?.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={item.quantity}
                        onChange={e => handleQuantityChange(item.serviceId, Number(e.target.value))}
                        className="w-14 border border-slate-300 rounded-lg p-1.5 text-center font-bold text-xs"
                      />
                      <span className="font-mono font-semibold text-teal-800 min-w-[70px] text-right">
                        {formatCurrency((s?.price || 0) * item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.serviceId)}
                        className="p-1 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50"
                        title="Xóa mục này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="text-rose-600 py-1 font-medium">Chưa có dịch vụ nào trong phiếu.</p>
              )}
            </div>
          </div>

          {/* Pricing & payment */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <CreditCard className="w-3.5 h-3.5 text-teal-700" />
              <span>Thanh toán & Thu tiền</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Giảm giá (VNĐ)</label>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  step="1"
                  required
                  value={discount}
                  onChange={e => setDiscount(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Đã thu (VNĐ)</label>
                <input
                  type="number"
                  min="0"
                  max={total}
                  step="1"
                  required
                  value={paidAmount}
                  onChange={e => setPaidAmount(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Phương thức</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className={inputClass}
                >
                  <option value="CASH">Tiền mặt</option>
                  <option value="TRANSFER">Chuyển khoản</option>
                  <option value="CARD">Thẻ</option>
                </select>
              </div>
            </div>

            {amount < total && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 space-y-2">
                <p className="text-amber-900 font-medium">
                  Ghi nợ: <strong>{formatCurrency(total - amount)}</strong>. Vui lòng chọn ngày hẹn thanh toán.
                </p>
                <div>
                  <label className="block text-amber-900 font-medium mb-1">Ngày hẹn thu nợ</label>
                  <input
                    type="date"
                    min={today}
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
              <span>Tổng tiền dịch vụ: <strong>{formatCurrency(subtotal)}</strong></span>
              <span className="text-sm font-bold text-teal-900">Thành tiền: {formatCurrency(total)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Ghi chú thêm</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ghi chú về nội dung phiếu vé..."
              className={inputClass}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCancelSale}
              disabled={isSubmitting}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa / Hủy vé sai này</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !items.length}
                className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
