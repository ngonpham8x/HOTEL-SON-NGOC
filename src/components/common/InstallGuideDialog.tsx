import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Download, Monitor, Smartphone } from 'lucide-react';
import { HotelLogo } from './HotelLogo';
import { browsersForPlatform, getInstallGuide, INSTALL_PLATFORMS, type InstallBrowser, type InstallEnvironment, type InstallPlatform } from '../../utils/installGuides';

export function InstallGuideDialog({ environment, error, onClose }: { environment: InstallEnvironment; error?: string; onClose: () => void }) {
  const [platform, setPlatform] = useState(environment.platform);
  const [browser, setBrowser] = useState<InstallBrowser>(() => {
    const options = browsersForPlatform(environment.platform);
    return options.some(item => item.value === environment.browser) ? environment.browser : options[0].value;
  });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const guide = getInstallGuide(platform, browser);
  const choices = browsersForPlatform(platform);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const shareable = location.protocol === 'https:' && !loopback;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select, a[href]') || []);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keyDown); previous?.focus(); };
  }, []);
  const changePlatform = (value: InstallPlatform) => {
    setPlatform(value);
    const browsers = browsersForPlatform(value);
    setBrowser(value === 'IOS' ? 'SAFARI' : value === 'MAC' ? 'SAFARI' : browsers.some(item => item.value === browser) ? browser : 'CHROME');
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.origin + '/'); setCopied(true); setCopyError(''); }
    catch { setCopyError('Chưa sao chép được. Hãy sao chép đường dẫn từ thanh địa chỉ trình duyệt.'); }
  };
  const DeviceIcon = platform === 'IOS' || platform === 'ANDROID' ? Smartphone : Monitor;
  return createPortal(<div className="no-print fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Hướng dẫn cài ứng dụng" tabIndex={-1} className="max-h-[calc(100dvh-2rem)] max-w-md w-full min-w-0 overflow-y-auto rounded-2xl bg-white p-5 text-slate-800 shadow-2xl border border-teal-200 outline-none">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4"><div className="flex items-center gap-3 min-w-0"><HotelLogo size="md" /><div><p className="font-bold text-sm">HOTEL SƠN NGỌC</p><p className="text-[11px] mt-1 text-teal-700">Cài app & thêm biểu tượng</p></div></div><button type="button" aria-label="Đóng hướng dẫn cài ứng dụng" onClick={onClose} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button></div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Chọn thiết bị và trình duyệt để xem cách thêm logo Sơn Ngọc vào màn hình chính, Desktop hoặc Dock.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">{error}</p>}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-[11px] font-semibold text-slate-600">Thiết bị<select aria-label="Thiết bị cài app" value={platform} onChange={event => changePlatform(event.target.value as InstallPlatform)} className="mt-1.5 w-full min-h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900">{INSTALL_PLATFORMS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-[11px] font-semibold text-slate-600">Trình duyệt<select aria-label="Trình duyệt cài app" value={browser} onChange={event => setBrowser(event.target.value as InstallBrowser)} className="mt-1.5 w-full min-h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900">{choices.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      {environment.inAppBrowser && <p role="status" className="mt-4 p-3 rounded-lg bg-amber-50 text-xs leading-5 text-amber-900">Bạn đang mở trong một ứng dụng khác. Hãy dùng menu của ứng dụng để mở trang bằng Safari, Chrome hoặc Edge rồi cài app.</p>}
      <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/50 p-4"><h2 className="flex items-start gap-2 text-sm font-bold text-teal-900"><DeviceIcon className="w-4 h-4 mt-0.5" />{guide.title}</h2><ol className="mt-4 space-y-3">{guide.steps.map((step, index) => <li key={step} className="flex items-start gap-2.5 text-xs leading-5"><span className="w-5 h-5 shrink-0 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold flex items-center justify-center">{index + 1}</span><span className="min-w-0">{step}</span></li>)}</ol>{guide.note && <p className="mt-3 pt-3 border-t border-teal-100 text-[11px] leading-5 text-slate-600">{guide.note}</p>}</div>
      {loopback ? <p className="mt-4 text-[11px] leading-5 text-amber-800">Bạn đang mở app trên máy này. Để cài trên thiết bị khác, mở đường dẫn HTTPS của app trên thiết bị đó.</p> : !window.isSecureContext ? <p className="mt-4 text-[11px] leading-5 text-amber-800">Trang đang dùng HTTP. Hãy mở đường dẫn HTTPS để dùng đầy đủ chức năng cài app.</p> : null}
      {shareable && <button type="button" onClick={copyLink} className="mt-4 w-full min-h-11 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-50">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'Đã sao chép đường dẫn' : 'Sao chép link để cài trên thiết bị khác'}</button>}
      {copyError && <p role="alert" className="mt-2 text-xs text-rose-700">{copyError}</p>}
      <p className="mt-4 text-[11px] leading-5 text-slate-500 flex items-start gap-2"><Download className="w-3.5 h-3.5 mt-0.5" />Mỗi thiết bị cần xác nhận cài riêng. Website không thể tự tạo biểu tượng trên tất cả thiết bị.</p>
      <button type="button" onClick={onClose} className="mt-4 min-h-11 w-full rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900">Đã hiểu, quay lại</button>
    </div>
  </div>, document.body);
}
