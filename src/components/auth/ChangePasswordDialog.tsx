import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Eye, EyeOff, KeyRound, LoaderCircle, X } from 'lucide-react';
import { HotelLogo } from '../common/HotelLogo';
import { PasswordChangeError, type PasswordErrorField } from '../../utils/authSession';
import { changeSystemPassword } from '../../utils/systemAuth';
import { cloudEnabled } from '../../utils/cloudHotel';

const fields = [
  { key: 'current', id: 'current-password', label: 'Mật khẩu hiện tại', autoComplete: 'current-password' },
  { key: 'new', id: 'new-password', label: 'Mật khẩu mới', autoComplete: 'new-password' },
  { key: 'confirmation', id: 'confirm-password', label: 'Nhập lại mật khẩu mới', autoComplete: 'new-password' },
] as const;

export default function ChangePasswordDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [passwords, setPasswords] = useState({ current: '', new: '', confirmation: '' });
  const [visible, setVisible] = useState({ current: false, new: false, confirmation: false });
  const [error, setError] = useState<{ message: string; field: PasswordErrorField } | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const dismiss = () => { if (!submitting.current) onClose(); };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting.current) { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)') || []);
      const first = controls[0], last = controls.at(-1);
      if (!controls.length) { event.preventDefault(); dialog.current?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyDown);
      if (previous && previous.getBoundingClientRect().left >= 0 && previous.isConnected) previous.focus();
      else document.querySelector<HTMLButtonElement>('button[aria-label="Ẩn hiện menu"]')?.focus();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await changeSystemPassword(passwords.current, passwords.new, passwords.confirmation);
      setPasswords({ current: '', new: '', confirmation: '' });
      onChanged();
    } catch (failure) {
      const nextError = failure instanceof PasswordChangeError ? failure : new PasswordChangeError('Chưa đổi được mật khẩu. Vui lòng thử lại.');
      setError({ message: nextError.message, field: nextError.field });
      const field = fields.find(item => item.key === nextError.field);
      if (field) {
        const input = dialog.current?.querySelector<HTMLInputElement>(`#${field.id}`);
        // Inputs are enabled again before focus/select runs.
        requestAnimationFrame(() => { input?.focus(); input?.select(); });
      }
    } finally { submitting.current = false; setBusy(false); }
  };

  return createPortal(<div className="no-print fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs" onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="change-password-title" tabIndex={-1} className="w-full min-w-0 max-w-md max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl bg-white text-slate-900 shadow-2xl border border-teal-200 overflow-hidden outline-none">
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100"><div className="flex items-center gap-3"><HotelLogo size="md" /><div><h2 id="change-password-title" className="text-base font-bold">Đổi mật khẩu</h2><p className="mt-1 text-[11px] text-teal-700">Hệ thống Hotel Sơn Ngọc</p></div></div><button type="button" aria-label="Đóng đổi mật khẩu" disabled={busy} onClick={dismiss} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X className="w-5 h-5" /></button></div>
      <form aria-label="Đổi mật khẩu hệ thống" onSubmit={submit} noValidate className="min-h-0 flex flex-col">
        <div className="min-h-0 overflow-y-auto p-5 space-y-5">
          <p className="text-xs leading-5 text-slate-500">Nhập mật khẩu hiện tại để xác nhận. Sau khi lưu, bạn sẽ đăng nhập lại bằng mật khẩu mới.</p>
          {fields.map(field => <div key={field.key}>
            <label htmlFor={field.id} className="block mb-2 text-xs font-semibold text-slate-700">{field.label}</label>
            <div className={`flex items-center gap-2 px-3 rounded-xl border bg-slate-50 focus-within:ring-4 ${error?.field === field.key ? 'border-rose-400 focus-within:ring-rose-100' : 'border-slate-200 focus-within:border-teal-600 focus-within:ring-teal-100'}`}>
              <KeyRound className="w-4 h-4 shrink-0 text-slate-400" /><input id={field.id} name={field.id} type={visible[field.key] ? 'text' : 'password'} autoComplete={field.autoComplete} required maxLength={128} disabled={busy} value={passwords[field.key]} onChange={event => { setPasswords(previous => ({ ...previous, [field.key]: event.target.value })); setError(null); }} aria-invalid={error?.field === field.key} aria-describedby={[field.key === 'new' ? 'new-password-rules' : '', error?.field === field.key ? 'change-password-error' : ''].filter(Boolean).join(' ') || undefined} className="w-full min-w-0 flex-1 h-12 text-base bg-transparent outline-none" />
              <button type="button" disabled={busy} aria-label={`${visible[field.key] ? 'Ẩn' : 'Hiện'} ${field.label.toLowerCase()}`} aria-pressed={visible[field.key]} onClick={() => setVisible(previous => ({ ...previous, [field.key]: !previous[field.key] }))} className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 focus-visible:outline-2 focus-visible:outline-teal-600">{visible[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
            {field.key === 'new' && <p id="new-password-rules" className="mt-2 text-[11px] leading-5 text-slate-500">8–128 ký tự, khác mật khẩu hiện tại. Không có khoảng trắng ở đầu hoặc cuối.</p>}
          </div>)}
          {error && <p id="change-password-error" role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs leading-5 text-rose-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error.message}</p>}
          <p className="text-[11px] leading-5 text-slate-500">{cloudEnabled ? 'Mật khẩu mới áp dụng trên tất cả thiết bị. Các phiên đăng nhập cũ sẽ hết hiệu lực.' : 'Mật khẩu mới áp dụng trên trình duyệt/thiết bị đang dùng. Các cửa sổ cùng trình duyệt sẽ cần đăng nhập lại.'}</p>
        </div>
        <div className="shrink-0 grid grid-cols-[1fr_1.6fr] gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60"><button type="button" disabled={busy} onClick={dismiss} className="min-h-11 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Hủy</button><button type="submit" disabled={busy} className="min-h-11 flex items-center justify-center gap-2 px-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-xs font-semibold text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{busy ? <><LoaderCircle className="w-4 h-4 animate-spin" />Đang lưu…</> : <><Check className="w-4 h-4" />Lưu mật khẩu</>}</button></div>
      </form>
    </div>
  </div>, document.body);
}
