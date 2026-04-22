'use client';

import { useEffect, useState, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import KPIBox from '@/components/ui/KPIBox';
import ChartWrapper from '@/components/ui/ChartWrapper';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import { KPISkeleton, ChartSkeleton } from '@/components/ui/Skeleton';

interface DashboardData { kpis: Record<string, any>; charts: Record<string, any>; trends: Record<string, any>; }
type Accent = 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate';

interface KpiDef {
  key: string;
  label: string;
  format?: (v: any) => string;
  icon?: ReactNode;
  accent?: Accent;
  deltaKey?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  endpoint: string;
  kpis: KpiDef[];
  renderCharts?: (charts: Record<string, any>) => ReactNode;
  renderTrends?: (trends: Record<string, any>) => ReactNode;
}

export default function DashboardModule({ title, subtitle, endpoint, kpis, renderCharts, renderTrends }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'فشل تحميل البيانات');
      setData(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [endpoint]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>تحديث</span>
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={() => load()} />}

      {!error && (
        <>
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading
                ? Array.from({ length: kpis.length }).map((_, i) => <KPISkeleton key={i} />)
                : kpis.map(k => {
                    const v = data?.kpis?.[k.key];
                    const display = v === undefined || v === null ? '—' : (k.format ? k.format(v) : String(v));
                    const delta = k.deltaKey ? Number(data?.kpis?.[k.deltaKey]) : undefined;
                    return <KPIBox key={k.key} label={k.label} value={display} icon={k.icon} accent={k.accent} delta={Number.isFinite(delta) ? delta : undefined} />;
                  })}
            </div>
          </section>

          {(renderCharts || renderTrends) && (
            <section className="space-y-6">
              {renderCharts && (
                <div>
                  <SectionTitle title="الرسوم البيانية" />
                  {loading ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><ChartSkeleton /><ChartSkeleton /></div> : renderCharts(data?.charts || {})}
                </div>
              )}
              {renderTrends && (
                <div>
                  <SectionTitle title="الاتجاهات" />
                  {loading ? <ChartSkeleton /> : renderTrends(data?.trends || {})}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">{title}</h2>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

export { ChartWrapper };
