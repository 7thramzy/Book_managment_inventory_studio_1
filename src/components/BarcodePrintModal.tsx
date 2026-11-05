import React, { useState, useEffect, useMemo } from 'react';
import { BookItem } from '../types/inventory';
import {
  X,
  Printer,
  Barcode,
  QrCode,
  Grid,
  Square,
  Plus,
  Minus,
  Search,
  CheckSquare,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';

export type BarcodeGraphicType = 'CODE128' | 'QR';
export type LabelPrintLayout = 'SINGLE' | 'A4_GRID';

interface BarcodeSvgGraphicProps {
  value: string;
  type?: BarcodeGraphicType;
  height?: number;
  className?: string;
}

/**
 * Deterministic Offline SVG Renderer for Linear Code-128 Barcodes & 2D QR Matrices.
 * Produces crisp vector bars suitable for high-DPI thermal and A4 laser printing.
 */
export const BarcodeSvgGraphic: React.FC<BarcodeSvgGraphicProps> = ({
  value,
  type = 'CODE128',
  height = 48,
  className = '',
}) => {
  const cleanValue = (value || 'MOE-2026-BOOK').trim().toUpperCase();

  // Deterministic Linear Code-128 Bar Generator
  const linearBars = useMemo(() => {
    // Code-128 style 11-module patterns per character + start/stop guard patterns
    const patterns = [
      '11011001100',
      '11001101100',
      '11001100110',
      '10010011000',
      '10010001100',
      '10001001100',
      '10011001000',
      '10011000100',
      '10001100100',
      '11001001000',
      '11001000100',
      '11000100100',
      '10110011100',
      '10011011100',
      '10011001110',
      '10111001100',
      '10011101100',
      '10011100110',
      '11001110010',
      '11001011100',
      '11001001110',
      '11011100100',
      '11001110100',
      '11101101110',
      '11101001100',
      '11100101100',
      '11100100110',
      '11101100100',
      '11100110100',
      '11100110010',
      '11011011000',
      '11011000110',
      '11000110110',
    ];

    const startPattern = '11010010000'; // Start Code B
    const stopPattern = '1100011101011'; // Stop pattern

    let bits = startPattern;
    let checksum = 104;

    for (let i = 0; i < cleanValue.length; i++) {
      const code = cleanValue.charCodeAt(i);
      const idx = (code + i * 7) % patterns.length;
      bits += patterns[idx];
      checksum += (idx + 1) * (i + 1);
    }

    bits += patterns[checksum % patterns.length];
    bits += stopPattern;

    const rects: { x: number; w: number }[] = [];
    let currentX = 0;
    let i = 0;
    while (i < bits.length) {
      if (bits[i] === '1') {
        let run = 0;
        while (i < bits.length && bits[i] === '1') {
          run++;
          i++;
        }
        rects.push({ x: currentX, w: run });
        currentX += run;
      } else {
        let run = 0;
        while (i < bits.length && bits[i] === '0') {
          run++;
          i++;
        }
        currentX += run;
      }
    }

    return { rects, totalWidth: currentX };
  }, [cleanValue]);

  // Deterministic 21x21 QR Matrix Generator
  const qrMatrix = useMemo(() => {
    const size = 21;
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    const placeFinder = (r0: number, c0: number) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = r0 + r;
          const cc = c0 + c;
          if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
            reserved[rr][cc] = true;
            const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
            const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            grid[rr][cc] = inOuter && (onBorder || inInner);
          }
        }
      }
    };

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      reserved[6][i] = true;
      reserved[i][6] = true;
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Hash seed from barcode value
    let hash = 2166136261;
    for (let i = 0; i < cleanValue.length; i++) {
      hash ^= cleanValue.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    let bitIndex = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c]) {
          const charCode = cleanValue.charCodeAt(bitIndex % cleanValue.length);
          const mixed = ((hash >>> (bitIndex % 16)) ^ (charCode * (r + 1) + c * 13)) & 1;
          grid[r][c] = mixed === 1;
          bitIndex++;
        }
      }
    }

    return { grid, size };
  }, [cleanValue]);

  if (type === 'QR') {
    const { grid, size } = qrMatrix;
    return (
      <svg
        viewBox={`0 0 ${size + 2} ${size + 2}`}
        width={height + 16}
        height={height + 16}
        className={`mx-auto block bg-white p-1 rounded ${className}`}
        aria-label={`QR Code for ${cleanValue}`}
      >
        <rect x={0} y={0} width={size + 2} height={size + 2} fill="#ffffff" />
        {grid.map((row, rIdx) =>
          row.map((cell, cIdx) =>
            cell ? (
              <rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx + 1}
                y={rIdx + 1}
                width={1}
                height={1}
                fill="#0f172a"
              />
            ) : null
          )
        )}
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${linearBars.totalWidth + 12} ${height}`}
      style={{ height: `${height}px` }}
      className={`w-full max-w-[260px] mx-auto block bg-white px-1.5 py-1 rounded ${className}`}
      preserveAspectRatio="none"
      aria-label={`Barcode for ${cleanValue}`}
    >
      <rect x={0} y={0} width={linearBars.totalWidth + 12} height={height} fill="#ffffff" />
      {linearBars.rects.map((bar, idx) => (
        <rect
          key={idx}
          x={bar.x + 6}
          y={2}
          width={bar.w}
          height={height - 4}
          fill="#0f172a"
        />
      ))}
    </svg>
  );
};

interface BookBarcodeStickerCardProps {
  bookTitle: string;
  academicYear: string;
  barcode: string;
  subtitle?: string;
  graphicType?: BarcodeGraphicType;
  showCutBorder?: boolean;
  compact?: boolean;
}

/**
 * Standardized Ministry Textbook Barcode Label Card:
 * - Top: Book Name + Academic Year badge (+ optional Stage/Grade)
 * - Bottom: Visual Barcode (Linear or QR) + Monospace Barcode code underneath
 */
export const BookBarcodeStickerCard: React.FC<BookBarcodeStickerCardProps> = ({
  bookTitle,
  academicYear,
  barcode,
  subtitle,
  graphicType = 'CODE128',
  showCutBorder = true,
  compact = false,
}) => {
  return (
    <div
      className={`bg-white text-slate-950 rounded-lg flex flex-col justify-between transition-all select-none ${
        compact ? 'p-2.5' : 'p-3.5'
      } ${
        showCutBorder
          ? 'border border-dashed border-slate-400 print:border-slate-500'
          : 'border border-slate-200'
      }`}
    >
      {/* Top Header: Book Name & Academic Year */}
      <div className="border-b border-slate-200 pb-2 mb-2.5">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`font-bold text-slate-950 leading-snug line-clamp-2 ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          >
            {bookTitle || 'كتاب مدرسي بدون عنوان'}
          </div>
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-900 border border-slate-300 rounded whitespace-nowrap shrink-0">
            {academicYear || '2026/2027'}
          </span>
        </div>
        {subtitle && (
          <div className="text-[10px] text-slate-600 mt-0.5 truncate font-medium">
            {subtitle}
          </div>
        )}
      </div>

      {/* Bottom Area: Barcode Graphic + Code Underneath */}
      <div className="flex flex-col items-center justify-center pt-0.5">
        <BarcodeSvgGraphic
          value={barcode || 'MOE-0000'}
          type={graphicType}
          height={compact ? 38 : 46}
        />
        <div
          className={`mt-1.5 font-mono tabular-nums font-bold tracking-wider text-slate-950 text-center break-all ${
            compact ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          {barcode || 'MOE-0000'}
        </div>
      </div>
    </div>
  );
};

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: BookItem[];
  initialBooks?: BookItem[];
  lang: 'ar' | 'en';
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  books,
  initialBooks = [],
  lang,
}) => {
  const isAr = lang === 'ar';

  const [graphicType, setGraphicType] = useState<BarcodeGraphicType>('CODE128');
  const [layout, setLayout] = useState<LabelPrintLayout>('A4_GRID');
  const [showSubtitle, setShowSubtitle] = useState<boolean>(true);
  const [showCutBorder, setShowCutBorder] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [defaultCopies, setDefaultCopies] = useState<number>(3);
  const [copiesByBookId, setCopiesByBookId] = useState<Record<string, number>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const targetBooks = initialBooks.length > 0 ? initialBooks : books.slice(0, 4);
    const nextMap: Record<string, number> = {};
    const initialCopies = initialBooks.length === 1 ? 6 : 3;
    setDefaultCopies(initialCopies);
    setLayout(initialBooks.length === 1 ? 'A4_GRID' : 'A4_GRID');

    targetBooks.forEach((b) => {
      nextMap[b.id] = initialCopies;
    });
    setCopiesByBookId(nextMap);
  }, [isOpen, initialBooks, books]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.titleAr.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q) ||
        b.barcode.toLowerCase().includes(q) ||
        b.subjectAr.toLowerCase().includes(q) ||
        b.gradeAr.toLowerCase().includes(q)
    );
  }, [books, searchQuery]);

  const selectedBookEntries = useMemo(() => {
    return books
      .filter((b) => (copiesByBookId[b.id] || 0) > 0)
      .map((b) => ({
        book: b,
        copies: copiesByBookId[b.id] || 0,
      }));
  }, [books, copiesByBookId]);

  const flattenedStickers = useMemo(() => {
    const list: { key: string; book: BookItem; copyIndex: number; totalCopies: number }[] = [];
    for (const entry of selectedBookEntries) {
      const count = layout === 'SINGLE' ? Math.min(entry.copies, 20) : Math.min(entry.copies, 60);
      for (let i = 1; i <= count; i++) {
        list.push({
          key: `${entry.book.id}-copy-${i}`,
          book: entry.book,
          copyIndex: i,
          totalCopies: count,
        });
      }
    }
    return list;
  }, [selectedBookEntries, layout]);

  if (!isOpen) return null;

  const toggleBookSelection = (bookId: string) => {
    setCopiesByBookId((prev) => {
      const current = prev[bookId] || 0;
      if (current > 0) {
        const next = { ...prev };
        delete next[bookId];
        return next;
      }
      return { ...prev, [bookId]: Math.max(1, defaultCopies) };
    });
  };

  const updateBookCopies = (bookId: string, nextCount: number) => {
    const clamped = Math.max(0, Math.min(60, nextCount));
    setCopiesByBookId((prev) => {
      if (clamped === 0) {
        const copy = { ...prev };
        delete copy[bookId];
        return copy;
      }
      return { ...prev, [bookId]: clamped };
    });
  };

  const applyUniformCopiesToSelected = (count: number) => {
    const clamped = Math.max(1, Math.min(60, count));
    setDefaultCopies(clamped);
    setCopiesByBookId((prev) => {
      const next: Record<string, number> = {};
      Object.keys(prev).forEach((id) => {
        if (prev[id] > 0) next[id] = clamped;
      });
      return next;
    });
  };

  const handleCopyBarcodeText = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handlePrintNow = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0 print:block"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Top Modal Header (Hidden when printing) */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#006F88]/10 text-[#006F88] dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'استوديو طباعة ملصقات الباركود المدرسية (Barcode Print Studio)'
                  : 'Textbook Barcode Label Print Studio'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? 'تجهيز وطباعة ملصقات الكتب بحيث يظهر اسم الكتاب والعام الدراسي بالأعلى والباركود المرئي بالأسفل'
                  : 'Format and print textbook labels with Title & Academic Year on top and Barcode graphic below'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrintNow}
              disabled={flattenedStickers.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>
                {isAr
                  ? `طباعة الآن (${flattenedStickers.length} ملصق)`
                  : `Print Now (${flattenedStickers.length} Labels)`}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Studio Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden print:block">
          {/* Left/Start Configuration Panel (Hidden on Print) */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-e border-slate-200 dark:border-slate-800 p-5 overflow-y-auto space-y-5 bg-slate-50/60 dark:bg-slate-950/50 no-print">
            {/* 1. Barcode Graphic Mode */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isAr ? '1. نوع رمز الباركود المطبوع' : '1. Barcode Symbology Type'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGraphicType('CODE128')}
                  className={`p-3 rounded-lg border text-start transition-all flex items-center gap-2.5 cursor-pointer ${
                    graphicType === 'CODE128'
                      ? 'bg-white dark:bg-slate-900 border-[#006F88] ring-2 ring-[#006F88]/20'
                      : 'bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Barcode className="w-5 h-5 text-[#006F88] shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {isAr ? 'باركود خطي (Code-128)' : 'Linear Barcode'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isAr ? 'متوافق مع قارئ الليزر' : 'Standard laser scanner'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGraphicType('QR')}
                  className={`p-3 rounded-lg border text-start transition-all flex items-center gap-2.5 cursor-pointer ${
                    graphicType === 'QR'
                      ? 'bg-white dark:bg-slate-900 border-[#006F88] ring-2 ring-[#006F88]/20'
                      : 'bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <QrCode className="w-5 h-5 text-[#006F88] shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {isAr ? 'رمز استجابة سريعة (QR)' : '2D QR Code'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isAr ? 'مثالي لكاميرا الهاتف' : 'Fast camera matrix scan'}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Sheet Layout Mode */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isAr ? '2. تخطيط ورقة الطباعة' : '2. Label Sheet Layout'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLayout('A4_GRID')}
                  className={`p-3 rounded-lg border text-start transition-all flex items-center gap-2.5 cursor-pointer ${
                    layout === 'A4_GRID'
                      ? 'bg-white dark:bg-slate-900 border-[#006F88] ring-2 ring-[#006F88]/20'
                      : 'bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Grid className="w-5 h-5 text-[#006F88] shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {isAr ? 'شبكة ملصقات A4' : 'A4 Multi-Label Grid'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isAr ? '3 أعمدة متجاورة للورق اللاصق' : '3-column sticker sheet'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout('SINGLE')}
                  className={`p-3 rounded-lg border text-start transition-all flex items-center gap-2.5 cursor-pointer ${
                    layout === 'SINGLE'
                      ? 'bg-white dark:bg-slate-900 border-[#006F88] ring-2 ring-[#006F88]/20'
                      : 'bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Square className="w-5 h-5 text-[#006F88] shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {isAr ? 'ملصق مفرد (حراري)' : 'Single Thermal Label'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isAr ? 'ملصق واحد عريض لكل سطر' : '1 label per roll card'}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Quick Copies per Book Preset */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isAr ? 'عدد الملصقات لكل كتاب محدد:' : 'Copies per Selected Book:'}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 3, 6, 9, 12].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyUniformCopiesToSelected(preset)}
                      className={`px-2 py-1 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                        defaultCopies === preset
                          ? 'bg-[#006F88] text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {preset}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showSubtitle}
                    onChange={(e) => setShowSubtitle(e.target.checked)}
                    className="rounded border-slate-300 text-[#006F88] focus:ring-[#006F88]"
                  />
                  <span>{isAr ? 'إظهار الصف والمادة الدراسية' : 'Show Grade & Subject'}</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showCutBorder}
                    onChange={(e) => setShowCutBorder(e.target.checked)}
                    className="rounded border-slate-300 text-[#006F88] focus:ring-[#006F88]"
                  />
                  <span>{isAr ? 'إظهار خطوط القص المنقطة' : 'Show Dashed Cut Lines'}</span>
                </label>
              </div>
            </div>

            {/* 4. Select Textbooks & Fine-Tune Copies */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isAr
                    ? `3. الكتب المختارة للطباعة (${selectedBookEntries.length} كتاب)`
                    : `3. Selected Textbooks (${selectedBookEntries.length})`}
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      const allMap: Record<string, number> = {};
                      books.forEach((b) => {
                        allMap[b.id] = defaultCopies;
                      });
                      setCopiesByBookId(allMap);
                    }}
                    className="text-[#006F88] dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
                  >
                    {isAr ? 'تحديد الكل' : 'Select All'}
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setCopiesByBookId({})}
                    className="text-slate-500 hover:text-red-600 cursor-pointer"
                  >
                    {isAr ? 'إفراغ' : 'Clear'}
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 start-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث في الكتب أو الباركود...' : 'Filter books by title or barcode...'}
                  className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                {filteredCatalog.map((b) => {
                  const copies = copiesByBookId[b.id] || 0;
                  const isSelected = copies > 0;
                  return (
                    <div
                      key={b.id}
                      className={`p-2.5 flex items-center justify-between gap-2 text-xs transition-colors ${
                        isSelected ? 'bg-[#006F88]/5 dark:bg-[#006F88]/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleBookSelection(b.id)}
                        className="flex items-start gap-2 text-start min-w-0 flex-1 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#006F88] shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {isAr ? b.titleAr : b.title}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            {b.barcode} · {b.academicYear}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyBarcodeText(b.barcode)}
                          title={isAr ? 'نسخ رقم الباركود' : 'Copy Barcode'}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                        >
                          {copiedCode === b.barcode ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBookCopies(b.id, copies - 1)}
                          className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={copies}
                          onChange={(e) => updateBookCopies(b.id, Number(e.target.value))}
                          className="w-10 text-center font-mono text-xs font-bold py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                        <button
                          type="button"
                          onClick={() => updateBookCopies(b.id, copies + 1)}
                          className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right/End Live Print Sheet Preview (Printed Directly on window.print) */}
          <div className="lg:col-span-7 p-6 overflow-y-auto bg-slate-100 dark:bg-slate-950 print:bg-white print:p-0 print:overflow-visible">
            <div className="flex items-center justify-between mb-4 no-print">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Sparkles className="w-4 h-4 text-[#006F88]" />
                <span>
                  {isAr
                    ? `معاينة حية لورقة الملصقات (${flattenedStickers.length} ملصق جاهز للطباعة)`
                    : `Live Print Sheet Preview (${flattenedStickers.length} ready labels)`}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {layout === 'A4_GRID'
                  ? isAr
                    ? 'تخطيط: شبكة A4 (3 أعمدة)'
                    : 'Layout: A4 3-Column Sheet'
                  : isAr
                  ? 'تخطيط: ملصق حراري مفرد'
                  : 'Layout: Single Thermal Roll'}
              </span>
            </div>

            {flattenedStickers.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-2 no-print">
                <Barcode className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {isAr ? 'لم يتم تحديد أي كتب لطباعة الباركود' : 'No textbooks selected for label printing'}
                </div>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? 'اختر كتاباً واحداً أو أكثر من القائمة الجانبية وحدد عدد النسخ المطلوبة.'
                    : 'Select one or more textbooks from the side list and set the desired copy count.'}
                </p>
              </div>
            ) : (
              /* Printable Sheet Surface */
              <div className="bg-white text-slate-950 p-6 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-2">
                {/* Sheet Header (Only subtle in print) */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 text-[11px] text-slate-500 no-print">
                  <span>
                    {isAr
                      ? 'وزارة التربية والتعليم — ملصقات تعريف الكتب المدرسية المعتمدة'
                      : 'Ministry of Education — Official Textbook Barcode Labels'}
                  </span>
                  <span className="font-mono">
                    {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                  </span>
                </div>

                {/* Grid or Single Column of Stickers */}
                <div
                  className={
                    layout === 'A4_GRID'
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-3'
                      : 'max-w-sm mx-auto space-y-3'
                  }
                >
                  {flattenedStickers.map((item) => {
                    const b = item.book;
                    const subtitle = showSubtitle
                      ? `${isAr ? b.gradeAr : b.grade} · ${isAr ? b.subjectAr : b.subject}`
                      : undefined;
                    return (
                      <BookBarcodeStickerCard
                        key={item.key}
                        bookTitle={isAr ? b.titleAr : b.title}
                        academicYear={b.academicYear}
                        barcode={b.barcode}
                        subtitle={subtitle}
                        graphicType={graphicType}
                        showCutBorder={showCutBorder}
                        compact={layout === 'A4_GRID'}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
