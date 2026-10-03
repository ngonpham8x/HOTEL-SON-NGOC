import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_ACTOR, DEFAULT_STAFF_PERMISSIONS } from '../src/utils/permissions';
import { authorizeHotelMutation, projectHotelData, mergeProjectedHotelData, roomNumberReferenced } from '../src/utils/authorizeHotelMutation';
import { INITIAL_ROOMS, INITIAL_SERVICES, INITIAL_RESERVATIONS, INITIAL_STAYS, INITIAL_INVOICES, INITIAL_DEBTS } from '../src/data/initialData';
import type { AccessActor } from '../src/types/access';
import type { HotelData } from '../src/utils/hotelStorage';
import type { Invoice, StayRecord } from '../src/types/hotel';

const empty = (): HotelData => ({ rooms: [{ ...INITIAL_ROOMS[0], status: 'AVAILABLE', cleanStatus: 'CLEAN', currentStayId: undefined, currentGuestName: undefined }], services: [INITIAL_SERVICES[0]], stays: [], reservations: [], invoices: [], debts: [] });
const staff: AccessActor = { id: 'reception-test', role: 'RECEPTION', username: 'qa-staff', displayName: 'Lễ tân kiểm thử', version: 1, permissions: DEFAULT_STAFF_PERMISSIONS };

test('mutation authorization enforces the granted action and verifies its actual field changes', () => {
  const before = empty(), next = { ...before, rooms: before.rooms.map(room => ({ ...room, cleanStatus: 'DIRTY' as const })) };
  assert.doesNotThrow(() => authorizeHotelMutation(staff, before, next, 'room.clean'));
  assert.throws(() => authorizeHotelMutation({ ...staff, permissions: { views: ['rooms'], actions: [] } }, before, next, 'room.clean'));
  assert.throws(() => authorizeHotelMutation(staff, before, { ...next, rooms: next.rooms.map(room => ({ ...room, pricePerNight: room.pricePerNight + 1 })) }, 'room.clean'));
  assert.throws(() => authorizeHotelMutation(staff, before, next, 'sale.create'));
});

test('deleting rooms or services preserves historical references for managers and granted receptionists', () => {
  const before = empty(), room = before.rooms[0], service = before.services[0];
  const granted: AccessActor = { ...staff, permissions: { views: ['rooms','services'], actions: ['room.delete','service.delete'] } };
  assert.doesNotThrow(() => authorizeHotelMutation(granted, before, { ...before, rooms: [] }, 'room.delete'));
  assert.doesNotThrow(() => authorizeHotelMutation(granted, before, { ...before, services: [] }, 'service.delete'));
  for (const actor of [ADMIN_ACTOR, granted]) {
    const oldStay = { ...INITIAL_STAYS[0], roomId: room.id, status: 'CHECKED_OUT' as const };
    const history = { ...before, stays: [oldStay] };
    assert.throws(() => authorizeHotelMutation(actor, history, { ...history, rooms: [] }, 'room.delete'));
    const issued = { ...INITIAL_INVOICES[0], roomNumber: room.number, services: [{ id: 'usage', serviceId: service.id, name: service.name, quantity: 1, unitPrice: service.price, totalPrice: service.price, timestamp: '2026-10-01 10:00' }] };
    const invoiceHistory = { ...before, invoices: [issued] };
    assert.throws(() => authorizeHotelMutation(actor, invoiceHistory, { ...invoiceHistory, rooms: [] }, 'room.delete'));
    assert.throws(() => authorizeHotelMutation(actor, invoiceHistory, { ...invoiceHistory, services: [] }, 'service.delete'));
  }
});

