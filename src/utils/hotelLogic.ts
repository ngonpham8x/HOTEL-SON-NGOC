import type { DebtRecord, Invoice, PaymentMethod, Reservation, Room, StayRecord } from '../types/hotel';

export function newId() {
  return globalThis.crypto.randomUUID?.() ?? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4))).map(n => n.toString(16).padStart(8, '0')).join('-');
}

export function localDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function localTime(date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
export function dateTime(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const value = Date.parse(`${date}T${time}:00+07:00`);
  return Number.isFinite(value) && localDate(new Date(value)) === date && localTime(new Date(value)) === time ? value : NaN;
}
export function validatePeriod(startDate: string, startTime: string, endDate: string, endTime: string) {
  const start = dateTime(startDate, startTime), end = dateTime(endDate, endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Thời gian trả phòng phải sau thời gian nhận phòng.');
  return { start, end };
}
export function money(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} phải là số tiền nguyên, không âm.`);
  return value;
}
export function stayDuration(stay: Pick<StayRecord, 'checkInDate' | 'checkInTime' | 'pricingType'>, endDate = localDate(), endTime = localTime()) {
  if (Number.isFinite(dateTime(stay.checkInDate, stay.checkInTime)) && endDate === stay.checkInDate && endTime === stay.checkInTime) return 1;
  const { start, end } = validatePeriod(stay.checkInDate, stay.checkInTime, endDate, endTime);
  if (stay.pricingType === 'HOUR') return Math.max(1, Math.ceil((end - start) / 3600000));
  // Nights follow calendar dates; a stay within one day is charged at least one night.
  return Math.max(1, Math.round((Date.parse(endDate) - Date.parse(stay.checkInDate)) / 86400000));
}
export function invoiceRevenue(invoice: Invoice) {
  return Math.max(0, invoice.roomCharge + invoice.serviceCharge + invoice.surcharge - invoice.discount);
}
export function invoiceCollected(invoice: Invoice) {
  return invoice.paidAmount + Math.min(invoice.depositDeducted, invoiceRevenue(invoice));
}
export function paymentBreakdown(invoices: Invoice[], debts: DebtRecord[]) {
  const result = { CASH: 0, TRANSFER: 0, CARD: 0, deposit: 0, other: 0 };
  const add = (method: PaymentMethod, amount: number) => {
    if (method === 'CASH' || method === 'TRANSFER' || method === 'CARD') result[method] += amount;
    else result.other += amount;
  };
  for (const invoice of invoices) {
    const payments = debts.filter(d => d.invoiceId === invoice.id).flatMap(d => d.paymentHistory);
    add(invoice.paymentMethod, Math.max(0, invoice.paidAmount - payments.reduce((sum, p) => sum + p.amount, 0)));
    payments.forEach(p => add(p.method, p.amount));
    result.deposit += Math.min(invoice.depositDeducted, invoiceRevenue(invoice));
  }
  return result;
}
export function periodKeys(today = localDate()) {
  const [year, month] = today.split('-').map(Number);
  const last = new Date(Date.UTC(year, month - 2, 1));
  return { today, thisMonth: today.slice(0, 7), lastMonth: last.toISOString().slice(0, 7), daysThisMonth: new Date(year, month, 0).getDate(), daysLastMonth: new Date(year, month - 1, 0).getDate() };
}
export function roomSchedule(roomId: string, reservations: Reservation[], stays: StayRecord[], excludedReservationId?: string, now = Date.now()) {
  return [
    ...reservations.filter(r => r.roomId === roomId && r.status === 'CONFIRMED' && r.id !== excludedReservationId).map(r => ({ id: r.id, code: r.code, customerName: r.customerName, startDate: r.checkInDate, startTime: r.checkInTime, endDate: r.checkOutDate, endTime: r.checkOutTime, overdue: false })),
    ...stays.filter(s => s.roomId === roomId && s.status === 'ACTIVE').map(s => ({ id: s.id, code: s.code, customerName: s.customerName, startDate: s.checkInDate, startTime: s.checkInTime, endDate: s.expectedCheckOutDate, endTime: s.expectedCheckOutTime, overdue: dateTime(s.expectedCheckOutDate, s.expectedCheckOutTime) <= now })),
  ].sort((a, b) => dateTime(a.startDate, a.startTime) - dateTime(b.startDate, b.startTime));
}
export function findBookingConflict(roomId: string, start: number, end: number, reservations: Reservation[], stays: StayRecord[], excludedReservationId?: string, now = Date.now()) {
  return roomSchedule(roomId, reservations, stays, excludedReservationId, now).find(entry => {
    const occupiedStart = dateTime(entry.startDate, entry.startTime), occupiedEnd = dateTime(entry.endDate, entry.endTime);
    // Invalid schedules must be reviewed, never silently treated as free rooms.
    return !Number.isFinite(occupiedStart) || !Number.isFinite(occupiedEnd) || occupiedEnd <= occupiedStart
      || (start < (entry.overdue ? Infinity : occupiedEnd) && end > occupiedStart);
  });
}
export function bookingConflict(roomId: string, start: number, end: number, reservations: Reservation[], stays: StayRecord[], excludedReservationId?: string, now = Date.now()) {
  return !!findBookingConflict(roomId, start, end, reservations, stays, excludedReservationId, now);
}
export function bookingConflictMessage(entry: NonNullable<ReturnType<typeof findBookingConflict>>) {
  const date = (value: string) => value.split('-').reverse().join('/');
  return entry.overdue
    ? `Khách ${entry.customerName} (${entry.code}) chưa trả phòng dù đã quá giờ dự kiến. Hãy xác nhận trả phòng trước khi giữ lịch mới.`
    : `Trùng lịch ${entry.code} của ${entry.customerName}: ${entry.startTime} ${date(entry.startDate)} → ${entry.endTime} ${date(entry.endDate)}. Hãy chọn phòng khác hoặc đổi thời gian; chưa ghi nhận phiếu đặt và tiền cọc.`;
}
export function roomDefaults(room: Room): Room {
  return { ...room, allowsHourly: room.allowsHourly ?? true, defaultCheckInTime: room.defaultCheckInTime || '14:00', defaultCheckOutTime: room.defaultCheckOutTime || '12:00' };
}
