import type { DebtRecord, Invoice, ServiceSaleEvent, ServiceUsage } from './hotel.ts';
import { dateTime, money } from './hotelLogic.ts';

export type SaleEventInput =
  | { kind: 'USE'; items: { usageId: string; quantity: number }[] }
  | { kind: 'CANCEL'; items: { usageId: string; quantity: number }[]; fee: number; reason: string; requestedBy: 'CUSTOMER' | 'HOTEL' }
  | { kind: 'REFUND'; amount: number; method: 'CASH' | 'TRANSFER' | 'CARD'; notes: string };

export function sameSaleSnapshot(a: Invoice, b: Invoice) {
  const canonical = (value: Invoice) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).filter(([, field]) => field !== undefined).sort(([left], [right]) => left.localeCompare(right))) : item);
  return canonical(a) === canonical(b);
}

export function saleQuantities(invoice: Invoice, usageId: string) {
  const quantity = invoice.services?.find(item => item.id === usageId)?.quantity || 0;
  let used = 0, cancelled = 0;
  for (const event of invoice.serviceLifecycle?.events || []) {
    if (event.kind === 'REFUND') continue;
    const count = event.items.find(item => item.usageId === usageId)?.quantity || 0;
    if (event.kind === 'USE') used += count; else cancelled += count;
  }
  return { used, cancelled, available: quantity - used - cancelled };
}
export function pendingSaleRefund(invoice: Invoice) {
  const state = invoice.serviceLifecycle;
  return state ? state.refundDue - state.events.reduce((sum, event) => sum + (event.kind === 'REFUND' ? event.amount : 0), 0) : 0;
}
export function remainingSaleServices(invoice: Invoice): ServiceUsage[] {
  return (invoice.services || []).map(item => {
    const quantity = item.quantity - saleQuantities(invoice, item.id).cancelled;
    return { ...item, quantity, totalPrice: quantity * item.unitPrice };
  }).filter(item => item.quantity > 0);
}

