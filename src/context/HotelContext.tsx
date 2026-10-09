import { newId, localDate, localTime, dateTime, validatePeriod, stayDuration, money, roomDefaults, findBookingConflict, bookingConflictMessage, sortRooms } from '../utils/hotelLogic';
import { DATA_KEY, readHotelData, serializeHotelData, validateHotelData, type HotelData } from '../utils/hotelStorage';
import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import { HotelContext } from './HotelContextInstance';
import { prepareServiceSale, type ServiceSaleInput } from '../utils/serviceSale';
import { cloudEnabled, cloudRequest, CloudRequestError } from '../utils/cloudHotel';
import { useAccess, getFreshAccessActor } from './AccessContext';
import { firstAllowedModule } from '../utils/permissions';
import { authorizeHotelMutation, projectHotelData, roomNumberReferenced } from '../utils/authorizeHotelMutation';
import type { ActionId } from '../types/access';
import {
  Room,
  ServiceItem,
  Reservation,
  StayRecord,
  Invoice,
  DebtRecord,
  DebtPayment,
  PaymentMethod,
  InvoiceStatus,
  CleanStatus,
  RoomStatus,
  RoomType,
  CompanionGuest,
} from '../types/hotel';
import {
  INITIAL_ROOMS,
  INITIAL_SERVICES,
  INITIAL_STAYS,
  INITIAL_RESERVATIONS,
  INITIAL_DEBTS,
  INITIAL_INVOICES,
} from '../data/initialData';

interface CheckOutParams {
  checkOutDate?: string;
  checkOutTime?: string;
  stayId: string;
  roomCharge: number;
  serviceCharge: number;
  surcharge: number;
  discount: number;
  depositDeducted: number;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  dueDateForDebt?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => void | Promise<unknown>;
}

