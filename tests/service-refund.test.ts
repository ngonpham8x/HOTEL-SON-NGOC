import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareServiceSale } from '../src/utils/serviceSale';
import { applySaleEvent, adjustSaleDebts, saleQuantities, pendingSaleRefund, validateSaleLifecycle, sameSaleSnapshot } from '../src/utils/serviceSaleLifecycle';
import { invoiceCollected, invoiceRevenue, paymentBreakdown, localDate, localTime } from '../src/utils/hotelLogic';
import { authorizeHotelMutation, projectHotelData, mergeProjectedHotelData } from '../src/utils/authorizeHotelMutation';
import { ADMIN_ACTOR } from '../src/utils/permissions';
import type { Invoice, ServiceSaleEvent } from '../src/types/hotel';
import type { HotelData } from '../src/utils/hotelStorage';
import { validateHotelData, serializeHotelData } from '../src/utils/hotelStorage';

const sale = (paidAmount = 600000, discount = 0) => prepareServiceSale({ customerName: 'Khách A', phone: '0900000000', items: [{ serviceId: 'massage', quantity: 3 }], discount, paidAmount, paymentMethod: 'CASH' }, [{ id: 'massage', name: 'Massage', category: 'MASSAGE', categoryName: 'Massage', price: 200000, unit: 'Vé' }]);
let sequence = 0;
const event = (input: Omit<ServiceSaleEvent, 'id' | 'date' | 'time' | 'actorId' | 'actorName'> | Record<string, unknown>): ServiceSaleEvent => ({ ...input, id: `e-${++sequence}`, date: localDate(), time: localTime(), actorId: ADMIN_ACTOR.id, actorName: ADMIN_ACTOR.displayName } as ServiceSaleEvent);
const cancel = (invoice: Invoice, quantity: number, fee = 0) => applySaleEvent(invoice, event({ kind: 'CANCEL', items: [{ usageId: invoice.services![0].id, quantity }], fee, reason: 'Khách đổi ý', requestedBy: 'CUSTOMER' }));
const data = (invoice: Invoice): HotelData => ({ rooms: [], services: [], stays: [], reservations: [], invoices: [invoice], debts: [] });

test('used tickets cannot be cancelled; partial cancellation preserves original items and creates refund liability', () => {
  const original = sale().invoice;
  const used = applySaleEvent(original, event({ kind: 'USE', items: [{ usageId: original.services![0].id, quantity: 1 }] }));
  assert.throws(() => cancel(used, 3), /Số vé/);
  const next = cancel(used, 2);
  assert.deepEqual(saleQuantities(next, original.services![0].id), { used: 1, cancelled: 2, available: 0 });
  assert.equal(invoiceRevenue(next), 200000);
  assert.equal(invoiceCollected(next), 600000);
  assert.equal(pendingSaleRefund(next), 400000);
  assert.deepEqual(next.services, original.services);
  validateSaleLifecycle(next);
});

test('refund can be paid in installments and another method without altering the original payment history', () => {
  let next = cancel(sale().invoice, 2, 50000);
  assert.equal(next.totalAmount, 250000);
  next = applySaleEvent(next, event({ kind: 'REFUND', amount: 100000, method: 'TRANSFER', notes: 'Mã giao dịch 1' }));
  assert.equal(pendingSaleRefund(next), 250000);
  assert.equal(invoiceCollected(next), 500000);
  assert.deepEqual(paymentBreakdown([next], []), { CASH: 600000, TRANSFER: -100000, CARD: 0, deposit: 0, other: 0 });
  assert.throws(() => applySaleEvent(next, event({ kind: 'REFUND', amount: 250001, method: 'CASH', notes: '' })), /Tiền hoàn/);
  next = applySaleEvent(next, event({ kind: 'REFUND', amount: 250000, method: 'CASH', notes: '' }));
  assert.equal(pendingSaleRefund(next), 0);
  assert.equal(invoiceCollected(next), 250000);
  assert.equal(next.serviceLifecycle!.events.length, 3);
  validateSaleLifecycle(next);
});

