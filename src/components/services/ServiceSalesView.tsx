import { AccessGuard } from '../common/AccessGuard';
import { useAccess } from '../../context/AccessContext';
import { useState } from 'react';
import { Ticket, Plus, Trash2, Printer, Edit2 } from 'lucide-react';
import { useHotel } from '../../context/HotelContext';
import type { Invoice } from '../../types/hotel';
import { formatCurrency } from '../../utils/formatters';
import type { ServiceSaleInput } from '../../utils/serviceSale';
import { EditServiceSaleModal } from '../modals/EditServiceSaleModal';

export function ServiceSalesView({ onPrint }: { onPrint: (invoice: Invoice) => void }) {
  const { canAct } = useAccess();
  const { services, invoices, sellServices, cancelServiceSale, requestConfirm, showToast, today } = useHotel();
  const [serviceId, setServiceId] = useState(() => services.find(s => s.category === 'MASSAGE')?.id || services[0]?.id || '');
  const [items, setItems] = useState<ServiceSaleInput['items']>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState<number | null>(null);
  const [method, setMethod] = useState<ServiceSaleInput['paymentMethod']>('CASH');
  const [dueDate, setDueDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [lastInvoice, setLastInvoice] = useState<Invoice>();
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const subtotal = items.reduce((sum, item) => sum + (services.find(s => s.id === item.serviceId)?.price || 0) * item.quantity, 0);
  const total = Math.max(0, subtotal - discount), amount = paid ?? total;
  const inputClass = 'w-full min-w-0 mt-1 px-3 py-2 border border-slate-300 rounded-lg bg-white';
  const add = () => {
    if (!services.some(s => s.id === serviceId)) return;
    setItems(prev => prev.some(i => i.serviceId === serviceId) ? prev.map(i => i.serviceId === serviceId ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { serviceId, quantity: 1 }]);
  };
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (busy) return;
    setBusy(true);
    try {
      const invoice = await sellServices({ customerName: name, phone, items, discount, paidAmount: amount, paymentMethod: method, dueDate, notes });
      setLastInvoice(invoice); setItems([]); setDiscount(0); setPaid(null); setName(''); setPhone(''); setNotes('');
      showToast(`Đã bán vé / dịch vụ và lưu phiếu thu ${invoice.code}.`, 'success');
    } catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được phiếu thu.'); } finally { setBusy(false); }
  };

  const handleDeleteInvoice = (inv: Invoice) => {
    requestConfirm({
      title: `Hủy phiếu vé ${inv.code}?`,
      message: `Bạn có chắc muốn xóa / hủy phiếu vé này do nhập sai nội dung? Toàn bộ doanh thu và công nợ của phiếu vé sẽ được hủy bỏ.`,
      confirmLabel: 'Xác nhận xóa vé',
      cancelLabel: 'Quay lại',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await cancelServiceSale(inv.id);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Không thể xóa phiếu vé.', 'error');
        }
      },
    });
  };

  const sales = invoices.filter(i => i.kind === 'SERVICE');
  return <div className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-r from-teal-900 to-slate-900 text-white p-4 sm:p-6">
      <h1 className="text-lg font-bold flex gap-2 items-center"><Ticket className="w-5 h-5" />Bán vé / dịch vụ khách ngoài</h1>
      <p className="mt-2 text-sm text-teal-100">Khách mua vé massage hoặc dịch vụ lẻ. Phiếu thu được tính vào doanh thu dịch vụ, không giữ phòng.</p>
    </div>
    {!canAct('sale.create') && <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">Bạn có quyền xem phiếu thu khách ngoài. Liên hệ quản lý nếu cần quyền bán vé hoặc tạo phiếu thu.</p>}
    <AccessGuard action="sale.create"><form onSubmit={submit} className="rounded-2xl border border-teal-200 bg-white p-4 sm:p-6 text-sm space-y-4">
      {error && <p role="alert" className="bg-rose-50 p-3 rounded-lg text-rose-700">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        <label>Tên khách<input aria-label="Tên khách mua lẻ" value={name} onChange={e => setName(e.target.value)} placeholder="Để trống: Khách lẻ" className={inputClass} /></label>
        <label>Số điện thoại<input aria-label="Điện thoại khách mua lẻ" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} /></label>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <label className="flex-1 min-w-0">Vé / dịch vụ<select aria-label="Vé dịch vụ bán lẻ" className={inputClass} value={serviceId} onChange={e => setServiceId(e.target.value)}>{services.map(s => <option key={s.id} value={s.id}>{s.name} · {formatCurrency(s.price)}/{s.unit}</option>)}</select></label>
        <button type="button" onClick={add} disabled={!services.length} className="bg-teal-700 text-white px-4 py-2 rounded-lg flex justify-center items-center gap-1"><Plus className="w-4 h-4" />Thêm vào phiếu thu</button>
      </div>
      <div className="space-y-2">
        {items.map(item => { const s = services.find(s => s.id === item.serviceId); return <div key={item.serviceId} className="rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[120px]"><strong>{s?.name || 'Dịch vụ đã xóa'}</strong><p className="text-slate-500 text-xs mt-1">{formatCurrency(s?.price || 0)} / {s?.unit}</p></div>
          <input aria-label={`Số lượng ${s?.name}`} type="number" min="1" step="1" required value={item.quantity} onChange={e => setItems(prev => prev.map(i => i.serviceId === item.serviceId ? { ...i, quantity: Number(e.target.value) } : i))} className="w-16 border rounded-lg p-2" />
          <span className="font-mono font-semibold">{formatCurrency((s?.price || 0) * item.quantity)}</span>
          <button type="button" aria-label={`Xóa ${s?.name} khỏi phiếu thu`} onClick={() => setItems(prev => prev.filter(i => i.serviceId !== item.serviceId))} className="p-2 text-rose-600"><Trash2 className="w-4 h-4" /></button>
        </div>; })}
        {!items.length && <p className="text-slate-500 py-2">Thêm vé / dịch vụ để tạo phiếu thu.</p>}
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label>Giảm giá (VNĐ)<input aria-label="Giảm giá bán lẻ" type="number" min="0" max={subtotal} step="1" required value={discount} onChange={e => setDiscount(Number(e.target.value))} className={inputClass} /></label>
        <label>Đã thu (VNĐ)<input aria-label="Tiền đã thu bán lẻ" type="number" min="0" max={total} step="1" required value={amount} onChange={e => setPaid(Number(e.target.value))} className={inputClass} /></label>
        <label>Phương thức<select aria-label="Thanh toán bán lẻ" value={method} onChange={e => setMethod(e.target.value as ServiceSaleInput['paymentMethod'])} className={inputClass}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option><option value="CARD">Thẻ</option></select></label>
      </div>
      {amount < total && <div className="rounded-xl bg-amber-50 p-3 space-y-2"><p className="text-amber-900">Ghi nợ {formatCurrency(total - amount)}. Cần tên và số điện thoại khách.</p><label>Ngày hẹn thu nợ<input type="date" min={today} required value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} /></label></div>}
      <label className="block">Ghi chú<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputClass} /></label>
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center pt-3 border-t"><strong className="text-teal-900">Cần thanh toán: {formatCurrency(total)}</strong><button type="submit" disabled={busy || !items.length} className="px-4 py-3 rounded-xl bg-teal-700 text-white font-bold disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu phiếu thu bán lẻ'}</button></div>
    </form></AccessGuard>
    {lastInvoice && <div role="status" className="rounded-xl bg-teal-50 border border-teal-200 p-3 flex flex-wrap items-center justify-between gap-2"><span>Đã lưu {lastInvoice.code} · {formatCurrency(lastInvoice.totalAmount)}</span><button type="button" onClick={() => onPrint(lastInvoice)} className="flex items-center gap-2 font-semibold text-teal-800"><Printer className="w-4 h-4" />Xem / In phiếu thu</button></div>}
    <section className="bg-white rounded-xl border p-4 space-y-3">
      <h2 className="font-bold text-slate-800">Phiếu thu khách ngoài ({sales.length})</h2>
      {sales.slice(0, 30).map(i => {
        const isCancelled = i.status === 'CANCELLED';
        return (
          <div key={i.id} className={`p-3 border rounded-xl flex flex-wrap items-center justify-between gap-2 text-sm ${isCancelled ? 'bg-slate-50 border-dashed border-slate-300 opacity-70' : 'bg-white hover:border-teal-200'}`}>
            <div className="min-w-[180px]">
              <div className="flex items-center gap-2">
                <strong className={isCancelled ? 'line-through text-slate-500' : 'text-slate-900'}>{i.code}</strong>
                {isCancelled && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">ĐÃ HỦY</span>}
                <span className="text-slate-700">· {i.customerName || 'Khách lẻ'}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {i.time} {i.date} {i.customerPhone && `· ${i.customerPhone}`}
                <span className="ml-2 font-medium">
                  {isCancelled ? 'Vé đã hủy bỏ' : i.status === 'PAID' ? '· Đã thanh toán' : `· Còn nợ ${formatCurrency(i.debtAmount)}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono font-bold ${isCancelled ? 'line-through text-slate-400' : 'text-teal-800'}`}>
                {formatCurrency(i.totalAmount)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onPrint(i)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs flex items-center gap-1"
                  title="Xem / In phiếu thu"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">In</span>
                </button>
                {!isCancelled && (
                  <AccessGuard action="sale.create">
                    <button
                      type="button"
                      onClick={() => setEditingInvoice(i)}
                      className="p-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs flex items-center gap-1 font-semibold"
                      title="Sửa nội dung vé"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteInvoice(i)}
                      className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs flex items-center gap-1"
                      title="Hủy / Xóa vé sai nội dung"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </AccessGuard>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>

    {/* Modal Sửa vé */}
    {editingInvoice && (
      <EditServiceSaleModal
        invoice={editingInvoice}
        onClose={() => setEditingInvoice(null)}
      />
    )}
  </div>;
}

