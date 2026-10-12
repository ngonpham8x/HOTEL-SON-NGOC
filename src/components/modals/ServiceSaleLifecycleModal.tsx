import { useState } from 'react';
import type { Invoice } from '../../types/hotel';
import { useHotel } from '../../context/HotelContext';
import { useAccess } from '../../context/AccessContext';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { applySaleEvent, pendingSaleRefund, saleQuantities, type SaleEventInput } from '../../utils/serviceSaleLifecycle';
import { localDate, localTime } from '../../utils/hotelLogic';
import { formatCurrency, getPaymentMethodName } from '../../utils/formatters';

export function ServiceSaleLifecycleModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { processServiceSale } = useHotel();
  const { actor, isAdmin, canAct } = useAccess();
  const modes: ('USE' | 'CANCEL' | 'REFUND')[] = [
    ...(canAct('sale.create') && (isAdmin || invoice.createdBy === actor.id) ? ['USE' as const] : []),
    ...(canAct('sale.cancel') ? ['CANCEL' as const] : []),
    ...(canAct('sale.refund') ? ['REFUND' as const] : []),
  ];
  const [snapshot, setSnapshot] = useState(invoice);
  const [mode, setMode] = useState<'USE' | 'CANCEL' | 'REFUND'>(() => modes[0] || 'USE');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [fee, setFee] = useState(0);
  const [reason, setReason] = useState('');
  const [requestedBy, setRequestedBy] = useState<'CUSTOMER' | 'HOTEL'>('CUSTOMER');
  const [refund, setRefund] = useState(pendingSaleRefund(invoice));
  const [method, setMethod] = useState<'CASH' | 'TRANSFER' | 'CARD'>('CASH');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useDialogFocus(true, () => { if (!busy) onClose(); });
  const items = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([usageId, quantity]) => ({ usageId, quantity }));
  const input: SaleEventInput = mode === 'USE' ? { kind: mode, items } : mode === 'CANCEL' ? { kind: mode, items, fee, reason: reason.trim(), requestedBy } : { kind: mode, amount: refund, method, notes: reason.trim() };
  let preview: Invoice | undefined;
  let previewError = '';
  try { preview = applySaleEvent(snapshot, { ...input, id: 'preview', date: localDate(), time: localTime(), actorId: actor.id, actorName: actor.displayName }); }
  catch (err) { previewError = err instanceof Error ? err.message : 'Thông tin chưa hợp lệ.'; }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !preview || !modes.includes(mode)) return;
    setBusy(true); setError('');
    try {
      const next = await processServiceSale(snapshot.id, input, snapshot);
      setSnapshot(next); setQuantities({}); setFee(0); setReason(''); setRefund(pendingSaleRefund(next));
    } catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được thao tác.'); }
    finally { setBusy(false); }
  };
  const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="sale-lifecycle-title" tabIndex={-1} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b p-4">
        <div><h2 id="sale-lifecycle-title" className="font-bold text-teal-950">Sử dụng vé / Hủy / Hoàn tiền</h2><p className="mt-1 text-xs text-slate-500">{snapshot.code} · {snapshot.customerName}</p></div>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Đóng xử lý vé" className="rounded-lg border px-3 py-2">Đóng</button>
      </div>
      <form onSubmit={submit} className="min-h-0 overflow-y-auto p-4 text-sm space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">Chờ hoàn: <strong>{formatCurrency(pendingSaleRefund(snapshot))}</strong>. Hủy vé chưa có nghĩa đã hoàn tiền cho khách.</div>
        <fieldset disabled={busy} className="space-y-4">
          <div className="flex flex-wrap gap-2" aria-label="Loại xử lý vé">{modes.map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setError(''); setRefund(pendingSaleRefund(snapshot)); }} className={`rounded-lg px-3 py-2 font-semibold ${mode === value ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{value === 'USE' ? 'Ghi nhận đã dùng' : value === 'CANCEL' ? 'Hủy vé chưa dùng' : 'Ghi nhận hoàn tiền'}</button>)}</div>
          {!snapshot.serviceLifecycle && <p className="text-xs text-slate-600">Phiếu chưa ghi nhận số vé đã dùng. Hãy ghi nhận phần khách đã sử dụng trước khi hủy phần còn lại.</p>}
          {mode !== 'REFUND' ? <>
            <div className="space-y-2">{snapshot.services?.map(usage => {
              const counts = saleQuantities(snapshot, usage.id);
              return <label key={usage.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                <span className="flex-1 min-w-[150px]"><strong>{usage.name}</strong><span className="block mt-1 text-xs text-slate-500">Đã mua {usage.quantity} · Đã dùng {counts.used} · Đã hủy {counts.cancelled} · Còn {counts.available}</span><span className="block text-xs text-slate-500">Giá lúc bán: {formatCurrency(usage.unitPrice)}</span></span>
                <span className="w-24 text-xs">{mode === 'USE' ? 'Số đã dùng' : 'Số hủy'}<input aria-label={`${mode === 'USE' ? 'Sử dụng' : 'Hủy'} ${usage.name}`} type="number" min={0} max={counts.available} step={1} required disabled={counts.available === 0} value={quantities[usage.id] || 0} onChange={event => setQuantities(old => ({ ...old, [usage.id]: Number(event.target.value) }))} className={field} /></span>
              </label>;
            })}</div>
            {mode === 'CANCEL' && <>
              <label className="block">Bên yêu cầu hủy<select value={requestedBy} onChange={event => { setRequestedBy(event.target.value as 'CUSTOMER' | 'HOTEL'); setFee(0); }} className={field}><option value="CUSTOMER">Khách đổi ý / yêu cầu hủy</option><option value="HOTEL">Khách sạn không cung cấp dịch vụ</option></select></label>
              <label className="block">Phí hủy giữ lại theo thỏa thuận (VNĐ)<input type="number" min={0} step={1} required disabled={requestedBy === 'HOTEL'} value={fee} onChange={event => setFee(Number(event.target.value))} className={field} /></label>
              <label className="block">Lý do hủy / thỏa thuận với khách<textarea required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} className={field} /></label>
              <p className="text-xs text-slate-500">Giảm giá được phân bổ theo giá trị vé. Tiền đã thu vượt số tiền còn phải trả sẽ chuyển thành tiền chờ hoàn; tiền chưa thu được giảm công nợ.</p>
            </>}
          </> : <>
            <p className="rounded-lg bg-rose-50 p-3 text-rose-800">Chỉ xác nhận sau khi đã trả tiền mặt hoặc chuyển tiền thành công cho khách.</p>
            <label className="block">Số tiền thực tế đã hoàn (VNĐ)<input type="number" min={1} max={pendingSaleRefund(snapshot)} step={1} required value={refund} onChange={event => setRefund(Number(event.target.value))} className={field} /></label>
            <label className="block">Phương thức hoàn<select value={method} onChange={event => setMethod(event.target.value as typeof method)} className={field}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option><option value="CARD">Hoàn qua thẻ</option></select></label>
            <label className="block">Ghi chú / mã giao dịch<textarea maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} className={field} /></label>
          </>}
          {preview && <div className="rounded-xl bg-teal-50 p-3 text-teal-950 space-y-1"><p>Số tiền phải trả sau xử lý: <strong>{formatCurrency(preview.totalAmount)}</strong></p><p>Công nợ còn lại: {formatCurrency(preview.debtAmount)}</p><p>Tiền chờ hoàn sau xử lý: <strong>{formatCurrency(pendingSaleRefund(preview))}</strong></p></div>}
          {!preview && <p role="status" className="text-amber-800">{mode !== 'REFUND' && snapshot.services?.every(usage => saleQuantities(snapshot, usage.id).available === 0) ? 'Tất cả vé đã được sử dụng hoặc hủy. Xem lịch sử xử lý bên dưới.' : previewError}</p>}
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
          <button type="submit" disabled={!preview || busy || !modes.includes(mode)} className="w-full rounded-xl bg-teal-700 p-3 font-bold text-white">{busy ? 'Đang lưu…' : mode === 'USE' ? 'Lưu số vé đã sử dụng' : mode === 'CANCEL' ? 'Xác nhận hủy các vé đã chọn' : 'Xác nhận đã hoàn tiền cho khách'}</button>
        </fieldset>
        <section className="border-t pt-4"><h3 className="font-bold">Lịch sử xử lý</h3>{!snapshot.serviceLifecycle?.events.length && <p className="mt-2 text-xs text-slate-500">Chưa có thao tác.</p>}
          {[...(snapshot.serviceLifecycle?.events || [])].reverse().map(event => <div key={event.id} className="mt-2 rounded-lg border p-3 text-xs space-y-1">
            <p className="font-semibold">{event.kind === 'USE' ? 'Ghi nhận sử dụng' : event.kind === 'CANCEL' ? 'Hủy vé' : 'Hoàn tiền'} · {event.date} {event.time} · {event.actorName}</p>
            {event.kind === 'REFUND' ? <p>{formatCurrency(event.amount)} · {getPaymentMethodName(event.method)} · {event.notes}</p> : <p>{event.items.map(item => `${snapshot.services?.find(usage => usage.id === item.usageId)?.name}: ${item.quantity}`).join(' · ')}</p>}
            {event.kind === 'CANCEL' && <p>{event.requestedBy === 'HOTEL' ? 'Khách sạn' : 'Khách'} yêu cầu · Phí giữ lại {formatCurrency(event.fee)} · {event.reason}</p>}
          </div>)}
        </section>
      </form>
    </div>
  </div>;
}
