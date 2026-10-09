import { AccessGuard } from '../common/AccessGuard';
import React, { useState, useMemo } from 'react';
import { invoiceRevenue, invoiceCollected, sortRooms } from '../../utils/hotelLogic';
import { useHotel } from '../../context/HotelContext';
import { Room, RoomStatus, StayRecord, Reservation } from '../../types/hotel';
import { EditStayModal } from '../modals/EditStayModal';
import { EditReservationModal } from '../modals/EditReservationModal';
import { formatCurrency, getRoomStatusMeta } from '../../utils/formatters';
import {
  Sparkles,
  User,
  Coffee,
  ArrowRightCircle,
  Calendar,
  Wrench,
  CheckCircle,
  Clock,
  Filter,
  Plus,
  Edit2,
} from 'lucide-react';

interface RoomRackViewProps {
  onSelectRoom: (room: Room) => void;
  onCheckInRoom: (room: Room) => void;
  onCheckOutRoom: (room: Room) => void;
  onBookRoom: (room: Room) => void;
  onOpenAddRoom: () => void;
  onEditRoom: (room: Room) => void;
}

export const RoomRackView: React.FC<RoomRackViewProps> = ({
  onSelectRoom,
  onCheckInRoom,
  onCheckOutRoom,
  onBookRoom,
  onOpenAddRoom,
  onEditRoom,
}) => {
  const { rooms, stays, reservations, invoices, debts, updateRoomCleanStatus, updateRoomStatus, searchQuery, setActiveTab, today, showToast } = useHotel();
  const [selectedFloor, setSelectedFloor] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'ALL'>('ALL');
  const [editingStay, setEditingStay] = useState<StayRecord | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  // Revenue & Debt KPIs for the top strip
  const todayStr = today;
  const todayInvoices = useMemo(() => invoices.filter(i => i.date === todayStr), [invoices, todayStr]);
  const todayRevenue = useMemo(() => todayInvoices.reduce((s, i) => s + invoiceRevenue(i), 0), [todayInvoices]);
  const todayPaid = useMemo(() => todayInvoices.reduce((s, i) => s + invoiceCollected(i), 0), [todayInvoices]);
  const thisMonthRevenue = useMemo(
    () => invoices.filter(i => i.date.startsWith(today.slice(0, 7))).reduce((s, i) => s + invoiceRevenue(i), 0),
    [invoices, today]
  );
  const totalRemainingDebt = useMemo(() => debts.reduce((s, d) => s + d.remainingAmount, 0), [debts]);
  const activeDebtorsCount = useMemo(() => debts.filter(d => d.remainingAmount > 0).length, [debts]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return sortRooms(rooms.filter(room => {
      // Floor filter
      if (selectedFloor !== 'ALL' && room.floor !== selectedFloor) return false;
      // Status filter
      if (statusFilter !== 'ALL' && room.status !== statusFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNumber = room.number.toLowerCase().includes(q);
        const matchType = room.typeName.toLowerCase().includes(q);
        const matchGuest = room.currentGuestName?.toLowerCase().includes(q);
        if (!matchNumber && !matchType && !matchGuest) return false;
      }
      return true;
    }));
  }, [rooms, selectedFloor, statusFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: rooms.length,
      available: rooms.filter(r => r.status === 'AVAILABLE').length,
      occupied: rooms.filter(r => r.status === 'OCCUPIED').length,
      reserved: rooms.filter(r => r.status === 'RESERVED').length,
      cleaning: rooms.filter(r => r.status === 'CLEANING').length,
      maintenance: rooms.filter(r => r.status === 'MAINTENANCE').length,
    };
  }, [rooms]);

  const floors = [...new Set(rooms.map(room => room.floor))].sort((a, b) => a - b);

  const occupancyRate = rooms.length > 0 ? Math.round((counts.occupied / rooms.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Top Quick KPI Strip: Revenue & Room Stats (Song song 2 cột trên mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <AccessGuard anyView={['dashboard', 'analytics']}><div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-[11px] sm:text-xs truncate">Hôm nay</span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold shrink-0">{today.split('-').slice(1).reverse().join('/')}</span>
          </div>
          <p className="text-base sm:text-xl font-bold font-mono text-slate-900 mt-1 truncate">
            {formatCurrency(todayRevenue)}
          </p>
          <div className="mt-1.5 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 truncate">
            <span className="truncate">Thực thu: <strong className="text-emerald-700 font-mono">{formatCurrency(todayPaid)}</strong></span>
          </div>
        </div></AccessGuard>

        <AccessGuard anyView={['dashboard', 'analytics']}><div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-[11px] sm:text-xs truncate">Tháng này</span>
            <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded shrink-0">Tháng này</span>
          </div>
          <p className="text-base sm:text-xl font-bold font-mono text-emerald-800 mt-1 truncate">
            {formatCurrency(thisMonthRevenue)}
          </p>
          <div className="mt-1.5 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
            <AccessGuard view="analytics"><button
              onClick={() => setActiveTab('analytics')}
              className="text-emerald-700 font-bold hover:underline truncate"
            >
              So sánh tháng →
            </button></AccessGuard>
          </div>
        </div></AccessGuard>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-[11px] sm:text-xs truncate">Công suất</span>
            <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded shrink-0">{occupancyRate}%</span>
          </div>
          <p className="text-base sm:text-xl font-bold font-mono text-purple-900 mt-1 truncate">
            {counts.occupied}/{rooms.length} phòng
          </p>
          <div className="mt-1.5 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 truncate">
            <span className="truncate">Trống: <strong className="text-emerald-700 font-bold">{counts.available}</strong> phòng</span>
          </div>
        </div>

        <AccessGuard view="debt"><div className="bg-white p-3 sm:p-3.5 rounded-xl border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 text-xs">
            <span className="font-semibold text-[11px] sm:text-xs truncate">Khách nợ</span>
            <span className="text-[10px] text-rose-800 font-bold bg-rose-50 px-1.5 py-0.5 rounded shrink-0">{activeDebtorsCount} đoàn</span>
          </div>
          <p className="text-base sm:text-xl font-bold font-mono text-rose-800 mt-1 truncate">
            {formatCurrency(totalRemainingDebt)}
          </p>
          <div className="mt-1.5 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 border-t border-rose-100 pt-1.5">
            <button
              onClick={() => setActiveTab('debt')}
              className="text-rose-700 font-bold hover:underline truncate"
            >
              Thu nợ →
            </button>
          </div>
        </div></AccessGuard>
      </div>

      {/* Top Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('AVAILABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'AVAILABLE'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Trống sẵn sàng ({counts.available})
            </button>
            <button
              onClick={() => setStatusFilter('OCCUPIED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'OCCUPIED'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Đang có khách ({counts.occupied})
            </button>
            <button
              onClick={() => setStatusFilter('RESERVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'RESERVED'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Đã đặt ({counts.reserved})
            </button>
            <button
              onClick={() => setStatusFilter('CLEANING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'CLEANING'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Cần dọn ({counts.cleaning})
            </button>
            <button
              onClick={() => setStatusFilter('MAINTENANCE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'MAINTENANCE'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              Bảo trì ({counts.maintenance})
            </button>
          </div>

          {/* Floor Selector & Add Room */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Tầng:
            </span>
            <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <button
                onClick={() => setSelectedFloor('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedFloor === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
              </button>
              {floors.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedFloor(f)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    selectedFloor === f
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tầng {f}
                </button>
              ))}
            </div>

            <AccessGuard action="room.configure"><button
              onClick={onOpenAddRoom}
              className="sm:ml-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm phòng</span>
            </button></AccessGuard>
          </div>
        </div>
      </div>

      {/* Room Grid */}
      {filteredRooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-sm font-semibold text-slate-800">Không tìm thấy phòng phù hợp</p>
          <p className="text-xs text-slate-500 mt-1">Vui lòng thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredRooms.map(room => {
            const statusMeta = getRoomStatusMeta(room.status);
            const activeStay = stays.find(
              s => s.status === 'ACTIVE' && (s.roomId === room.id || s.roomNumber === room.number)
            );
            const activeRes = [...reservations].sort((a, b) => `${a.checkInDate} ${a.checkInTime}`.localeCompare(`${b.checkInDate} ${b.checkInTime}`)).find(
              r => r.status === 'CONFIRMED' && (r.roomId === room.id || r.roomNumber === room.number)
            );

            // Calculate services sum if occupied
            const serviceSum = activeStay
              ? activeStay.services.reduce((sum, item) => sum + item.totalPrice, 0)
              : 0;

            const isOccupied = room.status === 'OCCUPIED';
            const isAvailable = room.status === 'AVAILABLE';
            const isReserved = room.status === 'RESERVED';
            const isCleaning = room.status === 'CLEANING';
            const isMaintenance = room.status === 'MAINTENANCE';

            return (
              <div
                key={room.id}
                className={`group relative bg-white rounded-xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  isOccupied
                    ? 'border-rose-200 hover:border-rose-300'
                    : isAvailable
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : isReserved
                    ? 'border-amber-200 hover:border-amber-300'
                    : isCleaning
                    ? 'border-blue-200 hover:border-blue-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Top Header Strip */}
                <div
                  className={`px-3.5 py-2.5 flex items-center justify-between border-b ${
                    isOccupied
                      ? 'bg-rose-50/80 border-rose-100'
                      : isAvailable
                      ? 'bg-emerald-50/80 border-emerald-100'
                      : isReserved
                      ? 'bg-amber-50/80 border-amber-100'
                      : isCleaning
                      ? 'bg-blue-50/80 border-blue-100'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold tracking-tight font-mono text-slate-900">
                      {room.number}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      T{room.floor}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${statusMeta.color}`}
                    >
                      {statusMeta.label}
                    </span>
                    <AccessGuard action="room.configure"><button
                      onClick={e => {
                        e.stopPropagation();
                        onEditRoom(room);
                      }}
                      title="Chỉnh sửa thông tin / giá phòng / xóa phòng"
                      className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/80 rounded transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button></AccessGuard>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 line-clamp-1">
                        {room.typeName}
                      </span>
                    </div>

                    <div className="mt-1 flex items-baseline gap-1 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900">
                        {formatCurrency(room.pricePerNight)}
                      </span>
                      <span>/đêm</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-600">
                        {formatCurrency(room.pricePerHour)}
                      </span>
                      <span>/h</span>
                    </div>

                    {/* Dynamic state content */}
                    {isOccupied && activeStay && (
                      <div className="mt-3 p-2 bg-rose-50/60 rounded-lg border border-rose-100 space-y-1.5">
                        <div className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-800">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <User className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span className="truncate">{activeStay.customerName}</span>
                          </div>
                          <AccessGuard action="stay.checkin">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setEditingStay(activeStay);
                              }}
                              title="Sửa thông tin khách / Tiền cọc"
                              className="px-1.5 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-0.5 shrink-0 transition-colors"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>Sửa</span>
                            </button>
                          </AccessGuard>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Vào: {activeStay.checkInDate.slice(5)} {activeStay.checkInTime}
                          </span>
                          {activeStay.deposit > 0 && (
                            <span className="font-mono text-emerald-700 font-semibold text-[10px]">
                              Cọc: {formatCurrency(activeStay.deposit)}
                            </span>
                          )}
                        </div>
                        {serviceSum > 0 && (
                          <div className="flex items-center justify-between text-[11px] font-medium text-rose-700 pt-1 border-t border-rose-100">
                            <span className="flex items-center gap-1">
                              <Coffee className="w-3 h-3" /> Minibar/DV:
                            </span>
                            <span className="font-mono">{formatCurrency(serviceSum)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isReserved && activeRes && (
                      <div className="mt-3 p-2 bg-amber-50/70 rounded-lg border border-amber-100 space-y-1 text-xs">
                        <div className="font-semibold text-slate-800 flex items-center justify-between gap-1">
                          <div className="truncate flex items-center gap-1.5 min-w-0">
                            <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">{activeRes.customerName}</span>
                          </div>
                          <AccessGuard action="booking.create">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setEditingReservation(activeRes);
                              }}
                              title="Sửa thông tin cọc / đặt phòng"
                              className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center gap-0.5 shrink-0 transition-colors"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>Sửa cọc</span>
                            </button>
                          </AccessGuard>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Đến: {activeRes.checkInDate.slice(5)} lúc {activeRes.checkInTime}
                        </p>
                        <p className="text-[11px] font-medium text-amber-700">
                          Đã cọc: <span className="font-mono">{formatCurrency(activeRes.depositAmount)}</span>
                        </p>
                      </div>
                    )}

                    {isCleaning && (
                      <div className="mt-3 p-2 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-blue-900 space-y-1">
                        <p className="font-medium flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          Buồng phòng đang dọn
                        </p>
                        <p className="text-[11px] text-blue-600">
                          {room.notes || 'Chờ thay drap & vệ sinh buồng tắm'}
                        </p>
                      </div>
                    )}

                    {isMaintenance && (
                      <div className="mt-3 p-2 bg-slate-100 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                        <p className="font-medium flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-slate-600" />
                          Đang bảo dưỡng kỹ thuật
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {room.notes || 'Kiểm tra trang thiết bị'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Quick Action Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    {isOccupied ? (
                      <>
                        <button
                          onClick={() => onSelectRoom(room)}
                          className="flex-1 px-2 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center"
                        >
                          Chi tiết / DV
                        </button>
                        {activeStay && (
                          <AccessGuard action="stay.checkin">
                            <button
                              type="button"
                              onClick={() => setEditingStay(activeStay)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors text-center flex items-center justify-center gap-1"
                              title="Sửa thông tin khách / cọc"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Sửa</span>
                            </button>
                          </AccessGuard>
                        )}
                        <AccessGuard action="stay.checkout"><button
                          onClick={() => onCheckOutRoom(room)}
                          className="flex-1 px-2 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors text-center"
                        >
                          Trả phòng
                        </button></AccessGuard>
                      </>
                    ) : isAvailable ? (
                      <>
                        <AccessGuard action="booking.create"><button
                          onClick={() => onBookRoom(room)}
                          className="flex-1 px-2 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center"
                        >
                          Đặt trước
                        </button></AccessGuard>
                        <AccessGuard action="stay.checkin"><button
                          onClick={() => onCheckInRoom(room)}
                          className="flex-1 px-2 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors text-center flex items-center justify-center gap-1"
                        >
                          <span>Nhận</span>
                          <ArrowRightCircle className="w-3 h-3" />
                        </button></AccessGuard>
                      </>
                    ) : isReserved ? (
                      <>
                        {activeRes && (
                          <AccessGuard action="booking.create">
                            <button
                              type="button"
                              onClick={() => setEditingReservation(activeRes)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors text-center flex items-center justify-center gap-1"
                              title="Sửa thông tin cọc / đặt phòng"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Sửa cọc</span>
                            </button>
                          </AccessGuard>
                        )}
                        <AccessGuard action="stay.checkin"><button
                          onClick={() => onCheckInRoom(room)}
                          className="flex-1 px-2 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors text-center flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Nhận phòng</span>
                        </button></AccessGuard>
                      </>
                    ) : isCleaning ? (
                      <AccessGuard action="room.clean"><button
                        onClick={() => updateRoomCleanStatus(room.id, 'CLEAN').catch(error => showToast(error.message, 'error'))}
                        className="w-full px-2 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-center flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Đã dọn xong (Sạch)</span>
                      </button></AccessGuard>
                    ) : (
                      <AccessGuard action="room.status"><button
                        onClick={() => updateRoomStatus(room.id, 'AVAILABLE').catch(error => showToast(error.message, 'error'))}
                        className="w-full px-2 py-1.5 text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                      >
                        Hoàn tất bảo trì
                      </button></AccessGuard>
                    )}
                  </div>
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
