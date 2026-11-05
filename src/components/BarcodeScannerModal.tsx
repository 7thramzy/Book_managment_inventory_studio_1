import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { BookItem, TransactionType } from '../types/inventory';
import {
  Camera,
  X,
  Barcode,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  VideoOff,
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: BookItem[];
  canEditInventory: boolean;
  onFilterByBarcode: (barcode: string) => void;
  onQuickTransaction: (type: TransactionType, bookId: string) => void;
  lang: 'ar' | 'en';
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  books,
  canEditInventory,
  onFilterByBarcode,
  onQuickTransaction,
  lang,
}) => {
  const isAr = lang === 'ar';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannedCode, setScannedCode] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const handleDetectedCode = useCallback((rawCode: string) => {
    const clean = rawCode.trim().toUpperCase();
    if (!clean) return;
    setScannedCode(clean);
    setManualInput(clean);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        isAr
          ? 'الكاميرا غير مدعومة في هذا المتصفح. يمكنك استخدام الأزرار التجريبية أدناه لمحاكاة مسح الباركود أو إدخال الكود يدوياً.'
          : 'Camera API is not available in this browser context. Use the quick simulated barcode buttons or manual input below.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // Set up native BarcodeDetector if available alongside jsQR
      let nativeDetector: any = null;
      if ('BarcodeDetector' in window) {
        try {
          nativeDetector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'],
          });
        } catch {
          nativeDetector = null;
        }
      }

      const scanFrame = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(scanFrame);
          return;
        }

        // 1. Try native BarcodeDetector (supports 1D Code128/EAN + 2D QR)
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleDetectedCode(barcodes[0].rawValue);
            }
          } catch {
            // fallback to canvas jsQR
          }
        }

        // 2. Canvas frame extraction for jsQR
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (qrResult && qrResult.data) {
            handleDetectedCode(qrResult.data);
          }
        }

        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      setCameraError(
        isAr
          ? 'تعذر الوصول إلى كاميرا الجهاز (قد يكون الإذن مرفوضاً أو الكاميرا غير متصلة). استخدم شريط محاكاة المسح السريع أدناه لاختبار قراءة الباركود فوراً.'
          : `Could not access device camera (${err?.message || 'Permission denied'}). Use the Instant Barcode Simulator strip below to test scanning.`
      );
    }
  }, [facingMode, handleDetectedCode, isAr, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      setScannedCode('');
      setManualInput('');
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  const matchedBook = books.find(
    (b) => b.barcode.toUpperCase() === scannedCode.toUpperCase()
  );

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleDetectedCode(manualInput);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#006F88]/10 text-[#006F88] dark:text-cyan-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'ماسح الباركود ورموز QR بالكاميرا (بحث وتسجيل فوري)'
                  : 'Camera QR & Barcode Scanner (Fast Lookup & Stock Actions)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'وجّه الكاميرا نحو باركود الكتاب المدرسي للاستعلام الفوري عن الرصيد أو تسجيل حركة توريد/صرف'
                  : 'Point camera at a textbook barcode or QR label for instant catalog lookup and stock recording'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Live Camera Viewport */}
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Targeting Reticle Overlay when Camera is Active */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-64 h-40 border-2 border-[#006F88] rounded-xl relative shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]">
                  <div className="absolute inset-x-3 top-1/2 h-0.5 bg-cyan-400/80" />
                </div>
                <span className="mt-3 px-3 py-1 rounded bg-slate-950/80 text-slate-200 text-xs font-medium">
                  {isAr ? 'جاري فحص إطار الكاميرا تلقائياً...' : 'Scanning live camera feed for QR / Barcode...'}
                </span>
              </div>
            )}

            {/* Camera Controls Overlay */}
            {cameraActive && (
              <div className="absolute top-3 end-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                  }
                  className="px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تبديل الكاميرا' : 'Switch Camera'}</span>
                </button>
              </div>
            )}

            {/* Fallback View if Camera Not Available */}
            {!cameraActive && (
              <div className="p-6 text-center max-w-md space-y-3">
                <VideoOff className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  {cameraError ||
                    (isAr
                      ? 'جاري تشغيل الكاميرا...'
                      : 'Initializing device camera stream...')}
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-1.5 rounded-lg bg-[#006F88] hover:bg-[#00586C] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إعادة محاولة تشغيل الكاميرا' : 'Retry Camera Stream'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Manual Input + Quick Simulated Barcode Chips for Fast Testing */}
          <div className="space-y-3">
            <form onSubmit={handleManualLookup} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-slate-400 absolute top-2.5 start-3 pointer-events-none" />
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                  placeholder={
                    isAr
                      ? 'أدخل كود الباركود يدوياً أو استخدم القارئ الليزري (مثال: MOE-2026-SEC-G12-PHY)...'
                      : 'Type or scan barcode via USB/Camera (e.g. MOE-2026-SEC-G12-PHY)...'
                  }
                  className="w-full ps-9 pe-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isAr ? 'فحص الكود' : 'Lookup Barcode'}
              </button>
            </form>

            {/* Quick Test Barcode Simulator Strip */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                {isAr
                  ? 'محاكاة مسح فوري لباركود كتاب من المخزن (انقر لاختبار الاستجابة الفورية):'
                  : 'Instant Barcode Scan Simulator (Click any textbook barcode to simulate scan):'}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {books.slice(0, 6).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleDetectedCode(b.barcode)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors border cursor-pointer ${
                      scannedCode === b.barcode
                        ? 'bg-[#006F88] text-white border-[#006F88]'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#006F88]'
                    }`}
                  >
                    {b.barcode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scanned Result & Instant Actions Card */}
          {scannedCode && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-4">
              {matchedBook ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isAr ? 'تم التعرف على الكتاب المدرسي بنجاح' : 'Textbook Matched in Catalog'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{matchedBook.barcode}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {isAr ? matchedBook.titleAr : matchedBook.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isAr ? matchedBook.subjectAr : matchedBook.subject} ·{' '}
                        {isAr ? matchedBook.gradeAr : matchedBook.grade} ·{' '}
                        <span className="font-mono">{matchedBook.academicYear}</span>
                      </p>
                    </div>

                    <div className="text-end font-mono tabular-nums shrink-0">
                      <span className="text-[11px] text-slate-500 block">
                        {isAr ? 'الرصيد الفعلي المتاح' : 'Available Stock'}
                      </span>
                      <span
                        className={`text-xl font-bold ${
                          matchedBook.currentStock <= matchedBook.minStockLevel
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[#006F88] dark:text-cyan-400'
                        }`}
                      >
                        {matchedBook.currentStock.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons for Matched Book */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        onFilterByBarcode(matchedBook.barcode);
                        stopCamera();
                        onClose();
                      }}
                      className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{isAr ? 'عرض وتصفية في الجدول' : 'Filter in Current View'}</span>
                    </button>

                    {canEditInventory && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            stopCamera();
                            onClose();
                            onQuickTransaction('INBOUND', matchedBook.id);
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                          <span>{isAr ? '+ تسجيل توريد لهذا الكتاب' : '+ Record Inbound'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            stopCamera();
                            onClose();
                            onQuickTransaction('OUTBOUND', matchedBook.id);
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          <span>{isAr ? '- تسجيل صرف مدرسي' : '- Record Outbound'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {isAr
                        ? `الباركود "${scannedCode}" غير مسجل حالياً في دليل الكتب المدرسية.`
                        : `Barcode "${scannedCode}" was not found in the textbook catalog.`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onFilterByBarcode(scannedCode);
                      stopCamera();
                      onClose();
                    }}
                    className="font-semibold underline whitespace-nowrap cursor-pointer"
                  >
                    {isAr ? 'بحث في السجلات' : 'Search Records'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
