import type { AccessActor, ActionId } from './access.ts';
import type { HotelData } from './hotelStorage.ts';
import type { Invoice, ServiceUsage } from './hotel.ts';
import { ACTION_IDS } from './access.ts';
import { canAct, canView } from './permissions.ts';
import { dateTime, stayDuration, validatePeriod } from './hotelLogic.ts';

export class HotelPermissionError extends Error {}
function deny(message = 'Thao tác không được cấp quyền hoặc sẽ làm thay đổi dữ liệu cần giữ lại.'): never { throw new HotelPermissionError(message); }
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b))) : item);
const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const without = (row: unknown, fields: string[]) => Object.fromEntries(Object.entries(row as Record<string, unknown>).filter(([key]) => !fields.includes(key)));
const onlyFields = (old: unknown, next: unknown, fields: string[]) => equal(without(old, fields), without(next, fields));
type Row = { id: string };
function changes<T extends Row>(old: T[], next: T[]) {
  const before = new Map(old.map(row => [row.id, row]));
  const after = new Map(next.map(row => [row.id, row]));
  if (before.size !== old.length || after.size !== next.length) deny('Mã bản ghi bị trùng.');
  return { added: next.filter(row => !before.has(row.id)), removed: old.filter(row => !after.has(row.id)), updated: next.filter(row => before.has(row.id) && !equal(before.get(row.id), row)).map(row => ({ old: before.get(row.id)!, next: row })) };
}
const emptyChange = (value: ReturnType<typeof changes>) => !value.added.length && !value.removed.length && !value.updated.length;
const hasFinancialView = (actor: AccessActor) => ['dashboard', 'analytics', 'reports'].some(view => canView(actor, view));
const collectionFields: (keyof HotelData)[] = ['rooms', 'services', 'stays', 'reservations', 'invoices', 'debts'];
/** Historical group bills can name several rooms in one label. Match whole
 * room codes so N01 is retained for "Đoàn N01, N02", without matching N010. */
export function roomNumberReferenced(label: string, roomNumber: string): boolean {
  const number = roomNumber.trim();
  if (!number) return false;
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(label);
}
function visibleRow(actor: AccessActor, field: keyof HotelData, row: Row, data: HotelData): boolean {
  if (actor.role === 'ADMIN') return true;
  const operational = ['rooms', 'reservations', 'stays'].some(view => canView(actor, view));
  if (field === 'rooms') return operational || canView(actor, 'services') || hasFinancialView(actor);
  if (field === 'services') return operational || canView(actor, 'services') || canView(actor, 'sales') || hasFinancialView(actor);
  if (field === 'stays' || field === 'reservations') return operational || hasFinancialView(actor);
  if (field === 'debts') return canView(actor, 'debt');
  const invoice = row as Invoice;
  return hasFinancialView(actor) || (canView(actor, 'debt') && data.debts.some(debt => debt.invoiceId === invoice.id)) || (canView(actor, 'sales') && invoice.kind === 'SERVICE' && invoice.createdBy === actor.id);
}

/** Filter on the server before returning a snapshot; permission claims come from the session. */
export function projectHotelData(actor: AccessActor, data: HotelData): HotelData {
  return Object.fromEntries(collectionFields.map(field => [field, data[field].filter(row => visibleRow(actor, field, row, data))])) as unknown as HotelData;
}

/** Full-snapshot clients cannot remove or replace records they were not allowed to read. */
export function mergeProjectedHotelData(actor: AccessActor, before: HotelData, submitted: HotelData): HotelData {
  if (actor.role === 'ADMIN') return submitted;
  return Object.fromEntries(collectionFields.map(field => {
    const hidden = before[field].filter(row => !visibleRow(actor, field, row, before));
    const hiddenIds = new Set(hidden.map((row: Row) => row.id));
    const submittedRows = submitted[field as keyof HotelData];
    for (const row of submittedRows) if (hiddenIds.has(row.id)) deny('Không được sửa bản ghi ngoài phạm vi được xem.');
    return [field, [...submittedRows, ...hidden]];
  })) as unknown as HotelData;
}

