import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, RefreshCw, Search, X } from 'lucide-react';
import { useAccess } from '../../context/AccessContext';
import { cloudEnabled } from '../../utils/cloudHotel';
import { localDate, dateTime } from '../../utils/hotelLogic';
import { loadAuditPage, AUDIT_ACTION_LABELS, AUDIT_COLLECTION_LABELS } from '../../utils/auditLogs';
import type { AuditEntry, AuditPage } from '../../types/audit';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { formatCurrency, formatDate, getPaymentMethodName } from '../../utils/formatters';
import { ACTION_LABELS, MODULE_LABELS } from '../../utils/permissions';
import type { ActionId, ModuleId } from '../../types/access';
import type { PaymentMethod } from '../../types/hotel';

const timestamp = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
const fieldLabels: Record<string, string> = {
  status: 'Trạng thái', cleanStatus: 'Dọn phòng', number: 'Số phòng', name: 'Tên', price: 'Đơn giá', rateApplied: 'Giá áp dụng',
  depositAmount: 'Tiền cọc đặt phòng', deposit: 'Tiền cọc', totalAmount: 'Tổng thanh toán', paidAmount: 'Đã thu', debtAmount: 'Còn nợ', remainingAmount: 'Nợ còn lại',
  serviceCharge: 'Tiền dịch vụ', massageCharge: 'Tiền massage', roomCharge: 'Tiền phòng', surcharge: 'Phụ thu / phí hủy', discount: 'Giảm giá',
  refundDue: 'Tiền cần hoàn lũy kế', refunded: 'Đã hoàn', ticketEvents: 'Số lần xử lý vé', services: 'Dịch vụ / vé',
  pricePerNight: 'Giá đêm', pricePerHour: 'Giá giờ', roomNumber: 'Phòng', checkInDate: 'Ngày nhận', checkInTime: 'Giờ nhận', checkOutDate: 'Ngày trả', checkOutTime: 'Giờ trả',
  expectedCheckOutDate: 'Ngày trả dự kiến', expectedCheckOutTime: 'Giờ trả dự kiến', dueDate: 'Hẹn thu nợ', paymentMethod: 'Phương thức thu',
  username: 'Tên đăng nhập', display_name: 'Tên lễ tân', active: 'Cho phép đăng nhập', permissions: 'Quyền được cấp', version: 'Phiên bản tài khoản',
  paymentEvents: 'Số lần thu nợ', lastPayment: 'Lần thu nợ gần nhất', lastTicketEvent: 'Lần xử lý vé gần nhất',
};
const moneyFields = new Set(['price','rateApplied','depositAmount','deposit','totalAmount','paidAmount','debtAmount','remainingAmount','serviceCharge','massageCharge','roomCharge','surcharge','discount','refundDue','refunded','pricePerNight','pricePerHour','originalDebt','depositDeducted','refundAmount']);
function displayValue(value: unknown, field: string): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return moneyFields.has(field) ? formatCurrency(value) : value.toLocaleString('vi-VN');
  if (Array.isArray(value) && field === 'services') return value.map(item => `${item.name} × ${item.quantity} · ${formatCurrency(item.unitPrice)}`).join('\n') || '—';
  if (typeof value === 'object' && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    if (field === 'permissions') return `Xem: ${(row.views as ModuleId[] || []).map(view => MODULE_LABELS[view] || view).join(', ') || 'Không có'}\nThao tác: ${(row.actions as ActionId[] || []).map(action => ACTION_LABELS[action] || action).join(', ') || 'Không có'}`;
    if (field === 'lastPayment') return row.amount === null ? '—' : `${formatCurrency(Number(row.amount))} · ${getPaymentMethodName(row.method as PaymentMethod)}\n${formatDate(String(row.date))} ${row.time || ''}`;
    if (field === 'lastTicketEvent') return [
      row.kind === 'USE' ? 'Sử dụng vé' : row.kind === 'CANCEL' ? 'Hủy vé' : 'Hoàn tiền',
      ...(Array.isArray(row.items) ? row.items.map(item => `${item.name} × ${item.quantity}`) : []),
      ...(typeof row.fee === 'number' ? [`Phí giữ lại: ${formatCurrency(row.fee)}`] : []),
      ...(typeof row.amount === 'number' ? [`Đã hoàn: ${formatCurrency(row.amount)} · ${getPaymentMethodName(row.method as PaymentMethod)}`] : []),
      ...(row.requestedBy ? [`Yêu cầu: ${row.requestedBy === 'HOTEL' ? 'Khách sạn' : 'Khách'}`] : []),
    ].join('\n');
    return JSON.stringify(value, null, 2);
  }
  if (field.endsWith('Date') && typeof value === 'string') return formatDate(value);
  if (field === 'paymentMethod') return getPaymentMethodName(value as PaymentMethod);
  const statuses: Record<string, string> = { AVAILABLE:'Trống',OCCUPIED:'Đang ở',RESERVED:'Đã đặt',CLEANING:'Cần dọn',MAINTENANCE:'Bảo trì',CLEAN:'Sạch',DIRTY:'Chưa dọn',CONFIRMED:'Chờ nhận',ACTIVE:'Đang ở',CHECKED_OUT:'Đã trả',CANCELLED:'Đã hủy',PAID:'Đã thu đủ',PARTIAL:'Thanh toán một phần',DEBT:'Ghi nợ',UNPAID:'Chưa thu',SETTLED:'Đã thu đủ',OVERDUE:'Quá hạn',NIGHT:'Theo đêm',HOUR:'Theo giờ' };
  return ['status','cleanStatus','pricingType'].includes(field) ? statuses[String(value)] || String(value) : String(value);
}

