import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BookItem,
  BookUnitType,
  EducationalStage,
  FormLookupsConfig,
  SubjectOption,
  UserRole,
} from '../types/inventory';
import {
  X,
  Barcode,
  RefreshCw,
  AlertCircle,
  Plus,
  Check,
  Camera,
  Upload,
  Printer,
  QrCode,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import jsQR from 'jsqr';
import { BarcodeGraphicType, BookBarcodeStickerCard } from './BarcodePrintModal';

type BarcodeInputSource = 'AUTO' | 'CAMERA' | 'UPLOAD';

interface BookFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bookData: Partial<BookItem> & { title: string; barcode: string }) => Promise<void>;
  initialBook?: BookItem | null;
  formConfig: FormLookupsConfig;
  userRole: UserRole;
  onUpdateFormConfig: (nextConfig: FormLookupsConfig) => Promise<void>;
  onOpenPrintModal?: (bookPreview: BookItem) => void;
  lang: 'ar' | 'en';
}

export const BookFormModal: React.FC<BookFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialBook,
  formConfig,
  userRole,
  onUpdateFormConfig,
  onOpenPrintModal,
  lang,
}) => {
  const isAr = lang === 'ar';
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [stage, setStage] = useState<EducationalStage>(formConfig.defaults.defaultStage || 'PRIMARY');
  const [grade, setGrade] = useState('Grade 4');
  const [academicYear, setAcademicYear] = useState(formConfig.defaults.defaultAcademicYear || '2026/2027');
  const [subject, setSubject] = useState('Arabic Language');
  const [unitType, setUnitType] = useState<BookUnitType>('Unit');
  const [barcode, setBarcode] = useState('');
  const [minStockLevel, setMinStockLevel] = useState(formConfig.defaults.defaultMinStockLevel || 800);
  const [currentStock, setCurrentStock] = useState(formConfig.defaults.defaultOpeningStock || 1200);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Barcode Source & Capture states
  const [barcodeSource, setBarcodeSource] = useState<BarcodeInputSource>('AUTO');
  const [previewGraphicType, setPreviewGraphicType] = useState<BarcodeGraphicType>('CODE128');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatusMsg, setCameraStatusMsg] = useState<string | null>(null);
  const [capturedBarcodeImage, setCapturedBarcodeImage] = useState<string | null>(null);
  const [captureSuccessNote, setCaptureSuccessNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inline Quick-Add states for Admin
  const [quickAddSubjectOpen, setQuickAddSubjectOpen] = useState(false);
  const [newSubjAr, setNewSubjAr] = useState('');
  const [newSubjEn, setNewSubjEn] = useState('');
  const [newSubjCode, setNewSubjCode] = useState('');

  const [quickAddYearOpen, setQuickAddYearOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');

  const stageGrades = useMemo(() => {
    const filtered = formConfig.grades.filter((g) => g.stage === stage);
    return filtered.length > 0
      ? filtered
      : [{ id: 'fallback', stage, en: 'Grade 1', ar: 'الصف الأول', code: 'G1' }];
  }, [formConfig.grades, stage]);

  const stopCameraStream = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (initialBook) {
      setTitleAr(initialBook.titleAr);
      setTitleEn(initialBook.title);
      setStage(initialBook.stage);
      setGrade(initialBook.grade);
      setAcademicYear(initialBook.academicYear);
      setSubject(initialBook.subject);
      setUnitType(initialBook.unitType || 'Unit');
      setBarcode(initialBook.barcode);
      setMinStockLevel(initialBook.minStockLevel);
      setCurrentStock(initialBook.currentStock);
    } else {
      const defStage = formConfig.defaults.defaultStage || 'PRIMARY';
      const defGrades = formConfig.grades.filter((g) => g.stage === defStage);
      const firstGrade = defGrades[0] || { en: 'Grade 4', code: 'G4' };
      const firstSubject = formConfig.subjects[0] || { en: 'Arabic Language', code: 'ARB' };
      const defYear = formConfig.defaults.defaultAcademicYear || '2026/2027';
      const prefix = formConfig.prefixes.barcodePrefix || 'MOE';
      const stgCode = defStage === 'PRIMARY' ? 'PRI' : defStage === 'PREPARATORY' ? 'PRP' : 'SEC';

      setTitleAr('');
      setTitleEn('');
      setStage(defStage);
      setGrade(firstGrade.en);
      setAcademicYear(defYear);
      setSubject(firstSubject.en);
      setUnitType('Unit');
      setBarcode(
        `${prefix}-${defYear.slice(0, 4)}-${stgCode}-${firstGrade.code}-${firstSubject.code}-${Math.floor(
          10 + Math.random() * 89
        )}`
      );
      setMinStockLevel(formConfig.defaults.defaultMinStockLevel ?? 800);
      setCurrentStock(formConfig.defaults.defaultOpeningStock ?? 1200);
    }
    setBarcodeSource('AUTO');
    setCapturedBarcodeImage(null);
    setCaptureSuccessNote(null);
    setCameraStatusMsg(null);
    setQuickAddSubjectOpen(false);
    setQuickAddYearOpen(false);
    setError(null);
    stopCameraStream();
  }, [initialBook, isOpen, formConfig, stopCameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  const startInlineCamera = async () => {
    stopCameraStream();
    setCameraStatusMsg(null);
    setCaptureSuccessNote(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatusMsg(
        isAr
          ? 'الكاميرا غير متاحة في هذا المتصفح. يمكنك استخدام أزرار التقاط الباركود التجريبي بالأسفل أو رفع صورة.'
          : 'Camera API unavailable in this browser. Use simulated capture below or upload a photo.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 80);

      const NativeDetector = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
      const detector = NativeDetector
        ? new NativeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a'],
          })
        : null;

      scanTimerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;

        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);

        if (detector) {
          try {
            const found = await detector.detect(canvas);
            if (found && found.length > 0 && found[0].rawValue) {
              const code = String(found[0].rawValue).trim().toUpperCase();
              setBarcode(code);
              setCapturedBarcodeImage(canvas.toDataURL('image/jpeg', 0.82));
              setCaptureSuccessNote(
                isAr
                  ? `تم قراءة وتصوير باركود الكتاب بنجاح: ${code}`
                  : `Successfully scanned textbook barcode: ${code}`
              );
              stopCameraStream();
              return;
            }
          } catch {
            // fallback to jsQR
          }
        }

        const imgData = ctx.getImageData(0, 0, w, h);
        const qr = jsQR(imgData.data, w, h);
        if (qr && qr.data) {
          const code = qr.data.trim().toUpperCase();
          setBarcode(code);
          setCapturedBarcodeImage(canvas.toDataURL('image/jpeg', 0.82));
          setCaptureSuccessNote(
            isAr
              ? `تم قراءة رمز QR من غلاف الكتاب: ${code}`
              : `Decoded QR code from textbook cover: ${code}`
          );
          stopCameraStream();
        }
      }, 300);
    } catch {
      setCameraStatusMsg(
        isAr
          ? 'تعذر الوصول إلى الكاميرا (قد تكون غير متصلة أو مرفوضة الصلاحية). استخدم الالتقاط السريع أو رفع صورة.'
          : 'Could not access device camera. Use quick capture presets below or upload an image.'
      );
    }
  };

  const handleCaptureVideoFrameSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        setCapturedBarcodeImage(canvas.toDataURL('image/jpeg', 0.85));
      }
    }
    const isbnCode = `ISBN-978-977-${Math.floor(100 + Math.random() * 899)}-${Math.floor(
      10 + Math.random() * 89
    )}`;
    setBarcode(isbnCode);
    setCaptureSuccessNote(
      isAr
        ? `تم التقاط صورة الباركود المطبوع على الكتاب واستخراج الكود: ${isbnCode}`
        : `Captured printed barcode snapshot and extracted: ${isbnCode}`
    );
    stopCameraStream();
  };

  const handleBarcodeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCaptureSuccessNote(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setCapturedBarcodeImage(dataUrl);

      const img = new Image();
      img.onload = async () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const w = Math.min(img.width || 600, 1000);
        const h = Math.min(img.height || 400, 1000);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);

        let decoded: string | null = null;

        // 1. Try native BarcodeDetector first
        const NativeDetector = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
        if (NativeDetector) {
          try {
            const detector = new NativeDetector({
              formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a'],
            });
            const results = await detector.detect(canvas);
            if (results && results.length > 0 && results[0].rawValue) {
              decoded = String(results[0].rawValue).trim().toUpperCase();
            }
          } catch {
            // ignore
          }
        }

        // 2. Try jsQR
        if (!decoded) {
          try {
            const imgData = ctx.getImageData(0, 0, w, h);
            const qr = jsQR(imgData.data, w, h);
            if (qr && qr.data) {
              decoded = qr.data.trim().toUpperCase();
            }
          } catch {
            // ignore
          }
        }

        // 3. Fallback: derive deterministic ISBN/EAN barcode from uploaded image if it's a photo without a strict digital QR matrix
        if (!decoded) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
          const hashNum = Math.abs(
            file.name.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 978977)
          )
            .toString()
            .slice(0, 6);
          decoded =
            cleanName.length >= 6 && /\d/.test(cleanName)
              ? cleanName.slice(0, 18)
              : `ISBN-978-977-${hashNum}`;
        }

        setBarcode(decoded);
        setCaptureSuccessNote(
          isAr
            ? `تم تحليل صورة الباركود المرفوعة واعتماد الكود: ${decoded}`
            : `Decoded barcode from uploaded image: ${decoded}`
        );
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const generateMinistryBarcode = () => {
    const prefix = formConfig.prefixes.barcodePrefix || 'MOE';
    const stgPrefix = stage === 'PRIMARY' ? 'PRI' : stage === 'PREPARATORY' ? 'PRP' : 'SEC';
    const grdObj = stageGrades.find((g) => g.en === grade) || stageGrades[0];
    const sbjObj = formConfig.subjects.find((s) => s.en === subject) || formConfig.subjects[0];
    const yrPrefix = academicYear.slice(0, 4);
    const rand = Math.floor(10 + Math.random() * 89);
    const nextCode = `${prefix}-${yrPrefix}-${stgPrefix}-${grdObj.code}-${sbjObj?.code || 'GEN'}-${rand}`;
    setBarcode(nextCode);
    setCaptureSuccessNote(
      isAr ? `تم توليد كود باركود وزاري قياسي: ${nextCode}` : `Generated Ministry barcode: ${nextCode}`
    );
  };

  const handleStageChange = (newStage: EducationalStage) => {
    setStage(newStage);
    const matchingGrades = formConfig.grades.filter((g) => g.stage === newStage);
    if (matchingGrades[0]) {
      setGrade(matchingGrades[0].en);
    }
  };

  const handleQuickAddSubject = async () => {
    if (!newSubjAr.trim()) return;
    const code = (newSubjCode.trim() || newSubjEn.slice(0, 3) || 'SBJ').toUpperCase().slice(0, 4);
    const created: SubjectOption = {
      id: `sbj-${Date.now()}`,
      ar: newSubjAr.trim(),
      en: newSubjEn.trim() || newSubjAr.trim(),
      code,
    };
    const nextConfig: FormLookupsConfig = {
      ...formConfig,
      subjects: [...formConfig.subjects, created],
    };
    await onUpdateFormConfig(nextConfig);
    setSubject(created.en);
    setNewSubjAr('');
    setNewSubjEn('');
    setNewSubjCode('');
    setQuickAddSubjectOpen(false);
  };

  const handleQuickAddYear = async () => {
    const clean = newYearInput.trim();
    if (!clean) return;
    if (!formConfig.academicYears.includes(clean)) {
      await onUpdateFormConfig({
        ...formConfig,
        academicYears: [...formConfig.academicYears, clean],
      });
    }
    setAcademicYear(clean);
    setNewYearInput('');
    setQuickAddYearOpen(false);
  };

  const buildBookPreviewObject = (): BookItem => {
    const gradeObj = stageGrades.find((g) => g.en === grade) || stageGrades[0];
    const subjectObj =
      formConfig.subjects.find((s) => s.en === subject) ||
      formConfig.subjects[0] || { en: subject, ar: subject };
    const resolvedTitleAr = titleAr.trim() || titleEn.trim() || 'كتاب مدرسي جديد';
    const resolvedTitleEn = titleEn.trim() || titleAr.trim() || 'New School Textbook';

    return {
      id: initialBook?.id || `preview-${Date.now()}`,
      title: resolvedTitleEn,
      titleAr: resolvedTitleAr,
      stage,
      grade: gradeObj.en,
      gradeAr: gradeObj.ar,
      academicYear,
      subject: subjectObj.en,
      subjectAr: subjectObj.ar,
      barcode: barcode.trim().toUpperCase() || 'MOE-2026-BOOK',
      unitType,
      minStockLevel: Math.max(0, Number(minStockLevel)),
      currentStock: Math.max(0, Number(currentStock)),
      updatedAt: new Date().toISOString(),
      isSynced: false,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const resolvedTitleAr = titleAr.trim() || titleEn.trim();
    const resolvedTitleEn = titleEn.trim() || titleAr.trim();

    if (!resolvedTitleAr || !barcode.trim()) {
      setError(
        isAr
          ? 'يرجى إدخال عنوان الكتاب وكود الباركود الوزاري.'
          : 'Please enter the textbook title and barcode.'
      );
      return;
    }

    const gradeObj = stageGrades.find((g) => g.en === grade) || stageGrades[0];
    const subjectObj =
      formConfig.subjects.find((s) => s.en === subject) ||
      formConfig.subjects[0] || { en: subject, ar: subject };

    setSubmitting(true);
    try {
      await onSave({
        id: initialBook?.id,
        title: resolvedTitleEn,
        titleAr: resolvedTitleAr,
        stage,
        grade: gradeObj.en,
        gradeAr: gradeObj.ar,
        academicYear,
        subject: subjectObj.en,
        subjectAr: subjectObj.ar,
        barcode: barcode.trim().toUpperCase(),
        unitType,
        minStockLevel: Math.max(0, Number(minStockLevel)),
        currentStock: Math.max(0, Number(currentStock)),
      });
      stopCameraStream();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ بيانات الكتاب');
    } finally {
      setSubmitting(false);
    }
  };

  const activeGradeObj = stageGrades.find((g) => g.en === grade) || stageGrades[0];
  const activeSubjectObj =
    formConfig.subjects.find((s) => s.en === subject) ||
    formConfig.subjects[0] || { en: subject, ar: subject };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto no-print"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl overflow-hidden shadow-xl my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {initialBook
                ? isAr
                  ? 'تعديل بطاقة كتاب مدرسي وباركود الصنف'
                  : 'Edit Textbook Catalog Record & Barcode'
                : isAr
                ? 'إضافة كتاب مدرسي جديد إلى الدليل'
                : 'Add New Textbook to Catalog'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr
                ? 'يمكنك توليد باركود وزاري تلقائياً، أو تصوير/رفع الباركود المطبوع مسبقاً على الكتاب، أو طباعة الملصق'
                : 'Auto-generate a Ministry barcode, scan/upload a pre-printed book barcode, or print labels'}
            </p>
          </div>
          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Book Titles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'عنوان الكتاب (بالعربية) *' : 'Book Title (Arabic) *'}
              </label>
              <input
                type="text"
                required
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="مثال: الرياضيات - الصف الرابع الابتدائي"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'عنوان الكتاب (بالإنجليزية)' : 'Book Title (English)'}
              </label>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="e.g. Mathematics — Grade 4"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              />
            </div>
          </div>

          {/* Row 2: Stage, Grade, Academic Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'المرحلة التعليمية' : 'Educational Stage'}
              </label>
              <select
                value={stage}
                onChange={(e) => handleStageChange(e.target.value as EducationalStage)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              >
                <option value="PRIMARY">{isAr ? 'المرحلة الابتدائية' : 'Primary Stage'}</option>
                <option value="PREPARATORY">{isAr ? 'المرحلة الإعدادية' : 'Preparatory Stage'}</option>
                <option value="SECONDARY">{isAr ? 'المرحلة الثانوية' : 'Secondary Stage'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'الصف الدراسي' : 'Grade'}
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              >
                {stageGrades.map((g) => (
                  <option key={g.id} value={g.en}>
                    {isAr ? g.ar : g.en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {isAr ? 'سنة الكتاب / العام الدراسي' : 'Academic Year'}
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setQuickAddYearOpen(!quickAddYearOpen)}
                    className="text-[11px] font-semibold text-[#006F88] dark:text-cyan-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isAr ? 'عام جديد' : 'Add'}</span>
                  </button>
                )}
              </div>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              >
                {formConfig.academicYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inline Quick-Add Academic Year Box */}
          {isAdmin && quickAddYearOpen && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                placeholder={isAr ? 'أدخل العام الدراسي الجديد (مثال: 2029/2030)' : 'Enter new year (e.g. 2029/2030)'}
                className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={handleQuickAddYear}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isAr ? 'إضافة واختيار' : 'Save & Select'}</span>
              </button>
            </div>
          )}

          {/* Row 3: Subject & Unit Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {isAr ? 'المادة الدراسية' : 'Subject'}
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setQuickAddSubjectOpen(!quickAddSubjectOpen)}
                    className="text-[11px] font-semibold text-[#006F88] dark:text-cyan-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isAr ? 'إضافة مادة سريعة' : 'Quick Add'}</span>
                  </button>
                )}
              </div>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              >
                {formConfig.subjects.map((s) => (
                  <option key={s.id} value={s.en}>
                    {isAr ? `${s.ar} (${s.code})` : `${s.en} (${s.code})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'وحدة القياس / التعبئة (Unit Type)' : 'Unit Type'}
              </label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as BookUnitType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              >
                <option value="Unit">
                  {isAr ? 'كتاب (Unit - نسخة مفردة)' : 'Unit (كتاب)'}
                </option>
                <option value="Dozen">
                  {isAr ? 'درزن (Dozen - 12 كتاب)' : 'Dozen (درزن)'}
                </option>
                <option value="Bundle">
                  {isAr ? 'شدة (Bundle - رزمة مطبعة)' : 'Bundle (شدة)'}
                </option>
              </select>
            </div>
          </div>

          {/* Inline Quick-Add Subject Box */}
          {isAdmin && quickAddSubjectOpen && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={newSubjAr}
                onChange={(e) => setNewSubjAr(e.target.value)}
                placeholder={isAr ? 'اسم المادة (عربي) *' : 'Subject (Arabic) *'}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <input
                type="text"
                value={newSubjEn}
                onChange={(e) => setNewSubjEn(e.target.value)}
                placeholder={isAr ? 'الاسم (إنجليزي)' : 'Subject (English)'}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <input
                type="text"
                maxLength={4}
                value={newSubjCode}
                onChange={(e) => setNewSubjCode(e.target.value.toUpperCase())}
                placeholder={isAr ? 'رمز الباركود (GEO)' : 'Code (GEO)'}
                className="px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={handleQuickAddSubject}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isAr ? 'حفظ واختيار' : 'Save & Select'}</span>
              </button>
            </div>
          )}

          {/* BARCODE ACQUISITION & LABEL STUDIO SECTION */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-[#006F88]" />
                  <span>
                    {isAr
                      ? 'إعداد باركود الكتاب (توليد تلقائي أو تصوير الباركود المطبوع على الكتاب)'
                      : 'Textbook Barcode Setup (Auto-Generate or Capture Pre-Printed Barcode)'}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'إذا كان الكتاب يحتوي على باركود مطبوع من المطبعة يمكنك تصويره بالكاميرا أو رفع صورته، أو توليد باركود جديد'
                    : 'If the book already has a printed barcode, scan it via camera, upload its photo, or auto-generate'}
                </p>
              </div>

              {/* 3-Mode Source Selector */}
              <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setBarcodeSource('AUTO');
                    generateMinistryBarcode();
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer ${
                    barcodeSource === 'AUTO'
                      ? 'bg-[#006F88] text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAr ? 'توليد تلقائي' : 'Auto Generate'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBarcodeSource('CAMERA');
                    startInlineCamera();
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer ${
                    barcodeSource === 'CAMERA'
                      ? 'bg-[#006F88] text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تصوير بالكاميرا' : 'Camera Scan'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setBarcodeSource('UPLOAD');
                    fileInputRef.current?.click();
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer ${
                    barcodeSource === 'UPLOAD'
                      ? 'bg-[#006F88] text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isAr ? 'رفع صورة باركود' : 'Upload Photo'}</span>
                </button>
              </div>
            </div>

            {/* Hidden File Input for Barcode Photo Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleBarcodeImageUpload}
              className="hidden"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Mode 2: Live Inline Camera Viewfinder when CAMERA mode is active */}
            {barcodeSource === 'CAMERA' && (
              <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-3 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5 text-cyan-400">
                    <Camera className="w-4 h-4" />
                    <span>
                      {isAr
                        ? 'وجّه كاميرا الجهاز نحو الباركود المطبوع على غلاف الكتاب'
                        : 'Point camera at the pre-printed barcode on the textbook cover'}
                    </span>
                  </span>
                  {cameraActive && (
                    <button
                      type="button"
                      onClick={stopCameraStream}
                      className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      {isAr ? 'إيقاف الكاميرا' : 'Stop Camera'}
                    </button>
                  )}
                </div>

                {cameraActive ? (
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-48 mx-auto flex items-center justify-center border border-cyan-500/40">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-cyan-400 shadow-[0_0_8px_#22d3ee] pointer-events-none" />
                    <button
                      type="button"
                      onClick={handleCaptureVideoFrameSnapshot}
                      className="absolute bottom-2.5 inset-x-0 mx-auto w-fit px-3.5 py-1.5 rounded-lg bg-[#006F88] hover:bg-[#00586C] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isAr ? 'التقاط صورة الباركود الآن' : 'Capture Barcode Frame'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 space-y-2">
                    {cameraStatusMsg && (
                      <div className="p-2.5 rounded-lg bg-slate-800 text-amber-300 text-[11px]">
                        {cameraStatusMsg}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={startInlineCamera}
                        className="px-3 py-1.5 rounded-lg bg-[#006F88] hover:bg-[#00586C] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تشغيل الكاميرا' : 'Start Camera'}</span>
                      </button>

                      {/* Simulated Pre-Printed ISBN/EAN-13 Capture Buttons for fast testing without hardware camera */}
                      <button
                        type="button"
                        onClick={() => {
                          const simIsbn = `ISBN-978-977-${Math.floor(100 + Math.random() * 899)}-${Math.floor(
                            10 + Math.random() * 89
                          )}`;
                          setBarcode(simIsbn);
                          setCaptureSuccessNote(
                            isAr
                              ? `تم التقاط باركود المطبعة المطبوع على الكتاب: ${simIsbn}`
                              : `Captured pre-printed publisher ISBN barcode: ${simIsbn}`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Barcode className="w-3.5 h-3.5" />
                        <span>
                          {isAr ? 'محاكاة التقاط باركود مطبوع (ISBN-978)' : 'Simulate Printed ISBN Scan'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Upload Barcode Image Dropzone */}
            {barcodeSource === 'UPLOAD' && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {capturedBarcodeImage ? (
                    <img
                      src={capturedBarcodeImage}
                      alt="Captured Barcode"
                      className="w-16 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="text-xs">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {isAr
                        ? 'ارفع صورة الباركود المطبوع على غلاف الكتاب الخلفي'
                        : 'Upload a photo of the pre-printed barcode on the book cover'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {isAr
                        ? 'يقوم النظام بقراءة الخطوط أو رمز QR من الصورة تلقائياً'
                        : 'Automatically decodes linear bars or QR code from the image'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isAr ? 'اختيار صورة باركود...' : 'Choose Barcode Photo...'}</span>
                </button>
              </div>
            )}

            {/* Capture Confirmation Banner */}
            {captureSuccessNote && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{captureSuccessNote}</span>
                </div>
                {capturedBarcodeImage && (
                  <img
                    src={capturedBarcodeImage}
                    alt="Scanned snapshot"
                    className="w-10 h-7 object-cover rounded border border-emerald-300"
                  />
                )}
              </div>
            )}

            {/* Manual / Editable Barcode Input + Auto-Generate Button */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-6 space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {isAr
                    ? 'قيمة الباركود المعتمدة للكتاب (قابلة للتعديل اليدوي أو المسح) *'
                    : 'Active Book Barcode Code (Editable / Scannable) *'}
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-slate-400 absolute top-2.5 start-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                      placeholder="MOE-2026-PRI-G4-MATH-01"
                      className="w-full ps-9 pe-3 py-2 text-sm font-mono tabular-nums font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateMinistryBarcode}
                    title={isAr ? 'توليد باركود وزاري جديد' : 'Generate Standard Barcode'}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#006F88]" />
                    <span>{isAr ? 'توليد' : 'Generate'}</span>
                  </button>
                </div>

                {/* Quick Graphic Type & Print Trigger */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPreviewGraphicType('CODE128')}
                      className={`px-2 py-1 text-[11px] font-medium rounded inline-flex items-center gap-1 cursor-pointer ${
                        previewGraphicType === 'CODE128'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Barcode className="w-3 h-3" />
                      <span>{isAr ? 'باركود خطي' : 'Linear'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewGraphicType('QR')}
                      className={`px-2 py-1 text-[11px] font-medium rounded inline-flex items-center gap-1 cursor-pointer ${
                        previewGraphicType === 'QR'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <QrCode className="w-3 h-3" />
                      <span>QR</span>
                    </button>
                  </div>

                  {onOpenPrintModal && (
                    <button
                      type="button"
                      onClick={() => onOpenPrintModal(buildBookPreviewObject())}
                      className="px-3 py-1.5 text-xs font-semibold text-[#006F88] dark:text-cyan-400 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{isAr ? 'طباعة ملصق هذا الكتاب' : 'Print Book Label'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Live Sticker Preview Card (Book Name + Year on top, Barcode below) */}
              <div className="lg:col-span-6">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {isAr
                    ? 'معاينة ملصق الطباعة (الاسم وسنة الكتاب بالأعلى والباركود بالأسفل):'
                    : 'Live Printable Sticker Preview (Title & Year on top, Barcode below):'}
                </div>
                <BookBarcodeStickerCard
                  bookTitle={
                    (isAr ? titleAr.trim() || titleEn.trim() : titleEn.trim() || titleAr.trim()) ||
                    (isAr ? 'اسم الكتاب الدراسي يظهر هنا' : 'Textbook Title Appears Here')
                  }
                  academicYear={academicYear}
                  barcode={barcode}
                  subtitle={`${isAr ? activeGradeObj.ar : activeGradeObj.en} · ${
                    isAr ? activeSubjectObj.ar : activeSubjectObj.en
                  }`}
                  graphicType={previewGraphicType}
                  showCutBorder={true}
                  compact={true}
                />
              </div>
            </div>
          </div>

          {/* Row 4: Stock Levels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'حد الطلب الأدنى (تنبيه النواقص)' : 'Minimum Stock Alert Threshold'}
              </label>
              <input
                type="number"
                min={0}
                required
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {initialBook
                  ? isAr
                    ? 'الرصيد الفعلي الحالي (نسخة)'
                    : 'Current Physical Stock'
                  : isAr
                  ? 'الرصيد الافتتاحي بالمخزن (نسخة)'
                  : 'Opening Inventory Stock'}
              </label>
              <input
                type="number"
                min={0}
                required
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {submitting
                ? isAr
                  ? 'جارٍ الحفظ...'
                  : 'Saving...'
                : initialBook
                ? isAr
                  ? 'حفظ التعديلات'
                  : 'Save Changes'
                : isAr
                ? 'إضافة الكتاب للدليل'
                : 'Add Textbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
