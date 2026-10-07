import { AccessGuard } from '../common/AccessGuard';
import { useAccess } from '../../context/AccessContext';
import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Room, StayRecord } from '../../types/hotel';
import { EditStayModal } from '../modals/EditStayModal';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  User,
  Phone,
  CreditCard,
  Coffee,
  ArrowRight,
  Plus,
  Clock,
  BedDouble,
  Edit2,
  Trash2,
} from 'lucide-react';

interface ActiveStayManagerProps {
  onSelectRoom: (room: Room) => void;
  onCheckOutRoom: (room: Room) => void;
}

export const ActiveStayManager: React.FC<ActiveStayManagerProps> = ({
  onSelectRoom,
  onCheckOutRoom,
}) => {
  const { canAct } = useAccess();
  const { stays, rooms, cancelCheckIn, requestConfirm, showToast } = useHotel();

  const activeStays = stays.filter(s => s.status === 'ACTIVE');
  const [editingStay, setEditingStay] = useState<StayRecord | null>(null);

  const handleCancelStay = (stay: StayRecord) => {
    requestConfirm({
      title: `Hủy lượt nhận phòng ${stay.roomNumber}?`,
      message: `Thao tác này dùng khi nhận phòng nhầm hoặc thông tin bị sai cần hủy bỏ hoàn toàn. Phòng ${stay.roomNumber} sẽ được đưa về trạng thái TRỐNG SẠCH ngay lập tức và không tính tiền hay phát sinh hóa đơn trả phòng. Bạn có chắc chắn muốn hủy?`,
      confirmLabel: 'Xác nhận hủy nhận phòng',
      cancelLabel: 'Quay lại',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await cancelCheckIn(stay.id);
          showToast(`Đã hủy lượt nhận phòng ${stay.roomNumber}.`, 'success');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Không thể hủy nhận phòng.', 'error');
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Danh sách khách đang lưu trú</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý khách đang ở các phòng, thêm dịch vụ minibar và làm thủ tục trả phòng
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-semibold text-xs">
            Tổng cộng: <strong>{activeStays.length}</strong> phòng đang có khách
          </div>
        </div>
      </div>

      {/* Grid of Active Stays */}
      {activeStays.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
          <p className="font-semibold text-slate-700">Hiện tại không có phòng nào đang có khách</p>
          <p className="text-xs text-slate-400 mt-1">Các phòng đều đang trống hoặc chờ nhận phòng</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeStays.map(stay => {
            const room = rooms.find(r => r.id === stay.roomId || r.number === stay.roomNumber);
            const totalServiceAmount = stay.services.reduce((sum, s) => sum + s.totalPrice, 0);

            return (
              <div
                key={stay.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition-all p-4 flex flex-col justify-between shadow-2xs space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold font-mono text-emerald-800">
                        P.{stay.roomNumber}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {room?.typeName || 'Phòng tiêu chuẩn'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {stay.code}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1.5 pt-2 text-xs">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{stay.customerName}</span>
                    </div>
                    <div className="text-slate-600 flex items-center gap-1.5 text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{stay.phone || 'Chưa lưu SĐT'}</span>
                      {stay.idCard && (
                        <>
                          <span className="text-slate-300">·</span>
                          <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{stay.idCard}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dates & Times */}
                  <div className="mt-3 p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> Vào:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {formatDateTime(stay.checkInDate, stay.checkInTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Dự kiến ra:</span>
                      <span className="text-slate-800 font-medium">
                        {formatDateTime(stay.expectedCheckOutDate, stay.expectedCheckOutTime)}
                      </span>
                    </div>
                  </div>

                  {/* Financial & Services */}
                  <div className="mt-3 flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Tiền cọc</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatCurrency(stay.deposit)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[11px] block flex items-center gap-1 justify-end">
                        <Coffee className="w-3 h-3 text-amber-600" />
                        Minibar ({stay.services.length})
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(totalServiceAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => room && onSelectRoom(room)}
                    className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{canAct('stay.service.add') ? 'Thêm Minibar/DV' : 'Xem chi tiết'}</span>
                  </button>
                  <AccessGuard action="stay.checkin">
                    <button
                      type="button"
                      onClick={() => setEditingStay(stay)}
                      className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                      title="Sửa thông tin khách / cọc"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelStay(stay)}
                      className="px-2 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors"
                      title="Hủy lượt nhận phòng nếu thông tin bị sai"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </AccessGuard>
                  <AccessGuard action="stay.checkout"><button
                    onClick={() => room && onCheckOutRoom(room)}
                    className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span>Trả phòng</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button></AccessGuard>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Stay Modal */}
      {editingStay && (
        <EditStayModal
          stay={editingStay}
          onClose={() => setEditingStay(null)}
        />
      )}
    </div>
  );
};
