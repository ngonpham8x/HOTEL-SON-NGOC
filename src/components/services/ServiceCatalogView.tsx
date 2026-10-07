import { AccessGuard } from '../common/AccessGuard';
import { useAccess } from '../../context/AccessContext';
import React, { useState } from 'react';
import { MobileTableToggle } from '../common/MobileTableToggle';
import { useHotel } from '../../context/HotelContext';
import { ServiceItem, Room, RoomType } from '../../types/hotel';
import { formatCurrency } from '../../utils/formatters';
import { sortRooms } from '../../utils/hotelLogic';
import {
  Coffee,
  Plus,
  DollarSign,
  Tag,
  Layers,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BedDouble,
  Sliders,
  Check,
} from 'lucide-react';

interface ServiceCatalogViewProps {
  onOpenAddRoom?: () => void;
  onEditRoom?: (room: Room) => void;
}

export const ServiceCatalogView: React.FC<ServiceCatalogViewProps> = ({
  onOpenAddRoom,
  onEditRoom,
}) => {
  const { canAct } = useAccess();
  const {
    services,
    rooms,
    addService,
    editService,
    deleteService,
    updateRoomTypePricing,
    deleteRoom,
    requestConfirm,
    showToast,
  } = useHotel();

  // Active view section: 'SERVICES' or 'ROOM_TARIFF'
  const [activeSection, setActiveSection] = useState<'SERVICES' | 'ROOM_TARIFF'>('SERVICES');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [tableMode, setTableMode] = useState<'COMPACT' | 'TABLE'>('COMPACT');

  // Service Edit / Add Modal state
  const [serviceModal, setServiceModal] = useState<{
    isOpen: boolean;
    mode: 'ADD' | 'EDIT';
    item: Partial<ServiceItem>;
  }>({
    isOpen: false,
    mode: 'ADD',
    item: {
      name: '',
      category: 'MASSAGE',
      categoryName: 'Vé Massage Thư Giãn',
      price: 200000,
      unit: 'Vé',
    },
  });

  // Room Type Batch Tariff Edit Modal state
  const [tariffModal, setTariffModal] = useState<{
    isOpen: boolean;
    type: RoomType;
    typeName: string;
    pricePerNight: number;
    pricePerHour: number;
  } | null>(null);

  const filteredServices = services.filter(
    s => activeCategory === 'ALL' || s.category === activeCategory
  );

  // Category meta helper
  const getCategoryName = (cat: ServiceItem['category']): string => {
    switch (cat) {
      case 'MASSAGE':
        return 'Vé Massage Thư Giãn';
      case 'MINIBAR':
        return 'Minibar & Đồ uống';
      case 'LAUNDRY':
        return 'Giặt ủi & Giặt khô';
      case 'RENTAL':
        return 'Dịch vụ thuê xe';
      case 'FOOD_BEVERAGE':
        return 'Ẩm thực & Buffet';
      default:
        return 'Dịch vụ khác';
    }
  };

  // Open Service Modal
  const handleOpenAddService = () => {
    setServiceModal({
      isOpen: true,
      mode: 'ADD',
      item: {
        name: '',
        category: 'MASSAGE',
        categoryName: 'Vé Massage Thư Giãn',
        price: 250000,
        unit: 'Vé',
      },
    });
  };

  const handleOpenEditService = (srv: ServiceItem) => {
    setServiceModal({
      isOpen: true,
      mode: 'EDIT',
      item: { ...srv },
    });
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceModal.item.name?.trim()) {
      showToast('Vui lòng nhập tên dịch vụ!', 'error');
      return;
    }
    if (typeof serviceModal.item.price !== 'number' || !Number.isSafeInteger(serviceModal.item.price) || serviceModal.item.price <= 0) {
      showToast('Đơn giá phải là số nguyên VND lớn hơn 0!', 'error');
      return;
    }

    const category = serviceModal.item.category || 'MASSAGE';
    const categoryName = getCategoryName(category);

    try {
    if (serviceModal.mode === 'ADD') {
      await addService({
        name: serviceModal.item.name.trim(),
        category,
        categoryName,
        price: Number(serviceModal.item.price),
        unit: serviceModal.item.unit?.trim() || 'Lượt',
      });
    } else if (serviceModal.mode === 'EDIT' && serviceModal.item.id) {
      await editService(serviceModal.item.id, {
        name: serviceModal.item.name.trim(),
        category,
        categoryName,
        price: Number(serviceModal.item.price),
        unit: serviceModal.item.unit?.trim() || 'Lượt',
      });
    }

    setServiceModal(prev => ({ ...prev, isOpen: false }));
    showToast('Đã lưu dịch vụ.');
    } catch (err) { showToast(err instanceof Error ? err.message : 'Không lưu được dịch vụ.', 'error'); }
  };

  const handleDeleteService = (srv: ServiceItem) => {
    requestConfirm({
      title: 'Xác nhận xóa dịch vụ',
      message: `Xóa dịch vụ "${srv.name}" khỏi bảng giá? Dịch vụ đã được sử dụng trong đặt phòng, lượt ở hoặc phiếu thu không thể xóa.`,
      confirmLabel: 'Xác nhận xóa',
      cancelLabel: 'Giữ lại',
      isDangerous: true,
      onConfirm: async () => {
        await deleteService(srv.id);
      },
    });
  };

  // Handle Room Delete
  const handleDeleteRoom = (room: Room) => {
    if (room.status === 'OCCUPIED') {
      showToast(`Không thể xóa phòng ${room.number} vì đang có khách lưu trú!`, 'error');
      return;
    }
    requestConfirm({
      title: 'Xác nhận xóa phòng',
      message: `Xóa phòng ${room.number} (Tầng ${room.floor}) khỏi khách sạn? Phòng có đặt phòng, lượt ở, phiếu thu hoặc công nợ liên quan không thể xóa.`,
      confirmLabel: 'Xác nhận xóa',
      cancelLabel: 'Giữ lại',
      isDangerous: true,
      onConfirm: async () => {
        if (await deleteRoom(room.id)) showToast(`Đã xóa thành công phòng ${room.number}`, 'success');
      },
    });
  };

  // Room Type Tariff Types definition
  const roomTypesMeta: {
    type: RoomType;
    typeName: string;
    description: string;
    maxGuests: number;
    defaultNight: number;
    defaultHour: number;
  }[] = [
    {
      type: 'STANDARD_SINGLE',
      typeName: 'Phòng Đơn Tiêu Chuẩn',
      description: 'Giường đơn/đôi 1m6, máy lạnh, TV 43", vệ sinh khép kín',
      maxGuests: 2,
      defaultNight: 450000,
      defaultHour: 100000,
    },
    {
      type: 'STANDARD_DOUBLE',
      typeName: 'Phòng Đôi Tiêu Chuẩn',
      description: 'Giường đôi King 1m8, điều hòa, TV, minibar, sấy tóc',
      maxGuests: 2,
      defaultNight: 600000,
      defaultHour: 130000,
    },
    {
      type: 'DELUXE',
      typeName: 'Phòng Deluxe View Hoa Viên / City View',
      description: 'Ban công ngắm đồi/hoa viên, bồn tắm nằm, TV 55", két sắt',
      maxGuests: 3,
      defaultNight: 850000,
      defaultHour: 180000,
    },
    {
      type: 'SUITE',
      typeName: 'Phòng Suite Gia Đình',
      description: '2 giường đôi lớn, khu sinh hoạt gia đình, bếp mini',
      maxGuests: 5,
      defaultNight: 1200000,
      defaultHour: 250000,
    },
    {
      type: 'VIP',
      typeName: 'Phòng VIP Hoàng Gia / Tổng Thống',
      description: 'Phòng khách riêng biệt, bồn sục Jacuzzi, âm thanh cao cấp',
      maxGuests: 4,
      defaultNight: 1400000,
      defaultHour: 300000,
    },
  ];

  // Save Batch Tariff Update
  const handleSaveTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tariffModal) return;
    if (tariffModal.pricePerNight <= 0 || tariffModal.pricePerHour <= 0) {
      showToast('Đơn giá phải lớn hơn 0!', 'error');
      return;
    }

    try {
    await updateRoomTypePricing(
      tariffModal.type,
      tariffModal.pricePerNight,
      tariffModal.pricePerHour
    );
    setTariffModal(null);
    showToast('Đã cập nhật bảng giá.');
    } catch (err) { showToast(err instanceof Error ? err.message : 'Không lưu được bảng giá.', 'error'); }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Main Section Switcher */}
      <div className="bg-white p-5 rounded-2xl border border-teal-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Bảng Giá Dịch Vụ & Cấu Hình Giá Phòng
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 uppercase">
              {canAct('service.configure') || canAct('service.delete') || canAct('room.configure') || canAct('room.delete') ? 'Cập nhật trực tiếp' : 'Chỉ xem'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Bảng giá vé Massage thư giãn, dịch vụ lưu trú, minibar và giá {rooms.length} phòng
          </p>
        </div>

        {/* Section Segmented Switcher */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-xl self-start md:self-center border border-slate-200">
          <button
            onClick={() => setActiveSection('SERVICES')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSection === 'SERVICES'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Dịch Vụ & Vé Massage ({services.length})</span>
          </button>
          <button
            onClick={() => setActiveSection('ROOM_TARIFF')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSection === 'ROOM_TARIFF'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Cấu hình giá phòng ({rooms.length} phòng)</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: SERVICES & MASSAGE TICKETS MANAGEMENT          */}
      {/* ========================================================= */}
      <MobileTableToggle mode={tableMode} onChange={setTableMode} />
      {activeSection === 'SERVICES' && (
        <div className="space-y-4">
          {/* Action Header & Category Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCategory === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Tất cả ({services.length})
              </button>
              <button
                onClick={() => setActiveCategory('MASSAGE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'MASSAGE'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-white border border-teal-300 text-teal-800 hover:bg-teal-50'
                }`}
              >
                <span>🌸 Vé Massage Thư Giãn</span>
                <span className="bg-teal-100 text-teal-800 text-[10px] px-1.5 py-0.2 rounded-full">
                  {services.filter(s => s.category === 'MASSAGE').length}
                </span>
              </button>
              <button
                onClick={() => setActiveCategory('MINIBAR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCategory === 'MINIBAR'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Minibar & Đồ uống
              </button>
              <button
                onClick={() => setActiveCategory('LAUNDRY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCategory === 'LAUNDRY'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Giặt ủi
              </button>
              <button
                onClick={() => setActiveCategory('RENTAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCategory === 'RENTAL'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Thuê xe
              </button>
              <button
                onClick={() => setActiveCategory('FOOD_BEVERAGE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCategory === 'FOOD_BEVERAGE'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Ẩm thực
              </button>
            </div>

            {/* Add Service Button */}
            <AccessGuard action="service.configure"><button
              onClick={handleOpenAddService}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Dịch Vụ / Vé Massage Mới</span>
            </button></AccessGuard>
          </div>

          {/* Services Table with Action Buttons */}
          <div className="bg-white rounded-2xl border border-teal-200/90 overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Coffee className="w-4 h-4 text-teal-600" />
                <span>Danh Sách Dịch Vụ Cung Cấp & Vé Massage ({filteredServices.length})</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                {canAct('service.configure') && canAct('service.delete') ? 'Nhấn "Sửa" để cập nhật đơn giá hoặc "Xóa" để gỡ bỏ dịch vụ' : canAct('service.configure') ? 'Nhấn "Sửa" để cập nhật đơn giá dịch vụ' : canAct('service.delete') ? 'Có thể xóa dịch vụ chưa có dữ liệu liên quan' : 'Bạn đang xem bảng giá dịch vụ'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className={`mobile-table ${tableMode === 'TABLE' ? 'mobile-table-wide' : ''} w-full text-left text-xs`}>
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-center">STT</th>
                    <th className="px-4 py-3">Tên Dịch Vụ / Vé Massage</th>
                    <th className="px-4 py-3">Phân loại</th>
                    <th className="px-4 py-3 text-center">Đơn vị tính</th>
                    <th className="px-4 py-3 text-right">Đơn giá niêm yết (VNĐ)</th>
                    <th className="px-4 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredServices.map((srv, idx) => (
                    <tr key={srv.id} className="hover:bg-teal-50/40 transition-colors">
                      <td data-label="STT" className="px-4 py-3 font-mono text-center text-slate-400">{idx + 1}</td>
                      <td data-label="Tên Dịch Vụ / Vé Massage" className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{srv.name}</span>
                        {srv.category === 'MASSAGE' && (
                          <span className="text-[10px] text-teal-700 font-semibold flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-3 h-3" />
                            <span>Dịch vụ vé massage thư giãn</span>
                          </span>
                        )}
                      </td>
                      <td data-label="Phân loại" className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          srv.category === 'MASSAGE'
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : srv.category === 'MINIBAR'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {srv.categoryName}
                        </span>
                      </td>
                      <td data-label="Đơn vị tính" className="px-4 py-3 text-center font-medium text-slate-600">
                        {srv.unit}
                      </td>
                      <td data-label="Đơn giá niêm yết (VNĐ)" className="px-4 py-3 text-right font-mono font-bold text-sm text-teal-900">
                        {formatCurrency(srv.price)}
                      </td>
                      <td data-label="Thao tác" className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <AccessGuard action="service.configure"><button
                            onClick={() => handleOpenEditService(srv)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-teal-100 text-slate-700 hover:text-teal-900 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-200"
                            title="Chỉnh sửa tên, phân loại hoặc đơn giá"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-teal-700" />
                            <span>Sửa</span>
                          </button></AccessGuard>
                          <AccessGuard action="service.delete"><button
                            onClick={() => handleDeleteService(srv)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-rose-200"
                            title="Xóa dịch vụ khỏi hệ thống"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Xóa</span>
                          </button></AccessGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: ROOM PRICING TARIFF & 15 ROOMS CONFIGURATION   */}
      {/* ========================================================= */}
      {activeSection === 'ROOM_TARIFF' && (
        <div className="space-y-6">
          {/* Sub-section 1: Room Type Tariff (Cập nhật giá theo Hạng Phòng) */}
          <div className="bg-white rounded-2xl border border-teal-200/90 overflow-hidden shadow-2xs">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-teal-600" />
                  <span>Bảng Giá Niêm Yết Theo Hạng Phòng (Tariff)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {canAct('room.configure') ? 'Cập nhật đơn giá theo đêm & theo giờ cho toàn bộ các phòng thuộc từng hạng phòng' : 'Đơn giá theo đêm và theo giờ của từng hạng phòng'}
                </p>
              </div>

              {onOpenAddRoom && (
                <AccessGuard action="room.configure"><button
                  onClick={onOpenAddRoom}
                  className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs shrink-0 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Thêm Phòng Mới</span>
                </button></AccessGuard>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className={`mobile-table ${tableMode === 'TABLE' ? 'mobile-table-wide' : ''} w-full text-left text-xs`}>
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Hạng phòng</th>
                    <th className="px-4 py-3 text-center">Số phòng áp dụng</th>
                    <th className="px-4 py-3 text-center">Sức chứa tối đa</th>
                    <th className="px-4 py-3 text-right">Giá theo đêm (VNĐ)</th>
                    <th className="px-4 py-3 text-right">Giá theo giờ (VNĐ)</th>
                    <th className="px-4 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomTypesMeta.map(meta => {
                    const roomsOfType = sortRooms(rooms.filter(r => r.type === meta.type));
                    const currentNightPrice = roomsOfType[0]?.pricePerNight || meta.defaultNight;
                    const currentHourPrice = roomsOfType[0]?.pricePerHour || meta.defaultHour;

                    return (
                      <tr key={meta.type} className="hover:bg-teal-50/30 transition-colors">
                        <td data-label="Hạng phòng" className="px-4 py-3.5">
                          <span className="font-bold text-slate-900 block">{meta.typeName}</span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">{meta.description}</span>
                        </td>
                        <td data-label="Số phòng áp dụng" className="px-4 py-3.5 text-center font-mono font-bold text-teal-800">
                          {roomsOfType.length} phòng
                        </td>
                        <td data-label="Sức chứa tối đa" className="px-4 py-3.5 text-center font-medium text-slate-600">
                          {meta.maxGuests} người
                        </td>
                        <td data-label="Giá theo đêm (VNĐ)" className="px-4 py-3.5 text-right font-mono font-bold text-sm text-teal-900">
                          {formatCurrency(currentNightPrice)}
                        </td>
                        <td data-label="Giá theo giờ (VNĐ)" className="px-4 py-3.5 text-right font-mono font-bold text-sm text-slate-700">
                          {formatCurrency(currentHourPrice)}
                        </td>
                        <td data-label="Thao tác" className="px-4 py-3.5 text-center">
                          <AccessGuard action="room.configure"><button
                            onClick={() =>
                              setTariffModal({
                                isOpen: true,
                                type: meta.type,
                                typeName: meta.typeName,
                                pricePerNight: currentNightPrice,
                                pricePerHour: currentHourPrice,
                              })
                            }
                            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold border border-teal-300 transition-colors flex items-center gap-1 mx-auto"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Sửa giá hạng này</span>
                          </button></AccessGuard>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-section 2: Individual 15 Rooms Configuration (N01 - N15 on 2 Floors) */}
          <div className="bg-white rounded-2xl border border-teal-200/90 overflow-hidden shadow-2xs">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-teal-600" />
                  <span>Danh sách phòng & cấu hình giá</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {canAct('room.configure') ? 'Cập nhật giá, hình thức thuê và giờ nhận / trả cho từng phòng.' : 'Giá, hình thức thuê và giờ nhận / trả của từng phòng.'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className={`mobile-table ${tableMode === 'TABLE' ? 'mobile-table-wide' : ''} w-full text-left text-xs`}>
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-center">Số Phòng</th>
                    <th className="px-4 py-3 text-center">Tầng</th>
                    <th className="px-4 py-3">Hạng phòng</th>
                    <th className="px-4 py-3 text-right">Giá theo đêm (VNĐ)</th>
                    <th className="px-4 py-3 text-right">Giá theo giờ (VNĐ)</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                    <th className="px-4 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortRooms(rooms).map(room => (
                    <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                      <td data-label="Số Phòng" className="px-4 py-3 text-center font-mono font-extrabold text-sm text-teal-900">
                        {room.number}
                      </td>
                      <td data-label="Tầng" className="px-4 py-3 text-center font-semibold text-slate-600">
                        Tầng {room.floor}
                      </td>
                      <td data-label="Hạng phòng" className="px-4 py-3">
                        <span className="font-semibold text-slate-900 block">{room.typeName}</span>
                        <span className="text-[11px] text-slate-500 block">Sức chứa: {room.maxGuests} khách · Nhận {room.defaultCheckInTime} · Trả {room.defaultCheckOutTime}</span>
                      </td>
                      <td data-label="Giá theo đêm (VNĐ)" className="px-4 py-3 text-right font-mono font-bold text-teal-900">
                        {formatCurrency(room.pricePerNight)}
                      </td>
                      <td data-label="Giá theo giờ (VNĐ)" className="px-4 py-3 text-right font-mono text-slate-700">
                        {room.allowsHourly === false ? 'Không thuê giờ' : formatCurrency(room.pricePerHour)}
                      </td>
                      <td data-label="Trạng thái" className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          room.status === 'OCCUPIED'
                            ? 'bg-rose-100 text-rose-800'
                            : room.status === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : room.status === 'RESERVED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {room.status === 'OCCUPIED' ? 'Có khách' : room.status === 'AVAILABLE' ? 'Trống sẵn sàng' : room.status === 'RESERVED' ? 'Đã đặt' : 'Cần dọn'}
                        </span>
                      </td>
                      <td data-label="Thao tác" className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {onEditRoom && (
                            <AccessGuard action="room.configure"><button
                              onClick={() => onEditRoom(room)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-teal-100 text-slate-700 hover:text-teal-900 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-200"
                              title="Sửa số phòng, giá hoặc thông tin"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-teal-700" />
                              <span>Sửa</span>
                            </button></AccessGuard>
                          )}
                          <AccessGuard action="room.delete"><button
                            onClick={() => handleDeleteRoom(room)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-rose-200"
                            title="Xóa phòng khỏi hệ thống"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Xóa</span>
                          </button></AccessGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT SERVICE & MASSAGE TICKET              */}
      {/* ========================================================= */}
      {serviceModal.isOpen && canAct('service.configure') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-teal-200 max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-gradient-to-r from-teal-900 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-teal-300" />
                  <span>
                    {serviceModal.mode === 'ADD'
                      ? 'Thêm Dịch Vụ / Vé Massage Mới'
                      : 'Cập Nhật Dịch Vụ / Vé Massage'}
                  </span>
                </h3>
                <p className="text-xs text-teal-200 mt-0.5">HOTEL SƠN NGỌC</p>
              </div>
              <button
                onClick={() => setServiceModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <AccessGuard action="service.configure"><form onSubmit={handleSaveService} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Tên dịch vụ / Vé massage <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Vé Massage Toàn Thân (60p), Nước ngọt..."
                  value={serviceModal.item.name || ''}
                  onChange={e =>
                    setServiceModal(prev => ({
                      ...prev,
                      item: { ...prev.item, name: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Phân loại danh mục <span className="text-rose-500">*</span>
                </label>
                <select
                  value={serviceModal.item.category || 'MASSAGE'}
                  onChange={e =>
                    setServiceModal(prev => ({
                      ...prev,
                      item: {
                        ...prev.item,
                        category: e.target.value as ServiceItem['category'],
                        categoryName: getCategoryName(e.target.value as ServiceItem['category']),
                      },
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none"
                >
                  <option value="MASSAGE">🌸 Vé Massage Thư Giãn</option>
                  <option value="MINIBAR">Minibar & Đồ uống</option>
                  <option value="LAUNDRY">Giặt ủi & Giặt khô</option>
                  <option value="RENTAL">Dịch vụ thuê xe máy / ô tô</option>
                  <option value="FOOD_BEVERAGE">Ẩm thực & Buffet</option>
                  <option value="OTHER">Dịch vụ khác</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Đơn vị tính <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Vé, Chai, Lon, Suất..."
                    value={serviceModal.item.unit || ''}
                    onChange={e =>
                      setServiceModal(prev => ({
                        ...prev,
                        item: { ...prev.item, unit: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Đơn giá niêm yết (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step={1}
                    aria-label="Đơn giá niêm yết (VNĐ)"
                    placeholder="VD: 250000"
                    value={serviceModal.item.price || ''}
                    onChange={e =>
                      setServiceModal(prev => ({
                        ...prev,
                        item: { ...prev.item, price: Number(e.target.value) },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setServiceModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors shadow-xs"
                >
                  {serviceModal.mode === 'ADD' ? 'Lưu Dịch Vụ Mới' : 'Cập Nhật Thay Đổi'}
                </button>
              </div>
            </form></AccessGuard>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: BATCH UPDATE ROOM TARIFF BY ROOM TYPE           */}
      {/* ========================================================= */}
      {tariffModal && canAct('room.configure') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-teal-200 max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-gradient-to-r from-teal-900 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-teal-300" />
                  <span>Cập Nhật Bảng Giá Hạng Phòng</span>
                </h3>
                <p className="text-xs text-teal-200 mt-0.5">{tariffModal.typeName}</p>
              </div>
              <button
                onClick={() => setTariffModal(null)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <AccessGuard action="room.configure"><form onSubmit={handleSaveTariff} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 space-y-1">
                <span className="font-bold block">Tự động áp dụng hàng loạt:</span>
                <p className="text-[11px] text-teal-800">
                  Khi bạn lưu, giá mới sẽ được cập nhật đồng loạt cho toàn bộ các phòng thuộc hạng này:
                  {' '}
                  <strong>
                    {sortRooms(rooms.filter(r => r.type === tariffModal.type)).map(r => r.number).join(', ') || 'Chưa có phòng'}
                  </strong>
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Giá theo đêm mới (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  aria-label="Giá theo đêm mới (VNĐ)"
                  value={tariffModal.pricePerNight}
                  onChange={e =>
                    setTariffModal(prev => (prev ? { ...prev, pricePerNight: Number(e.target.value) } : null))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Giá theo giờ mới (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  aria-label="Giá theo giờ mới (VNĐ)"
                  value={tariffModal.pricePerHour}
                  onChange={e =>
                    setTariffModal(prev => (prev ? { ...prev, pricePerHour: Number(e.target.value) } : null))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none text-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTariffModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors shadow-xs"
                >
                  Lưu & Áp Dụng Ngay
                </button>
              </div>
            </form></AccessGuard>
          </div>
        </div>
      )}
    </div>
  );
};
