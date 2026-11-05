import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { EducationalStage, InventoryTransaction } from '../types/inventory';
import { TrendingUp } from 'lucide-react';

interface InventoryTurnoverChartProps {
  transactions: InventoryTransaction[];
  lang: 'ar' | 'en';
  darkMode: boolean;
}

export const InventoryTurnoverChart: React.FC<InventoryTurnoverChartProps> = ({
  transactions,
  lang,
  darkMode,
}) => {
  const isAr = lang === 'ar';
  const [daysWindow, setDaysWindow] = useState<30 | 14 | 7>(30);
  const [stageFilter, setStageFilter] = useState<'ALL' | EducationalStage>('ALL');

  const { dailySeries, summary } = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const bucketsMap = new Map<
      string,
      {
        dateKey: string;
        label: string;
        inbound: number;
        outbound: number;
        net: number;
        txCount: number;
      }
    >();

    for (let i = daysWindow - 1; i >= 0; i--) {
      const d = new Date(todayMidnight.getTime() - i * 24 * 3600 * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const label = d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
      bucketsMap.set(dateKey, {
        dateKey,
        label,
        inbound: 0,
        outbound: 0,
        net: 0,
        txCount: 0,
      });
    }

    let totalInbound = 0;
    let totalOutbound = 0;
    let totalMatchedTx = 0;

    for (const t of transactions) {
      if (stageFilter !== 'ALL' && t.stage !== stageFilter) continue;
      const d = new Date(t.createdAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;

      const bucket = bucketsMap.get(key);
      if (!bucket) continue;

      if (t.type === 'INBOUND') {
        bucket.inbound += t.quantity;
        totalInbound += t.quantity;
      } else {
        bucket.outbound += t.quantity;
        totalOutbound += t.quantity;
      }
      bucket.net = bucket.inbound - bucket.outbound;
      bucket.txCount += 1;
      totalMatchedTx += 1;
    }

    const dailySeries = Array.from(bucketsMap.values());
    const turnoverRate =
      totalInbound > 0 ? Math.round((totalOutbound / totalInbound) * 100) : 0;

    return {
      dailySeries,
      summary: {
        totalInbound,
        totalOutbound,
        netChange: totalInbound - totalOutbound,
        turnoverRate,
        totalMatchedTx,
      },
    };
  }, [transactions, daysWindow, stageFilter, isAr]);

  const gridStroke = darkMode ? '#1e293b' : '#e2e8f0';
  const axisColor = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
      {/* Header & Interactive Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <TrendingUp className="w-4 h-4 text-[#006F88]" />
            <span>
              {isAr
                ? `تحليل معدل دوران المخزون (آخر ${daysWindow} يوماً)`
                : `Inventory Turnover Volume Trends (Last ${daysWindow} Days)`}
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {isAr
              ? 'مؤشر حركة التوريد مقابل الصرف المدرسي اليومي'
              : 'Inbound Printing Receipts vs. Outbound School Distribution'}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">{isAr ? 'كل المراحل التعليمية' : 'All Stages'}</option>
            <option value="PRIMARY">{isAr ? 'المرحلة الابتدائية' : 'Primary Stage'}</option>
            <option value="PREPARATORY">{isAr ? 'المرحلة الإعدادية' : 'Preparatory Stage'}</option>
            <option value="SECONDARY">{isAr ? 'المرحلة الثانوية' : 'Secondary Stage'}</option>
          </select>

          {/* Time Window Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            {([30, 14, 7] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDaysWindow(d)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer font-mono tabular-nums ${
                  daysWindow === d
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isAr ? `${d} يوم` : `${d}D`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quantitative Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">
            {isAr ? 'إجمالي التوريد خلال الفترة (+)' : 'Period Inbound Volume (+)'}
          </span>
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5 block">
            +{summary.totalInbound.toLocaleString()} {isAr ? 'نسخة' : 'copies'}
          </span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block">
            {isAr ? 'إجمالي الصرف للمدارس (-)' : 'Period Outbound Volume (-)'}
          </span>
          <span className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-0.5 block">
            -{summary.totalOutbound.toLocaleString()} {isAr ? 'نسخة' : 'copies'}
          </span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block">
            {isAr ? 'صافي التغير في المخزون' : 'Net Inventory Delta'}
          </span>
          <span className="text-base font-bold text-[#006F88] dark:text-cyan-400 font-mono tabular-nums mt-0.5 block">
            {summary.netChange >= 0 ? `+${summary.netChange.toLocaleString()}` : summary.netChange.toLocaleString()}{' '}
            {isAr ? 'نسخة' : 'copies'}
          </span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block">
            {isAr ? 'نسبة الصرف إلى التوريد' : 'Dispense-to-Inbound Ratio'}
          </span>
          <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-0.5 block">
            {summary.turnoverRate}% ({summary.totalMatchedTx} {isAr ? 'حركة' : 'tx'})
          </span>
        </div>
      </div>

      {/* Recharts Line Chart */}
      <div className="h-72 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dailySeries} margin={{ top: 10, right: 20, left: 4, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={axisColor}
              tick={{ fontSize: 11, fill: axisColor }}
              tickMargin={8}
              minTickGap={22}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fontSize: 11, fill: axisColor }}
              tickFormatter={(val) => Number(val).toLocaleString()}
              width={52}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                borderColor: darkMode ? '#1e293b' : '#e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                color: darkMode ? '#f1f5f9' : '#0f172a',
              }}
              formatter={(value: any, name: any) => [
                `${Number(value).toLocaleString()} ${isAr ? 'نسخة' : 'copies'}`,
                name,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
            <Line
              type="monotone"
              dataKey="inbound"
              name={isAr ? 'التوريد المخزني (Inbound +)' : 'Inbound Volume (+)'}
              stroke="#16A34A"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#16A34A' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="outbound"
              name={isAr ? 'الصرف والتوزيع المدرسي (Outbound -)' : 'Outbound Volume (-)'}
              stroke="#D97706"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#D97706' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
