import { localDate, localTime, stayDuration, sortRooms } from '../../utils/hotelLogic';
import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Room, CompanionGuest } from '../../types/hotel';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  UserCheck,
  Calendar,
  Clock,
  DollarSign,
  BedDouble,
  AlertCircle,
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  User,
} from 'lucide-react';

interface CheckInModalProps {
  initialRoom?: Room;
  onClose: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({ initialRoom, onClose }) => {
  const { rooms, checkInDirect, showToast } = useHotel();

  // Find available rooms or default
  const availableRooms = sortRooms(rooms.filter(
    r => (r.status === 'AVAILABLE' || r.status === 'RESERVED') && r.cleanStatus === 'CLEAN'
  ));

  const [roomId, setRoomId] = useState<string>(
    initialRoom ? initialRoom.id : availableRooms[0]?.id || ''
  );

  // 1. Trưởng đoàn / Khách đại diện
  const [customerName, setCustomerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [idCard, setIdCard] = useState<string>('');

  // 2. Danh sách khách ở cùng phòng (2, 3, 4, 5+ khách)
  const [companionGuests, setCompanionGuests] = useState<CompanionGuest[]>([]);

  const [pricingType, setPricingType] = useState<'NIGHT' | 'HOUR'>('NIGHT');

  const now = new Date();
  const todayStr = localDate(now);
  const timeStr = localTime(now);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDate(tomorrow);

  const [checkInDate, setCheckInDate] = useState<string>(todayStr);
  const [checkInTime, setCheckInTime] = useState<string>(timeStr);
  const [expectedCheckOutDate, setExpectedCheckOutDate] = useState<string>(tomorrowStr);
  const [expectedCheckOutTime, setExpectedCheckOutTime] = useState<string>((initialRoom || availableRooms[0])?.defaultCheckOutTime || '12:00');
  const [deposit, setDeposit] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  const selectedRoom = rooms.find(r => r.id === roomId);
  const rateApplied = selectedRoom
    ? pricingType === 'NIGHT'
      ? selectedRoom.pricePerNight
      : selectedRoom.pricePerHour
    : 0;

  // Add a companion guest row
  const handleAddCompanion = () => {
    setCompanionGuests(prev => [
      ...prev,
      {
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        idCard: '',
        birthYear: '',
        gender: 'NAM',
        relationship: 'Bạn bè / Người thân',
      },
    ]);
  };

  const handleUpdateCompanion = (id: string, field: keyof CompanionGuest, value: any) => {
    setCompanionGuests(prev =>
      prev.map(g => (g.id === id ? { ...g, [field]: value } : g))
    );
  };

  const handleRemoveCompanion = (id: string) => {
    setCompanionGuests(prev => prev.filter(g => g.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Vui lòng nhập tên trưởng đoàn / khách đại diện');
      return;
    }
    if (!selectedRoom) {
      setError('Vui lòng chọn phòng');
      return;
    }

    // Filter out companions with empty names
    const validCompanions = companionGuests
      .filter(g => g.name.trim().length > 0)
      .map(g => ({ ...g, name: g.name.trim() }));

    try {
    await checkInDirect({
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.number,
      customerName: customerName.trim(),
      phone: phone.trim(),
      idCard: idCard.trim(),
      companionGuests: validCompanions,
      checkInDate,
      checkInTime,
      expectedCheckOutDate,
      expectedCheckOutTime,
      pricingType,
      rateApplied,
      deposit: Number(deposit) || 0,
      notes,
    });

    const totalCount = 1 + validCompanions.length;
    showToast(
      `Đoàn ${totalCount} khách (${customerName.trim()}) đã nhận Phòng ${selectedRoom.number} thành công!`,
      'success'
    );
    onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Không thể nhận phòng.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-teal-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-teal-900 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">
                Nhận Phòng Khách Sạn (Check-in)
              </h3>
              <p className="text-xs text-teal-200">
                {selectedRoom
                  ? `Phòng ${selectedRoom.number} (Tầng ${selectedRoom.floor}) · ${selectedRoom.typeName}`
                  : 'Đăng ký lưu trú khách sạn'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4.5 flex-1 text-xs text-slate-700">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Room Selection & Pricing Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Chọn phòng lưu trú <span className="text-rose-500">*</span>
              </label>
              <select
                value={roomId}
                onChange={e => { const r = rooms.find(r => r.id === e.target.value); setRoomId(e.target.value); setExpectedCheckOutTime(r?.defaultCheckOutTime || '12:00'); if (r?.allowsHourly === false) setPricingType('NIGHT'); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none"
              >
                {availableRooms.map(r => (
                  <option key={r.id} value={r.id}>
                    Phòng {r.number} - {r.typeName} (Tầng {r.floor} · {r.status === 'RESERVED' ? 'Đã đặt trước' : 'Phòng trống'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Hình thức thuê phòng
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPricingType('NIGHT')}
                  className={`py-1.5 rounded-md font-bold text-center transition-all ${
                    pricingType === 'NIGHT'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Theo đêm
                </button>
                <button
                  type="button"
                  disabled={selectedRoom?.allowsHourly === false} onClick={() => setPricingType('HOUR')}
                  className={`py-1.5 rounded-md font-bold text-center transition-all ${
                    pricingType === 'HOUR'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Theo giờ
                </button>
              </div>
            </div>
          </div>

          {/* Pricing preview pill */}
          {selectedRoom && <p className="text-[11px] text-slate-500">Giờ nhận phòng chuẩn: {selectedRoom.defaultCheckInTime} · Giờ trả phòng chuẩn: {selectedRoom.defaultCheckOutTime}. Có thể nhập giờ nhận thực tế bên dưới.</p>}
          {selectedRoom && (
            <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200 flex items-center justify-between text-teal-950">
              <span className="flex items-center gap-1.5 font-medium">
                <BedDouble className="w-4 h-4 text-teal-700" />
                <span>Giá áp dụng:</span>
              </span>
              <span className="font-mono font-bold text-sm text-teal-900">
                {formatCurrency(rateApplied)} / {pricingType === 'NIGHT' ? 'đêm' : 'giờ'}
              </span>
            </div>
          )}

          {/* 1. Trưởng đoàn / Khách đại diện */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-700" />
                <span>1. Khách đại diện / Trưởng đoàn</span>
              </h4>
              <span className="text-[10px] text-teal-800 bg-teal-100 px-2 py-0.5 rounded font-semibold">
                Bắt buộc
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Hoàng Nam"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  placeholder="VD: 0912345678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Số CCCD / Hộ chiếu
                </label>
                <input
                  type="text"
                  placeholder="VD: 001298014521"
                  value={idCard}
                  onChange={e => setIdCard(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Danh sách khách ở cùng phòng (2, 3, 4, 5+ người) */}
          <div className="p-4 bg-teal-50/40 rounded-xl border border-teal-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-teal-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-teal-700" />
                  <span>2. Khách ở cùng phòng (2, 3, 4, 5+ người)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tổng số: <strong>{1 + companionGuests.length} người</strong> (1 Trưởng đoàn + {companionGuests.length} khách đi cùng)
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddCompanion}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm khách ở cùng</span>
              </button>
            </div>

            {companionGuests.length === 0 ? (
              <div className="py-3 px-4 bg-white/80 rounded-lg border border-dashed border-teal-300 text-center text-slate-500 text-xs">
                <span>Phòng hiện chỉ có 1 khách. Nếu có thêm 2, 3, 4, 5 người ở cùng, bấm </span>
                <strong className="text-teal-700 cursor-pointer underline" onClick={handleAddCompanion}>
                  + Thêm khách ở cùng
                </strong>
                <span> để khai báo lưu trú đầy đủ.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {companionGuests.map((guest, idx) => (
                  <div
                    key={guest.id}
                    className="p-3 bg-white rounded-xl border border-teal-200/80 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-teal-900 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[11px] flex items-center justify-center font-bold">
                          {idx + 2}
                        </span>
                        <span>Khách đi cùng #{idx + 1}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompanion(guest.id)}
                        className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors flex items-center gap-1 text-[11px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          required
                          placeholder="Họ và tên thành viên *"
                          value={guest.name}
                          onChange={e => handleUpdateCompanion(guest.id, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-teal-600 focus:bg-white text-xs"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Số CCCD / Hộ chiếu"
                          value={guest.idCard || ''}
                          onChange={e => handleUpdateCompanion(guest.id, 'idCard', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:ring-1 focus:ring-teal-600 focus:bg-white"
                        />
                      </div>
                      <div>
                        <select
                          value={guest.gender || 'NAM'}
                          onChange={e => handleUpdateCompanion(guest.id, 'gender', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-1 focus:ring-teal-600 focus:bg-white"
                        >
                          <option value="NAM">Nam</option>
                          <option value="NU">Nữ</option>
                          <option value="KHAC">Khác</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input
                          type="text"
                          placeholder="Năm sinh (VD: 1995)"
                          value={guest.birthYear || ''}
                          onChange={e => handleUpdateCompanion(guest.id, 'birthYear', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Quan hệ (Vợ/Chồng, Con, Bạn...)"
                          value={guest.relationship || ''}
                          onChange={e => handleUpdateCompanion(guest.id, 'relationship', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dates & Times & Deposit */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Thời gian lưu trú & Tiền đặt cọc</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Ngày vào</label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={e => setCheckInDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Giờ vào</label>
                <input
                  type="time"
                  value={checkInTime}
                  onChange={e => setCheckInTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Dự kiến ra</label>
                <input
                  type="date"
                  value={expectedCheckOutDate}
                  onChange={e => setExpectedCheckOutDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Giờ ra</label>
                <input
                  type="time"
                  value={expectedCheckOutTime}
                  onChange={e => setExpectedCheckOutTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Tiền cọc (VNĐ)</label>
                <input
                  type="number"
                  step="1"
                  aria-label="Tiền cọc nhận phòng (VNĐ)"
                  min="0"
                  placeholder="0"
                  value={deposit || ''}
                  onChange={e => setDeposit(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-xs"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Ghi chú thêm
            </label>
            <textarea
              rows={2}
              placeholder="Yêu cầu thêm gối mền, dịch vụ massage, gọi dậy buổi sáng..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Submit buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl font-semibold text-slate-700 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <UserCheck className="w-4 h-4" />
              <span>Xác nhận nhận phòng ({1 + companionGuests.length} khách)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
