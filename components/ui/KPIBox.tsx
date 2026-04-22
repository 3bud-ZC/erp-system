import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Accent = 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate';

interface Props {
  label: string;
  value: string | number;
  icon?: ReactNode;
  delta?: number;
  hint?: string;
  accent?: Accent;
}

const ACCENTS: Record<Accent, { bg: string; fg: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/40', fg: 'text-blue-600 dark:text-blue-400' },
  green: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', fg: 'text-emerald-600 dark:text-emerald-400' },
  red: { bg: 'bg-red-50 dark:bg-red-950/40', fg: 'text-red-600 dark:text-red-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', fg: 'text-amber-600 dark:text-amber-400' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', fg: 'text-violet-600 dark:text-violet-400' },
  slate: { bg: 'bg-slate-100 dark:bg-slate-800', fg: 'text-slate-600 dark:text-slate-300' },
};

export default function KPIBox({ label, value, icon, delta, hint, accent = 'blue' }: Props) {
  const a = ACCENTS[accent];
  const hasDelta = typeof delta === 'number' && !Number.isNaN(delta);
  const positive = hasDelta && delta! > 0;
  const negative = hasDelta && delta! < 0;
  const TrendIcon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  const trendColor = positive
    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400'
    : negative
      ? 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400'
      : 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300';

  return (
    <div className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50 tracking-tight tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">{hint}</p>}
        </div>
        {icon && (
          <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${a.bg} ${a.fg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
            {icon}
          </div>
        )}
      </div>
      {hasDelta && (
        <div className={`mt-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${trendColor}`}>
          <TrendIcon size={12} strokeWidth={2.5} />
          <span>{Math.abs(delta!).toFixed(1)}%</span>
        </div>
      )}
      <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-[color:var(--brand,#2563eb)]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
