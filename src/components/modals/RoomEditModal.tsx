import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Room, RoomType } from '../../types/hotel';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  BedDouble,
  DollarSign,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  Layers,
} from 'lucide-react';

interface RoomEditModalProps {
  initialRoom?: Room | null; // If null, mode is ADD ROOM
  onClose: () => void;
}

export const RoomEditModal: React.FC<RoomEditModalProps> = ({ initialRoom, onClose }) => {
  const { rooms, addRoom, editRoom, deleteRoom, showToast, requestConfirm } = useHotel();

  const isEditing = !!initialRoom;

  const [number, setNumber] = useState<string>(initialRoom ? initialRoom.number : '');
  const [floor, setFloor] = useState<number>(initialRoom ? initialRoom.floor : 1);
  const [type, setType] = useState<RoomType>(initialRoom ? initialRoom.type : 'STANDARD_SINGLE');
  const [pricePerNight, setPricePerNight] = useState<number>(
    initialRoom ? initialRoom.pricePerNight : 450000
  );
  const [pricePerHour, setPricePerHour] = useState<number>(
    initialRoom ? initialRoom.pricePerHour : 100000
  );
  const [maxGuests, setMaxGuests] = useState<number>(initialRoom ? initialRoom.maxGuests : 2);
  const [amenitiesText, setAmenitiesText] = useState<string>(
    initialRoom ? initialRoom.amenities.join(', ') : 'Điều hòa, Smart TV, Wifi, Bình nóng lạnh'
  );
  const [notes, setNotes] = useState<string>(initialRoom ? initialRoom.notes || '' : '');
  const [allowsHourly, setAllowsHourly] = useState(initialRoom?.allowsHourly ?? true);
  const [defaultCheckInTime, setDefaultCheckInTime] = useState(initialRoom?.defaultCheckInTime || '14:00');
  const [defaultCheckOutTime, setDefaultCheckOutTime] = useState(initialRoom?.defaultCheckOutTime || '12:00');
  const [error, setError] = useState<string>('');

  const getTypeName = (t: RoomType): string => {
    switch (t) {
      case 'STANDARD_SINGLE':
        return 'Phòng Đơn Tiêu Chuẩn';
      case 'STANDARD_DOUBLE':
        return 'Phòng Đôi Tiêu Chuẩn';
      case 'DELUXE':
        return 'Phòng Deluxe City View';
      case 'SUITE':
        return 'Phòng Suite Gia Đình';
      case 'VIP':
        return 'Phòng VIP Hoàng Gia';
      default:
        return 'Phòng tiêu chuẩn';
    }
  };

  const handleTypeChange = (newType: RoomType) => {
    setType(newType);
    if (!initialRoom) {
      // Suggest default prices when adding
      if (newType === 'STANDARD_SINGLE') {
        setPricePerNight(450000);
        setPricePerHour(100000);
        setMaxGuests(2);
      } else if (newType === 'STANDARD_DOUBLE') {
        setPricePerNight(600000);
        setPricePerHour(130000);
        setMaxGuests(2);
      } else if (newType === 'DELUXE') {
        setPricePerNight(850000);
        setPricePerHour(180000);
        setMaxGuests(3);
      } else if (newType === 'SUITE') {
        setPricePerNight(1200000);
        setPricePerHour(250000);
        setMaxGuests(5);
      } else if (newType === 'VIP') {
        setPricePerNight(1600000);
        setPricePerHour(320000);
        setMaxGuests(4);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = number.trim();
    if (!cleanNumber) {
      setError('Vui lòng nhập số phòng!');
      return;
    }

    // Check duplicate room number
    const existing = rooms.find(
      r => r.number.toLowerCase() === cleanNumber.toLowerCase() && r.id !== initialRoom?.id
    );
    if (existing) {
      setError(`Số phòng ${cleanNumber} đã tồn tại trong khách sạn!`);
      return;
    }

    const amenitiesList = amenitiesText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (isEditing && initialRoom) {
      // Prompt confirmation before update
      requestConfirm({
        title: 'Xác nhận cập nhật thông tin phòng',
        message: `Bạn có chắc chắn muốn lưu các thay đổi cho Phòng ${cleanNumber}? Mức giá mới: ${formatCurrency(pricePerNight)}/đêm.`,
        confirmLabel: 'Lưu thay đổi',
        onConfirm: async () => {
          await editRoom(initialRoom.id, {
            allowsHourly, defaultCheckInTime, defaultCheckOutTime,
            number: cleanNumber,
            floor: Number(floor),
            type,
            typeName: getTypeName(type),
            pricePerNight: Number(pricePerNight),
            pricePerHour: Number(pricePerHour),
            maxGuests: Number(maxGuests),
            amenities: amenitiesList,
            notes,
          });
          showToast(`Đã cập nhật thông tin Phòng ${cleanNumber} thành công!`, 'success');
          onClose();
        },
      });
    } else {
      // Add room prompt
      requestConfirm({
        title: 'Xác nhận thêm phòng mới',
        message: `Xác nhận tạo mới Phòng ${cleanNumber} (Tầng ${floor}, ${getTypeName(type)}) vào hệ thống HOTEL SƠN NGỌC?`,
        confirmLabel: 'Tạo phòng ngay',
        onConfirm: async () => {
          await addRoom({
            allowsHourly, defaultCheckInTime, defaultCheckOutTime,
            number: cleanNumber,
            floor: Number(floor),
            type,
            typeName: getTypeName(type),
            pricePerNight: Number(pricePerNight),
            pricePerHour: Number(pricePerHour),
            maxGuests: Number(maxGuests),
            status: 'AVAILABLE',
            cleanStatus: 'CLEAN',
            amenities: amenitiesList,
            notes,
          });
          showToast(`Đã thêm Phòng ${cleanNumber} mới thành công!`, 'success');
          onClose();
        },
      });
    }
  };

  const handleDelete = () => {
    if (!initialRoom) return;

    if (initialRoom.status === 'OCCUPIED') {
      showToast(`Không thể xóa phòng ${initialRoom.number} vì đang có khách lưu trú!`, 'error');
      return;
    }

    requestConfirm({
      title: 'Xác nhận xóa phòng',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn Phòng ${initialRoom.number} khỏi danh sách phòng HOTEL SƠN NGỌC? Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xác nhận xóa phòng',
      cancelLabel: 'Giữ lại',
      isDangerous: true,
      onConfirm: async () => {
        const ok = await deleteRoom(initialRoom.id);
        if (ok) {
          showToast(`Đã xóa Phòng ${initialRoom.number} khỏi hệ thống!`, 'success');
          onClose();
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BedDouble className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold">
                {isEditing ? `Chỉnh sửa thông tin Phòng ${initialRoom.number}` : 'Thêm phòng mới'}
              </h3>
              <p className="text-xs text-slate-300">
                HOTEL SƠN NGỌC · Hotline: 0392.089.960 (Ms Trinh)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={allowsHourly} onChange={e => setAllowsHourly(e.target.checked)} />Cho thuê theo giờ</label>
            <div className="grid grid-cols-2 gap-3">
              <label>Giờ bắt đầu nhận phòng<input aria-label="Giờ bắt đầu nhận phòng" type="time" required value={defaultCheckInTime} onChange={e => setDefaultCheckInTime(e.target.value)} className="mt-1 w-full p-2 border rounded-lg bg-white" /></label>
              <label>Giờ trả phòng chuẩn<input aria-label="Giờ trả phòng chuẩn" type="time" required value={defaultCheckOutTime} onChange={e => setDefaultCheckOutTime(e.target.value)} className="mt-1 w-full p-2 border rounded-lg bg-white" /></label>
            </div>
          </div>
          {/* Room Number & Floor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Số phòng <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: N01, N02..."
                value={number}
                onChange={e => setNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Thuộc tầng <span className="text-rose-500">*</span>
              </label>
              <select
                value={floor}
                onChange={e => setFloor(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
              >
                <option value={1}>Tầng 1</option>
                <option value={2}>Tầng 2</option>
              </select>
            </div>
          </div>

          {/* Room Type */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Hạng phòng lưu trú <span className="text-rose-500">*</span>
            </label>
            <select
              value={type}
              onChange={e => handleTypeChange(e.target.value as RoomType)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
            >
              <option value="STANDARD_SINGLE">Phòng Đơn Tiêu Chuẩn (Standard Single)</option>
              <option value="STANDARD_DOUBLE">Phòng Đôi Tiêu Chuẩn (Standard Double)</option>
              <option value="DELUXE">Phòng Deluxe View Hoa Viên / City View</option>
              <option value="SUITE">Phòng Suite Gia Đình (Family Suite)</option>
              <option value="VIP">Phòng VIP Hoàng Gia / Tổng Thống</option>
            </select>
          </div>

          {/* Pricing fields */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Giá theo đêm (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="1"
                aria-label="Giá theo đêm (VNĐ)"
                min="0"
                required
                value={pricePerNight}
                onChange={e => setPricePerNight(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
              />
              <span className="text-[11px] text-emerald-700 font-mono mt-0.5 block">
                {formatCurrency(pricePerNight)}/đêm
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Giá theo giờ (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="1"
                aria-label="Giá theo giờ (VNĐ)"
                min="0"
                required
                value={pricePerHour}
                onChange={e => setPricePerHour(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
              />
              <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                {formatCurrency(pricePerHour)}/giờ
              </span>
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Sức chứa tối đa (Khách)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxGuests}
              onChange={e => setMaxGuests(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Tiện nghi phòng (ngăn cách bởi dấu phẩy)
            </label>
            <input
              type="text"
              value={amenitiesText}
              onChange={e => setAmenitiesText(e.target.value)}
              placeholder="Điều hòa, Smart TV, Wifi, Bồn tắm..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Ghi chú thêm về phòng
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Vị trí ban công ngắm phố, cửa sổ đón nắng..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa phòng</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 rounded-lg font-semibold text-slate-700 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isEditing ? 'Lưu cập nhật' : 'Tạo phòng'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
