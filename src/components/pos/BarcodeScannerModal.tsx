import React, { useEffect, useRef, useState } from 'react';
import { Camera, Flashlight, RefreshCw, X, Keyboard } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { playErrorBeep, playSuccessBeep } from '../../lib/barcodeAudio';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerGenerationRef = useRef(0);
  const scannerContainerId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    async function initCameras() {
      try {
        setErrorMessage(null);
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          if (isMounted) {
            setCameras(devices);
            // Default to back camera
            const backCam = devices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('rear') || 
              d.label.toLowerCase().includes('environment')
            );
            const chosenId = backCam ? backCam.id : devices[devices.length - 1].id;
            setSelectedCameraId(chosenId);
            startScanner(chosenId);
          }
        } else if (isMounted) {
          setErrorMessage('لم يتم العثور على كاميرا في هذا الجهاز.');
        }
      } catch (err: any) {
        console.error('Failed to get cameras:', err);
        if (isMounted) setErrorMessage('تعذر الوصول للكاميرا. يرجى منح الإذن للمتصفح.');
      }
    }

    initCameras();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async (cameraId: string) => {
    await stopScanner();
    const generation = ++scannerGenerationRef.current;
    const html5QrCode = new Html5Qrcode(scannerContainerId);
    scannerRef.current = html5QrCode;
    setScanning(true);
    setIsTorchOn(false);
    setErrorMessage(null);

    try {
      await html5QrCode.start(
        cameraId,
        {
          fps: 20,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.333333,
        },
        (decodedText) => {
          if (generation !== scannerGenerationRef.current || scannerRef.current !== html5QrCode) return;
          playSuccessBeep();
          onScan(decodedText.trim());
          onClose();
        },
        (_errorMessage) => {
          // Ignore scan-frame misses; they are normal while searching for a barcode.
        }
      );

      // If the modal closed or another camera was selected while start() was pending,
      // stop this now-started camera instead of leaving it active in the background.
      if (generation !== scannerGenerationRef.current || scannerRef.current !== html5QrCode) {
        try {
          if (html5QrCode.isScanning) await html5QrCode.stop();
          html5QrCode.clear();
        } catch (disposeError) {
          console.warn('Stale scanner cleanup:', disposeError);
        }
      }
    } catch (err: any) {
      if (generation === scannerGenerationRef.current) {
        console.error('Start scanner error:', err);
        setErrorMessage('تعذر تشغيل الكاميرا: ' + (err.message || 'خطأ غير معروف'));
        setScanning(false);
        if (scannerRef.current === html5QrCode) scannerRef.current = null;
      }
    }
  };

  const stopScanner = async () => {
    // Invalidate any pending camera enumeration/start operation first.
    scannerGenerationRef.current += 1;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        // clear() is only safe after the active scan has stopped.
        if (!scanner.isScanning) scanner.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
    }
    setScanning(false);
    setIsTorchOn(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playSuccessBeep();
    onScan(manualCode.trim());
    setManualCode('');
    onClose();
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const nextTorch = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch not supported:', e);
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIdx = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIdx = (currentIdx + 1) % cameras.length;
    const nextCam = cameras[nextIdx];
    setSelectedCameraId(nextCam.id);
    startScanner(nextCam.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h3 className="font-bold text-sm sm:text-base">مسح الباركود بكاميرا الهاتف</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Camera Scanner Viewport */}
        <div className="relative bg-black flex-1 min-h-[260px] flex items-center justify-center overflow-hidden">
          <div id={scannerContainerId} className="w-full h-full min-h-[240px]" />

          {/* Scanner Overlay Sight Guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-36 border-2 border-emerald-400/80 rounded-xl relative shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br" />
              <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500/60 animate-pulse" />
            </div>
          </div>

          {/* Camera controls toolbar */}
          <div className="absolute top-3 left-3 flex gap-2 z-10">
            {cameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="bg-slate-800/90 text-white p-2 rounded-full shadow hover:bg-slate-700 active:scale-95 transition"
                title="تبديل الكاميرا"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full shadow active:scale-95 transition ${
                isTorchOn ? 'bg-amber-500 text-slate-900' : 'bg-slate-800/90 text-white hover:bg-slate-700'
              }`}
              title="تشغيل الفلاش"
            >
              <Flashlight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error message if any */}
        {errorMessage && (
          <div className="px-4 py-2 bg-rose-950/70 border-y border-rose-800 text-rose-300 text-xs text-center">
            {errorMessage}
          </div>
        )}

        {/* Manual Barcode Input Fallback */}
        <div className="p-4 bg-slate-850 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              أو أدخل رقم الباركود يدويًا:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="مثال: 6130001001"
                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm text-center tracking-wider font-mono focus:outline-none focus:border-emerald-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition"
              >
                إضافة
              </button>
            </div>
          </form>
          <p className="text-[11px] text-slate-500 text-center mt-2">
            وجّه الكاميرا نحو باركود السلعة ليتم إضافتها تلقائيًا مع صوت تنبيه
          </p>
        </div>
      </div>
    </div>
  );
};
