import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Eye, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, Save, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useAccess } from '../../context/AccessContext';
import { useHotel } from '../../context/HotelContext';
import { ACTION_IDS, MODULE_IDS, type ActionId, type ModuleId, type StaffAccount, type StaffAccountInput, type StaffPermissions } from '../../types/access';
import { ACTION_LABELS, ACTION_VIEWS, DEFAULT_STAFF_PERMISSIONS, MODULE_LABELS } from '../../utils/permissions';

const staffActions = ACTION_IDS.filter(action => action !== 'data.restore');
const copyPermissions = (permissions: StaffPermissions): StaffPermissions => ({ views: [...permissions.views], actions: [...permissions.actions] });
const newAccount = (): StaffAccountInput => ({ username: '', displayName: '', password: '', active: true, permissions: copyPermissions(DEFAULT_STAFF_PERMISSIONS) });
const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-50 disabled:opacity-50';

export function StaffAccessManager() {
  const { isAdmin } = useAccess();
  if (!isAdmin) return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Chỉ quản lý được cấp quyền cho lễ tân.</div>;
  return <StaffAccessEditor />;
}

export default StaffAccessManager;

function StaffAccessEditor() {
  const { listStaffAccounts, saveStaffAccount } = useAccess();
  const { requestConfirm } = useHotel();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [form, setForm] = useState<StaffAccountInput>(newAccount);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const saving = useRef(false);
  const refreshSequence = useRef(0);
  const formHeading = useRef<HTMLHeadingElement>(null);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    setLoading(true);
    try {
      const next = await listStaffAccounts();
      if (sequence === refreshSequence.current) { setAccounts(next); setError(''); }
    } catch (failure) {
      if (sequence === refreshSequence.current) setError(failure instanceof Error ? failure.message : 'Chưa tải được danh sách lễ tân.');
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [listStaffAccounts]);

  useEffect(() => { void refresh(); return () => { refreshSequence.current += 1; }; }, [refresh]);

  const clearMessages = () => { setError(''); setSuccess(''); };
  const edit = (account: StaffAccount) => {
    if (saving.current) return;
    setForm({ id: account.id, expectedVersion: account.version, username: account.username, displayName: account.displayName, password: '', active: account.active, permissions: copyPermissions(account.permissions) });
    clearMessages();
    formHeading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const create = () => {
    if (saving.current) return;
    setForm(newAccount()); clearMessages();
    formHeading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleView = (module: ModuleId) => {
    setForm(previous => {
      const views = previous.permissions.views.includes(module)
        ? previous.permissions.views.filter(view => view !== module)
        : [...previous.permissions.views, module];
      const actions = previous.permissions.actions.filter(action => ACTION_VIEWS[action].some(view => views.includes(view)));
      return { ...previous, permissions: { views, actions } };
    });
    clearMessages();
  };
  const toggleAction = (action: ActionId) => {
    setForm(previous => ({ ...previous, permissions: { ...previous.permissions, actions: previous.permissions.actions.includes(action)
      ? previous.permissions.actions.filter(item => item !== action)
      : [...previous.permissions.actions, action] } }));
    clearMessages();
  };

  const persist = async (input: StaffAccountInput) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); clearMessages();
    try {
      const account = await saveStaffAccount(input);
      setAccounts(previous => [...previous.filter(item => item.id !== account.id), account]);
      setForm({ id: account.id, expectedVersion: account.version, username: account.username, displayName: account.displayName, password: '', active: account.active, permissions: copyPermissions(account.permissions) });
      setSuccess(account.active ? 'Đã lưu tài khoản và quyền của lễ tân.' : 'Đã khóa truy cập. Dữ liệu nghiệp vụ của khách sạn vẫn được giữ nguyên.');
      // Refresh the list so changes from another management session are visible.
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa lưu được tài khoản. Vui lòng thử lại.');
    } finally { saving.current = false; setBusy(false); }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving.current) return;
    clearMessages();
    if (!form.permissions.views.length) { setError('Chọn ít nhất một mục lễ tân được xem.'); return; }
    const input = { ...form, username: form.username.trim(), displayName: form.displayName.trim(), permissions: copyPermissions(form.permissions) };
    if (!input.password) delete input.password;
    const current = accounts.find(account => account.id === input.id);
    if (current?.active && !input.active) {
      requestConfirm({ title: 'Khóa tài khoản lễ tân?', message: `${current.displayName} sẽ không thể đăng nhập và các phiên đang dùng sẽ hết hiệu lực. Đặt phòng, hóa đơn và công nợ vẫn được giữ nguyên.`, confirmLabel: 'Khóa và lưu', isDangerous: true, onConfirm: () => persist(input) });
    } else void persist(input);
  };

  return <section className="mx-auto w-full min-w-0 max-w-6xl space-y-5" aria-labelledby="staff-access-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-teal-700" /><h2 id="staff-access-title" className="text-lg font-bold text-slate-900">Phân quyền lễ tân</h2></div><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Tạo tài khoản riêng, chọn nội dung được xem và thao tác được phép thực hiện cho từng lễ tân.</p></div>
      <button type="button" disabled={busy} onClick={create} className="flex min-h-10 items-center gap-2 rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50"><Plus className="h-4 w-4" />Thêm lễ tân</button>
    </div>
    <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-xs leading-5 text-teal-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>Quyền xóa chỉ áp dụng với nội dung được phép xóa an toàn. Phòng và dịch vụ đã có dữ liệu liên quan được giữ lại; hóa đơn, lịch sử thanh toán và công nợ không bị xóa. Lễ tân không được cấp quyền khôi phục dữ liệu hoặc quản lý tài khoản.</p></div>
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(15rem,0.85fr)_minmax(0,2fr)]">
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Users className="h-4 w-4 text-teal-700" />Tài khoản ({accounts.length})</h3><button type="button" aria-label="Tải lại danh sách lễ tân" title="Tải lại danh sách" disabled={loading || busy} onClick={() => void refresh()} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
        <div className="max-h-96 overflow-y-auto p-3 lg:max-h-[36rem]">
          {loading && !accounts.length ? <p className="flex items-center gap-2 p-3 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Đang tải tài khoản…</p> : !accounts.length ? <p className="p-3 text-xs leading-5 text-slate-500">Chưa có tài khoản lễ tân. Điền biểu mẫu bên dưới để tạo tài khoản đầu tiên.</p> : <div className="space-y-2">{accounts.map(account => <button type="button" key={account.id} disabled={busy} onClick={() => edit(account)} aria-label={`Sửa quyền ${account.displayName}`} aria-pressed={form.id === account.id} className={`w-full min-w-0 rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${form.id === account.id ? 'border-teal-400 bg-teal-50' : 'border-slate-100 hover:border-teal-200 hover:bg-slate-50'}`}>
            <div className="flex min-w-0 items-start gap-2.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800"><UserRound className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{account.displayName}</p><p className="mt-1 truncate text-[11px] text-slate-500">{account.username}</p></div><Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" /></div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]"><span className={`rounded-full px-2 py-1 font-semibold ${account.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{account.active ? 'Đang hoạt động' : 'Đã khóa'}</span><span className="text-slate-500">{account.permissions.views.length} mục xem · {account.permissions.actions.length} thao tác</span></div>
          </button>)}</div>}
        </div>
      </div>
      <form onSubmit={submit} aria-label="Cấp quyền tài khoản lễ tân" className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h3 ref={formHeading} className="scroll-mt-20 text-sm font-semibold text-slate-900">{form.id ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản lễ tân'}</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">Tài khoản này luôn có vai trò lễ tân. Mật khẩu hiện tại không được hiển thị.</p></div>
        <fieldset disabled={busy} className="min-w-0 space-y-6 p-4 sm:p-5">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-xs font-semibold text-slate-700">Tên lễ tân <span className="text-rose-500">*</span><input aria-label="Tên lễ tân" autoComplete="name" required maxLength={80} value={form.displayName} onChange={event => { setForm(previous => ({ ...previous, displayName: event.target.value })); clearMessages(); }} placeholder="Ví dụ: Nguyễn Thị Hoa" className={`${inputClass} mt-2`} /></label>
            <label className="min-w-0 text-xs font-semibold text-slate-700">Tên đăng nhập <span className="text-rose-500">*</span><input aria-label="Tên đăng nhập lễ tân" autoComplete="off" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={40} value={form.username} onChange={event => { setForm(previous => ({ ...previous, username: event.target.value })); clearMessages(); }} placeholder="Ví dụ: letan.hoa" className={`${inputClass} mt-2`} /><span className="mt-1.5 block text-[11px] font-normal leading-5 text-slate-500">3–40 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.</span></label>
            <label className="min-w-0 text-xs font-semibold text-slate-700 sm:col-span-2"><span className="inline-flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />{form.id ? 'Mật khẩu mới (nếu cần đổi)' : 'Mật khẩu đăng nhập'}{!form.id && <span className="text-rose-500">*</span>}</span><input aria-label="Mật khẩu lễ tân" type="password" autoComplete="new-password" required={!form.id} minLength={8} maxLength={128} value={form.password || ''} onChange={event => { setForm(previous => ({ ...previous, password: event.target.value })); clearMessages(); }} placeholder={form.id ? 'Để trống để giữ mật khẩu hiện tại' : 'Nhập mật khẩu riêng cho lễ tân'} className={`${inputClass} mt-2`} /><span className="mt-1.5 block text-[11px] font-normal leading-5 text-slate-500">8–128 ký tự, không có khoảng trắng ở đầu hoặc cuối.</span></label>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Chọn nhanh quyền truy cập</p>
            <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => { setForm(previous => ({ ...previous, permissions: copyPermissions(DEFAULT_STAFF_PERMISSIONS) })); clearMessages(); }} className="flex min-h-10 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100"><ShieldCheck className="h-4 w-4" />Lễ tân nghiệp vụ</button><button type="button" onClick={() => { setForm(previous => ({ ...previous, permissions: { views: previous.permissions.views.length ? [...previous.permissions.views] : [...DEFAULT_STAFF_PERMISSIONS.views], actions: [] } })); clearMessages(); }} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"><Eye className="h-4 w-4" />Chỉ xem</button></div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">Có thể chọn lại từng mục bên dưới trước khi lưu.</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-800">1. Nội dung được xem</h4>
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">{MODULE_IDS.map(module => <label key={module} className={`flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-xs ${form.permissions.views.includes(module) ? 'border-teal-200 bg-teal-50 text-teal-900' : 'border-slate-200 text-slate-600'}`}><input type="checkbox" checked={form.permissions.views.includes(module)} onChange={() => toggleView(module)} className="h-4 w-4 shrink-0 accent-teal-700" /><span className="min-w-0 leading-5">{MODULE_LABELS[module]}</span></label>)}</div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-800">2. Thao tác được phép</h4><p className="mt-1 text-[11px] leading-5 text-slate-500">Chọn quyền xem mục tương ứng trước. Bỏ quyền xem sẽ bỏ các thao tác không còn sử dụng được.</p>
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">{staffActions.map(action => {
              const available = ACTION_VIEWS[action].some(view => form.permissions.views.includes(view));
              const selected = form.permissions.actions.includes(action);
              return <label key={action} className={`flex min-w-0 items-start gap-2.5 rounded-xl border p-3 text-xs ${!available ? 'border-slate-100 bg-slate-50 text-slate-400' : selected ? 'cursor-pointer border-teal-200 bg-teal-50 text-teal-900' : 'cursor-pointer border-slate-200 text-slate-600'}`}><input type="checkbox" disabled={!available || busy} checked={selected && available} onChange={() => toggleAction(action)} className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700" /><span className="min-w-0 leading-5">{ACTION_LABELS[action]}{!available && <span className="mt-1 block text-[10px]">Cần quyền xem: {ACTION_VIEWS[action].map(view => MODULE_LABELS[view]).join(' hoặc ')}.</span>}</span></label>;
            })}</div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><input type="checkbox" checked={form.active} onChange={event => { setForm(previous => ({ ...previous, active: event.target.checked })); clearMessages(); }} className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700" /><span className="min-w-0 text-xs font-semibold leading-5 text-slate-700">Cho phép đăng nhập<span className="mt-1 block text-[11px] font-normal text-slate-500">Bỏ chọn để khóa tài khoản. Dữ liệu nghiệp vụ vẫn được giữ nguyên.</span></span></label>
        </fieldset>
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
          {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
          {success && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] leading-5 text-slate-500">{form.permissions.views.length} mục xem · {form.permissions.actions.length} thao tác được cấp</p><button type="submit" disabled={busy || loading} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Đang lưu…' : 'Lưu tài khoản và quyền'}</button></div>
          {form.id && <p className="text-[11px] leading-5 text-slate-500">Sau khi cập nhật quyền hoặc mật khẩu, lễ tân cần đăng nhập lại để áp dụng.</p>}
        </div>
      </form>
    </div>
  </section>;
}