function AuditDetailDialog({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const ref = useDialogFocus(true, onClose);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" tabIndex={-1} className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b p-4"><div><h2 id="audit-detail-title" className="font-bold">{AUDIT_ACTION_LABELS[entry.action] || entry.action}</h2><p className="mt-1 text-xs text-slate-500">{timestamp(entry.createdAt)} · {entry.actorName} ({entry.actorUsername})</p></div><button type="button" aria-label="Đóng chi tiết nhật ký" onClick={onClose} className="rounded-lg border p-2"><X className="h-5 w-5" /></button></div>
      <div className="min-h-0 overflow-y-auto p-4 text-sm space-y-4">
        {entry.metadata.passwordChanged && <p className="rounded-lg bg-teal-50 p-3 text-teal-900">Đã thay đổi mật khẩu. Nhật ký không lưu mật khẩu hoặc giá trị băm.</p>}
        {!entry.details.length && <p className="text-slate-500">Thao tác đã được ghi nhận, không có thay đổi dữ liệu nghiệp vụ.</p>}
        {entry.details.map((detail, index) => {
          const keys = [...new Set([...Object.keys(detail.before), ...Object.keys(detail.after)])].filter(key => JSON.stringify(detail.before[key]) !== JSON.stringify(detail.after[key]));
          return <section key={`${detail.collection}-${detail.id}-${index}`} className="overflow-hidden rounded-xl border border-slate-200">
            <h3 className="bg-slate-50 px-3 py-2 font-semibold">{AUDIT_COLLECTION_LABELS[detail.collection] || detail.collection} · {detail.reference || detail.id} · {detail.kind === 'CREATED' ? 'Thêm mới' : detail.kind === 'DELETED' ? 'Xóa' : 'Cập nhật'}</h3>
            {keys.length ? <div className="overflow-x-auto"><table className="w-full min-w-[450px] text-left text-xs"><thead className="text-slate-500"><tr><th className="p-3">Nội dung</th><th className="p-3">Trước</th><th className="p-3">Sau</th></tr></thead><tbody>{keys.map(key => <tr key={key} className="border-t border-slate-100 align-top"><th className="p-3 font-medium">{fieldLabels[key] || key}</th><td className="max-w-[240px] whitespace-pre-wrap break-words p-3 text-slate-500">{displayValue(detail.before[key],key)}</td><td className="max-w-[240px] whitespace-pre-wrap break-words p-3 text-teal-900">{displayValue(detail.after[key],key)}</td></tr>)}</tbody></table></div> : <p className="p-3 text-xs text-slate-500">Đã cập nhật thông tin. Nội dung cá nhân và ghi chú không được sao chép vào nhật ký.</p>}
          </section>;
        })}
        {Object.values(entry.metadata.counts || {}).reduce((sum, amount) => sum + amount, 0) > entry.details.length && <p className="text-xs text-amber-800">Nhật ký lưu chi tiết tối đa 100 bản ghi mỗi thao tác; số lượng thay đổi tổng vẫn được ghi nhận.</p>}
        <p className="break-all text-xs text-slate-400">Mã nhật ký: {entry.id}{entry.revision !== undefined && entry.revision !== null ? ` · Phiên bản dữ liệu: ${entry.revision}` : ''}</p>
      </div>
    </div>
  </div>;
}

export function AuditLogsView() {
  const { isAdmin } = useAccess();
  const [actorId, setActorId] = useState('');
  const [operation, setOperation] = useState('');
  const [fromDate, setFromDate] = useState(() => localDate(new Date(dateTime(localDate(),'00:00') - 7 * 86400000)));
  const [toDate, setToDate] = useState(localDate);
  const [page, setPage] = useState<AuditPage>({ entries: [], actors: [], actions: [], nextCursor: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditEntry>();
  const request = useRef(0);
  const load = useCallback(async (beforeId?: string) => {
    const id = ++request.current;
    setBusy(true); setError('');
    if (!beforeId) setPage(previous => ({ ...previous, entries: [], nextCursor: null }));
    try {
      const result = await loadAuditPage({ ...(actorId ? { actorId } : {}), ...(operation ? { operation } : {}), ...(fromDate ? { fromDate } : {}), ...(toDate ? { toDate } : {}), ...(beforeId ? { beforeId } : {}) });
      if (id !== request.current) return;
      setPage(previous => ({ ...result, entries: beforeId ? [...previous.entries, ...result.entries] : result.entries }));
    } catch (err) { if (id === request.current) setError(err instanceof Error ? err.message : 'Không tải được nhật ký.'); }
    finally { if (id === request.current) setBusy(false); }
  }, [actorId, operation, fromDate, toDate]);
  useEffect(() => { if (isAdmin) void load(); return () => { request.current++; }; }, [load, isAdmin]);
  if (!isAdmin) return <p role="alert">Chỉ quản lý được xem nhật ký hệ thống.</p>;
  const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm';
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-teal-950 p-4 text-white sm:p-6">
      <div><h1 className="flex items-center gap-2 text-lg font-bold"><ClipboardList className="h-5 w-5" />Nhật ký hệ thống</h1><p className="mt-2 text-sm text-teal-100">Theo dõi người thực hiện và các thay đổi đã lưu thành công.</p></div>
      <button type="button" onClick={() => void load()} disabled={busy} className="flex items-center gap-2 rounded-lg border border-teal-700 px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Tải lại</button>
    </div>
    <p className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">{cloudEnabled ? 'Nhật ký được máy chủ ghi cùng giao dịch, giữ lại khi tài khoản bị xóa. Chỉ quản lý được xem; không có thao tác sửa hoặc xóa nhật ký.' : 'Chế độ cục bộ: theo dõi thao tác dữ liệu trong trình duyệt này. Nhật ký đăng nhập và quản lý tài khoản tập trung có ở bản Supabase.'} Nhật ký bắt đầu từ khi bật tính năng, không tạo lại lịch sử trước đó.</p>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-semibold">Người thực hiện<select aria-label="Lọc người thực hiện" value={actorId} onChange={event => setActorId(event.target.value)} className={input}><option value="">Tất cả người thực hiện</option>{page.actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name} · {actor.username}</option>)}</select></label>
      <label className="text-xs font-semibold">Loại thao tác<select aria-label="Lọc loại thao tác" value={operation} onChange={event => setOperation(event.target.value)} className={input}><option value="">Tất cả thao tác</option>{page.actions.map(action => <option key={action} value={action}>{AUDIT_ACTION_LABELS[action] || action}</option>)}</select></label>
      <label className="text-xs font-semibold">Từ ngày<input aria-label="Nhật ký từ ngày" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className={input} /></label>
      <label className="text-xs font-semibold">Đến ngày<input aria-label="Nhật ký đến ngày" type="date" value={toDate} onChange={event => setToDate(event.target.value)} className={input} /></label>
    </div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b bg-slate-50 px-4 py-3 text-xs text-slate-600">Đang hiển thị {page.entries.length} thao tác · Mới nhất trước · Giờ Việt Nam</div>
      {!page.entries.length && !busy && !error && <div className="flex flex-col items-center gap-2 p-8 text-sm text-slate-500"><Search className="h-7 w-7" />Không có nhật ký phù hợp với bộ lọc.</div>}
      <div className="divide-y divide-slate-100">{page.entries.map(entry => <article key={entry.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="w-40 shrink-0 text-xs text-slate-500">{timestamp(entry.createdAt)}<span className="mt-1 block text-[10px]">{entry.actorRole === 'ADMIN' ? 'Quản lý' : entry.actorRole === 'RECEPTION' ? 'Lễ tân' : 'Hệ thống'}</span></div>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{AUDIT_ACTION_LABELS[entry.action] || entry.action}</p><p className="mt-1 break-words text-xs text-teal-800">{entry.actorName} · {entry.actorUsername}</p><p className="mt-1 break-words text-xs text-slate-500">{entry.details.slice(0,3).map(detail => `${AUDIT_COLLECTION_LABELS[detail.collection] || detail.collection}: ${detail.reference || detail.id}`).join(' · ')}{entry.details.length > 3 ? '…' : ''}</p></div>
        <button type="button" onClick={() => setSelected(entry)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-teal-800">Xem chi tiết</button>
      </article>)}</div>
      {busy && <p role="status" className="p-4 text-sm text-teal-800">Đang tải nhật ký…</p>}
      {page.nextCursor && <div className="border-t p-3 text-center"><button type="button" disabled={busy} onClick={() => void load(page.nextCursor!)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Tải thêm nhật ký</button></div>}
    </section>
    {selected && <AuditDetailDialog entry={selected} onClose={() => setSelected(undefined)} />}
  </div>;
}