test('cancelling an unpaid part reduces debt first and retains every debt payment record', () => {
  const initial = sale(200000);
  const next = cancel(initial.invoice, 2);
  const debt = adjustSaleDebts([initial.debt!], next)[0];
  assert.equal(next.debtAmount, 0);
  assert.equal(pendingSaleRefund(next), 0);
  assert.equal(debt.remainingAmount, 0);
  assert.equal(debt.status, 'SETTLED');
  assert.deepEqual(debt.paymentHistory, initial.debt!.paymentHistory);
  const withPayments = { ...initial.debt!, paidAmount: 100000, remainingAmount: 300000, paymentHistory: [{ id: 'payment', date: localDate(), time: localTime(), amount: 100000, method: 'TRANSFER' as const, collectedBy: 'Quản lý' }] };
  const afterCollection = cancel({ ...initial.invoice, paidAmount: 300000, debtAmount: 300000 }, 2);
  const adjusted = adjustSaleDebts([withPayments], afterCollection)[0];
  assert.deepEqual(adjusted.paymentHistory, withPayments.paymentHistory);
  assert.equal(pendingSaleRefund(afterCollection), 100000);
  assert.equal(paymentBreakdown([afterCollection], [adjusted]).CASH, 200000);
  assert.equal(paymentBreakdown([afterCollection], [adjusted]).TRANSFER, 100000);
});

test('repeated cancellation allocates original discounts consistently, including zero value tickets', () => {
  const original = sale(599999, 1).invoice;
  const sequential = cancel(cancel(cancel(original, 1), 1), 1);
  const once = cancel(original, 3);
  assert.equal(sequential.totalAmount, once.totalAmount);
  assert.equal(sequential.discount, 0);
  assert.equal(pendingSaleRefund(sequential), 599999);
  validateSaleLifecycle(sequential);
  const free = cancel(sale(0, 600000).invoice, 3);
  assert.equal(pendingSaleRefund(free), 0);
  validateSaleLifecycle(free);
});

test('invalid quantities, fees, hotel-imposed fees, duplicate usage and refund events are rejected', () => {
  const original = sale().invoice;
  assert.throws(() => cancel(original, 0), /Số vé/);
  assert.throws(() => cancel(original, 1.5), /Số vé/);
  assert.throws(() => cancel(original, 1, 200001), /Phí hủy/);
  assert.throws(() => applySaleEvent(original, event({ kind: 'CANCEL', items: [{ usageId: original.services![0].id, quantity: 1 }], fee: 1, reason: 'Hỏng thiết bị', requestedBy: 'HOTEL' })), /không giữ phí/);
  const first = event({ kind: 'USE', items: [{ usageId: original.services![0].id, quantity: 1 }] });
  assert.throws(() => applySaleEvent(applySaleEvent(original, first), first), /đã được ghi nhận/);
});

test('server authorization recomputes refunds, preserves history and rejects ungranted financial actions', () => {
  const original = { ...sale().invoice, createdBy: 'staff' };
  const next = cancel(original, 2);
  authorizeHotelMutation(ADMIN_ACTOR, data(original), data(next), 'sale.cancel');
  assert.throws(() => authorizeHotelMutation(ADMIN_ACTOR, data(original), data({ ...next, paidAmount: 0 }), 'sale.cancel'));
  assert.throws(() => authorizeHotelMutation({ ...ADMIN_ACTOR, id: 'staff', role: 'RECEPTION', permissions: { views: ['sales'], actions: ['sale.create'] } }, data(original), data(next), 'sale.cancel'));
  assert.throws(() => authorizeHotelMutation(ADMIN_ACTOR, data(next), data(original), 'sale.create'));
  assert.throws(() => validateSaleLifecycle({ ...next, serviceLifecycle: { ...next.serviceLifecycle!, refundDue: 900000 } }));
});

