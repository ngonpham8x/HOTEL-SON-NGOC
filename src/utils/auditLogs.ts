import type { AccessActor, ActionId } from '../types/access';
import type { AuditEntry, AuditDetail, AuditPage } from '../types/audit';
import type { HotelData } from './hotelStorage';
import { cloudEnabled, cloudRequest } from './cloudHotel';
import { DATA_KEY } from './hotelStorage';
import { newId, dateTime } from './hotelLogic';
import { ACTION_LABELS } from './permissions';

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ...ACTION_LABELS, 'sale.use': 'Ghi nhận vé đã sử dụng', 'auth.login': 'Đăng nhập', 'auth.logout': 'Đăng xuất',
  'auth.password': 'Đổi mật khẩu quản lý', 'staff.create': 'Tạo tài khoản lễ tân',
  'staff.update': 'Sửa tài khoản / quyền lễ tân', 'staff.delete': 'Xóa tài khoản lễ tân',
  'staff.password': 'Lễ tân đổi mật khẩu', 'data.update': 'Cập nhật dữ liệu hệ thống',
};
export const AUDIT_COLLECTION_LABELS: Record<string, string> = { rooms: 'Phòng', services: 'Dịch vụ', stays: 'Lượt ở', reservations: 'Đặt phòng', invoices: 'Phiếu thu', debts: 'Công nợ', staff: 'Tài khoản' };
const fields = new Set(['number','name','category','price','unit','floor','typeName','maxGuests','status','cleanStatus','roomNumber','checkInDate','checkInTime','checkOutDate','checkOutTime','expectedCheckOutDate','expectedCheckOutTime','pricingType','rateApplied','pricePerNight','pricePerHour','allowsHourly','defaultCheckInTime','defaultCheckOutTime','deposit','depositAmount','roomCharge','serviceCharge','massageCharge','surcharge','discount','depositDeducted','refundAmount','totalAmount','paidAmount','debtAmount','originalDebt','remainingAmount','dueDate','paymentMethod','archived']);
function safeFields(row: Record<string, unknown> | undefined) {
  if (!row) return {};
  const result: Record<string, unknown> = Object.fromEntries(Object.entries(row).filter(([key]) => fields.has(key)));
  if (Array.isArray(row.services)) result.services = row.services.map(item => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice }));
  if (Array.isArray(row.paymentHistory)) {
    result.paymentEvents = row.paymentHistory.length;
    const payment = row.paymentHistory.at(-1);
    if (payment) result.lastPayment = { amount: payment.amount, method: payment.method, date: payment.date, time: payment.time };
  }
  if (row.serviceLifecycle && typeof row.serviceLifecycle === 'object') {
    const lifecycle = row.serviceLifecycle as { events: { kind: string; amount?: number; method?: string; fee?: number; requestedBy?: string; items?: { usageId: string; quantity: number }[] }[]; refundDue: number };
    result.ticketEvents = lifecycle.events.length; result.refundDue = lifecycle.refundDue;
    result.refunded = lifecycle.events.reduce((sum, event) => sum + (event.kind === 'REFUND' ? event.amount || 0 : 0), 0);
    const last = lifecycle.events.at(-1);
    if (last) result.lastTicketEvent = { kind: last.kind, amount: last.amount, method: last.method, fee: last.fee, requestedBy: last.requestedBy,
      items: last.items?.map(item => ({ name: Array.isArray(row.services) ? row.services.find(usage => usage.id === item.usageId)?.name : undefined, quantity: item.quantity })) };
  }
  return result;
}
export function createLocalAuditEntry(actor: AccessActor, before: HotelData, next: HotelData, operation: ActionId): AuditEntry | undefined {
  const details: AuditDetail[] = [], counts: Record<string, number> = {};
  const canonical = (row: unknown) => JSON.stringify(row, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([left],[right]) => left.localeCompare(right))) : value);
  for (const collection of ['rooms','services','stays','reservations','invoices','debts'] as const) {
    const oldRows = new Map(before[collection].map(row => [row.id, row as unknown as Record<string, unknown>]));
    const newRows = new Map(next[collection].map(row => [row.id, row as unknown as Record<string, unknown>]));
    for (const id of new Set([...oldRows.keys(), ...newRows.keys()])) {
      const old = oldRows.get(id), row = newRows.get(id);
      if (canonical(old) === canonical(row)) continue;
      counts[collection] = (counts[collection] || 0) + 1;
      if (details.length < 100) details.push({ collection, id, reference: String(row?.code || old?.code || row?.number || old?.number || row?.name || old?.name || row?.roomNumber || old?.roomNumber || ''), kind: !old ? 'CREATED' : !row ? 'DELETED' : 'UPDATED', before: safeFields(old), after: safeFields(row) });
    }
  }
  if (!details.length) return undefined;
  const use = operation === 'sale.create' && next.invoices.some(invoice => invoice.serviceLifecycle?.events.at(-1)?.kind === 'USE' && invoice.serviceLifecycle.events.length > (before.invoices.find(old => old.id === invoice.id)?.serviceLifecycle?.events.length || 0));
  return { id: newId(), createdAt: new Date().toISOString(), actorId: actor.id, actorName: actor.displayName, actorUsername: actor.username, actorRole: actor.role, action: use ? 'sale.use' : operation, details, metadata: { counts } };
}
export interface AuditFilters { actorId?: string; operation?: string; fromDate?: string; toDate?: string; beforeId?: string }
export function filterLocalAudit(entries: AuditEntry[], filters: AuditFilters): AuditPage {
  const from = filters.fromDate ? dateTime(filters.fromDate,'00:00') : -Infinity;
  const to = filters.toDate ? dateTime(filters.toDate,'00:00') + 86400000 : Infinity;
  if (Number.isNaN(from) || Number.isNaN(to) || from >= to) throw new Error('Khoảng ngày lọc nhật ký không hợp lệ.');
  const actors = [...new Map(entries.map(entry => [entry.actorId, { id: entry.actorId, name: entry.actorName, username: entry.actorUsername }])).values()];
  let matched = [...entries].reverse().filter(entry => (!filters.actorId || entry.actorId === filters.actorId) && (!filters.operation || entry.action === filters.operation) && Date.parse(entry.createdAt) >= from && Date.parse(entry.createdAt) < to);
  if (filters.beforeId) {
    const index = matched.findIndex(entry => entry.id === filters.beforeId);
    if (index < 0) throw new Error('Danh sách nhật ký đã thay đổi. Hãy tải lại.');
    matched = matched.slice(index + 1);
  }
  return { entries: matched.slice(0,50), actors, actions: [...new Set(entries.map(entry => entry.action))].sort(), nextCursor: matched.length > 50 ? matched[49].id : null };
}
export async function loadAuditPage(filters: AuditFilters): Promise<AuditPage> {
  if (cloudEnabled) return cloudRequest<AuditPage>('audit.list', filters as Record<string, unknown>);
  const raw = localStorage.getItem(DATA_KEY);
  return filterLocalAudit(raw ? JSON.parse(raw).data.auditLogs || [] : [], filters);
}
