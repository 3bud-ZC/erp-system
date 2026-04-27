'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import {
  ClipboardList, Layers, GitBranch, AlertTriangle, Plus, ArrowLeft, Factory,
  CheckCircle, Clock, Hourglass,
} from 'lucide-react';
import { ManufacturingLayout } from '@/components/manufacturing/ManufacturingLayout';
import { KpiCard } from '@/components/accounting/AccountingLayout';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  status: string;
  quantity: number;
  produced?: number;
  date: string;
  product?: { nameAr?: string; code?: string; unit?: string };
  productionLine?: { name?: string };
}

interface BOMItemLite { id: string; productId: string; quantity: number }
interface ProductionLineLite { id: string; status: string }
interface WasteLite { id: string; date: string; quantity: number }

export default function ManufacturingHubPage() {
  const ordersQ = useQuery({
    queryKey: ['production-orders'],
    queryFn:  () => apiGet<ProductionOrder[]>('/api/production-orders'),
    staleTime: 30_000,
  });
  const bomQ = useQuery({
    queryKey: ['bom'],
    queryFn:  () => apiGet<BOMItemLite[]>('/api/bom'),
    staleTime: 60_000,
  });
  const linesQ = useQuery({
    queryKey: ['production-lines'],
    queryFn:  () => apiGet<ProductionLineLite[]>('/api/production-lines'),
    staleTime: 60_000,
  });
  const wasteQ = useQuery({
    queryKey: ['production-waste'],
    queryFn:  () => apiGet<{ wastes: WasteLite[] } | WasteLite[]>('/api/production-waste').catch(() => [] as WasteLite[]),
    staleTime: 60_000,
  });

  const orders = useMemo(() => ordersQ.data ?? [], [ordersQ.data]);
  const bom    = useMemo(() => bomQ.data    ?? [], [bomQ.data]);
  const lines  = useMemo(() => linesQ.data  ?? [], [linesQ.data]);
  const wastes = useMemo<WasteLite[]>(() => {
    const raw = wasteQ.data;
    if (Array.isArray(raw)) return raw;
    return raw?.wastes ?? [];
  }, [wasteQ.data]);

  const stats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth(), year = now.getFullYear();
    const today = now.toISOString().slice(0, 10);

    return {
      pending:        orders.filter(o => o.status === 'pending').length,
      inProgress:     orders.filter(o => o.status === 'in_progress').length,
      completedToday: orders.filter(o => o.status === 'completed' && (o.date || '').slice(0, 10) === today).length,
      bomProducts:    new Set(bom.map(b => b.productId)).size,
      activeLines:    lines.filter(l => l.status === 'active').length,
      wasteThisMonth: wastes
        .filter(w => {
          const d = new Date(w.date);
          return d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((s, w) => s + (Number(w.quantity) || 0), 0),
    };
  }, [orders, bom, lines, wastes]);

  const loading = ordersQ.isLoading || bomQ.isLoading || linesQ.isLoading;

  return (
    <ManufacturingLayout
      title="التصنيع"
      subtitle="إدارة عمليات الإنتاج، قوائم المواد، خطوط الإنتاج، والفاقد"
      toolbar={
        <Link
          href="/manufacturing/production-orders/new"
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> أمر إنتاج جديد
        </Link>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="أوامر تحت التنفيذ"
          value={loading ? '…' : stats.inProgress}
          subtitle="قيد الإنتاج الآن"
          icon={Hourglass}
          color="blue"
        />
        <KpiCard
          title="أوامر معلقة"
          value={loading ? '…' : stats.pending}
          subtitle="بانتظار البدء"
          icon={Clock}
          color="amber"
        />
        <KpiCard
          title="أُنجز اليوم"
          value={loading ? '…' : stats.completedToday}
          icon={CheckCircle}
          color="green"
        />
        <KpiCard
          title="فاقد الشهر"
          value={loading ? '…' : stats.wasteThisMonth.toLocaleString('ar-EG')}
          subtitle="إجمالي الكمية"
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <NavCard
          href="/manufacturing/production-orders"
          title="أوامر الإنتاج"
          description="إنشاء، متابعة، وإكمال أوامر الإنتاج"
          icon={ClipboardList}
          stat={`${orders.length} أمر`}
          accent="bg-blue-50 text-blue-600"
        />
        <NavCard
          href="/manufacturing/bom"
          title="قوائم المواد (BOM)"
          description="تعريف المواد المطلوبة لكل منتج نهائي"
          icon={Layers}
          stat={`${stats.bomProducts} منتج معرّف`}
          accent="bg-emerald-50 text-emerald-600"
        />
        <NavCard
          href="/manufacturing/production-lines"
          title="خطوط الإنتاج"
          description="إدارة خطوط الإنتاج وتعيين المنتجات لها"
          icon={GitBranch}
          stat={`${stats.activeLines} خط نشط`}
          accent="bg-purple-50 text-purple-600"
        />
        <NavCard
          href="/manufacturing/waste"
          title="الفاقد"
          description="تسجيل ومتابعة الفاقد والمواد التالفة"
          icon={AlertTriangle}
          stat="سجل وتتبع"
          accent="bg-red-50 text-red-600"
        />
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">آخر أوامر الإنتاج</h3>
          </div>
          <Link href="/manufacturing/production-orders" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
            عرض الكل <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">جاري التحميل…</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10">
            <Factory className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">لا توجد أوامر إنتاج بعد</p>
            <Link href="/manufacturing/production-orders/new" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm mt-2">
              <Plus className="w-3.5 h-3.5" /> أنشئ أول أمر
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">رقم الأمر</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">المنتج</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">خط الإنتاج</th>
                  <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">الكمية</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 8).map(o => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-slate-700">{o.orderNumber}</td>
                    <td className="px-3 py-2 text-slate-800">{o.product?.nameAr ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{o.productionLine?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-left tabular-nums">
                      {(o.produced ?? 0).toLocaleString('ar-EG')} / {o.quantity.toLocaleString('ar-EG')} {o.product?.unit ?? ''}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ManufacturingLayout>
  );
}

function NavCard({
  href, title, description, icon: Icon, stat, accent,
}: {
  href: string; title: string; description: string;
  icon: any; stat: string; accent: string;
}) {
  return (
    <Link href={href}
      className="group bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-200 transition-all p-4 flex flex-col gap-3"
    >
      <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
        <span>{stat}</span>
        <ArrowLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string; cls: string }> = {
    pending:     { label: 'معلّق',         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    in_progress: { label: 'قيد التنفيذ',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    completed:   { label: 'مكتمل',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    cancelled:   { label: 'ملغى',           cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  };
  const m = labels[status] ?? labels.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
      {m.label}
    </span>
  );
}