function validUsage(usage: ServiceUsage, data: HotelData) {
  const service = data.services.find(row => row.id === usage.serviceId);
  return !!service && usage.name === service.name && usage.unitPrice === service.price && Number.isSafeInteger(usage.quantity) && usage.quantity > 0 && Number.isSafeInteger(usage.totalPrice) && usage.totalPrice === usage.unitPrice * usage.quantity && (!usage.category || usage.category === service.category);
}
function financialAddition(invoice: Invoice, next: HotelData) {
  const fields: (keyof Invoice)[] = ['roomCharge', 'serviceCharge', 'surcharge', 'discount', 'depositDeducted', 'totalAmount', 'paidAmount', 'debtAmount'];
  if (fields.some(key => !Number.isSafeInteger(invoice[key]) || (invoice[key] as number) < 0)) deny('Số tiền phiếu thu không hợp lệ.');
  const gross = invoice.roomCharge + invoice.serviceCharge + invoice.surcharge - invoice.discount;
  if (gross < 0 || invoice.depositDeducted > gross || invoice.totalAmount !== gross - invoice.depositDeducted || invoice.paidAmount + invoice.debtAmount !== invoice.totalAmount || invoice.status !== (invoice.debtAmount ? invoice.paidAmount ? 'PARTIAL' : 'DEBT' : 'PAID')) deny('Số tiền phiếu thu không khớp.');
  if (!['CASH', 'TRANSFER', 'CARD', 'DEBT', 'MIXED'].includes(invoice.paymentMethod) || invoice.paymentMethod === 'DEBT' && invoice.paidAmount > 0 || invoice.kind === 'SERVICE' && !['CASH', 'TRANSFER', 'CARD'].includes(invoice.paymentMethod)) deny('Phương thức thanh toán không hợp lệ.');
  const debts = next.debts.filter(debt => debt.invoiceId === invoice.id);
  if (invoice.debtAmount === 0 ? debts.length !== 0 : debts.length !== 1 || debts[0].originalDebt !== invoice.debtAmount || debts[0].remainingAmount !== invoice.debtAmount || debts[0].paidAmount !== 0 || debts[0].paymentHistory.length !== 0) deny('Công nợ không khớp phiếu thu.');
  if (debts.some(debt => debt.invoiceCode !== invoice.code || debt.customerName !== invoice.customerName || debt.phone !== invoice.phone || debt.roomNumber !== invoice.roomNumber || debt.totalInvoiceAmount !== gross || !Number.isFinite(dateTime(debt.dueDate, '12:00')) || debt.status !== 'UNPAID' || invoice.kind === 'SERVICE' && (!debt.customerName.trim() || !debt.phone.trim()))) deny('Thông tin công nợ không khớp phiếu thu.');
}

