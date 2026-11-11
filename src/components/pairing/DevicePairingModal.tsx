import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Smartphone,
  ShieldCheck,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Store,
  Check,
  AlertTriangle,
  HelpCircle,
  Camera,
  X,
  FileCheck,
} from 'lucide-react';
import QRCode from 'qrcode';
import { StoreInfo } from '../../types';
import { storage } from '../../lib/storage';
import { syncEngine } from '../../lib/syncEngine';
import { ConfirmModal } from '../common/ConfirmModal';
import { toast } from '../../lib/toast';

interface DevicePairingModalProps {
  storeInfo: StoreInfo;
  onUpdateStoreInfo: (info: Partial<StoreInfo>) => void;
  onRefreshData: () => void;
}

export const DevicePairingModal: React.FC<DevicePairingModalProps> = ({
  storeInfo,
  onUpdateStoreInfo,
  onRefreshData,
}) => {
  const [shopKey, setShopKey] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [pairInputKey, setPairInputKey] = useState('');
  const [pairStatusMsg, setPairStatusMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [isPairingLoading, setIsPairingLoading] = useState(false);

  // Store Settings Form
  const [name, setName] = useState(storeInfo.name);
  const [tagline, setTagline] = useState(storeInfo.tagline);
  const [address, setAddress] = useState(storeInfo.address);
  const [phone, setPhone] = useState(storeInfo.phone);
  const [footerMessage, setFooterMessage] = useState(storeInfo.footerMessage);
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch shop key from server or local
    fetchShopKey();
  }, []);

  const fetchShopKey = async () => {
    try {
      const res = await fetch('/api/pair/info', { headers: { 'x-shop-key': storage.getShopKey() } });
      if (res.ok) {
        const data = await res.json();
        if (data.shopKey) {
          setShopKey(data.shopKey);
          storage.setShopKey(data.shopKey);
          generateQR(data.shopKey);
        }
      } else {
        const localKey = storage.getShopKey();
        if (localKey) {
          setShopKey(localKey);
          generateQR(localKey);
        }
      }
    } catch {
      const localKey = storage.getShopKey();
      if (localKey) {
        setShopKey(localKey);
        generateQR(localKey);
      }
    }
  };

  const generateQR = async (key: string) => {
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;
    const pairUrl = `${origin}/?pair=${key}`;
    try {
      const url = await QRCode.toDataURL(pairUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  };

  const copyPairLink = () => {
    if (!shopKey) return;
    const origin = window.location.origin;
    const link = `${origin}/?pair=${shopKey}`;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleManualPairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairInputKey.trim()) return;
    setIsPairingLoading(true);
    setPairStatusMsg(null);

    const res = await syncEngine.pairWithShopKey(pairInputKey.trim());
    setIsPairingLoading(false);
    if (res.success) {
      setPairStatusMsg({ success: true, text: res.message });
      setShopKey(pairInputKey.trim());
      generateQR(pairInputKey.trim());
      onRefreshData();
    } else {
      setPairStatusMsg({ success: false, text: res.message });
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Partial<StoreInfo> = {
      name: name.trim() || 'سوبيرات الهناء',
      tagline: tagline.trim(),
      address: address.trim(),
      phone: phone.trim(),
      footerMessage: footerMessage.trim(),
    };
    onUpdateStoreInfo(updated);

    try {
      await fetch('/api/settings/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shop-key': shopKey,
        },
        body: JSON.stringify({ storeInfo: updated }),
      });
    } catch (e) {
      console.warn('Failed to save store settings to server, saved locally:', e);
    }

    setSaveSettingsSuccess(true);
    setTimeout(() => setSaveSettingsSuccess(false), 2500);
  };

  // Backup Export
  const handleDownloadBackup = () => {
    const state = storage.getState();
    const backupData = {
      storeInfo: state.storeInfo,
      products: state.products,
      sales: state.sales,
      customers: state.customers,
      debtPayments: state.debtPayments,
      expenses: state.expenses,
      trashItems: state.trashItems,
      exportDate: new Date().toISOString(),
      app: 'Superette El Hanaa POS',
      version: 1,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة-احتياطية-سوبيرات-الهناء-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [pendingBackupContent, setPendingBackupContent] = useState<any | null>(null);

  // Backup Restore
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed || !Array.isArray(parsed.products)) {
          toast.error('ملف النسخة الاحتياطية غير صالح أو تالف.');
          return;
        }
        setPendingBackupContent(parsed);
      } catch (err: any) {
        toast.error('فشل قراءة الملف: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestoreBackup = () => {
    if (pendingBackupContent) {
      storage.restoreBackupData(pendingBackupContent);
      toast.success('تم استرجاع النسخة الاحتياطية بنجاح!');
      setPendingBackupContent(null);
      onRefreshData();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-right">
      
      {/* 1. DEVICE PAIRING & QR CODE CARD */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Smartphone className="w-6 h-6 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            ربط أجهزة المحل (الهاتف والحاسوب) بدون إدخال رمز كل مرة
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          وفّرنا ربطًا آمنًا لجميع هواتف وحواسيب المحل لتعمل بالتزامن التلقائي. امسح رمز QR مرة واحدة بكاميرا هاتف الموظف وسيتم التعرف على الجهاز واعتماده فورًا.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* QR Code Display */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="رمز QR لربط الأجهزة"
                className="w-56 h-56 rounded-xl border-4 border-white shadow-md bg-white p-2"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center bg-slate-200 rounded-xl text-xs text-slate-500">
                جاري توليد رمز QR...
              </div>
            )}
            <span className="text-xs font-bold text-slate-700 mt-3 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>امسح هذا الرمز بكاميرا هاتف المحل للربط المباشر</span>
            </span>
          </div>

          {/* Shop Key & Quick Link */}
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
              <span className="text-xs font-bold text-emerald-900 block">
                مفتاح المحل الآمن (Shop Secret Key):
              </span>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-emerald-300 font-mono text-sm sm:text-base font-bold text-slate-900 px-3 py-2 rounded-xl text-center tracking-wider">
                  {shopKey || 'جاري التحميل...'}
                </code>
                <button
                  onClick={copyPairLink}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                  title="نسخ رابط الربط"
                >
                  {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                </button>
              </div>
              <p className="text-[11px] text-emerald-700">
                يحمي قاعدة بيانات المحل من الوصول غير المصرح به للعامة.
              </p>
            </div>

            {/* Manual Pair input for secondary device */}
            <form onSubmit={handleManualPairSubmit} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                أو أدخل مفتاح المحل يدويًا على هذا الجهاز:
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pairInputKey}
                  onChange={(e) => setPairInputKey(e.target.value)}
                  placeholder="مثال: hanaa_abc123"
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="submit"
                  disabled={isPairingLoading || !pairInputKey.trim()}
                  className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  {isPairingLoading ? 'جاري التحقق...' : 'ربط الجهاز'}
                </button>
              </div>

              {pairStatusMsg && (
                <div
                  className={`p-2 rounded-lg text-xs font-bold ${
                    pairStatusMsg.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {pairStatusMsg.text}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* 2. BACKUP & RESTORE */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Download className="w-6 h-6 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            النسخ الاحتياطي واسترجاع البيانات (حماية بيانات المحل)
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          احفظ نسخة احتياطية من جميع سلع ومبيعات وديون ومصاريف سوبيرات الهناء في أي وقت، أو استرجع نسخة سابقة بضغطة زر.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleDownloadBackup}
            className="flex items-center justify-center gap-2 p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow transition active:scale-95"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تنزيل نسخة احتياطية كاملة (JSON)</span>
          </button>

          <label className="flex items-center justify-center gap-2 p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition active:scale-95 border border-slate-200">
            <Upload className="w-4 h-4 text-slate-600" />
            <span>استرجاع البيانات من نسخة احتياطية</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 3. STORE BRAND & RECEIPT INFO SETTINGS */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Store className="w-6 h-6 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            بيانات محل «سوبيرات الهناء» وعنوان الفاتورة
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          تظهر هذه البيانات أعلى وأسفل الفاتورة المطبوعة للزبائن وبالتقارير.
        </p>

        <form onSubmit={handleSaveStoreSettings} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المحل:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الشعار الفرعي:</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">العنوان / الحي:</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتف المحل:</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">رسالة الترحيب والشكر بأسفل الفاتورة:</label>
            <input
              type="text"
              value={footerMessage}
              onChange={(e) => setFooterMessage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition shadow active:scale-95"
            >
              حفظ الإعدادات
            </button>

            {saveSettingsSuccess && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <Check className="w-4 h-4" />
                <span>تم حفظ إعدادات المحل بنجاح!</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 4. EXPLANATION OF DATABASE ARCHITECTURE & SYNC */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <HelpCircle className="w-5 h-5" />
          <h3 className="font-bold text-sm sm:text-base">
            دليل إعداد قاعدة البيانات والعمل دون إنترنت والمزامنة
          </h3>
        </div>
        <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
          <p>
            1. <strong>العمل دون اتصال أولاً (Offline-First):</strong> يعمل التطبيق بالكامل حتى عند انقطاع الإنترنت داخل المحل. تسجل عمليات الكاشير والمخزون في ذاكرة جهازك وتخزن في طابور مزامنة محلي.
          </p>
          <p>
            2. <strong>المزامنة التلقائية بين الأجهزة:</strong> بمجرد عودة الاتصال أو الاتصال بشبكة Wi-Fi للمحل، يقوم التطبيق بمزامنة البيانات مع السيرفر وباقي هواتف وحواسيب المحل تلقائيًا.
          </p>
          <p>
            3. <strong>معالجة تعارض التعديلات:</strong> يعتمد النظام على خوارزمية <em>Last-Write-Wins (LWW)</em> الدقيقة بالمللي ثانية، ويقوم بحساب وتحديث المخزون بشكل تراكمي آمن لمنع تضارب المبيعات المتزامنة.
          </p>
          <p>
            4. <strong>أمان البيانات وعدم الفتح للعامة:</strong> جميع واجهات البيانات وقاعدة البيانات محمية بمفتاح المحل (Shop Key) ولا يُسمح لأي جهاز غير مقترن بقراءة أو كتابة أي معلومة.
          </p>
        </div>
      </div>

      {/* Restore Backup Confirmation Modal */}
      <ConfirmModal
        isOpen={!!pendingBackupContent}
        title="تأكيد استرجاع النسخة الاحتياطية"
        message="تحذير: استرجاع النسخة الاحتياطية سيقوم بتحديث سلع ومبيعات ومخزون المحل. هل أنت متأكد من المتابعة واستبدال البيانات الحالية؟"
        confirmLabel="استرجاع وتحديث"
        onConfirm={confirmRestoreBackup}
        onCancel={() => setPendingBackupContent(null)}
      />
    </div>
  );
};
