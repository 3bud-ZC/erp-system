'use client';

import { ReactNode } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

type ChartType = 'bar' | 'line' | 'area';
export interface ChartPoint { label: string; value: number; [k: string]: any }

interface Props {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  data?: ChartPoint[];
  type?: ChartType;
  color?: string;
  height?: number;
  action?: ReactNode;
}

export default function ChartWrapper({
  title, subtitle, children, data, type = 'bar', color, height = 280, action,
}: Props) {
  const hasData = data && data.length > 0;
  const brand = color || 'var(--brand, #2563eb)';
  return (
    <div className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between px-6 pt-5 pb-2">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="px-4 pb-5" style={{ height }}>
        {children ? children : hasData ? <RenderChart data={data!} type={type} color={brand as string} /> : <Empty />}
      </div>
    </div>
  );
}

function RenderChart({ data, type, color }: { data: ChartPoint[]; type: ChartType; color: string }) {
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-gray-800" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500 dark:text-gray-400" axisLine={{ stroke: 'currentColor', className: 'text-gray-200 dark:text-gray-700' } as any} tickLine={false} />
      <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500 dark:text-gray-400" axisLine={false} tickLine={false} width={40} />
      <Tooltip
        contentStyle={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', backgroundColor: 'rgba(255,255,255,0.98)' }}
        wrapperClassName="dark:![&>div]:!bg-gray-900 dark:![&>div]:!border-gray-700 dark:![&>div]:!text-gray-100"
        cursor={{ fill: 'rgba(37,99,235,0.06)' }}
      />
    </>
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      {type === 'line' ? (
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {common}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
        </LineChart>
      ) : type === 'area' ? (
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {common}
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill="url(#gradArea)" isAnimationActive animationDuration={800} />
        </AreaChart>
      ) : (
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {common}
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive animationDuration={700} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

function Empty() {
  return <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-500">لا توجد بيانات</div>;
}