/** One declared operation may change only its own fields, including dependent records. */
export function authorizeHotelMutation(actor: AccessActor, before: HotelData, next: HotelData, action: ActionId): void {
  if (!ACTION_IDS.includes(action)) deny('Loại thao tác không hợp lệ.');
  if (!canAct(actor, action)) deny('Bạn chưa được cấp quyền thực hiện thao tác này.');
  if (action === 'data.restore') { if (actor.role !== 'ADMIN') deny(); return; }
  if (action === 'data.export') deny('Xuất dữ liệu không phải thao tác ghi dữ liệu.');
  const d = { rooms: changes(before.rooms, next.rooms), services: changes(before.services, next.services), stays: changes(before.stays, next.stays), reservations: changes(before.reservations, next.reservations), invoices: changes(before.invoices, next.invoices), debts: changes(before.debts, next.debts) };
  if (Object.values(d).every(emptyChange)) return; // Idempotent network retry.
  if (d.stays.removed.length || d.reservations.removed.length || d.invoices.removed.length || d.debts.removed.length) deny('Không được xóa lịch sử khách, đặt phòng, phiếu thu hoặc công nợ.');
  const scope = (...fields: (keyof HotelData)[]) => { for (const field of Object.keys(d) as (keyof HotelData)[]) if (!fields.includes(field) && !emptyChange(d[field])) deny(); };
  const updatesOnly = (value: ReturnType<typeof changes>) => { if (value.added.length || value.removed.length) deny(); };
  const roomUpdates = (ids: string[], fields: string[]) => { updatesOnly(d.rooms); for (const item of d.rooms.updated) if (!ids.includes(item.old.id) || !onlyFields(item.old, item.next, fields)) deny(); };
  const newInvoice = (kind: 'ROOM' | 'SERVICE') => {
    if (d.invoices.added.length !== 1 || d.invoices.updated.length || d.debts.updated.length || d.debts.added.length > 1) deny();
    const invoice = d.invoices.added[0];
    if ((invoice.kind || 'ROOM') !== kind || (actor.role !== 'ADMIN' && invoice.createdBy !== actor.id)) deny();
    if (d.debts.added.some(debt => debt.invoiceId !== invoice.id)) deny();
    financialAddition(invoice, next);
    return invoice;
  };
  switch (action) {
    case 'room.clean':
      scope('rooms'); roomUpdates(before.rooms.map(room => room.id), ['cleanStatus', 'status']);
      for (const { old, next: room } of d.rooms.updated) if (!['CLEAN', 'DIRTY'].includes(room.cleanStatus) || room.status !== old.status && !(old.status === 'CLEANING' && room.cleanStatus === 'CLEAN' && room.status === (before.reservations.some(res => res.roomId === room.id && res.status === 'CONFIRMED') ? 'RESERVED' : 'AVAILABLE'))) deny();
      break;
    case 'room.status':
      scope('rooms'); roomUpdates(before.rooms.map(room => room.id), ['status']);
      for (const { next: room } of d.rooms.updated) if (before.stays.some(stay => stay.roomId === room.id && stay.status === 'ACTIVE') || !['AVAILABLE', 'RESERVED', 'CLEANING', 'MAINTENANCE'].includes(room.status)) deny();
      break;
    case 'room.configure': {
      scope('rooms', 'stays', 'reservations'); if (d.rooms.removed.length || d.stays.added.length || d.reservations.added.length) deny();
      for (const { old, next: room } of d.rooms.updated) if (!onlyFields(old, room, ['number', 'floor', 'type', 'typeName', 'pricePerNight', 'pricePerHour', 'allowsHourly', 'defaultCheckInTime', 'defaultCheckOutTime', 'maxGuests', 'amenities', 'notes'])) deny();
      for (const room of [...d.rooms.added, ...d.rooms.updated.map(item => item.next)]) if (!Number.isSafeInteger(room.pricePerNight) || !Number.isSafeInteger(room.pricePerHour) || !Number.isSafeInteger(room.maxGuests) || room.maxGuests < 1 || !Number.isSafeInteger(room.floor) || room.floor < 1) deny();
      if (d.rooms.added.some(room => room.currentStayId || room.currentGuestName || room.status === 'OCCUPIED')) deny();
      const changedRooms = new Map(d.rooms.updated.map(item => [item.next.id, item.next]));
      for (const { old, next: stay } of d.stays.updated) if (old.status !== 'ACTIVE' || !changedRooms.has(old.roomId) || !onlyFields(old, stay, ['roomNumber']) || stay.roomNumber !== changedRooms.get(old.roomId)!.number) deny();
      for (const { old, next: res } of d.reservations.updated) if (old.status !== 'CONFIRMED' || !changedRooms.has(old.roomId) || !onlyFields(old, res, ['roomNumber', 'roomType']) || res.roomNumber !== changedRooms.get(old.roomId)!.number || res.roomType !== changedRooms.get(old.roomId)!.typeName) deny();
      break;
    }
    case 'room.delete':
      scope('rooms'); if (d.rooms.added.length || d.rooms.updated.length) deny();
      for (const room of d.rooms.removed) if (before.stays.some(stay => stay.roomId === room.id) || before.reservations.some(res => res.roomId === room.id) || before.invoices.some(invoice => roomNumberReferenced(invoice.roomNumber, room.number)) || before.debts.some(debt => roomNumberReferenced(debt.roomNumber, room.number)) || room.currentStayId) deny('Phòng có dữ liệu liên quan; hãy giữ lại để bảo toàn lịch sử.');
      break;
    case 'service.configure': scope('services'); if (d.services.removed.length || [...d.services.added, ...d.services.updated.map(item => item.next)].some(service => !Number.isSafeInteger(service.price) || service.price < 0)) deny(); break;
    case 'service.delete':
      scope('services'); if (d.services.added.length || d.services.updated.length) deny();
      for (const service of d.services.removed) if (before.stays.some(stay => stay.services.some(usage => usage.serviceId === service.id)) || before.invoices.some(invoice => invoice.services?.some(usage => usage.serviceId === service.id))) deny('Dịch vụ đã được sử dụng; không được xóa lịch sử liên quan.');
      break;
    case 'booking.create': {
      scope('reservations', 'rooms'); if (d.reservations.added.length !== 1 || d.reservations.updated.length) deny();
      const res = d.reservations.added[0]; if (res.status !== 'CONFIRMED' || res.archived || !Number.isSafeInteger(res.depositAmount)) deny();
      validatePeriod(res.checkInDate, res.checkInTime, res.checkOutDate, res.checkOutTime);
      const room = before.rooms.find(row => row.id === res.roomId);
      if (!room || room.status === 'MAINTENANCE' || !Number.isInteger(res.guestsCount) || res.guestsCount < 1 || res.guestsCount > room.maxGuests) deny();
      const pricingType = res.pricingType || 'NIGHT', rate = pricingType === 'HOUR' ? room.pricePerHour : room.pricePerNight;
      if (!['NIGHT', 'HOUR'].includes(pricingType) || pricingType === 'HOUR' && room.allowsHourly === false || res.rateApplied !== rate || res.estimatedTotal !== stayDuration({ checkInDate: res.checkInDate, checkInTime: res.checkInTime, pricingType }, res.checkOutDate, res.checkOutTime) * rate) deny('Giá đặt phòng không khớp bảng giá.');
      roomUpdates([res.roomId], ['status']); for (const { old, next: room } of d.rooms.updated) if (old.status !== 'AVAILABLE' || room.status !== 'RESERVED') deny();
      break;
    }
    case 'booking.cancel': {
      scope('reservations', 'rooms'); updatesOnly(d.reservations); if (d.reservations.updated.length !== 1) deny();
      const { old, next: res } = d.reservations.updated[0]; if (old.status !== 'CONFIRMED' || res.status !== 'CANCELLED' || !onlyFields(old, res, ['status'])) deny();
      roomUpdates([res.roomId], ['status']); for (const { old: room, next: changed } of d.rooms.updated) if (room.status !== 'RESERVED' || changed.status !== (next.reservations.some(row => row.roomId === room.id && row.status === 'CONFIRMED') ? 'RESERVED' : 'AVAILABLE')) deny();
      break;
    }
    case 'booking.archive':
      scope('reservations'); updatesOnly(d.reservations); if (d.reservations.updated.length !== 1) deny();
      for (const { old, next: res } of d.reservations.updated) if (old.status !== 'CANCELLED' || old.depositAmount !== 0 || old.archived || res.archived !== true || !onlyFields(old, res, ['archived']) || before.stays.some(stay => ('reservationId' in stay && stay.reservationId === old.id) || stay.roomId === old.roomId && stay.customerName === old.customerName && stay.phone === old.phone)) deny('Chỉ lưu trữ phiếu đã hủy, không có cọc và chưa nhận phòng.');
      break;
    case 'stay.checkin': {
      scope('stays', 'rooms', 'reservations'); if (d.stays.added.length !== 1 || d.stays.updated.length || d.reservations.added.length || d.reservations.updated.length > 1) deny();
      const stay = d.stays.added[0]; if (stay.status !== 'ACTIVE' || !before.rooms.some(room => room.id === stay.roomId) || stay.services.some(usage => !validUsage(usage, before))) deny();
      const sourceRoom = before.rooms.find(room => room.id === stay.roomId)!;
      if (!['AVAILABLE', 'RESERVED'].includes(sourceRoom.status) || sourceRoom.cleanStatus !== 'CLEAN' || before.stays.some(row => row.roomId === stay.roomId && row.status === 'ACTIVE') || !Number.isSafeInteger(stay.deposit) || !Number.isSafeInteger(stay.rateApplied)) deny();
      validatePeriod(stay.checkInDate, stay.checkInTime, stay.expectedCheckOutDate, stay.expectedCheckOutTime);
      if (dateTime(stay.checkInDate, stay.checkInTime) > Date.now() + 60000 || (stay.companionGuests?.length || 0) + 1 > sourceRoom.maxGuests || stay.reservationId && !d.reservations.updated.length) deny();
      for (const { old, next: res } of d.reservations.updated) if (old.status !== 'CONFIRMED' || res.status !== 'CHECKED_IN' || !onlyFields(old, res, ['status']) || stay.roomId !== res.roomId || stay.deposit !== res.depositAmount || stay.customerName !== res.customerName || stay.phone !== res.phone || stay.reservationId !== res.id) deny();
      const sourceReservation = d.reservations.updated[0]?.old;
      const expectedPricingType = sourceReservation ? sourceReservation.pricingType || 'NIGHT' : stay.pricingType;
      const expectedRate = sourceReservation?.rateApplied ?? (expectedPricingType === 'HOUR' ? sourceRoom.pricePerHour : sourceRoom.pricePerNight);
      if (!['NIGHT', 'HOUR'].includes(stay.pricingType) || stay.rateApplied !== expectedRate || stay.pricingType !== expectedPricingType || stay.pricingType === 'HOUR' && sourceRoom.allowsHourly === false) deny('Đơn giá nhận phòng không khớp giá đã đặt hoặc bảng giá.');
      roomUpdates([stay.roomId], ['status', 'currentStayId', 'currentGuestName']);
      const room = next.rooms.find(row => row.id === stay.roomId); if (!room || room.status !== 'OCCUPIED' || room.currentStayId !== stay.id || room.currentGuestName !== stay.customerName) deny();
      break;
    }
    case 'stay.guests':
    case 'stay.service.add':
    case 'stay.service.remove': {
      scope('stays'); updatesOnly(d.stays); if (d.stays.updated.length !== 1) deny();
      const { old, next: stay } = d.stays.updated[0]; if (old.status !== 'ACTIVE' || !onlyFields(old, stay, [action === 'stay.guests' ? 'companionGuests' : 'services'])) deny();
      if (action === 'stay.guests') { const room = before.rooms.find(row => row.id === old.roomId); if (!room || (stay.companionGuests?.length || 0) + 1 > room.maxGuests) deny(); }
      else { const usage = changes(old.services, stay.services); if (usage.updated.length || (action === 'stay.service.add' ? usage.removed.length || usage.added.length !== 1 || usage.added.some(row => !validUsage(row, before)) : usage.added.length || usage.removed.length !== 1)) deny(); }
      break;
    }
    case 'stay.checkout': {
      scope('stays', 'rooms', 'invoices', 'debts'); updatesOnly(d.stays); if (d.stays.updated.length !== 1) deny();
      const { old, next: stay } = d.stays.updated[0]; if (old.status !== 'ACTIVE' || stay.status !== 'CHECKED_OUT' || !onlyFields(old, stay, ['status', 'actualCheckOutDate', 'actualCheckOutTime'])) deny();
      const invoice = newInvoice('ROOM'); if (invoice.stayId !== old.id || invoice.roomNumber !== old.roomNumber || invoice.customerName !== old.customerName || !equal(invoice.services || [], old.services) || invoice.serviceCharge !== old.services.reduce((sum, usage) => sum + usage.totalPrice, 0) || invoice.depositDeducted > old.deposit || before.invoices.some(row => row.stayId === old.id)) deny();
      if (!stay.actualCheckOutDate || !stay.actualCheckOutTime || !Number.isFinite(dateTime(stay.actualCheckOutDate, stay.actualCheckOutTime))) deny();
      if (dateTime(stay.actualCheckOutDate, stay.actualCheckOutTime) > Date.now() + 60000) deny();
      const duration = stayDuration(old, stay.actualCheckOutDate, stay.actualCheckOutTime), gross = invoice.roomCharge + invoice.serviceCharge + invoice.surcharge - invoice.discount;
      if (invoice.roomCharge !== duration * old.rateApplied || invoice.durationNightsOrHours !== duration || invoice.depositDeducted !== Math.min(old.deposit, gross) || (invoice.refundAmount || 0) !== Math.max(0, old.deposit - gross) || invoice.checkInDateTime !== `${old.checkInDate} ${old.checkInTime}` || invoice.checkOutDateTime !== `${stay.actualCheckOutDate} ${stay.actualCheckOutTime}` || invoice.date !== stay.actualCheckOutDate || invoice.time !== stay.actualCheckOutTime || invoice.pricingType !== old.pricingType || invoice.phone !== old.phone) deny('Phiếu thu không khớp lượt ở và tiền cọc.');
      roomUpdates([old.roomId], ['status', 'cleanStatus', 'currentStayId', 'currentGuestName']); const room = next.rooms.find(row => row.id === old.roomId); if (!room || room.status !== 'CLEANING' || room.cleanStatus !== 'DIRTY' || room.currentStayId || room.currentGuestName) deny();
      break;
    }
    case 'sale.create': {
      scope('invoices', 'debts'); const invoice = newInvoice('SERVICE');
      if (invoice.roomCharge || invoice.depositDeducted || invoice.surcharge || invoice.refundAmount || !invoice.services?.length || invoice.services.some(usage => !validUsage(usage, before)) || invoice.serviceCharge !== invoice.services.reduce((sum, usage) => sum + usage.totalPrice, 0)) deny();
      break;
    }
    case 'debt.collect': {
      scope('debts', 'invoices'); updatesOnly(d.debts); updatesOnly(d.invoices); if (d.debts.updated.length !== 1 || d.invoices.updated.length !== 1) deny();
      const { old, next: debt } = d.debts.updated[0], { old: invoice, next: changed } = d.invoices.updated[0];
      if (debt.invoiceId !== invoice.id || !onlyFields(old, debt, ['paidAmount', 'remainingAmount', 'status', 'paymentHistory']) || !onlyFields(invoice, changed, ['paidAmount', 'debtAmount', 'status'])) deny();
      const payments = changes(old.paymentHistory, debt.paymentHistory); if (payments.added.length !== 1 || payments.removed.length || payments.updated.length) deny();
      const amount = payments.added[0].amount; if (!Number.isSafeInteger(amount) || amount <= 0 || amount > old.remainingAmount || debt.paidAmount !== old.paidAmount + amount || debt.remainingAmount !== old.remainingAmount - amount || changed.paidAmount !== invoice.paidAmount + amount || changed.debtAmount !== invoice.debtAmount - amount || debt.status !== (debt.remainingAmount ? 'PARTIAL' : 'SETTLED') || changed.status !== (changed.debtAmount ? 'PARTIAL' : 'PAID')) deny();
      break;
    }
    default: deny();
  }
}