export interface HotelContextType {
  rooms: Room[];
  services: ServiceItem[];
  stays: StayRecord[];
  reservations: Reservation[];
  invoices: Invoice[];
  debts: DebtRecord[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Toast & Notifications
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;

  // Confirmation Modal
  confirmModal: ConfirmOptions | null;
  requestConfirm: (options: ConfirmOptions) => void;
  closeConfirm: () => void;

  // Room actions
  updateRoomCleanStatus: (roomId: string, cleanStatus: CleanStatus) => Promise<void>;
  updateRoomStatus: (roomId: string, status: RoomStatus) => Promise<void>;
  addRoom: (newRoom: Omit<Room, 'id'>) => Promise<void>;
  editRoom: (roomId: string, updated: Partial<Room>) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<boolean>;

  // Reservation actions
  createReservation: (data: Omit<Reservation, 'id' | 'code' | 'status' | 'createdAt'>) => Promise<Reservation>;
  cancelReservation: (resId: string) => Promise<void>;
  archiveReservation: (resId: string) => Promise<void>;
  checkInReservation: (resId: string) => Promise<void>;
  updateReservation: (resId: string, updates: Partial<Reservation>) => Promise<void>;

  // Stays & Services actions
  checkInDirect: (data: Omit<StayRecord, 'id' | 'code' | 'status' | 'services'>, initialServices?: { serviceId: string; quantity: number }[]) => Promise<StayRecord>;
  updateActiveStay: (stayId: string, updates: Partial<StayRecord>) => Promise<void>;
  addServiceToStay: (stayId: string, serviceId: string, quantity: number) => Promise<void>;
  removeServiceFromStay: (stayId: string, usageId: string) => Promise<void>;
  updateStayCompanions: (stayId: string, companions: CompanionGuest[]) => Promise<void>;

  // Service CRUD actions
  addService: (item: Omit<ServiceItem, 'id'>) => Promise<void>;
  editService: (id: string, updated: Partial<ServiceItem>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;

  // Room pricing batch actions
  updateRoomTypePricing: (roomType: RoomType, pricePerNight: number, pricePerHour: number) => Promise<void>;

  // Checkout & Invoice
  checkOutStay: (params: CheckOutParams) => Promise<Invoice>;
  sellServices: (params: ServiceSaleInput) => Promise<Invoice>;
  cancelCheckIn: (stayId: string) => Promise<void>;
  updateServiceSale: (invoiceId: string, params: ServiceSaleInput) => Promise<Invoice>;
  cancelServiceSale: (invoiceId: string) => Promise<void>;
  updateRoomInvoice: (invoiceId: string, updates: { customerName?: string; phone?: string; paymentMethod?: PaymentMethod; notes?: string }) => Promise<Invoice>;
  cancelRoomInvoice: (invoiceId: string) => Promise<void>;
  deleteInvoice: (invoiceId: string) => Promise<void>;
  clearCancelledInvoices: () => Promise<void>;

  // Debt actions
  recordDebtPayment: (debtId: string, amount: number, method: PaymentMethod, collectedBy: string, notes?: string) => Promise<void>;

  today: string;
  storageError: string;
  exportBackup: () => void;
  importBackup: (text: string) => Promise<void>;
}

export const HotelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const access = useAccess();
  const [activeTab, setActiveTabState] = useState(() => firstAllowedModule(access.actor) || 'none');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage?.getItem('hotel_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        window.localStorage?.setItem('hotel_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null);
  const [initial] = useState(() => cloudEnabled ? { data: { rooms: [], services: [], stays: [], reservations: [], invoices: [], debts: [] } as HotelData, error: '' } : readHotelData({ getItem: key => window.localStorage.getItem(key) }, { rooms: INITIAL_ROOMS, services: INITIAL_SERVICES, stays: INITIAL_STAYS, reservations: INITIAL_RESERVATIONS, invoices: INITIAL_INVOICES, debts: INITIAL_DEBTS }));
  const [data, setData] = useState(initial.data);
  const dataRef = useRef(data);
  const savedRef = useRef<string | null | undefined>(undefined);
  if (savedRef.current === undefined) { try { savedRef.current = localStorage.getItem(DATA_KEY); } catch { savedRef.current = null; } }
  const [storageError, setStorageError] = useState(initial.error);
  const blockedRef = useRef(initial.error);
  const cloudRevision = useRef(-1);
  const writing = useRef(false);
  const [cloudReady, setCloudReady] = useState(!cloudEnabled);
  const [today, setToday] = useState(localDate);
  useEffect(() => { const timer = setInterval(() => setToday(localDate()), 60000); return () => clearInterval(timer); }, []);
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  const showToast = (message: string, type: ToastMessage['type'] = 'success') => {
    const id = newId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  };
  const setActiveTab = (tab: string) => { if (access.canView(tab)) setActiveTabState(tab); else showToast('Bạn chưa được cấp quyền xem mục này.', 'error'); };
  useEffect(() => { if (!access.canView(activeTab)) setActiveTabState(firstAllowedModule(access.actor) || 'none'); }, [access.actor.version, activeTab]);
  const requestConfirm = (options: ConfirmOptions) => setConfirmModal(options);
  const closeConfirm = () => setConfirmModal(null);
  const commit = async (next: HotelData, operation: ActionId, recovering = false) => {
    const actor = getFreshAccessActor(access.actor);
    const normalizedNext: HotelData = { ...next, rooms: sortRooms(next.rooms) };
    authorizeHotelMutation(actor, dataRef.current, normalizedNext, operation);
    if (cloudEnabled) {
      if (!cloudReady || writing.current) throw new Error('Đang cập nhật dữ liệu. Vui lòng chờ rồi thử lại.');
      writing.current = true;
      try {
        const payload = { revision: cloudRevision.current, requestId: newId(), data: normalizedNext, operation };
        let result: { revision: number; data: HotelData };
        try { result = await cloudRequest('write', payload); }
        catch (error) { if (error instanceof CloudRequestError && error.status !== 503 && error.status !== 504) throw error; result = await cloudRequest('write', payload); }
        const fresh = validateHotelData(result.data);
        cloudRevision.current = result.revision; dataRef.current = fresh; setData(fresh); setStorageError('');
      } catch (error) {
        // Never confirm a deposit or invoice until the server has committed it.
        try { const fresh = await cloudRequest<{ revision: number; data: HotelData }>('read'); cloudRevision.current = fresh.revision; dataRef.current = validateHotelData(fresh.data); setData(dataRef.current); } catch { /* retain last confirmed snapshot */ }
        throw error;
      } finally { writing.current = false; }
      return;
    }
    if (blockedRef.current && !recovering) throw new Error(blockedRef.current);
    let saved: string | null;
    try { saved = localStorage.getItem(DATA_KEY); } catch { throw new Error('Trình duyệt không cho phép lưu dữ liệu.'); }
    if (!recovering && saved !== savedRef.current) {
      if (saved) { const fresh = validateHotelData(JSON.parse(saved).data); dataRef.current = fresh; setData(fresh); }
      savedRef.current = saved;
      throw new Error('Dữ liệu vừa được cập nhật ở cửa sổ khác. Kiểm tra lại rồi thực hiện thao tác.');
    }
    const serialized = serializeHotelData(normalizedNext);
    try {
      localStorage.setItem(DATA_KEY, serialized);
    } catch {
      setStorageError('Không lưu được dữ liệu. Kiểm tra dung lượng hoặc quyền lưu của trình duyệt; thao tác chưa được ghi nhận.');
      throw new Error('Không lưu được dữ liệu; thao tác chưa được ghi nhận.');
    }
    blockedRef.current = '';
    savedRef.current = serialized;
    setStorageError('');
    dataRef.current = normalizedNext;
    setData(normalizedNext);
  };
  useEffect(() => {
    if (cloudEnabled) {
      let stopped = false, reading = false;
      const refresh = async () => {
        if (reading || writing.current) return;
        reading = true;
        try {
          const next = await cloudRequest<{ revision: number; data: HotelData }>('read');
          if (!stopped && !writing.current && next.revision >= cloudRevision.current) { const fresh = validateHotelData(next.data); cloudRevision.current = next.revision; dataRef.current = fresh; setData(fresh); setCloudReady(true); setStorageError(''); }
        } catch { if (!stopped) setStorageError('Chưa kết nối được dữ liệu chung. Kiểm tra mạng; thao tác chỉ được ghi nhận khi máy chủ xác nhận.'); }
        finally { reading = false; }
      };
      void refresh(); const timer = setInterval(refresh, 5000);
      window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
      return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== DATA_KEY || !event.newValue) return;
      try {
        const next = validateHotelData(JSON.parse(event.newValue).data);
        savedRef.current = event.newValue;
        dataRef.current = next; setData(next);
      } catch { setStorageError('Dữ liệu từ cửa sổ khác không hợp lệ.'); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const rooms = useMemo(() => sortRooms(data.rooms), [data.rooms]);
  const { services, stays, reservations, invoices } = data;
  const debts = data.debts.map(d => ({ ...d, status: (d.remainingAmount === 0 ? 'SETTLED' : d.dueDate < today ? 'OVERDUE' : d.paidAmount > 0 ? 'PARTIAL' : 'UNPAID') as DebtRecord['status'] }));
  const ensureGuests = (room: Room, count: number) => { if (!Number.isInteger(count) || count < 1 || count > room.maxGuests) throw new Error(`Phòng ${room.number} chỉ nhận từ 1 đến ${room.maxGuests} khách.`); };
  const vacantStatus = (roomId: string, list = dataRef.current.reservations): RoomStatus => list.some(r => r.roomId === roomId && r.status === 'CONFIRMED') ? 'RESERVED' : 'AVAILABLE';
  const updateRoomCleanStatus = async (roomId: string, cleanStatus: CleanStatus) => {
    const db = dataRef.current;
    await commit({ ...db, rooms: db.rooms.map(r => r.id === roomId ? { ...r, cleanStatus, status: r.status === 'CLEANING' && cleanStatus === 'CLEAN' ? vacantStatus(roomId) : r.status } : r) }, 'room.clean');
  };
  const updateRoomStatus = async (roomId: string, status: RoomStatus) => {
    const db = dataRef.current;
    if (db.stays.some(s => s.roomId === roomId && s.status === 'ACTIVE')) throw new Error('Phòng đang có khách; hãy trả phòng trước.');
    await commit({ ...db, rooms: db.rooms.map(r => r.id === roomId ? { ...r, status } : r) }, 'room.status');
  };
  const validateRoom = (room: Room) => {
    money(room.pricePerNight, 'Giá đêm'); money(room.pricePerHour, 'Giá giờ');
    if (!Number.isFinite(dateTime(today, room.defaultCheckInTime || '')) || !Number.isFinite(dateTime(today, room.defaultCheckOutTime || ''))) throw new Error('Giờ nhận / trả phòng không hợp lệ.');
    if (!room.number.trim() || !Number.isInteger(room.maxGuests) || room.maxGuests < 1 || !Number.isInteger(room.floor) || room.floor < 1) throw new Error('Thông tin phòng không hợp lệ.');
    if (dataRef.current.rooms.some(r => r.id !== room.id && r.number.toLowerCase() === room.number.trim().toLowerCase())) throw new Error('Số phòng đã tồn tại.');
  };
  const addRoom = async (input: Omit<Room, 'id'>) => {
    const room = roomDefaults({ ...input, id: newId() }); validateRoom(room);
    await commit({ ...dataRef.current, rooms: [...dataRef.current.rooms, room] }, 'room.configure');
  };
  const editRoom = async (roomId: string, updated: Partial<Room>) => {
    const db = dataRef.current, old = db.rooms.find(r => r.id === roomId); if (!old) throw new Error('Không tìm thấy phòng.');
    const room = roomDefaults({ ...old, ...updated, id: old.id }); validateRoom(room);
    await commit({ ...db, rooms: db.rooms.map(r => r.id === roomId ? room : r), stays: db.stays.map(s => s.roomId === roomId && s.status === 'ACTIVE' ? { ...s, roomNumber: room.number } : s), reservations: db.reservations.map(r => r.roomId === roomId && r.status === 'CONFIRMED' ? { ...r, roomNumber: room.number, roomType: room.typeName } : r) }, 'room.configure');
  };
  const deleteRoom = async (roomId: string) => {
    const db = dataRef.current;
    const room = db.rooms.find(r => r.id === roomId); if (!room) throw new Error('Không tìm thấy phòng.');
    if (db.stays.some(s => s.roomId === roomId && s.status !== 'CANCELLED') || db.reservations.some(r => r.roomId === roomId && r.status !== 'CANCELLED') || db.invoices.some(i => roomNumberReferenced(i.roomNumber, room.number) && i.status !== 'CANCELLED') || db.debts.some(d => roomNumberReferenced(d.roomNumber, room.number)) || room.currentStayId) { throw new Error('Phòng đã có dữ liệu liên quan. Không thể xóa; hãy dùng trạng thái bảo trì nếu cần ngừng sử dụng.'); }
    await commit({ ...db, rooms: db.rooms.filter(r => r.id !== roomId) }, 'room.delete'); return true;
  };
  const createReservation = async (input: Omit<Reservation, 'id' | 'code' | 'status' | 'createdAt'>) => {
    const db = dataRef.current, room = db.rooms.find(r => r.id === input.roomId); if (!room) throw new Error('Không tìm thấy phòng.');
    const { start, end } = validatePeriod(input.checkInDate, input.checkInTime, input.checkOutDate, input.checkOutTime);
    if (room.status === 'MAINTENANCE') throw new Error('Phòng đang bảo trì.');
    const conflict = findBookingConflict(room.id, start, end, db.reservations, db.stays);
    if (conflict) throw new Error(bookingConflictMessage(conflict));
    ensureGuests(room, input.guestsCount); money(input.depositAmount, 'Tiền cọc');
    if (!input.customerName.trim()) throw new Error('Vui lòng nhập tên khách.');
    if (input.pricingType === 'HOUR' && room.allowsHourly === false) throw new Error('Phòng này không cho thuê theo giờ.');
    const pricingType = input.pricingType || 'NIGHT', rateApplied = pricingType === 'HOUR' ? room.pricePerHour : room.pricePerNight;
    const id = newId();
    const res: Reservation = { ...input, pricingType, rateApplied, estimatedTotal: stayDuration({ checkInDate: input.checkInDate, checkInTime: input.checkInTime, pricingType }, input.checkOutDate, input.checkOutTime) * rateApplied, id, code: `RES-${id.slice(0, 8).toUpperCase()}`, status: 'CONFIRMED', createdAt: `${localDate()} ${localTime()}` };
    await commit({ ...db, reservations: [res, ...db.reservations], rooms: db.rooms.map(r => r.id === room.id && r.status === 'AVAILABLE' ? { ...r, status: 'RESERVED' } : r) }, 'booking.create'); return res;
  };
  const cancelReservation = async (resId: string) => {
    const db = dataRef.current, res = db.reservations.find(r => r.id === resId); if (!res || res.status !== 'CONFIRMED') throw new Error('Phiếu đặt không còn chờ nhận phòng.');
    const next = db.reservations.map(r => r.id === resId ? { ...r, status: 'CANCELLED' as const } : r);
    await commit({ ...db, reservations: next, rooms: db.rooms.map(r => r.id === res.roomId && r.status === 'RESERVED' ? { ...r, status: vacantStatus(r.id, next) } : r) }, 'booking.cancel');
  };
  const archiveReservation = async (resId: string) => {
    const db = dataRef.current, reservation = db.reservations.find(r => r.id === resId);
    if (!reservation || reservation.status !== 'CANCELLED' || reservation.depositAmount !== 0 || db.stays.some(s => s.reservationId === resId)) throw new Error('Chỉ lưu trữ phiếu đã hủy, không có tiền cọc hoặc lượt ở liên quan.');
    await commit({ ...db, reservations: db.reservations.map(r => r.id === resId ? { ...r, archived: true } : r) }, 'booking.archive');
  };
  const prepareStay = (input: Omit<StayRecord, 'id' | 'code' | 'status' | 'services'>, excludedReservationId?: string, initialServices: { serviceId: string; quantity: number }[] = []): StayRecord => {
    const db = dataRef.current, room = db.rooms.find(r => r.id === input.roomId); if (!room) throw new Error('Không tìm thấy phòng.');
    if (!['AVAILABLE', 'RESERVED'].includes(room.status) || room.cleanStatus !== 'CLEAN' || db.stays.some(s => s.roomId === room.id && s.status === 'ACTIVE')) throw new Error('Phòng chưa sẵn sàng hoặc đang có khách.');
    const { start, end } = validatePeriod(input.checkInDate, input.checkInTime, input.expectedCheckOutDate, input.expectedCheckOutTime);
    if (start > Date.now() + 60000) throw new Error('Thời gian nhận phòng thực tế không thể ở tương lai; hãy tạo phiếu đặt trước.');
    if (!input.customerName.trim()) throw new Error('Vui lòng nhập tên khách.');
    const conflict = findBookingConflict(room.id, start, end, db.reservations, db.stays, excludedReservationId);
    if (conflict) throw new Error(bookingConflictMessage(conflict));
    if (input.pricingType === 'HOUR' && room.allowsHourly === false) throw new Error('Phòng này không cho thuê theo giờ.');
    ensureGuests(room, 1 + (input.companionGuests?.length || 0)); money(input.deposit, 'Tiền cọc'); money(input.rateApplied, 'Đơn giá');
    const id = newId();
    return { ...input, roomNumber: room.number, id, code: `STAY-${id.slice(0, 8).toUpperCase()}`, status: 'ACTIVE', services: initialServices.map(item => {
      const srv = db.services.find(s => s.id === item.serviceId); if (!srv || !Number.isInteger(item.quantity) || item.quantity < 1) throw new Error('Dịch vụ không hợp lệ.');
      return { id: newId(), serviceId: srv.id, name: srv.name, category: srv.category, quantity: item.quantity, unitPrice: srv.price, totalPrice: srv.price * item.quantity, timestamp: `${localDate()} ${localTime()}` };
    }) };
  };
  const occupy = (room: Room, stay: StayRecord): Room => room.id === stay.roomId ? { ...room, status: 'OCCUPIED', currentStayId: stay.id, currentGuestName: stay.customerName } : room;
  const checkInDirect = async (input: Omit<StayRecord, 'id' | 'code' | 'status' | 'services'>, initialServices: { serviceId: string; quantity: number }[] = []) => {
    const stay = prepareStay(input, undefined, initialServices), db = dataRef.current;
    await commit({ ...db, stays: [stay, ...db.stays], rooms: db.rooms.map(r => occupy(r, stay)) }, 'stay.checkin'); return stay;
  };
  const checkInReservation = async (resId: string) => {
    const db = dataRef.current, res = db.reservations.find(r => r.id === resId); if (!res || res.status !== 'CONFIRMED') throw new Error('Phiếu đặt không còn chờ nhận phòng.');
    const room = db.rooms.find(r => r.id === res.roomId); if (!room) throw new Error('Phòng đã bị xóa.');
    const pricingType = res.pricingType || 'NIGHT';
    const stay = prepareStay({ reservationId: res.id, roomId: room.id, roomNumber: room.number, customerName: res.customerName, phone: res.phone, idCard: res.idCard, companionGuests: res.companionGuests || [], checkInDate: localDate(), checkInTime: localTime(), expectedCheckOutDate: res.checkOutDate, expectedCheckOutTime: res.checkOutTime, pricingType, rateApplied: res.rateApplied ?? (pricingType === 'HOUR' ? room.pricePerHour : room.pricePerNight), deposit: res.depositAmount, notes: res.notes }, res.id);
    await commit({ ...db, stays: [stay, ...db.stays], reservations: db.reservations.map(r => r.id === res.id ? { ...r, status: 'CHECKED_IN' } : r), rooms: db.rooms.map(r => occupy(r, stay)) }, 'stay.checkin');
  };
  const mutateActiveStay = (stayId: string, update: (stay: StayRecord) => StayRecord, operation: ActionId) => {
    const db = dataRef.current, stay = db.stays.find(s => s.id === stayId); if (!stay || stay.status !== 'ACTIVE') throw new Error('Lượt ở không còn hoạt động.');
    return commit({ ...db, stays: db.stays.map(s => s.id === stayId ? update(s) : s) }, operation);
  };
  const addServiceToStay = (stayId: string, serviceId: string, quantity: number) => {
    const srv = dataRef.current.services.find(s => s.id === serviceId); if (!srv || !Number.isInteger(quantity) || quantity < 1) throw new Error('Số lượng dịch vụ không hợp lệ.');
    return mutateActiveStay(stayId, stay => ({ ...stay, services: [...stay.services, { id: newId(), serviceId, name: srv.name, category: srv.category, quantity, unitPrice: srv.price, totalPrice: quantity * srv.price, timestamp: `${localDate()} ${localTime()}` }] }), 'stay.service.add');
  };
  const removeServiceFromStay = async (stayId: string, usageId: string) => mutateActiveStay(stayId, stay => ({ ...stay, services: stay.services.filter(s => s.id !== usageId) }), 'stay.service.remove');
  const updateStayCompanions = (stayId: string, companions: CompanionGuest[]) => mutateActiveStay(stayId, stay => {
    const room = dataRef.current.rooms.find(r => r.id === stay.roomId); if (room) ensureGuests(room, 1 + companions.length); return { ...stay, companionGuests: companions };
  }, 'stay.guests');
  const updateReservation = async (resId: string, updates: Partial<Reservation>) => {
    const db = dataRef.current, res = db.reservations.find(r => r.id === resId);
    if (!res || res.status !== 'CONFIRMED') throw new Error('Phiếu đặt phòng không còn chờ nhận phòng hoặc không tồn tại.');
    const nextRes: Reservation = {
      ...res,
      customerName: updates.customerName !== undefined ? updates.customerName.trim() : res.customerName,
      phone: updates.phone !== undefined ? updates.phone.trim() : res.phone,
      idCard: updates.idCard !== undefined ? updates.idCard.trim() : res.idCard,
      depositAmount: updates.depositAmount !== undefined ? money(updates.depositAmount, 'Tiền cọc') : res.depositAmount,
      checkInDate: updates.checkInDate || res.checkInDate,
      checkInTime: updates.checkInTime || res.checkInTime,
      checkOutDate: updates.checkOutDate || res.checkOutDate,
      checkOutTime: updates.checkOutTime || res.checkOutTime,
      guestsCount: updates.guestsCount !== undefined ? Number(updates.guestsCount) : res.guestsCount,
      pricingType: updates.pricingType || res.pricingType,
      rateApplied: updates.rateApplied !== undefined ? money(updates.rateApplied, 'Đơn giá') : res.rateApplied,
      estimatedTotal: updates.estimatedTotal !== undefined ? money(updates.estimatedTotal, 'Dự kiến tổng') : res.estimatedTotal,
      notes: updates.notes !== undefined ? updates.notes : res.notes,
    };
    if (!nextRes.customerName) throw new Error('Tên khách không được để trống.');
    validatePeriod(nextRes.checkInDate, nextRes.checkInTime, nextRes.checkOutDate, nextRes.checkOutTime);
    await commit({
      ...db,
      reservations: db.reservations.map(r => r.id === resId ? nextRes : r),
    }, 'booking.create');
    showToast('Đã cập nhật thông tin đặt phòng / đặt cọc thành công.', 'success');
  };
  const updateActiveStay = async (stayId: string, updates: Partial<StayRecord>) => {
    const db = dataRef.current, stay = db.stays.find(s => s.id === stayId);
    if (!stay || stay.status !== 'ACTIVE') throw new Error('Lượt ở không còn hoạt động hoặc không tồn tại.');
    const nextStay: StayRecord = {
      ...stay,
      customerName: updates.customerName !== undefined ? updates.customerName.trim() : stay.customerName,
      phone: updates.phone !== undefined ? updates.phone.trim() : stay.phone,
      idCard: updates.idCard !== undefined ? updates.idCard.trim() : stay.idCard,
      deposit: updates.deposit !== undefined ? money(updates.deposit, 'Tiền cọc') : stay.deposit,
      checkInDate: updates.checkInDate || stay.checkInDate,
      checkInTime: updates.checkInTime || stay.checkInTime,
      expectedCheckOutDate: updates.expectedCheckOutDate || stay.expectedCheckOutDate,
      expectedCheckOutTime: updates.expectedCheckOutTime || stay.expectedCheckOutTime,
      pricingType: updates.pricingType || stay.pricingType,
      rateApplied: updates.rateApplied !== undefined ? money(updates.rateApplied, 'Đơn giá phòng') : stay.rateApplied,
      notes: updates.notes !== undefined ? updates.notes : stay.notes,
    };
    if (!nextStay.customerName) throw new Error('Tên khách hàng không được để trống.');
    validatePeriod(nextStay.checkInDate, nextStay.checkInTime, nextStay.expectedCheckOutDate, nextStay.expectedCheckOutTime);
    const nextRooms = db.rooms.map(r => r.id === stay.roomId ? { ...r, currentGuestName: nextStay.customerName } : r);
    await commit({
      ...db,
      rooms: nextRooms,
      stays: db.stays.map(s => s.id === stayId ? nextStay : s),
    }, 'stay.checkin');
    showToast('Đã cập nhật thông tin phòng đang ở thành công.', 'success');
  };
  const addService = (input: Omit<ServiceItem, 'id'>) => { money(input.price, 'Giá dịch vụ'); return commit({ ...dataRef.current, services: [...dataRef.current.services, { ...input, id: newId() }] }, 'service.configure'); };
  const editService = (id: string, updated: Partial<ServiceItem>) => { if (updated.price !== undefined) money(updated.price, 'Giá dịch vụ'); return commit({ ...dataRef.current, services: dataRef.current.services.map(s => s.id === id ? { ...s, ...updated, id } : s) }, 'service.configure'); };
  const deleteService = async (id: string) => {
    const db = dataRef.current;
    if (db.stays.some(s => s.services.some(u => u.serviceId === id)) || db.invoices.some(i => i.services?.some(u => u.serviceId === id))) throw new Error('Dịch vụ đã được sử dụng. Không thể xóa để giữ chi tiết phiếu thu và lịch sử lưu trú.');
    await commit({ ...db, services: db.services.filter(s => s.id !== id) }, 'service.delete');
  };
  const updateRoomTypePricing = (roomType: RoomType, pricePerNight: number, pricePerHour: number) => {
    money(pricePerNight, 'Giá đêm'); money(pricePerHour, 'Giá giờ'); return commit({ ...dataRef.current, rooms: dataRef.current.rooms.map(r => r.type === roomType ? { ...r, pricePerNight, pricePerHour } : r) }, 'room.configure');
  };
  const checkOutStay = async (params: CheckOutParams): Promise<Invoice> => {
    const db = dataRef.current, stay = db.stays.find(s => s.id === params.stayId); if (!stay || stay.status !== 'ACTIVE' || db.invoices.some(i => i.stayId === stay.id)) throw new Error('Lượt ở đã trả phòng hoặc không tồn tại.');
    const date = params.checkOutDate || localDate(), time = params.checkOutTime || localTime();
    if (dateTime(date, time) > Date.now() + 60000) throw new Error('Thời gian trả phòng thực tế không thể ở tương lai.');
    const duration = stayDuration(stay, date, time), roomCharge = duration * stay.rateApplied, serviceCharge = stay.services.reduce((sum, s) => sum + s.totalPrice, 0);
    const surcharge = money(params.surcharge, 'Phụ thu'), discount = money(params.discount, 'Giảm giá');
    if (discount > roomCharge + serviceCharge + surcharge) throw new Error('Giảm giá vượt tổng tiền phiếu thu.');
    const gross = roomCharge + serviceCharge + surcharge - discount, deposit = Math.min(stay.deposit, gross), total = gross - deposit;
    if (params.roomCharge !== roomCharge || params.serviceCharge !== serviceCharge || params.depositDeducted !== deposit || params.totalAmount !== total) throw new Error('Thông tin tính tiền đã thay đổi. Hãy kiểm tra lại phiếu thu trước khi xác nhận.');
    const paid = money(params.paidAmount, 'Số tiền thu'); if (paid > total || (params.paymentMethod === 'DEBT' && paid > 0)) throw new Error('Số tiền thanh toán không hợp lệ.');
    if (params.debtAmount !== total - paid) throw new Error('Số tiền công nợ không khớp phiếu thu.');
    if (total > paid && params.dueDateForDebt && !Number.isFinite(dateTime(params.dueDateForDebt, '12:00'))) throw new Error('Ngày hẹn thu nợ không hợp lệ.');
    const debtAmount = total - paid, id = newId();
    const invoice: Invoice = { createdBy: access.actor.id, id, code: `HD-${id.slice(0, 8).toUpperCase()}`, stayId: stay.id, roomNumber: stay.roomNumber, customerName: stay.customerName, phone: stay.phone, checkInDateTime: `${stay.checkInDate} ${stay.checkInTime}`, checkOutDateTime: `${date} ${time}`, durationNightsOrHours: duration, pricingType: stay.pricingType, roomCharge, serviceCharge, massageCharge: stay.services.filter(s => db.services.find(v => v.id === s.serviceId)?.category === 'MASSAGE' || s.name.toLowerCase().includes('massage')).reduce((sum, s) => sum + s.totalPrice, 0), services: stay.services, surcharge, discount, depositDeducted: deposit, refundAmount: Math.max(0, stay.deposit - gross), totalAmount: total, paidAmount: paid, debtAmount, paymentMethod: params.paymentMethod, status: debtAmount === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'DEBT', date, time, notes: params.notes };
    const due = new Date(`${date}T12:00:00+07:00`); due.setDate(due.getDate() + 7);
    const debt: DebtRecord = { id: newId(), invoiceId: id, invoiceCode: invoice.code, customerName: stay.customerName, phone: stay.phone, roomNumber: stay.roomNumber, createdDate: date, dueDate: params.dueDateForDebt || localDate(due), totalInvoiceAmount: gross, originalDebt: debtAmount, paidAmount: 0, remainingAmount: debtAmount, status: 'UNPAID', paymentHistory: [], notes: params.notes };
    await commit({ ...db, invoices: [invoice, ...db.invoices], debts: debtAmount > 0 ? [debt, ...db.debts] : db.debts, stays: db.stays.map(s => s.id === stay.id ? { ...s, status: 'CHECKED_OUT', actualCheckOutDate: date, actualCheckOutTime: time } : s), rooms: db.rooms.map(r => r.id === stay.roomId ? { ...r, status: 'CLEANING', cleanStatus: 'DIRTY', currentStayId: undefined, currentGuestName: undefined } : r) }, 'stay.checkout');
    return invoice;
  };
  const sellServices = async (params: ServiceSaleInput) => {
    const db = dataRef.current;
    const { invoice, debt } = prepareServiceSale(params, db.services);
    invoice.createdBy = access.actor.id;
    await commit({ ...db, invoices: [invoice, ...db.invoices], debts: debt ? [debt, ...db.debts] : db.debts }, 'sale.create');
    return invoice;
  };
  const cancelCheckIn = async (stayId: string) => {
    const db = dataRef.current, stay = db.stays.find(s => s.id === stayId);
    if (!stay || stay.status !== 'ACTIVE') throw new Error('Lượt ở không còn hoạt động hoặc không tồn tại.');
    const room = db.rooms.find(r => r.id === stay.roomId || r.number === stay.roomNumber);
    if (!room) throw new Error('Không tìm thấy phòng.');

    const nextStay: StayRecord = {
      ...stay,
      status: 'CANCELLED',
    };

    const nextRooms = db.rooms.map(r => {
      if (r.id === stay.roomId) {
        return {
          ...r,
          status: vacantStatus(r.id, db.reservations),
          cleanStatus: 'CLEAN' as const,
          currentStayId: undefined,
          currentGuestName: undefined,
        };
      }
      return r;
    });

    const nextReservations = stay.reservationId
      ? db.reservations.map(res => res.id === stay.reservationId ? { ...res, status: 'CONFIRMED' as const } : res)
      : db.reservations;

    await commit({
      ...db,
      stays: db.stays.map(s => s.id === stayId ? nextStay : s),
      rooms: nextRooms,
      reservations: nextReservations,
    }, 'stay.checkin');

    showToast(`Đã hủy nhận phòng sai cho phòng ${room.number}. Phòng đã trở về trạng thái trống.`, 'success');
  };
  const updateServiceSale = async (invoiceId: string, params: ServiceSaleInput): Promise<Invoice> => {
    const db = dataRef.current;
    const oldInvoice = db.invoices.find(i => i.id === invoiceId);
    if (!oldInvoice || oldInvoice.kind !== 'SERVICE') throw new Error('Không tìm thấy phiếu vé dịch vụ.');

    const { invoice: newInv, debt: newDebt } = prepareServiceSale(params, db.services);
    const updatedInvoice: Invoice = {
      ...newInv,
      id: oldInvoice.id,
      code: oldInvoice.code,
      date: oldInvoice.date,
      time: oldInvoice.time,
      createdBy: oldInvoice.createdBy,
    };

    let nextDebts = db.debts.filter(d => d.invoiceId !== invoiceId);
    if (newDebt) {
      nextDebts = [{ ...newDebt, invoiceId: oldInvoice.id, invoiceCode: oldInvoice.code }, ...nextDebts];
    }

    const nextInvoices = db.invoices.map(i => i.id === invoiceId ? updatedInvoice : i);
    await commit({
      ...db,
      invoices: nextInvoices,
      debts: nextDebts,
    }, 'sale.create');
    showToast(`Đã cập nhật thông tin phiếu vé ${oldInvoice.code}.`, 'success');
    return updatedInvoice;
  };
  const cancelServiceSale = async (invoiceId: string) => {
    const db = dataRef.current;
    const oldInvoice = db.invoices.find(i => i.id === invoiceId);
    if (!oldInvoice || oldInvoice.kind !== 'SERVICE') throw new Error('Không tìm thấy phiếu vé dịch vụ.');

    const cancelledInvoice: Invoice = {
      ...oldInvoice,
      status: 'CANCELLED',
      roomCharge: 0,
      serviceCharge: 0,
      massageCharge: 0,
      surcharge: 0,
      discount: 0,
      depositDeducted: 0,
      refundAmount: 0,
      totalAmount: 0,
      paidAmount: 0,
      debtAmount: 0,
      services: [],
    };

    const nextDebts = db.debts.filter(d => d.invoiceId !== invoiceId);
    const nextInvoices = db.invoices.map(i => i.id === invoiceId ? cancelledInvoice : i);

    await commit({
      ...db,
      invoices: nextInvoices,
      debts: nextDebts,
    }, 'sale.create');
    showToast(`Đã hủy phiếu vé / dịch vụ ${oldInvoice.code}.`, 'success');
  };
  const updateRoomInvoice = async (invoiceId: string, updates: { customerName?: string; phone?: string; paymentMethod?: PaymentMethod; notes?: string }): Promise<Invoice> => {
    const db = dataRef.current;
    const oldInvoice = db.invoices.find(i => i.id === invoiceId);
    if (!oldInvoice) throw new Error('Không tìm thấy phiếu thu.');

    const updatedInvoice: Invoice = {
      ...oldInvoice,
      customerName: updates.customerName !== undefined ? updates.customerName.trim() : oldInvoice.customerName,
      phone: updates.phone !== undefined ? updates.phone.trim() : oldInvoice.phone,
      paymentMethod: updates.paymentMethod || oldInvoice.paymentMethod,
      notes: updates.notes !== undefined ? updates.notes : oldInvoice.notes,
    };
    if (!updatedInvoice.customerName) throw new Error('Tên khách hàng không được để trống.');

    const nextDebts = db.debts.map(d => {
      if (d.invoiceId === invoiceId) {
        return {
          ...d,
          customerName: updatedInvoice.customerName,
          phone: updatedInvoice.phone,
          notes: updatedInvoice.notes,
        };
      }
      return d;
    });

    const nextInvoices = db.invoices.map(i => i.id === invoiceId ? updatedInvoice : i);
    await commit({
      ...db,
      invoices: nextInvoices,
      debts: nextDebts,
    }, 'stay.checkout');
    showToast(`Đã cập nhật thông tin phiếu thu ${oldInvoice.code}.`, 'success');
    return updatedInvoice;
  };
  const cancelRoomInvoice = async (invoiceId: string) => {
    const db = dataRef.current;
    const oldInvoice = db.invoices.find(i => i.id === invoiceId);
    if (!oldInvoice) throw new Error('Không tìm thấy phiếu thu.');

    const cancelledInvoice: Invoice = {
      ...oldInvoice,
      status: 'CANCELLED',
      roomCharge: 0,
      serviceCharge: 0,
      massageCharge: 0,
      surcharge: 0,
      discount: 0,
      depositDeducted: 0,
      refundAmount: 0,
      totalAmount: 0,
      paidAmount: 0,
      debtAmount: 0,
      services: [],
    };

    const nextDebts = db.debts.map(d => {
      if (d.invoiceId === invoiceId) {
        return {
          ...d,
          status: 'SETTLED' as const,
          remainingAmount: 0,
          notes: `${d.notes || ''} [Phiếu thu ${oldInvoice.code} đã hủy]`.trim(),
        };
      }
      return d;
    });

    const nextInvoices = db.invoices.map(i => i.id === invoiceId ? cancelledInvoice : i);
    await commit({
      ...db,
      invoices: nextInvoices,
      debts: nextDebts,
    }, 'stay.checkout');
    showToast(`Đã hủy phiếu thu phòng ${oldInvoice.code}.`, 'success');
  };
  const deleteInvoice = async (invoiceId: string) => {
    const db = dataRef.current;
    const oldInvoice = db.invoices.find(i => i.id === invoiceId);
    if (!oldInvoice) throw new Error('Không tìm thấy phiếu thu.');

    const nextInvoices = db.invoices.filter(i => i.id !== invoiceId);
    const nextDebts = db.debts.filter(d => d.invoiceId !== invoiceId);

    if (access.actor.role === 'ADMIN') {
      await commit({
        ...db,
        invoices: nextInvoices,
        debts: nextDebts,
      }, 'data.restore');
    } else {
      if (oldInvoice.status !== 'CANCELLED') {
        if (oldInvoice.kind === 'SERVICE') {
          await cancelServiceSale(invoiceId);
        } else {
          await cancelRoomInvoice(invoiceId);
        }
      } else {
        throw new Error('Chỉ tài khoản Quản lý mới có quyền xóa vĩnh viễn phiếu thu khỏi hệ thống.');
      }
      return;
    }
    showToast(`Đã xóa vĩnh viễn phiếu thu ${oldInvoice.code} khỏi hệ thống.`, 'success');
  };
  const clearCancelledInvoices = async () => {
    const db = dataRef.current;
    const cancelled = db.invoices.filter(i => i.status === 'CANCELLED');
    if (cancelled.length === 0) {
      showToast('Không có phiếu thu đã hủy nào để xóa.', 'info');
      return;
    }
    if (access.actor.role !== 'ADMIN') {
      throw new Error('Chỉ tài khoản Quản lý mới có quyền xóa sạch các phiếu thu đã hủy.');
    }

    const cancelledIds = new Set(cancelled.map(i => i.id));
    const nextInvoices = db.invoices.filter(i => !cancelledIds.has(i.id));
    const nextDebts = db.debts.filter(d => !cancelledIds.has(d.invoiceId));

    await commit({
      ...db,
      invoices: nextInvoices,
      debts: nextDebts,
    }, 'data.restore');
    showToast(`Đã xóa sạch ${cancelled.length} phiếu thu đã hủy / test khỏi hệ thống.`, 'success');
  };
  const recordDebtPayment = async (debtId: string, amount: number, method: PaymentMethod, collectedBy: string, notes?: string) => {
    const db = dataRef.current, debt = db.debts.find(d => d.id === debtId); money(amount, 'Tiền thu nợ');
    if (!debt || amount <= 0 || amount > debt.remainingAmount || !['CASH', 'TRANSFER', 'CARD'].includes(method)) throw new Error('Số tiền thu vượt dư nợ hoặc phương thức không hợp lệ.');
    const payment: DebtPayment = { id: newId(), date: localDate(), time: localTime(), amount, method, collectedBy, notes };
    await commit({ ...db, debts: db.debts.map(d => d.id === debt.id ? { ...d, paidAmount: d.paidAmount + amount, remainingAmount: d.remainingAmount - amount, status: d.remainingAmount === amount ? 'SETTLED' : 'PARTIAL', paymentHistory: [...d.paymentHistory, payment] } : d), invoices: db.invoices.map(i => i.id === debt.invoiceId ? { ...i, paidAmount: i.paidAmount + amount, debtAmount: i.debtAmount - amount, status: i.debtAmount === amount ? 'PAID' : 'PARTIAL' } : i) }, 'debt.collect');
  };
  const exportBackup = () => {
    access.requireAction('data.export');
    const url = URL.createObjectURL(new Blob([serializeHotelData(projectHotelData(getFreshAccessActor(access.actor), dataRef.current))], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `SonNgoc-sao-luu-${today}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importBackup = (text: string) => {
    const snapshot = JSON.parse(text); if (snapshot.version !== 3) throw new Error('Phiên bản bản sao lưu không hợp lệ.');
    return commit(validateHotelData(snapshot.data), 'data.restore', true);
  };
  if (!cloudReady) return <div className="p-6 text-teal-900"><p role="status">{storageError || 'Đang mở dữ liệu khách sạn…'}</p></div>;
  const visible = projectHotelData(access.actor, { ...data, debts });
  return <HotelContext.Provider value={{ rooms: visible.rooms, services: visible.services, stays: visible.stays, reservations: visible.reservations, invoices: visible.invoices, debts: visible.debts, today, storageError, exportBackup, importBackup, activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen, isSidebarCollapsed, setIsSidebarCollapsed, toggleSidebar, searchQuery, setSearchQuery, toasts, showToast, removeToast, confirmModal, requestConfirm, closeConfirm, updateRoomCleanStatus, updateRoomStatus, addRoom, editRoom, deleteRoom, createReservation, cancelReservation, archiveReservation, checkInReservation, updateReservation, checkInDirect, updateActiveStay, cancelCheckIn, addServiceToStay, removeServiceFromStay, updateStayCompanions, addService, editService, deleteService, updateRoomTypePricing, checkOutStay, sellServices, updateServiceSale, cancelServiceSale, updateRoomInvoice, cancelRoomInvoice, deleteInvoice, clearCancelledInvoices, recordDebtPayment }}>{children}</HotelContext.Provider>;
};

export const useHotel = () => {
  const context = useContext(HotelContext);
  if (!context) throw new Error('useHotel must be used within a HotelProvider');
  return context;
};