test('grouped room labels protect linked debts and invoices without confusing N01 with N010', () => {
  const before = empty(); before.rooms[0].number = 'N01';
  const grouped = { ...before, debts: [{ ...INITIAL_DEBTS[0], roomNumber: 'Đoàn N01, N02, N09' }] };
  assert.equal(roomNumberReferenced('Đoàn N01, N02, N09', 'N01'), true);
  assert.equal(roomNumberReferenced('Đoàn N010, N02, N09', 'N01'), false);
  assert.equal(roomNumberReferenced('Đoàn n01 / N02', 'N01'), true);
  assert.equal(roomNumberReferenced('XN01, N01A, N01_2', 'N01'), false);
  assert.equal(roomNumberReferenced('Đoàn A.01, A.02', 'A.01'), true, 'custom room punctuation must be escaped');
  assert.equal(roomNumberReferenced('Đoàn Ax01', 'A.01'), false);
  const granted: AccessActor = { ...staff, permissions: { views: ['rooms'], actions: ['room.delete'] } };
  for (const actor of [ADMIN_ACTOR, granted]) {
    assert.throws(() => authorizeHotelMutation(actor, grouped, { ...grouped, rooms: [] }, 'room.delete'), /dữ liệu liên quan/);
    const otherRoom = { ...before, debts: [{ ...INITIAL_DEBTS[0], roomNumber: 'Đoàn N010, N02, N09' }] };
    assert.doesNotThrow(() => authorizeHotelMutation(actor, otherRoom, { ...otherRoom, rooms: [] }, 'room.delete'));
    const groupedInvoice = { ...before, invoices: [{ ...INITIAL_INVOICES[0], roomNumber: 'Đoàn N01, N02, N09' }] };
    assert.throws(() => authorizeHotelMutation(actor, groupedInvoice, { ...groupedInvoice, rooms: [] }, 'room.delete'));
  }
});

test('archive only marks an eligible canceled booking and never erases its record or deposit', () => {
  const before = { ...empty(), reservations: [{ ...INITIAL_RESERVATIONS[0], status: 'CANCELLED' as const, depositAmount: 0 }] };
  const archived = { ...before, reservations: before.reservations.map(reservation => ({ ...reservation, archived: true })) };
  assert.doesNotThrow(() => authorizeHotelMutation(staff, before, archived, 'booking.archive'));
  assert.throws(() => authorizeHotelMutation(staff, before, { ...before, reservations: [] }, 'booking.archive'));
  const onDeposit = { ...before, reservations: [{ ...before.reservations[0], depositAmount: 1 }] };
  assert.throws(() => authorizeHotelMutation(staff, onDeposit, { ...onDeposit, reservations: [{ ...onDeposit.reservations[0], archived: true }] }, 'booking.archive'));
  const linked = { ...before, stays: [{ ...INITIAL_STAYS[0], reservationId: before.reservations[0].id }] };
  assert.throws(() => authorizeHotelMutation(staff, linked, { ...linked, reservations: archived.reservations }, 'booking.archive'));
});

test('normal writes retain stays, invoices and debt histories even for an administrator', () => {
  const before = { ...empty(), stays: [INITIAL_STAYS[0]], invoices: [INITIAL_INVOICES[0]], debts: [INITIAL_DEBTS[0]] };
  for (const field of ['stays', 'invoices', 'debts'] as const) assert.throws(() => authorizeHotelMutation(ADMIN_ACTOR, before, { ...before, [field]: [] }, 'room.clean'));
  assert.doesNotThrow(() => authorizeHotelMutation(ADMIN_ACTOR, before, empty(), 'data.restore'));
  assert.throws(() => authorizeHotelMutation(staff, before, empty(), 'data.restore'));
});

