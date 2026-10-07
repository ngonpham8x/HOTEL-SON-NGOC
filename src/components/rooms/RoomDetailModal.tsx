import { AccessGuard } from '../common/AccessGuard';
import { useAccess } from '../../context/AccessContext';
import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Room, CompanionGuest } from '../../types/hotel';
import { EditStayModal } from '../modals/EditStayModal';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  X,
  User,
  Phone,
  CreditCard,
  Plus,
  Trash2,
  Coffee,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Clock,
  Edit,
  Users,
} from 'lucide-react';

interface RoomDetailModalProps {
  room: Room;
  onClose: () => void;
  onCheckOut: (room: Room) => void;
  onEditRoom?: (room: Room) => void;
}

export const RoomDetailModal: React.FC<RoomDetailModalProps> = ({ room, onClose, onCheckOut, onEditRoom }) => {
  const { canAct } = useAccess();
  const {
    stays,
    services,
    addServiceToStay,
    removeServiceFromStay,
    updateRoomCleanStatus,
    updateStayCompanions,
    showToast,
  } = useHotel();
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [serviceQuantity, setServiceQuantity] = useState<number>(1);
  const [isEditingStay, setIsEditingStay] = useState(false);

  // Companion guest adding state
  const [isAddingCompanion, setIsAddingCompanion] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompIdCard, setNewCompIdCard] = useState('');
  const [newCompBirth, setNewCompBirth] = useState('');
  const [newCompRel, setNewCompRel] = useState('Người thân / Bạn bè');
  const [newCompGender, setNewCompGender] = useState<'NAM' | 'NU' | 'KHAC'>('NAM');

  const activeStay = stays.find(
    s => s.status === 'ACTIVE' && (s.roomId === room.id || s.roomNumber === room.number)
  );

  const totalServiceCharge = activeStay
    ? activeStay.services.reduce((sum, item) => sum + item.totalPrice, 0)
    : 0;

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStay || !selectedServiceId) return;
    try { await addServiceToStay(activeStay.id, selectedServiceId, serviceQuantity); } catch (err) { showToast(err instanceof Error ? err.message : 'Không thêm được dịch vụ.', 'error'); return; }
    setServiceQuantity(1);
  };

  const handleSaveCompanion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStay || !newCompName.trim()) return;

    const newGuest: CompanionGuest = {
      id: `guest-${Date.now()}`,
      name: newCompName.trim(),
      idCard: newCompIdCard.trim(),
      birthYear: newCompBirth.trim(),
      relationship: newCompRel.trim(),
      gender: newCompGender,
    };

    const updated = [...(activeStay.companionGuests || []), newGuest];
    try { await updateStayCompanions(activeStay.id, updated); } catch (err) { showToast(err instanceof Error ? err.message : 'Không cập nhật được khách.', 'error'); return; }
    setNewCompName('');
    setNewCompIdCard('');
    setNewCompBirth('');
    setIsAddingCompanion(false);
  };

  const handleRemoveCompanion = async (guestId: string) => {
    if (!activeStay) return;
    const updated = (activeStay.companionGuests || []).filter(g => g.id !== guestId);
    try { await updateStayCompanions(activeStay.id, updated); } catch (err) { showToast(err instanceof Error ? err.message : 'Không cập nhật được khách.', 'error'); return; }
  };

  return (
    <div className="room-dialog fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-mono font-black text-sm shrink-0 border border-teal-400/40">
              {room.number}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                  Phòng {room.number}
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-200 border border-teal-700/60 shrink-0">
                  Tầng {room.floor}
                </span>
              </div>
              <p className="text-[11px] text-teal-200/90 font-medium whitespace-normal mt-0.5">
                {room.typeName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs">
          {/* Room Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-slate-400 font-medium">Giá theo ngày</p>
              <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                {formatCurrency(room.pricePerNight)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Giá theo giờ</p>
              <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                {formatCurrency(room.pricePerHour)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Sức chứa tối đa</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {room.maxGuests} người lớn
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Tình trạng vệ sinh</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    room.cleanStatus === 'CLEAN' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></span>
                <span className="font-semibold text-slate-800">
                  {room.cleanStatus === 'CLEAN' ? 'Phòng sạch' : 'Chưa dọn'}
                </span>
                {room.cleanStatus === 'DIRTY' && (
                  <AccessGuard action="room.clean"><button
                    onClick={() => updateRoomCleanStatus(room.id, 'CLEAN').catch(error => showToast(error.message, 'error'))}
                    className="ml-1 text-[11px] text-blue-600 underline font-medium hover:text-blue-800"
                  >
                    Báo sạch
                  </button></AccessGuard>
                )}
              </div>
            </div>
          </div>

          {/* Occupant Info */}
          {activeStay ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-700" />
                    Khách đang lưu trú: {activeStay.customerName}
                  </h4>
                  <div className="flex items-center gap-2">
                    <AccessGuard action="stay.checkin">
                      <button
                        type="button"
                        onClick={() => setIsEditingStay(true)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs"
                        title="Sửa thông tin khách / cọc"
                      >
                        <Edit className="w-3 h-3 text-emerald-700" />
                        <span>Sửa thông tin / Cọc</span>
                      </button>
                    </AccessGuard>
                    <span className="font-mono text-emerald-800 text-[11px] font-semibold bg-emerald-100 px-2 py-0.5 rounded">
                    Mã lượt ở: {activeStay.code}
                  </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>SĐT: <strong className="text-slate-800">{activeStay.phone}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    <span>CCCD: <strong className="text-slate-800">{activeStay.idCard || 'Đã xuất trình'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Nhận lúc: <strong>{formatDateTime(activeStay.checkInDate, activeStay.checkInTime)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 text-emerald-900">
                  <span>Tiền cọc trước: <strong className="font-mono">{formatCurrency(activeStay.deposit)}</strong></span>
                  <span>Dự kiến trả phòng: <strong>{formatDateTime(activeStay.expectedCheckOutDate, activeStay.expectedCheckOutTime)}</strong></span>
                </div>
              </div>

              {/* Companion Guests in Room (2 - 5+ guests) */}
              <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-700" />
                    <h4 className="font-bold text-slate-900 text-xs">
                      Danh Sách Khách Ở Cùng Phòng ({1 + (activeStay.companionGuests?.length || 0)} người)
                    </h4>
                  </div>
                  <AccessGuard action="stay.guests"><button
                    type="button"
                    onClick={() => setIsAddingCompanion(!isAddingCompanion)}
                    className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isAddingCompanion ? 'Đóng form' : '+ Bổ sung khách'}</span>
                  </button></AccessGuard>
                </div>

                {/* List of Companion Guests */}
                {(!activeStay.companionGuests || activeStay.companionGuests.length === 0) ? (
                  <p className="text-[11px] text-slate-500 italic py-1">
                    Hiện chỉ có 1 khách đại diện ({activeStay.customerName}). {canAct('stay.guests') && 'Bấm "+ Bổ sung khách" nếu có thêm người ở cùng để khai báo tạm trú.'}
                  </p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {activeStay.companionGuests.map((guest, idx) => (
                      <div
                        key={guest.id}
                        className="p-2.5 bg-white rounded-lg border border-teal-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                            {idx + 2}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900">{guest.name}</span>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              {guest.idCard && <span>CCCD: <strong>{guest.idCard}</strong></span>}
                              {guest.birthYear && <span>Năm sinh: {guest.birthYear}</span>}
                              {guest.relationship && <span>Quan hệ: {guest.relationship}</span>}
                              <span>Giới tính: {guest.gender === 'NU' ? 'Nữ' : 'Nam'}</span>
                            </div>
                          </div>
                        </div>
                        <AccessGuard action="stay.guests"><button
                          type="button"
                          onClick={() => handleRemoveCompanion(guest.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors"
                          title="Xóa khách khỏi phòng"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button></AccessGuard>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline form to add companion */}
                {isAddingCompanion && (
                  <AccessGuard action="stay.guests"><form onSubmit={handleSaveCompanion} className="p-3 bg-white rounded-xl border border-teal-300 space-y-2.5 pt-3">
                    <p className="font-bold text-teal-900 text-xs flex items-center gap-1">
                      <span>Bổ sung khách vào phòng {room.number}</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Họ và tên thành viên *"
                        value={newCompName}
                        onChange={e => setNewCompName(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Số CCCD / Hộ chiếu"
                        value={newCompIdCard}
                        onChange={e => setNewCompIdCard(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Quan hệ (Vợ, Con, Bạn...)"
                        value={newCompRel}
                        onChange={e => setNewCompRel(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-[11px]">
                          <input
                            type="radio"
                            name="gender"
                            checked={newCompGender === 'NAM'}
                            onChange={() => setNewCompGender('NAM')}
                          />
                          <span>Nam</span>
                        </label>
                        <label className="flex items-center gap-1 text-[11px]">
                          <input
                            type="radio"
                            name="gender"
                            checked={newCompGender === 'NU'}
                            onChange={() => setNewCompGender('NU')}
                          />
                          <span>Nữ</span>
                        </label>
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs shadow-xs"
                      >
                        Lưu khách vào phòng
                      </button>
                    </div>
                  </form></AccessGuard>
                )}
              </div>

              {/* Minibar & Service Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    Dịch vụ minibar & phát sinh
                  </h4>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Tổng DV: {formatCurrency(totalServiceCharge)}
                  </span>
                </div>

                {/* Add Service Bar (Responsive, Never Overflows) */}
                <AccessGuard action="stay.service.add"><form
                  onSubmit={handleAddService}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                >
                  <select
                    value={selectedServiceId}
                    onChange={e => setSelectedServiceId(e.target.value)}
                    className="w-full sm:flex-1 min-w-0 px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-teal-600 focus:outline-none truncate"
                  >
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatCurrency(s.price)}/{s.unit})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-xs">SL:</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={serviceQuantity}
                        onChange={e => setServiceQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-mono font-bold focus:ring-1 focus:ring-teal-600 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="flex-1 sm:flex-none px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm DV</span>
                    </button>
                  </div>
                </form></AccessGuard>

                {/* Services List Table */}
                {activeStay.services.length === 0 ? (
                  <p className="text-center py-4 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Chưa dùng dịch vụ hoặc minibar nào
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="px-3 py-2">Dịch vụ</th>
                          <th className="px-3 py-2 text-center">SL</th>
                          <th className="px-3 py-2 text-right">Đơn giá</th>
                          <th className="px-3 py-2 text-right">Thành tiền</th>
                          <th className="px-3 py-2 text-center">Hủy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeStay.services.map(usage => (
                          <tr key={usage.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {usage.name}
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {usage.timestamp}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-mono">{usage.quantity}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">
                              {formatCurrency(usage.unitPrice)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(usage.totalPrice)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <AccessGuard action="stay.service.remove"><button
                                onClick={() => removeServiceFromStay(activeStay.id, usage.id).catch(error => showToast(error.message, 'error'))}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button></AccessGuard>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Phòng hiện tại không có khách lưu trú</p>
              <p className="text-slate-400 text-xs">
                Bạn có thể tiến hành nhận phòng nhanh hoặc đặt trước cho khách hàng.
              </p>
            </div>
          )}

          {/* Amenities tags */}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-2">Trang thiết bị & Tiện nghi phòng</p>
            <div className="flex flex-wrap gap-2">
              {room.amenities.map((item, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-slate-700 text-[11px]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer (Clean, Sleek & Compact for Mobile & Desktop) */}
        <div className="room-dialog-footer p-3 sm:px-6 sm:py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AccessGuard action="room.clean"><button
              onClick={() => updateRoomCleanStatus(room.id, room.cleanStatus === 'CLEAN' ? 'DIRTY' : 'CLEAN').catch(error => showToast(error.message, 'error'))}
              className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{room.cleanStatus === 'CLEAN' ? 'Báo bẩn' : 'Báo sạch'}</span>
            </button></AccessGuard>

            {onEditRoom && (
              <AccessGuard action="room.configure"><button
                onClick={() => {
                  onClose();
                  onEditRoom(room);
                }}
                className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <Edit className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>Sửa phòng</span>
              </button></AccessGuard>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
            >
              Đóng
            </button>

            {activeStay && (
              <AccessGuard action="stay.checkout"><button
                onClick={() => {
                  onClose();
                  onCheckOut(room);
                }}
                className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <span>Trả phòng</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button></AccessGuard>
            )}
          </div>
        </div>
      </div>
      {/* Sửa thông tin phòng đang ở */}
      {isEditingStay && activeStay && (
        <EditStayModal
          stay={activeStay}
          onClose={() => setIsEditingStay(false)}
        />
      )}
    </div>
  );
};
