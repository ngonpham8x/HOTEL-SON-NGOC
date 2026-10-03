import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, localTime, stayDuration, validatePeriod, bookingConflict, invoiceRevenue, invoiceCollected, periodKeys, paymentBreakdown } from '../src/utils/hotelLogic';
import { readHotelData, serializeHotelData, validateHotelData, DATA_KEY } from '../src/utils/hotelStorage';
import { INITIAL_ROOMS, INITIAL_SERVICES, INITIAL_STAYS, INITIAL_RESERVATIONS, INITIAL_INVOICES, INITIAL_DEBTS } from '../src/data/initialData';
const data = { rooms: INITIAL_ROOMS, services: INITIAL_SERVICES, stays: INITIAL_STAYS, reservations: INITIAL_RESERVATIONS, invoices: INITIAL_INVOICES, debts: INITIAL_DEBTS };
test('Vietnam dates are correct before 7AM and at midnight', () => {
  const d = new Date('2026-10-03T00:30:00+07:00');
  assert.equal(localDate(d), '2026-10-03'); assert.equal(localTime(d), '00:30');
});
test('hourly charges use actual elapsed time across midnight and round up', () => {
  const stay = { checkInDate: '2026-10-02', checkInTime: '22:30', pricingType: 'HOUR' as const };
  assert.equal(stayDuration(stay, '2026-10-02', '23:30'), 1);
  assert.equal(stayDuration(stay, '2026-10-02', '22:30'), 1);
  assert.equal(stayDuration(stay, '2026-10-03', '00:31'), 3);
  assert.equal(stayDuration(stay, '2026-10-03', '06:30'), 8);
});
test('night stays use calendar nights; reversed and invalid dates are rejected', () => {
  const stay = { checkInDate: '2026-10-02', checkInTime: '14:00', pricingType: 'NIGHT' as const };
  assert.equal(stayDuration(stay, '2026-10-05', '12:00'), 3);
  assert.throws(() => stayDuration(stay, '2026-10-02', '13:00'));
  assert.throws(() => validatePeriod('2026-02-30', '14:00', '2026-03-05', '12:00'));
});
test('deposits do not reduce revenue and are included in invoice collections', () => {
  const invoice = { ...INITIAL_INVOICES[0], roomCharge: 1000000, serviceCharge: 0, surcharge: 0, discount: 0, depositDeducted: 500000, paidAmount: 500000, totalAmount: 500000 };
  assert.equal(invoiceRevenue(invoice), 1000000); assert.equal(invoiceCollected(invoice), 1000000);
});
test('booking intervals reject overlaps but accept back-to-back reservations', () => {
  const r = { ...INITIAL_RESERVATIONS[0], id: 'r', roomId: 'room', status: 'CONFIRMED' as const, checkInDate: '2026-10-02', checkInTime: '14:00', checkOutDate: '2026-10-03', checkOutTime: '12:00' };
  const conflict = (d: string, t: string, end: string, et: string) => { const { start, end: finish } = validatePeriod(d,t,end,et); return bookingConflict('room', start, finish, [r], []); };
  assert.equal(conflict('2026-10-02','15:00','2026-10-04','12:00'),true);
  assert.equal(conflict('2026-10-03','12:00','2026-10-04','12:00'),false);
});
test('periods follow current dates and handle the year boundary', () => {
  const keys = periodKeys('2027-01-03'); assert.equal(keys.lastMonth, '2026-12'); assert.equal(keys.daysThisMonth,31);
  assert.equal(periodKeys('2028-02-03').daysThisMonth,29);
});
test('existing sample/legacy data migrates without removing records', () => {
  const migrated = readHotelData({getItem: key => key === 'son_ngoc_hotel_rooms_v2' ? JSON.stringify(data.rooms) : null},data);
  assert.equal(migrated.error,''); assert.equal(migrated.data.rooms.length,15); assert.equal(migrated.data.rooms[0].allowsHourly,true);
});
test('corrupt data is reported without silently loading sample records', () => {
  const result = readHotelData({ getItem: key => key === DATA_KEY ? '{broken' : null },data);
  assert.ok(result.error); assert.deepEqual(result.data.rooms,[]);
});
test('snapshot round-trips and invalid backups are rejected', () => {
  assert.equal(validateHotelData(JSON.parse(serializeHotelData(data)).data).stays.length,data.stays.length);
  assert.throws(() => validateHotelData({ ...data, rooms: [{id:'x'}] }));
});
test('later debt payments retain their actual methods and do not classify deposits as cash', () => {
  const invoice = { ...INITIAL_INVOICES[0], id: 'invoice-test', paymentMethod: 'DEBT' as const, paidAmount: 200000, depositDeducted: 100000 };
  const debt = { ...INITIAL_DEBTS[0], invoiceId: invoice.id, paymentHistory: [{ ...INITIAL_DEBTS[0].paymentHistory[0], date: '2026-10-03', time: '12:00', amount: 200000, method: 'TRANSFER' as const }] };
  const result = paymentBreakdown([invoice],[debt]);
  assert.equal(result.TRANSFER,200000); assert.equal(result.CASH,0); assert.equal(result.deposit,100000); assert.equal(result.other,0);
});