test('projected snapshots hide finance history and preserve hidden rows when merging a staff write', () => {
  const own = { ...INITIAL_INVOICES[0], id: 'own-service', kind: 'SERVICE' as const, createdBy: staff.id };
  const foreign = { ...own, id: 'foreign-service', createdBy: 'other-reception' };
  const before = { ...empty(), invoices: [INITIAL_INVOICES[0], own, foreign], debts: [INITIAL_DEBTS[0]] };
  const projected = projectHotelData(staff, before);
  assert.deepEqual(projected.invoices, [own]); assert.deepEqual(projected.debts, []);
  const merged = mergeProjectedHotelData(staff, before, projected);
  assert.deepEqual(new Set(merged.invoices.map(invoice => invoice.id)), new Set(before.invoices.map(invoice => invoice.id)));
  assert.deepEqual(merged.debts, before.debts);
  assert.throws(() => mergeProjectedHotelData(staff, before, { ...projected, invoices: [...projected.invoices, { ...foreign, paidAmount: 0 }] }));
  const noViews = { ...staff, permissions: { views: [], actions: [] } };
  assert.ok(Object.values(projectHotelData(noViews, before)).every(rows => rows.length === 0));
});

test('debt-only staff see linked invoices and can collect debt while unrelated invoices and room data remain hidden and intact', () => {
  const actor: AccessActor = { ...staff, permissions: { views: ['debt'], actions: ['debt.collect'] } };
  const linked = { ...INITIAL_INVOICES[0], id: 'debt-invoice', paidAmount: 500000, debtAmount: 100000, status: 'PARTIAL' as const };
  const unrelated = { ...INITIAL_INVOICES[0], id: 'unrelated-paid-invoice', debtAmount: 0, status: 'PAID' as const };
  const debt = { ...INITIAL_DEBTS[0], invoiceId: linked.id, originalDebt: 100000, paidAmount: 0, remainingAmount: 100000, status: 'UNPAID' as const, paymentHistory: [] };
  const before: HotelData = { ...empty(), stays: [INITIAL_STAYS[0]], reservations: [INITIAL_RESERVATIONS[0]], invoices: [linked, unrelated], debts: [debt] };
  const projected = projectHotelData(actor, before);
  for (const field of ['rooms', 'services', 'stays', 'reservations'] as const) assert.deepEqual(projected[field], []);
  assert.deepEqual(projected.invoices, [linked]); assert.deepEqual(projected.debts, [debt]);
  const paid: HotelData = { ...projected, invoices: [{ ...linked, paidAmount: 501000, debtAmount: 99000 }], debts: [{ ...debt, paidAmount: 1000, remainingAmount: 99000, status: 'PARTIAL', paymentHistory: [{ id: 'collection', date: '2026-10-03', time: '12:00', amount: 1000, method: 'CASH', collectedBy: actor.displayName }] }] };
  const merged = mergeProjectedHotelData(actor, before, paid);
  assert.doesNotThrow(() => authorizeHotelMutation(actor, before, merged, 'debt.collect'));
  for (const field of ['rooms', 'services', 'stays', 'reservations'] as const) assert.deepEqual(merged[field], before[field]);
  assert.deepEqual(merged.invoices.find(invoice => invoice.id === unrelated.id), unrelated);
  assert.throws(() => mergeProjectedHotelData(actor, before, { ...paid, invoices: [...paid.invoices, { ...unrelated, paidAmount: 0 }] }));
});

