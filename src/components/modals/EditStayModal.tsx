import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { StayRecord } from '../../types/hotel';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  Edit2,
  Calendar,
  Clock,
  DollarSign,
  User,
  Phone,
  CreditCard,
  FileText,
  Check,
  BedDouble,
} from 'lucide-react';

interface EditStayModalProps {
  stay: StayRecord;
  onClose: () => void;
}

export const EditStayModal: React.FC<EditStayModalProps> = ({ stay, onClose }) => {
  const { updateActiveStay, showToast } = useHotel();

  const [customerName, setCustomerName] = useState(stay.customerName);
  const [phone, setPhone] = useState(stay.phone || '');
  const [idCard, setIdCard] = useState(stay.idCard || '');
  const [deposit, setDeposit] = useState<number>(stay.deposit || 0);
  const [pricingType, setPricingType] = useState<'NIGHT' | 'HOUR'>(stay.pricingType || 'NIGHT');
  const [rateApplied, setRateApplied] = useState<number>(stay.rateApplied || 0);
  const [checkInDate, setCheckInDate] = useState(stay.checkInDate);
  const [checkInTime, setCheckInTime] = useState(stay.checkInTime);
  const [expectedCheckOutDate, setExpectedCheckOutDate] = useState(stay.expectedCheckOutDate);
  const [expectedCheckOutTime, setExpectedCheckOutTime] = useState(stay.expectedCheckOutTime);
  const [notes, setNotes] = useState(stay.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerName.trim()) {
      setErrorMessage('Vui lòng nhập tên khách hàng.');
      return;
    }

    if (deposit < 0) {
      setErrorMessage('Tiền đặt cọc không được nhỏ hơn 0.');
      return;
    }

    if (rateApplied < 0) {
      setErrorMessage('Đơn giá phòng không hợp lệ.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateActiveStay(stay.id, {
        customerName: customerName.trim(),
        phone: phone.trim(),
        idCard: idCard.trim(),
        deposit: Number(deposit) || 0,
        pricingType,
        rateApplied: Number(rateApplied) || 0,
        checkInDate,
        checkInTime,
        expectedCheckOutDate,
        expectedCheckOutTime,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể cập nhật thông tin.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-[#081e24] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-sm shrink-0 border border-amber-400/40">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Sửa thông tin phòng đang ở</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-900 text-teal-200 border border-teal-700">
                  Phòng {stay.roomNumber}
                </span>
              </div>
              <p className="text-[11px] text-teal-300/90 font-medium">
                Mã lượt ở: {stay.code}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Customer Info */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <User className="w-3.5 h-3.5 text-teal-700" />
              <span>Thông tin khách hàng</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Họ và tên khách <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-semibold focus:outline-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Số điện thoại
                </label>
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

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-medium mb-1">
                  Số CCCD / CMND / Hộ chiếu
                </label>
                <div className="relative">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={idCard}
                    onChange={e => setIdCard(e.target.value)}
                    placeholder="001200000000"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-semibold focus:outline-teal-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Deposit & Pricing */}
          <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                <span>Tiền đặt cọc & Hình thức tính giá</span>
              </span>
              <span className="font-mono text-amber-800 text-[11px] font-semibold">
                Đang cọc: {formatCurrency(deposit)}
              </span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Tiền đặt cọc trước (VNĐ)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={deposit}
                    onChange={e => setDeposit(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-amber-900 text-xs font-bold font-mono focus:outline-amber-600"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {formatCurrency(deposit)}
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Hình thức tính giá
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-white border border-slate-300 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPricingType('NIGHT')}
                    className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all ${
                      pricingType === 'NIGHT'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Qua đêm / ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingType('HOUR')}
                    className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all ${
                      pricingType === 'HOUR'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Theo giờ
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-medium mb-1">
                  Đơn giá áp dụng ({pricingType === 'HOUR' ? 'đ/giờ' : 'đ/đêm'})
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={rateApplied}
                  onChange={e => setRateApplied(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-bold font-mono focus:outline-teal-600"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {formatCurrency(rateApplied)} / {pricingType === 'HOUR' ? 'giờ' : 'đêm'}
                </span>
              </div>
            </div>
          </div>

          {/* Time Check-in & Expected Checkout */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-blue-700" />
              <span>Thời gian lưu trú</span>
            </h4>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Ngày nhận phòng
                </label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={e => setCheckInDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-teal-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Giờ nhận phòng
                </label>
                <input
                  type="time"
                  value={checkInTime}
                  onChange={e => setCheckInTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-teal-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Dự kiến ngày trả
                </label>
                <input
                  type="date"
                  value={expectedCheckOutDate}
                  onChange={e => setExpectedCheckOutDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-teal-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Dự kiến giờ trả
                </label>
                <input
                  type="time"
                  value={expectedCheckOutTime}
                  onChange={e => setExpectedCheckOutTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-teal-600"
                />
              </div>
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
              placeholder="Ghi chú yêu cầu đặc biệt của khách hoặc thông tin bổ sung..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-teal-600"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu…' : 'Lưu cập nhật'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

