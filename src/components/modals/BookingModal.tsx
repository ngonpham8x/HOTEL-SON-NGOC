import { localDate, stayDuration, validatePeriod, findBookingConflict, bookingConflictMessage, roomSchedule, sortRooms } from '../../utils/hotelLogic';
import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Room, CompanionGuest } from '../../types/hotel';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  CalendarPlus,
  Calendar,
  Clock,
  DollarSign,
  Bed,
  AlertCircle,
  Users,
  Plus,
  Trash2,
  User,
} from 'lucide-react';

interface BookingModalProps {
  initialRoom?: Room;
  onClose: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({ initialRoom, onClose }) => {
  const { rooms, reservations, stays, createReservation, showToast } = useHotel();

  const [roomId, setRoomId] = useState<string>(initialRoom ? initialRoom.id : rooms[0]?.id || '');
  const [customerName, setCustomerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [idCard, setIdCard] = useState<string>('');
  const [guestsCount, setGuestsCount] = useState<number>(2);

  // Companion guests for multi-guest bookings (2, 3, 4, 5+ guests)
  const [companionGuests, setCompanionGuests] = useState<CompanionGuest[]>([]);

  const now = new Date();
  const todayStr = localDate(now);

  const futureCheckIn = new Date();
  futureCheckIn.setDate(futureCheckIn.getDate() + 1);
  const futureCheckInStr = localDate(futureCheckIn);

  const futureCheckOut = new Date();
  futureCheckOut.setDate(futureCheckOut.getDate() + 3);
  const futureCheckOutStr = localDate(futureCheckOut);

  const [checkInDate, setCheckInDate] = useState<string>(futureCheckInStr);
  const [checkInTime, setCheckInTime] = useState<string>((initialRoom || rooms[0])?.defaultCheckInTime || '14:00');
  const [checkOutDate, setCheckOutDate] = useState<string>(futureCheckOutStr);
  const [checkOutTime, setCheckOutTime] = useState<string>((initialRoom || rooms[0])?.defaultCheckOutTime || '12:00');
  const [depositAmount, setDepositAmount] = useState<number>(500000);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  const selectedRoom = rooms.find(r => r.id === roomId);

  const [pricingType, setPricingType] = useState<'NIGHT' | 'HOUR'>('NIGHT');
  let nights = 0;
  try { nights = stayDuration({ checkInDate, checkInTime, pricingType }, checkOutDate, checkOutTime); } catch {}
  const estimatedTotal = selectedRoom ? (pricingType === 'HOUR' ? selectedRoom.pricePerHour : selectedRoom.pricePerNight) * nights : 0;
  let period: { start: number; end: number } | undefined;
  try { period = validatePeriod(checkInDate, checkInTime, checkOutDate, checkOutTime); } catch {}
  const conflictFor = (id: string) => period ? findBookingConflict(id, period.start, period.end, reservations, stays) : undefined;
  const conflict = selectedRoom && conflictFor(selectedRoom.id);
  const unavailable = !period || !selectedRoom || selectedRoom.status === 'MAINTENANCE' || !!conflict;
  const schedule = selectedRoom ? roomSchedule(selectedRoom.id, reservations, stays) : [];

  // Add companion
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
    setGuestsCount(prev => prev + 1);
  };

  const handleUpdateCompanion = (id: string, field: keyof CompanionGuest, value: any) => {
    setCompanionGuests(prev =>
      prev.map(g => (g.id === id ? { ...g, [field]: value } : g))
    );
  };

  const handleRemoveCompanion = (id: string) => {
    setCompanionGuests(prev => prev.filter(g => g.id !== id));
    setGuestsCount(prev => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Vui lòng nhập tên khách hàng');
      return;
    }
    if (!selectedRoom) {
      setError('Vui lòng chọn phòng');
      return;
    }

    const validCompanions = companionGuests
      .filter(g => g.name.trim().length > 0)
      .map(g => ({ ...g, name: g.name.trim() }));

    const totalGuests = 1 + validCompanions.length;

    try {
    await createReservation({
      pricingType,
      customerName: customerName.trim(),
      phone: phone.trim(),
      idCard: idCard.trim(),
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.number,
      roomType: selectedRoom.typeName,
      guestsCount: totalGuests,
      companionGuests: validCompanions,
      depositAmount: Number(depositAmount) || 0,
      estimatedTotal,
      notes,
    });

    showToast(`Đã tạo phiếu đặt Phòng ${selectedRoom.number} cho đoàn ${totalGuests} khách (${customerName.trim()}) thành công!`, 'success');
    onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Không thể đặt phòng.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-teal-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-teal-900 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">Đặt Phòng Khách Sạn Trước</h3>
              <p className="text-xs text-teal-200">
                {selectedRoom ? `Phòng ${selectedRoom.number} · ${selectedRoom.typeName}` : 'Tạo phiếu đặt cọc và giữ phòng'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Room Selection & Quick Pricing Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Chọn phòng đặt <span className="text-rose-500">*</span>
              </label>
              <select
                aria-label="Phòng đặt trước"
                value={roomId}
                onChange={e => { const r = rooms.find(r => r.id === e.target.value); setRoomId(e.target.value); setCheckInTime(r?.defaultCheckInTime || '14:00'); setCheckOutTime(r?.defaultCheckOutTime || '12:00'); if (r?.allowsHourly === false) setPricingType('NIGHT'); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none"
              >
                {sortRooms(rooms).map(r => (
                  <option key={r.id} value={r.id}>
                    Phòng {r.number} - {r.typeName} (T{r.floor}) - {r.status === 'MAINTENANCE' ? 'Bảo trì' : conflictFor(r.id) ? 'Trùng lịch đã chọn' : period ? 'Còn lịch đã chọn' : 'Chọn thời gian'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Dự tính tiền phòng ({nights} {pricingType === 'HOUR' ? 'giờ' : 'đêm'})
              </label>
              <div className="p-2.5 bg-teal-50/70 border border-teal-200 rounded-lg flex items-center justify-between">
                <span className="text-slate-600 text-[11px] font-medium">Tổng tiền dự kiến:</span>
                <span className="font-mono font-bold text-sm text-teal-900">
                  {formatCurrency(estimatedTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* 1. Trưởng đoàn / Khách đại diện */}
          <section aria-label="Lịch giữ phòng" className="rounded-xl border border-teal-200 bg-teal-50 p-3 space-y-2">
            <h4 className="font-bold text-teal-900">Lịch giữ phòng {selectedRoom?.number}</h4>
            <p>Giữ phòng theo thời gian nhận–trả. Cùng phòng ở hai tuần khác nhau vẫn đặt được nếu không giao nhau.</p>
            {conflict && <p role="alert" className="font-semibold text-rose-700">{bookingConflictMessage(conflict)}</p>}
            {selectedRoom?.status === 'MAINTENANCE' && <p role="alert" className="text-rose-700">Phòng đang bảo trì. Vui lòng chọn phòng khác.</p>}
            {!period && <p role="alert" className="text-rose-700">Nhập lịch nhận–trả hợp lệ; giờ trả phải sau giờ nhận.</p>}
            {period && !unavailable && <p role="status" className="font-semibold text-teal-800">Có thể đặt trong khoảng thời gian đã chọn.</p>}
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {schedule.map(item => <li key={item.id} className="rounded-lg bg-white p-2"><strong>{item.code}</strong> · {item.customerName}<br />{item.startTime} {item.startDate.split('-').reverse().join('/')} → {item.endTime} {item.endDate.split('-').reverse().join('/')}{item.overdue && <span className="text-rose-700"> · Chưa trả, đã quá giờ</span>}</li>)}
            </ul>
            {schedule.length === 0 && <p className="text-slate-500">Chưa có lịch giữ phòng.</p>}
          </section>
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-700" />
                <span>1. Khách đại diện đặt phòng</span>
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
                  placeholder="VD: Trần Quốc Bảo"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Số điện thoại <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="VD: 0988776655"
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
                  placeholder="Số định danh công dân"
                  value={idCard}
                  onChange={e => setIdCard(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Khách ở cùng phòng (2, 3, 4, 5+ người) */}
          <div className="p-4 bg-teal-50/40 rounded-xl border border-teal-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-teal-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-teal-700" />
                  <span>2. Thành viên đi cùng đoàn (2, 3, 4, 5+ người)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Quy mô đoàn: <strong>{1 + companionGuests.length} người</strong> (1 Trưởng đoàn + {companionGuests.length} người đi cùng)
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddCompanion}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm người đi cùng</span>
              </button>
            </div>

            {companionGuests.length === 0 ? (
              <div className="py-2.5 px-3.5 bg-white/80 rounded-lg border border-dashed border-teal-300 text-center text-slate-500 text-xs">
                <span>Nếu đoàn có từ 2 đến 4-5 người, bấm </span>
                <strong className="text-teal-700 cursor-pointer underline" onClick={handleAddCompanion}>
                  + Thêm người đi cùng
                </strong>
                <span> để lưu thông tin các thành viên.</span>
              </div>
            ) : (
              <div className="space-y-2">
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
                        <input
                          type="text"
                          placeholder="Quan hệ (Vợ, Con...)"
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

          <label className="block font-semibold">Hình thức thuê
            <select aria-label="Hình thức thuê" value={pricingType} onChange={e => setPricingType(e.target.value as 'NIGHT' | 'HOUR')} className="mt-1 w-full p-2 border border-slate-300 rounded-lg">
              <option value="NIGHT">Theo đêm</option>
              {selectedRoom?.allowsHourly !== false && <option value="HOUR">Theo giờ</option>}
            </select>
          </label>
          {/* Dates & Times */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Lịch trình nhận và trả phòng ({nights} {pricingType === 'HOUR' ? 'giờ' : 'đêm'})</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Ngày nhận</label>
                <input
                  type="date"
                  required aria-label="Ngày nhận đặt trước"
                  value={checkInDate}
                  onChange={e => setCheckInDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Giờ nhận</label>
                <input
                  type="time"
                  required aria-label="Giờ nhận đặt trước"
                  value={checkInTime}
                  onChange={e => setCheckInTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Ngày trả</label>
                <input
                  type="date"
                  required aria-label="Ngày trả đặt trước"
                  value={checkOutDate}
                  onChange={e => setCheckOutDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Giờ trả</label>
                <input
                  type="time"
                  required aria-label="Giờ trả đặt trước"
                  value={checkOutTime}
                  onChange={e => setCheckOutTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Tiền cọc (VNĐ)</label>
                <input
                  type="number"
                  step="1"
                  aria-label="Tiền cọc đặt phòng (VNĐ)"
                  min="0"
                  value={depositAmount || ''}
                  onChange={e => setDepositAmount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-xs"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Ghi chú đặt phòng
            </label>
            <textarea
              rows={2}
              placeholder="Yêu cầu tầng cao, hướng view, chuẩn bị vé Massage trước..."
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
              disabled={unavailable}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Xác nhận đặt phòng ({1 + companionGuests.length} khách)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