/** Derive all money from the stored sale, never from the current catalog or client totals. */
export function applySaleEvent(invoice: Invoice, event: ServiceSaleEvent): Invoice {
  if (invoice.kind !== 'SERVICE' || invoice.status === 'CANCELLED' || !invoice.services?.length) throw new Error('Phiếu vé không còn hợp lệ.');
  if (!event.id || !event.actorId || !event.actorName?.trim() || !Number.isFinite(dateTime(event.date, event.time))) throw new Error('Thông tin người xử lý hoặc thời gian không hợp lệ.');
  if (invoice.serviceLifecycle?.events.some(old => old.id === event.id)) throw new Error('Thao tác đã được ghi nhận.');
  const state = invoice.serviceLifecycle || {
    original: { serviceCharge: invoice.serviceCharge, massageCharge: invoice.massageCharge || 0, discount: invoice.discount, totalAmount: invoice.totalAmount },
    refundDue: 0, events: [],
  };
  if (event.kind === 'REFUND') {
    money(event.amount, 'Tiền hoàn');
    if (!event.amount || event.amount > pendingSaleRefund(invoice) || !['CASH', 'TRANSFER', 'CARD'].includes(event.method)) throw new Error('Tiền hoàn phải lớn hơn 0 và không vượt tiền chờ hoàn.');
    if (typeof event.notes !== 'string') throw new Error('Ghi chú hoàn tiền không hợp lệ.');
    return { ...invoice, serviceLifecycle: { ...state, events: [...state.events, event] } };
  }
  if (!['USE', 'CANCEL'].includes(event.kind) || !Array.isArray(event.items) || !event.items.length) throw new Error('Chọn ít nhất một vé.');
  const ids = new Set<string>();
  for (const item of event.items) {
    if (ids.has(item.usageId) || !invoice.services.some(usage => usage.id === item.usageId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > saleQuantities(invoice, item.usageId).available) throw new Error('Số vé vượt phần chưa sử dụng hoặc đã hủy.');
    ids.add(item.usageId);
  }
  const lifecycle = { ...state, events: [...state.events, event] };
  if (event.kind === 'USE') return { ...invoice, serviceLifecycle: lifecycle };
  money(event.fee, 'Phí hủy');
  if (!event.reason?.trim() || !['CUSTOMER', 'HOTEL'].includes(event.requestedBy)) throw new Error('Nhập lý do và bên yêu cầu hủy.');
  if (event.requestedBy === 'HOTEL' && event.fee !== 0) throw new Error('Khách sạn hủy dịch vụ: không giữ phí hủy.');
  const updated = { ...invoice, serviceLifecycle: lifecycle };
  const remaining = remainingSaleServices(updated);
  const serviceCharge = money(remaining.reduce((sum, item) => sum + item.totalPrice, 0), 'Dịch vụ còn lại');
  const cancelledGross = state.original.serviceCharge - serviceCharge;
  // Allocate the original discount proportionally; cumulative rounding makes repeated cancellations consistent.
  const cancellationValue = state.original.serviceCharge ? Number(BigInt(state.original.totalAmount) * BigInt(cancelledGross) / BigInt(state.original.serviceCharge)) : 0;
  const previousValue = state.original.totalAmount - invoice.totalAmount + state.events.reduce((sum, old) => sum + (old.kind === 'CANCEL' ? old.fee : 0), 0);
  if (event.fee > cancellationValue - previousValue) throw new Error('Phí hủy vượt giá trị vé hủy sau giảm giá.');
  const fees = lifecycle.events.reduce((sum, old) => sum + (old.kind === 'CANCEL' ? old.fee : 0), 0);
  const totalAmount = state.original.totalAmount - cancellationValue + fees;
  const paidAmount = Math.min(invoice.paidAmount, totalAmount);
  lifecycle.refundDue += invoice.paidAmount - paidAmount;
  return {
    ...updated, serviceCharge, massageCharge: remaining.filter(item => item.category === 'MASSAGE' || !item.category && item.name.toLowerCase().includes('massage')).reduce((sum, item) => sum + item.totalPrice, 0),
    discount: state.original.discount - (cancelledGross - cancellationValue), surcharge: fees,
    totalAmount, paidAmount, debtAmount: Math.max(0, totalAmount - paidAmount),
    status: paidAmount === totalAmount ? 'PAID' : paidAmount ? 'PARTIAL' : 'DEBT',
  };
}

export function adjustSaleDebts(debts: DebtRecord[], invoice: Invoice): DebtRecord[] {
  if (invoice.serviceLifecycle?.events.at(-1)?.kind !== 'CANCEL') return debts;
  return debts.map(debt => debt.invoiceId !== invoice.id ? debt : {
    ...debt, totalInvoiceAmount: invoice.totalAmount, originalDebt: debt.paidAmount + invoice.debtAmount,
    remainingAmount: invoice.debtAmount, status: invoice.debtAmount === 0 ? 'SETTLED' : debt.paidAmount ? 'PARTIAL' : 'UNPAID',
  });
}

/** Validate optional new fields when reading old data or restoring a backup. */
export function validateSaleLifecycle(invoice: Invoice) {
  const state = invoice.serviceLifecycle;
  if (!state) return;
  if (invoice.kind !== 'SERVICE' || invoice.status === 'CANCELLED' || !Array.isArray(state.events) || !state.events.length || !state.original) throw new Error('Lịch sử vé không hợp lệ.');
  for (const value of Object.values(state.original)) money(value, 'Giá trị phiếu gốc');
  money(state.refundDue, 'Tiền hoàn');
  if (state.original.serviceCharge !== (invoice.services || []).reduce((sum, item) => sum + item.totalPrice, 0) || state.original.discount > state.original.serviceCharge || state.original.totalAmount !== state.original.serviceCharge - state.original.discount) throw new Error('Giá trị phiếu gốc không khớp.');
  let replay: Invoice = { ...invoice, serviceLifecycle: undefined, serviceCharge: state.original.serviceCharge, massageCharge: state.original.massageCharge, discount: state.original.discount, surcharge: 0, totalAmount: state.original.totalAmount, paidAmount: state.original.totalAmount, debtAmount: 0, status: 'PAID' };
  const ids = new Set<string>();
  let refunded = 0;
  for (const event of state.events) {
    if (!event || ids.has(event.id)) throw new Error('Lịch sử vé bị trùng.');
    ids.add(event.id);
    replay = applySaleEvent(replay, event);
    if (event.kind === 'REFUND') refunded += event.amount;
  }
  if (refunded > state.refundDue || state.refundDue > replay.serviceLifecycle!.refundDue || invoice.serviceCharge !== replay.serviceCharge || invoice.massageCharge !== replay.massageCharge || invoice.discount !== replay.discount || invoice.surcharge !== replay.surcharge || invoice.totalAmount !== replay.totalAmount || invoice.paidAmount + invoice.debtAmount !== invoice.totalAmount || invoice.status !== (invoice.debtAmount ? invoice.paidAmount ? 'PARTIAL' : 'DEBT' : 'PAID')) throw new Error('Số tiền xử lý vé không khớp.');
}
