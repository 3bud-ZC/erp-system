'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowRight, ClipboardList, Layers, Factory, CheckCircle, XCircle, PlayCircle, AlertCircle,
} from 'lucide-react';
import { apiGet } from '@/lib/api/fetcher';
import { Toast, useToast, ErrorBanner } from '@/components/ui/patterns';
import { Section } from '@/components/ui/modal';

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  cost?: number;
  product?: { nameAr?: string; code?: string; unit?: string; stock?: number };
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  status: string;
  quantity: number;
  plannedQuantity?: number;
  actualOutputQuantity?: number;
  produced?: number;
  cost?: number;
  date: string;
  notes?: string | null;
  product?: { id: string; nameAr?: string; code?: string; unit?: string };
  productionLine?: { id: string; name?: string };
  items?: OrderItem[];
  workInProgress?: {
    rawMaterialCost: number;
    laborCost: number;
    overheadCost: number;
    totalCost: number;
    status: string;
  } | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'معلّق',         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved:    { label: 'معتمد',          cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  in_progress: { label: 'قيد التنفيذ',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  waiting:     { label: 'في الانتظار',  cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  completed:   { label: 'مكتمل',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled:   { label: 'ملغى',           cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function fmtMoney(v?: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

export default function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [toast, showToast] = useToast();

  const [order, setOrder]     = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    apiGet<ProductionOrder[]>('/api/production-orders')
      .then(list => {
        const found = list.find(o => o.id === id) ?? null;
        if (!found) setError('أمر الإنتاج غير موجود');
        setOrder(found);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  async function changeStatus(status: string, extra: Record<string, unknown> = {}) {
    if (!order) return;
    setRunning(true);
    try {
      const res = await fetch('/api/production-orders', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status, ...extra }),
      });
      const j = await res.json();
      if (j.success) {
        showToast('تم تحديث حالة الأمر', 'success');
        load();
      } else {
        showToast(j.message || j.error || 'فشلت العملية', 'error');
      }
    } catch {
      showToast('تعذر الاتصال بالخادم', 'error');
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-slate-500" dir="rtl">جاري تحميل أمر الإنتاج…</div>;
  }
  if (error || !order) {
    return <div className="p-6" dir="rtl"><ErrorBanner message={error || 'غير موجود'} onRetry={load} /></div>;
  }

  const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.pending;
  const totalCost =
    (order.workInProgress?.totalCost ?? 0) ||
    (order.cost ?? 0);

  return (
    <div className="p-6 space-y-5 pb-24" dir="rtl">
      <Toast toast={toast} />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 font-mono">{order.orderNumber}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status.cls}`}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {order.product?.nameAr ?? '—'} · بتاريخ {new Date(order.date).toLocaleDateString('ar-EG')}
            </p>
          </div>
        </div>

        <Link
          href="/manufacturing/production-orders"
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          <ArrowRight className="w-4 h-4" /> العودة للقائمة
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-6xl">
        <div className="lg:col-span-2 space-y-5">
          <Section title="تفاصيل الأمر" subtitle="بيانات المنتج والكميات">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Detail label="المنتج النهائي"  value={order.product?.nameAr ?? '—'} />
              <Detail label="رمز المنتج"       value={order.product?.code ?? '—'} mono />
              <Detail label="خط الإنتاج"       value={order.productionLine?.name ?? 'بدون'} />
              <Detail label="التاريخ"          value={new Date(order.date).toLocaleDateString('ar-EG')} />
              <Detail label="الكمية المخططة" value={`${(order.plannedQuantity ?? order.quantity).toLocaleString('ar-EG')} ${order.product?.unit ?? ''}`} />
              <Detail label="الكمية المنتجة" value={`${(order.actualOutputQuantity ?? order.produced ?? 0).toLocaleString('ar-EG')} ${order.product?.unit ?? ''}`} />
            </div>
            {order.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-sm">
                <div className="text-xs font-semibold text-slate-500 mb-1">ملاحظات</div>
                <p className="text-slate-700 whitespace-pre-line">{order.notes}</p>
              </div>
            )}
          </Section>

          <Section title="المواد المستهلكة" subtitle={`${order.items?.length ?? 0} مادة من قائمة المواد (BOM)`} action={<Layers className="w-4 h-4 text-slate-400" />}>
            {!order.items || order.items.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">لا توجد مواد مرتبطة بهذا الأمر</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">المادة</th>
                      <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">الكمية</th>
                      <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">التكلفة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map(it => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 text-slate-800">
                          <div className="font-medium">{it.product?.nameAr ?? '—'}</div>
                          {it.product?.code && (
                            <div className="text-xs text-slate-400 font-mono">{it.product.code}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700 text-left tabular-nums">
                          {it.quantity.toLocaleString('ar-EG')} {it.product?.unit ?? ''}
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-left tabular-nums">
                          {fmtMoney(it.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="ملخص التكلفة" action={<Factory className="w-4 h-4 text-slate-400" />}>
            <dl className="space-y-2 text-sm">
              <CostRow label="مواد خام"       value={fmtMoney(order.workInProgress?.rawMaterialCost)} />
              <CostRow label="عمالة"           value={fmtMoney(order.workInProgress?.laborCost)} />
              <CostRow label="تشغيل"           value={fmtMoney(order.workInProgress?.overheadCost)} />
              <div className="border-t border-slate-200 pt-2 mt-2">
                <CostRow label="الإجمالي" value={fmtMoney(totalCost)} bold />
              </div>
            </dl>
          </Section>

          <Section title="الإجراءات" subtitle="انقل الأمر بين الحالات">
            <div className="space-y-2">
              {order.status === 'pending' && (
                <ActionButton
                  onClick={() => changeStatus('approved')}
                  disabled={running}
                  icon={PlayCircle}
                  label="اعتماد وبدء التنفيذ (يخصم المواد)"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                />
              )}
              {(order.status === 'approved' || order.status === 'in_progress' || order.status === 'waiting') && (
                <ActionButton
                  onClick={() => changeStatus('completed', { actualOutputQuantity: order.plannedQuantity ?? order.quantity })}
                  disabled={running}
                  icon={CheckCircle}
                  label="إكمال الأمر (يضيف المنتج للمخزون)"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                />
              )}
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <ActionButton
                  onClick={() => changeStatus('cancelled')}
                  disabled={running}
                  icon={XCircle}
                  label="إلغاء الأمر"
                  className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                />
              )}
              {order.status === 'completed' && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  تم إكمال هذا الأمر وإضافة المنتج النهائي للمخزون.
                </div>
              )}
              {order.status === 'cancelled' && (
                <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl p-3 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  هذا الأمر ملغى.
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 mb-1">{label}</div>
      <div className={`text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function CostRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function ActionButton({
  onClick, disabled, icon: Icon, label, className,
}: {
  onClick: () => void; disabled: boolean;
  icon: any; label: string; className: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
