import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, do not show button
  if (isInstalled) {
    return null;
  }

  // Android / Chromium / Desktop prompt
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-2.5 py-1.5 text-xs font-bold shadow transition"
        title="تثبيت التطبيق على الهاتف أو الحاسوب"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">تثبيت التطبيق</span>
        <span className="sm:hidden">تثبيت</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold shadow transition"
          title="تثبيت التطبيق على آيفون"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>تثبيت PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-slate-800 text-right">
              <div className="flex items-center justify-between border-b pb-3 mb-3">
                <h3 className="font-bold text-slate-900">تثبيت «سوبيرات الهناء» على آيفون</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                1. اضغط على زر <strong>المشاركة (Share)</strong> في شريط متصفح سفاري بالأسفل.<br />
                2. مرّر للأسفل واختر <strong>«إضافة إلى الشاشة الرئيسية» (Add to Home Screen)</strong>.<br />
                3. ستظهر أيقونة التطبيق على شاشة هاتفك لفتحه مباشرة وبسرعة فائقة.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition"
              >
                حسنًا، فهمت
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
