import React from 'react';
import { useHotel } from '../../context/HotelContext';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
  HelpCircle,
} from 'lucide-react';

export const NotificationOverlay: React.FC = () => {
  const { toasts, removeToast, confirmModal, closeConfirm, showToast } = useHotel();

  return (
    <>
      {/* Toast Notifications Container (Fixed bottom-right) */}
      <div className="fixed bottom-3 right-3 left-3 sm:left-auto z-[80] flex flex-col gap-2.5 sm:max-w-sm sm:w-full pointer-events-none">
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border text-xs animate-in slide-in-from-bottom-3 duration-200 ${
                isSuccess
                  ? 'bg-emerald-900 text-white border-emerald-700'
                  : isError
                  ? 'bg-rose-900 text-white border-rose-700'
                  : isWarning
                  ? 'bg-amber-900 text-white border-amber-700'
                  : 'bg-slate-900 text-white border-slate-700'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
                {isError && <AlertCircle className="w-4 h-4 text-rose-300" />}
                {isWarning && <AlertTriangle className="w-4 h-4 text-amber-300" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-sky-300" />}
              </div>

              <div className="flex-1 font-medium leading-relaxed">
                {toast.message}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-white/70 hover:text-white p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div
              className={`px-6 py-4 flex items-center gap-3 text-white ${
                confirmModal.isDangerous ? 'bg-rose-700' : 'bg-slate-900'
              }`}
            >
              {confirmModal.isDangerous ? (
                <AlertTriangle className="w-5 h-5 text-rose-200 shrink-0" />
              ) : (
                <HelpCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <h3 className="text-sm font-bold leading-tight">
                {confirmModal.title}
              </h3>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <p className="text-sm font-medium leading-relaxed text-slate-800">
                {confirmModal.message}
              </p>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
                >
                  {confirmModal.cancelLabel || 'Hủy bỏ'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const cb = confirmModal.onConfirm;
                    closeConfirm();
                    try { await cb(); } catch (error) { showToast(error instanceof Error ? error.message : 'Không thực hiện được thao tác.', 'error'); }
                  }}
                  className={`px-5 py-2 text-white font-bold rounded-lg transition-colors shadow-sm ${
                    confirmModal.isDangerous
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  {confirmModal.confirmLabel || 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
