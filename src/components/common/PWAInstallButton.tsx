import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { HotelLogo } from './HotelLogo';
import { InstallGuideDialog } from './InstallGuideDialog';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'sidebar' | 'banner' }> = ({
  variant = 'header',
}) => {
  const { isInstalled, isIOS, environment, deferredPrompt, installApp } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [installError, setInstallError] = useState('');
  const [installing, setInstalling] = useState(false);

  if (isInstalled) return null;

  const openGuide = () => { setInstallError(''); setShowGuide(true); };
  const handleClick = async () => {
    setInstallError('');
    if (isIOS || environment.inAppBrowser || !deferredPrompt) {
      setShowGuide(true);
      return;
    }
    setInstalling(true);
    try { await installApp(); }
    catch {
      setInstallError('Chưa mở được hộp cài. Bạn có thể cài từ menu trình duyệt theo hướng dẫn bên dưới.');
      setShowGuide(true);
    } finally { setInstalling(false); }
  };

  return (
    <>
      {variant === 'sidebar' && (
        <button
          type="button"
          aria-label="Cài ứng dụng"
          title="Cài app ra màn hình"
          onClick={handleClick}
          disabled={installing}
          className="min-h-10 flex-1 min-w-0 flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-[11px] font-semibold text-teal-200 hover:bg-teal-900/60 hover:text-white border border-teal-900/70 focus-visible:outline-2 focus-visible:outline-teal-400 disabled:opacity-60"
        >
          <Download className="w-3.5 h-3.5 text-teal-300 shrink-0" />
          <span className="truncate">{installing ? 'Đang mở…' : 'Cài app'}</span>
        </button>
      )}
      {variant === 'banner' && <button type="button" aria-label="Cài ứng dụng" onClick={handleClick} disabled={installing} className="w-full min-w-0 min-h-16 flex items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-3 text-left hover:bg-teal-100/60 transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-teal-700">
        <HotelLogo size="sm" className="shrink-0" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold leading-5 text-teal-900">{installing ? 'Đang mở hộp cài…' : 'Cài app ra màn hình chính'}</span><span className="block mt-0.5 text-[11px] leading-4 text-teal-700">iPhone · Android · Máy tính</span></span><Download className="w-4 h-4 text-teal-700 shrink-0" />
      </button>}
      {variant === 'header' && <button type="button" aria-label="Cài ứng dụng" onClick={handleClick} disabled={installing} className="inline-flex items-center gap-2 rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-800"><Download className="w-4 h-4" />{installing ? 'Đang mở hộp cài…' : 'Cài app'}</button>}
      {variant !== 'sidebar' && (
        <button
          type="button"
          aria-label="Hướng dẫn cài trên mọi thiết bị"
          onClick={openGuide}
          className={`text-[11px] underline underline-offset-2 ${
            variant === 'banner'
              ? 'mt-1 min-h-9 w-full min-w-0 inline-flex items-center justify-center rounded-lg text-teal-700 hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-teal-700'
              : 'text-teal-700 hover:text-teal-900'
          }`}
        >
          Hướng dẫn cho mọi thiết bị
        </button>
      )}
      {showGuide && <InstallGuideDialog environment={environment} error={installError} onClose={() => setShowGuide(false)} />}
    </>
  );
};