test('checkout recomputes the stored room rate, duration and deposit refund instead of trusting forged invoice totals', () => {
  const base = empty(), room = { ...base.rooms[0], pricePerNight: 100000, status: 'OCCUPIED' as const, currentStayId: 'active', currentGuestName: 'Khách kiểm thử' };
  const stay: StayRecord = { ...INITIAL_STAYS[0], id: 'active', roomId: room.id, roomNumber: room.number, customerName: 'Khách kiểm thử', status: 'ACTIVE', services: [], pricingType: 'NIGHT', rateApplied: 100000, deposit: 400000, checkInDate: '2026-09-01', checkInTime: '14:00', expectedCheckOutDate: '2026-09-02', expectedCheckOutTime: '12:00' };
  const before: HotelData = { ...base, rooms: [room], stays: [stay] };
  const invoice: Invoice = { ...INITIAL_INVOICES[0], id: 'checked-out-invoice', code: 'HD-QA', createdBy: staff.id, stayId: stay.id, customerName: stay.customerName, phone: stay.phone, roomNumber: stay.roomNumber, checkInDateTime: '2026-09-01 14:00', checkOutDateTime: '2026-09-02 12:00', durationNightsOrHours: 1, pricingType: 'NIGHT', roomCharge: 100000, serviceCharge: 0, services: [], surcharge: 0, discount: 0, depositDeducted: 100000, refundAmount: 300000, totalAmount: 0, paidAmount: 0, debtAmount: 0, status: 'PAID', paymentMethod: 'CASH', date: '2026-09-02', time: '12:00' };
  const next: HotelData = { ...before, stays: [{ ...stay, status: 'CHECKED_OUT', actualCheckOutDate: '2026-09-02', actualCheckOutTime: '12:00' }], rooms: [{ ...room, status: 'CLEANING', cleanStatus: 'DIRTY', currentStayId: undefined, currentGuestName: undefined }], invoices: [invoice] };
  assert.doesNotThrow(() => authorizeHotelMutation(staff, before, next, 'stay.checkout'));
  assert.throws(() => authorizeHotelMutation(staff, before, { ...next, invoices: [{ ...invoice, roomCharge: 200000, depositDeducted: 200000, refundAmount: 200000 }] }, 'stay.checkout'), /lượt ở/);
  assert.throws(() => authorizeHotelMutation(staff, before, { ...next, invoices: [{ ...invoice, refundAmount: 0 }] }, 'stay.checkout'), /lượt ở/);
  assert.throws(() => authorizeHotelMutation(staff, before, { ...next, invoices: [{ ...invoice, date: '2026-09-03' }] }, 'stay.checkout'), /lượt ở/);
});

test('checkin uses the current room tariff or the preserved booking rate and rejects unrelated booking links', () => {
  const before = empty(), room = before.rooms[0];
  const stay: StayRecord = { ...INITIAL_STAYS[0], id: 'new-stay', roomId: room.id, roomNumber: room.number, customerName: 'Khách nhận phòng', status: 'ACTIVE', services: [], companionGuests: [], pricingType: 'NIGHT', rateApplied: room.pricePerNight, deposit: 0, checkInDate: '2026-09-01', checkInTime: '14:00', expectedCheckOutDate: '2026-09-02', expectedCheckOutTime: '12:00' };
  const next: HotelData = { ...before, stays: [stay], rooms: [{ ...room, status: 'OCCUPIED', currentStayId: stay.id, currentGuestName: stay.customerName }] };
  assert.doesNotThrow(() => authorizeHotelMutation(staff, before, next, 'stay.checkin'));
  assert.throws(() => authorizeHotelMutation(staff, before, { ...next, stays: [{ ...stay, rateApplied: room.pricePerNight + 1 }] }, 'stay.checkin'), /Đơn giá/);
  assert.throws(() => authorizeHotelMutation(staff, before, { ...next, stays: [{ ...stay, reservationId: 'unrelated-booking' }] }, 'stay.checkin'));
  const reservation = { ...INITIAL_RESERVATIONS[0], id: 'preserved-rate', roomId: room.id, roomNumber: room.number, customerName: stay.customerName, phone: stay.phone, pricingType: 'NIGHT' as const, rateApplied: 70000, depositAmount: 10000, status: 'CONFIRMED' as const };
  const booked = { ...before, reservations: [reservation] };
  const converted = { ...next, reservations: [{ ...reservation, status: 'CHECKED_IN' as const }], stays: [{ ...stay, reservationId: reservation.id, rateApplied: 70000, deposit: 10000 }] };
  assert.doesNotThrow(() => authorizeHotelMutation(staff, booked, converted, 'stay.checkin'));
  assert.throws(() => authorizeHotelMutation(staff, booked, { ...converted, stays: [{ ...converted.stays[0], rateApplied: room.pricePerNight }] }, 'stay.checkin'), /Đơn giá/);
});
