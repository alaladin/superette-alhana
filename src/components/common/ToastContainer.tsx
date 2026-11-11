import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { toast, ToastItem } from '../../lib/toast';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updated) => {
      setToasts(updated);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-sm w-full px-3 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between gap-2.5 p-3.5 rounded-2xl shadow-xl text-xs sm:text-sm font-bold border transition-all duration-200 transform animate-in fade-in slide-in-from-top-4 ${
            t.type === 'success'
              ? 'bg-emerald-900 border-emerald-700 text-emerald-100 shadow-emerald-950/20'
              : t.type === 'error'
              ? 'bg-rose-950 border-rose-800 text-rose-100 shadow-rose-950/20'
              : 'bg-slate-900 border-slate-700 text-white shadow-slate-950/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
            <span className="leading-snug">{t.message}</span>
          </div>

          <button
            onClick={() => toast.remove(t.id)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
