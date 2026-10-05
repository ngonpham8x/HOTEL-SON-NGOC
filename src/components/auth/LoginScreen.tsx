import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, BedDouble, Eye, EyeOff, KeyRound, LoaderCircle, Phone, ReceiptText, ChartNoAxesCombined, AlertCircle } from 'lucide-react';
import { HotelLogo } from '../common/HotelLogo';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { loginSystem } from '../../utils/systemAuth';
import type { AccessActor } from '../../types/access';

const features = [
  { icon: BedDouble, title: 'Phòng & đặt phòng', detail: 'Nhận phòng, trả phòng, theo dõi lưu trú' },
  { icon: ReceiptText, title: 'Dịch vụ & thanh toán', detail: 'Giá phòng, dịch vụ và phiếu thu' },
  { icon: ChartNoAxesCombined, title: 'Báo cáo & công nợ', detail: 'Nắm doanh thu, quản lý khoản cần thu' },
];

export function LoginScreen({ onSuccess, notice }: { onSuccess: (actor: AccessActor) => void; notice?: string }) {
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'ADMIN' | 'RECEPTION'>('ADMIN');
  const [username, setUsername] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [capsLock, setCapsLock] = useState(false);
  const submitting = useRef(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const actor = await loginSystem(password, mode === 'RECEPTION' ? username : undefined);
      if (actor) {
        setPassword('');
        onSuccess(actor);
      } else {
        setError(mode === 'RECEPTION' ? 'Tên đăng nhập hoặc mật khẩu chưa đúng, hoặc tài khoản đã bị khóa.' : 'Mật khẩu chưa đúng. Vui lòng nhập lại.');
        passwordInput.current?.focus();
        passwordInput.current?.select();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Chưa thể đăng nhập. Vui lòng thử lại.');
    } finally { submitting.current = false; setBusy(false); }
  };

  return <main className="login-screen min-h-dvh bg-[#f3f6f4] text-slate-900 flex items-center justify-center px-3 sm:px-6 lg:px-8">
    <div className="w-full max-w-[480px] lg:max-w-[1080px] grid lg:grid-cols-[1.05fr_1fr] rounded-3xl bg-white border border-slate-100 shadow-[0_24px_80px_-24px_rgba(8,30,36,0.25)] overflow-hidden">
      <section className="login-brand relative hidden lg:flex flex-col justify-between bg-[#08272d] p-8 xl:p-10 text-white overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 w-80 h-80 rounded-full border-[45px] border-teal-200/5" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-24 -bottom-28 w-80 h-80 rounded-full border-[45px] border-amber-200/5" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-3"><HotelLogo size="xl" /><div><p className="font-bold text-xl tracking-tight">HOTEL SƠN NGỌC</p><p className="mt-1 text-[11px] tracking-[0.16em] uppercase text-amber-200/80">Khách sạn & Massage</p></div></div>
          <p className="mt-10 text-xs font-semibold tracking-[0.2em] text-teal-300 uppercase">Hệ thống quản lý</p>
          <h2 className="mt-3 text-[32px] xl:text-[34px] leading-[1.3] font-bold tracking-tight">Quản lý gọn gàng.<br />Vận hành thuận tiện.</h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-teal-100/70">Một nơi để theo dõi phòng, chăm sóc khách và nắm tình hình kinh doanh mỗi ngày.</p>
          <div className="mt-8 space-y-4">{features.map(({ icon: Icon, title, detail }) => <div key={title} className="flex items-center gap-3"><div className="w-10 h-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><Icon className="w-5 h-5 text-teal-300" /></div><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-teal-100/60">{detail}</p></div></div>)}</div>
        </div>
        <p className="relative mt-8 text-[11px] leading-5 text-teal-100/50">Số 70 Quốc lộ 20, xã Hòa Ninh, Lâm Đồng</p>
      </section>
      <section className="min-w-0 px-5 py-6 sm:p-8 lg:p-9 xl:p-10 flex flex-col justify-center">
        <div className="mx-auto w-full max-w-[380px]">
        <div className="lg:hidden flex items-center justify-center gap-3 mb-5"><HotelLogo size="lg" /><div className="min-w-0 text-left"><p className="font-bold text-lg leading-6 tracking-tight">HOTEL SƠN NGỌC</p><p className="text-[11px] leading-5 text-teal-700 mt-0.5">Hệ thống quản lý khách sạn</p></div></div>
        <div className="text-center lg:text-left">
          <span className="inline-flex rounded-full bg-teal-50 border border-teal-100 px-3 py-1 text-[10px] leading-5 font-semibold text-teal-800">Cổng quản trị Sơn Ngọc</span>
          <h1 className="mt-3 text-[25px] sm:text-[28px] font-bold tracking-tight leading-tight">Chào mừng trở lại</h1>
          <p className="mt-2 text-[13px] leading-6 text-slate-500">{mode === 'ADMIN' ? 'Nhập mật khẩu để vào hệ thống quản lý.' : 'Đăng nhập tài khoản lễ tân do quản lý cấp.'}</p>
        </div>
        {notice && <p role="status" className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs leading-5 text-teal-900 break-words">{notice}</p>}
        <form onSubmit={submit} className="mt-5 space-y-4" aria-label="Đăng nhập hệ thống">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" aria-label="Loại tài khoản">{(['ADMIN', 'RECEPTION'] as const).map(role => <button key={role} type="button" disabled={busy} aria-pressed={mode === role} onClick={() => { setMode(role); setPassword(''); setError(''); }} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${mode === role ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-500 hover:text-teal-800'}`}>{role === 'ADMIN' ? 'Quản lý' : 'Lễ tân'}</button>)}</div>
          {mode === 'RECEPTION' && <div><label htmlFor="login-username" className="block text-xs leading-5 font-semibold text-slate-700 mb-2">Tên đăng nhập lễ tân</label><input id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={40} disabled={busy} value={username} onChange={event => { setUsername(event.target.value); setError(''); }} placeholder="Tên do quản lý cấp" className="min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 h-12 px-3.5 text-base outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" /></div>}
          <div>
            <label htmlFor="login-password" className="block text-xs leading-5 font-semibold text-slate-700 mb-2">{mode === 'ADMIN' ? 'Mật khẩu hệ thống' : 'Mật khẩu lễ tân'}</label>
            <div className={`flex items-center gap-3 rounded-xl border bg-slate-50 px-3.5 focus-within:ring-4 transition-shadow ${error ? 'border-rose-400 focus-within:ring-rose-100' : 'border-slate-200 focus-within:border-teal-600 focus-within:ring-teal-100'}`}>
              <KeyRound className="w-[18px] h-[18px] text-slate-400" />
              <input ref={passwordInput} id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} value={password} onChange={event => { setPassword(event.target.value); setError(''); }} onKeyUp={event => setCapsLock(event.getModifierState('CapsLock'))} onBlur={() => setCapsLock(false)} aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} placeholder="Nhập mật khẩu" className="min-w-0 w-full flex-1 bg-transparent h-12 text-base outline-none text-slate-900 placeholder:text-slate-400" />
              <button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible} className="shrink-0 w-11 h-11 flex items-center justify-center -mr-1 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-teal-600">{visible ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}</button>
            </div>
            {capsLock && <p role="status" className="mt-2 text-xs text-amber-700">Bạn đang bật Caps Lock.</p>}
            {error && <p id="login-error" role="alert" className="mt-3 flex items-start gap-2 text-xs leading-5 text-rose-700"><AlertCircle className="w-4 h-4 mt-0.5" /><span className="min-w-0 break-words">{error}</span></p>}
          </div>
          <button type="submit" disabled={busy} className="w-full min-h-12 px-4 py-3 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-teal-900/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{busy ? <><LoaderCircle className="w-4 h-4 animate-spin" />Đang đăng nhập…</> : <>Đăng nhập hệ thống<ArrowRight className="w-4 h-4" /></>}</button>
        </form>
        <div className="mt-5 pt-4 border-t border-slate-100 empty:hidden"><PWAInstallButton variant="banner" /></div>
        <a href="tel:0392089960" className="mt-3 min-h-9 w-full text-[11px] text-slate-500 inline-flex items-center justify-center gap-2 hover:text-teal-800"><Phone className="w-3.5 h-3.5" />0392.089.960 · Ms Trinh</a>
        </div>
      </section>
    </div>
  </main>;
}