test('receptionists receive cancellation and refund independently, including receipts sold in another shift', () => {
  const original = { ...sale().invoice, createdBy: 'another-shift' };
  const cancelStaff = { ...ADMIN_ACTOR, id: 'canceller', displayName: 'Lễ tân hủy', role: 'RECEPTION' as const, permissions: { views: ['sales' as const], actions: ['sale.cancel' as const] } };
  const cancelled = applySaleEvent(original, { ...event({ kind: 'CANCEL', items: [{ usageId: original.services![0].id, quantity: 2 }], fee: 0, reason: 'Khách đổi ý', requestedBy: 'CUSTOMER' }), actorId: cancelStaff.id, actorName: cancelStaff.displayName });
  authorizeHotelMutation(cancelStaff, data(original), data(cancelled), 'sale.cancel');
  assert.throws(() => authorizeHotelMutation(cancelStaff, data(original), data(cancelled), 'sale.create'));
  assert.equal(projectHotelData(cancelStaff, data(original)).invoices.length, 1);
  const refundStaff = { ...cancelStaff, id: 'refunder', displayName: 'Lễ tân hoàn', permissions: { views: ['sales' as const], actions: ['sale.refund' as const] } };
  const refunded = applySaleEvent(cancelled, { ...event({ kind: 'REFUND', amount: 400000, method: 'CASH', notes: '' }), actorId: refundStaff.id, actorName: refundStaff.displayName });
  authorizeHotelMutation(refundStaff, data(cancelled), data(refunded), 'sale.refund');
  assert.throws(() => authorizeHotelMutation(cancelStaff, data(cancelled), data(refunded), 'sale.refund'));
  assert.throws(() => authorizeHotelMutation(refundStaff, data(original), data(cancelled), 'sale.cancel'));
  assert.throws(() => authorizeHotelMutation({ ...refundStaff, permissions: { views: [], actions: ['sale.refund'] } }, data(cancelled), data(refunded), 'sale.refund'));
});

test('financial ticket permissions expose only linked service debt and preserve hidden room debt when cancelling', () => {
  const sold = sale(200000);
  const staff = { ...ADMIN_ACTOR, id: 'cancel-staff', displayName: 'Lễ tân', role: 'RECEPTION' as const, permissions: { views: ['sales' as const], actions: ['sale.cancel' as const] } };
  const roomInvoice = { ...sale().invoice, kind: 'ROOM' as const, createdBy: 'manager' };
  const hiddenDebt = { ...sold.debt!, id: 'room-debt', invoiceId: roomInvoice.id };
  const before = { ...data(sold.invoice), invoices: [roomInvoice, sold.invoice], debts: [hiddenDebt, sold.debt!] };
  const projected = projectHotelData(staff, before);
  assert.deepEqual(projected.debts.map(debt => debt.id), [sold.debt!.id]);
  assert.equal(projected.invoices.length, 1);
  const nextInvoice = applySaleEvent(sold.invoice, { ...event({ kind: 'CANCEL', items: [{ usageId: sold.invoice.services![0].id, quantity: 2 }], fee: 0, reason: 'Hủy vé', requestedBy: 'CUSTOMER' }), actorId: staff.id, actorName: staff.displayName });
  const submitted = { ...projected, invoices: [nextInvoice], debts: adjustSaleDebts(projected.debts, nextInvoice) };
  const next = mergeProjectedHotelData(staff, before, submitted);
  authorizeHotelMutation(staff, before, next, 'sale.cancel');
  assert.deepEqual(next.debts.find(debt => debt.id === hiddenDebt.id), hiddenDebt);
  assert.equal(next.debts.find(debt => debt.id === sold.debt!.id)!.remainingAmount, 0);
});

test('refund history round-trips in backups and malformed quantities or money are rejected', () => {
  const original = sale().invoice;
  const next = cancel(original, 2);
  assert.deepEqual(validateHotelData(JSON.parse(serializeHotelData(data(next))).data).invoices[0], JSON.parse(JSON.stringify(next)));
  const forged = structuredClone(next);
  const first = forged.serviceLifecycle!.events[0];
  if (first.kind === 'CANCEL') first.items[0].quantity = 4;
  assert.throws(() => validateHotelData(data(forged)));
  assert.deepEqual(validateHotelData(data(original)).invoices[0], original);
});

test('stale invoice check tolerates JSON key ordering and still detects another payment or cancellation', () => {
  const invoice = cancel(sale().invoice, 1);
  const fromDatabase = JSON.parse(JSON.stringify(invoice, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).reverse()) : item));
  assert.equal(sameSaleSnapshot(invoice, fromDatabase), true);
  assert.equal(sameSaleSnapshot(invoice, cancel(invoice, 1)), false);
});
