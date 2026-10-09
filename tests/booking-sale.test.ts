import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_RESERVATIONS, INITIAL_STAYS, INITIAL_SERVICES } from '../src/data/initialData';
import { bookingConflict, findBookingConflict, validatePeriod, invoiceRevenue, invoiceCollected, invoiceRoomCharge, invoiceMassageCharge, invoiceServiceCharge, invoiceDebtAmount, isInvoiceActive, paymentBreakdown } from '../src/utils/hotelLogic';
import { prepareServiceSale } from '../src/utils/serviceSale';
const reservation = { ...INITIAL_RESERVATIONS[0], id: 'a', roomId: 'N07', status: 'CONFIRMED' as const, checkInDate: '2026-10-11', checkInTime: '14:00', checkOutDate: '2026-10-12', checkOutTime: '12:00' };
const conflict = (date: string, time: string, endDate: string, endTime: string) => { const { start, end } = validatePeriod(date, time, endDate, endTime); return bookingConflict('N07', start, end, [reservation], []); };
test('N07 can hold different Sunday bookings, but overlapping deposits are blocked', () => {
  assert.equal(conflict('2026-10-18', '14:00', '2026-10-19', '12:00'), false);
  assert.equal(conflict('2026-10-11', '15:00', '2026-10-12', '10:00'), true);
  assert.equal(conflict('2026-10-10', '14:00', '2026-10-13', '12:00'), true);
  assert.equal(conflict('2026-10-11', '14:00', '2026-10-12', '12:00'), true);
  assert.equal(conflict('2026-10-12', '12:00', '2026-10-13', '12:00'), false);
  assert.equal(conflict('2026-10-10', '14:00', '2026-10-11', '14:00'), false);
});
test('cancelled and converted reservations release their interval; check-in excludes only its own reservation', () => {
  const { start, end } = validatePeriod('2026-10-11', '14:00', '2026-10-12', '12:00');
  assert.equal(bookingConflict('N07', start, end, [{ ...reservation, status: 'CANCELLED' }], []), false);
  assert.equal(bookingConflict('N07', start, end, [{ ...reservation, status: 'CHECKED_IN' }], []), false);
  assert.equal(bookingConflict('N07', start, end, [reservation], [], 'a'), false);
  assert.equal(bookingConflict('N07', start, end, [reservation, { ...reservation, id: 'b' }], [], 'a'), true);
});
test('overdue active guests and invalid intervals never appear available', () => {
  const stay = { ...INITIAL_STAYS[0], roomId: 'N07', status: 'ACTIVE' as const, checkInDate: '2026-10-10', checkInTime: '14:00', expectedCheckOutDate: '2026-10-11', expectedCheckOutTime: '12:00' };
  const { start, end } = validatePeriod('2026-10-18', '14:00', '2026-10-19', '12:00');
  assert.equal(findBookingConflict('N07', start, end, [], [stay], undefined, Date.parse('2026-10-12T00:00:00+07:00'))?.overdue, true);
  assert.equal(bookingConflict('N07', start, end, [], [{ ...stay, status: 'CHECKED_OUT' }]), false);
  assert.equal(bookingConflict('N07', start, end, [{ ...reservation, checkOutDate: 'broken' }], []), true);
});
const massage = INITIAL_SERVICES.find(s => s.category === 'MASSAGE')!;
const catalog = [{ ...massage, price: 100001 }];
const input = { customerName: '', phone: '', items: [{ serviceId: massage.id, quantity: 2 }], discount: 1, paidAmount: 200001, paymentMethod: 'TRANSFER' as const };
test('walk-in massage produces a standalone receipt with exact amounts and price snapshots', () => {
  const { invoice, debt } = prepareServiceSale(input, catalog);
  assert.equal(invoice.kind, 'SERVICE'); assert.equal(invoice.roomCharge, 0); assert.equal(invoice.durationNightsOrHours, 0);
  assert.equal(invoice.serviceCharge, 200002); assert.equal(invoice.massageCharge, 200002); assert.equal(invoiceRevenue(invoice), 200001);
  assert.equal(invoiceCollected(invoice), 200001); assert.equal(invoice.services![0].unitPrice, 100001); assert.equal(invoice.customerName, 'Khách lẻ');
  assert.equal(paymentBreakdown([invoice], []).TRANSFER, 200001); assert.equal(debt, undefined);
  catalog[0].price = 99999; assert.equal(invoice.services![0].unitPrice, 100001); catalog[0].price = 100001;
});
test('partial walk-in payments create matching debt and require customer contact', () => {
  assert.throws(() => prepareServiceSale({ ...input, paidAmount: 0 }, catalog), /tên và số điện thoại/);
  const { invoice, debt } = prepareServiceSale({ ...input, customerName: 'QA Guest', phone: '0900000000', paidAmount: 100001 }, catalog);
  assert.equal(invoice.debtAmount, 100000); assert.equal(invoice.status, 'PARTIAL'); assert.equal(debt!.invoiceId, invoice.id); assert.equal(debt!.remainingAmount, invoice.debtAmount);
});
test('invalid sale amounts, duplicate items, removed services and fractional quantities are rejected', () => {
  for (const patch of [{ discount: 200003 }, { discount: -1 }, { paidAmount: 200002 }, { paidAmount: 0.5 }, { items: [] }, { items: [{ serviceId: 'missing', quantity: 1 }] }, { items: [{ serviceId: massage.id, quantity: 1.5 }] }, { items: [...input.items, ...input.items] }]) assert.throws(() => prepareServiceSale({ ...input, ...patch }, catalog));
});
test('cancelled transactions are excluded from all revenue, charges, debt and payment breakdown', () => {
  const { invoice } = prepareServiceSale({ ...input, customerName: 'Cancelled Guest', phone: '0900000000', paidAmount: 100001 }, catalog);
  const cancelled = { ...invoice, status: 'CANCELLED' as const };
  assert.equal(isInvoiceActive(cancelled), false);
  assert.equal(invoiceRevenue(cancelled), 0);
  assert.equal(invoiceCollected(cancelled), 0);
  assert.equal(invoiceRoomCharge(cancelled), 0);
  assert.equal(invoiceMassageCharge(cancelled), 0);
  assert.equal(invoiceServiceCharge(cancelled), 0);
  assert.equal(invoiceDebtAmount(cancelled), 0);

  const breakdown = paymentBreakdown([cancelled], []);
  assert.equal(breakdown.TRANSFER, 0);
  assert.equal(breakdown.deposit, 0);
});

