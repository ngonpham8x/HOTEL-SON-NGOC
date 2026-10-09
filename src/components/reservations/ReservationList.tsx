import React, { useState } from 'react';
import { MobileTableToggle } from '../common/MobileTableToggle';
import { useHotel } from '../../context/HotelContext';
import { useAccess } from '../../context/AccessContext';
import { Reservation } from '../../types/hotel';
import { EditReservationModal } from '../modals/EditReservationModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  CalendarPlus,
  CheckCircle,
  XCircle,
  Search,
  User,
  Phone,
  Clock,
  CalendarCheck,
  Edit2,
} from 'lucide-react';

interface ReservationListProps {
  onOpenBookingModal: () => void;
}

export const ReservationList: React.FC<ReservationListProps> = ({ onOpenBookingModal }) => {
  const { reservations, cancelReservation, archiveReservation, checkInReservation, setActiveTab, requestConfirm, showToast } = useHotel();
  const { canAct, canView } = useAccess();
  const [filterStatus, setFilterStatus] = useState<string>('CONFIRMED');
  const [search, setSearch] = useState<string>('');
  const [tableMode, setTableMode] = useState<'COMPACT' | 'TABLE'>('COMPACT');
  const [showArchived, setShowArchived] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const filtered = reservations.filter(res => {
    if (res.archived && !showArchived) return false;
    if (filterStatus !== 'ALL' && res.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = res.customerName.toLowerCase().includes(q);
      const matchPhone = res.phone.includes(q);
      const matchCode = res.code.toLowerCase().includes(q);
      const matchRoom = res.roomNumber.includes(q);
      if (!matchName && !matchPhone && !matchCode && !matchRoom) return false;
    }
    return true;
  });

  const confirmedCount = reservations.filter(r => r.status === 'CONFIRMED').length;
  const checkedInCount = reservations.filter(r => r.status === 'CHECKED_IN').length;
  const cancelledCount = reservations.filter(r => r.status === 'CANCELLED').length;
  const totalDeposit = reservations
    .filter(r => r.status === 'CONFIRMED')
    .reduce((sum, r) => sum + r.depositAmount, 0);

  const handleCheckInAndNavigate = async (resId: string, roomNum: string, guestName: string) => {
    try { await checkInReservation(resId); } catch (err) { showToast(err instanceof Error ? err.message : 'Không thể nhận phòng.', 'error'); return; }
    showToast(`Đã nhận Phòng ${roomNum} cho khách ${guestName} thành công!`, 'success');
    if (canView('rooms')) setActiveTab('rooms');
    else if (canView('stays')) setActiveTab('stays');
  };

  const handleCancel = (resId: string, code: string, guestName: string) => {
    requestConfirm({
      title: 'Xác nhận hủy đặt phòng',
      message: `Bạn có chắc chắn muốn hủy phiếu đặt ${code} của khách ${guestName}? Trạng thái phòng sẽ được cập nhật theo các phiếu đặt còn lại.`,
      confirmLabel: 'Hủy đặt phòng',
      isDangerous: true,
      onConfirm: async () => {
        await cancelReservation(resId);
        showToast(`Đã hủy phiếu đặt ${code} thành công!`, 'info');
      },
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Stats (Song song 2 cột trên mobile) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-slate-500 text-[11px] sm:text-xs font-medium truncate">Chờ nhận phòng</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-amber-600 mt-1 truncate">{confirmedCount}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-slate-500 text-[11px] sm:text-xs font-medium truncate">Tiền cọc đang giữ</p>
          <p className="text-base sm:text-xl font-bold font-mono text-emerald-700 mt-1 truncate">
            {formatCurrency(totalDeposit)}
          </p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-slate-500 text-[11px] sm:text-xs font-medium truncate">Đã nhận phòng</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-800 mt-1 truncate">{checkedInCount}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-slate-500 text-[11px] sm:text-xs font-medium truncate">Đơn đã hủy</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-400 mt-1 truncate">{cancelledCount}</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('CONFIRMED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'CONFIRMED'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Chờ nhận phòng ({confirmedCount})
          </button>
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả đơn ({reservations.length})
          </button>
          <button
            onClick={() => setFilterStatus('CHECKED_IN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'CHECKED_IN'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Đã check-in ({checkedInCount})
          </button>
          <button
            onClick={() => setFilterStatus('CANCELLED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'CANCELLED'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Đã hủy ({cancelledCount})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên, SĐT, mã đặt..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>

          {canAct('booking.create') && <button
            onClick={onOpenBookingModal}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shadow-xs"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Thêm đặt phòng</span>
          </button>}
        </div>
      </div>

      {/* Table List */}
      <MobileTableToggle mode={tableMode} onChange={setTableMode} />
      <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />Hiện phiếu đã lưu trữ ({reservations.filter(r => r.archived).length})</label>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">Không có đơn đặt phòng nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`mobile-table ${tableMode === 'TABLE' ? 'mobile-table-wide' : ''} w-full text-left text-xs`}>
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Mã đơn & Ngày tạo</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Phòng đặt</th>
                  <th className="px-4 py-3">Lịch trình lưu trú</th>
                  <th className="px-4 py-3 text-right">Tiền cọc</th>
                  <th className="px-4 py-3 text-right">Dự kiến tổng</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(res => (
                  <tr key={res.id} className="hover:bg-slate-50/80 transition-colors">
                    <td data-label="Mã đơn & Ngày tạo" className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-900 block">
                        {res.code}
                      </span>
                      {res.archived && <span className="text-[10px] text-slate-500">Đã lưu trữ</span>}
                      <span className="text-[10px] text-slate-400">
                        {res.createdAt}
                      </span>
                    </td>

                    <td data-label="Khách hàng" className="px-4 py-3">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{res.customerName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{res.phone}</span>
                      </div>
                    </td>

                    <td data-label="Phòng đặt" className="px-4 py-3">
                      <span className="font-bold font-mono text-emerald-800 text-sm">
                        Phòng {res.roomNumber}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {res.roomType} ({res.guestsCount} khách)
                      </span>
                    </td>

                    <td data-label="Lịch trình lưu trú" className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Vào: <strong>{formatDate(res.checkInDate)} {res.checkInTime}</strong></span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Ra: {formatDate(res.checkOutDate)} {res.checkOutTime}
                      </div>
                    </td>

                    <td data-label="Tiền cọc" className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(res.depositAmount)}
                    </td>

                    <td data-label="Dự kiến tổng" className="px-4 py-3 text-right font-mono text-slate-900 font-semibold">
                      {formatCurrency(res.estimatedTotal)}<span className="block text-[10px] text-slate-500">{res.pricingType === 'HOUR' ? 'Theo giờ' : 'Theo đêm'}</span>
                    </td>

                    <td data-label="Trạng thái" className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          res.status === 'CONFIRMED'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : res.status === 'CHECKED_IN'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {res.status === 'CONFIRMED'
                          ? 'Chờ nhận phòng'
                          : res.status === 'CHECKED_IN'
                          ? 'Đã check-in'
                          : 'Đã hủy'}
                      </span>
                    </td>

                    <td data-label="Hành động" className="px-4 py-3 text-right">
                      {res.status === 'CONFIRMED' && (
                        <div className="flex items-center justify-end gap-2">
                          {canAct('booking.create') && (
                            <button
                              type="button"
                              onClick={() => setEditingReservation(res)}
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Sửa thông tin hoặc tiền đặt cọc"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canAct('booking.cancel') && <button
                            onClick={() => handleCancel(res.id, res.code, res.customerName)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hủy đặt phòng này"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>}
                          {canAct('stay.checkin') && <button
                            onClick={() => handleCheckInAndNavigate(res.id, res.roomNumber, res.customerName)}
                            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors shadow-xs"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Check-in</span>
                          </button>}
                        </div>
                      )}
                      {res.status === 'CHECKED_IN' && (
                        <span className="text-[11px] text-emerald-700 font-medium">
                          Đang lưu trú
                        </span>
                      )}
                      {res.status === 'CANCELLED' && !res.archived && res.depositAmount === 0 && canAct('booking.archive') && <button type="button" onClick={() => requestConfirm({ title: 'Lưu trữ phiếu đã hủy', message: `Ẩn phiếu ${res.code} khỏi danh sách thường? Phiếu được giữ trong lịch sử và bản sao lưu.`, confirmLabel: 'Lưu trữ', onConfirm: async () => { await archiveReservation(res.id); showToast('Đã lưu trữ phiếu. Lịch sử được giữ nguyên.'); } })} className="px-2.5 py-1.5 border rounded-lg text-slate-600 hover:bg-slate-100 text-xs">Lưu trữ</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Edit Reservation Modal */}
      {editingReservation && (
        <EditReservationModal
          reservation={editingReservation}
          onClose={() => setEditingReservation(null)}
        />
      )}
    </div>
  );
};
