'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Eye, Pencil, Trash2, AlertCircle, ChevronRight, ChevronLeft,
  FileText, Search, X,
} from 'lucide-react';
import { TableSkeleton, Toast, useToast } from '@/components/ui/patterns';
import { apiGet } from '@/lib/api/fetcher';
import { cn } from '@/lib/utils';
import {
  InvoiceConfig, STATUS_LABELS, PAYMENT_LABELS, fmtMoney, fmtDate,
} from './InvoiceConfig';
import { InvoiceLayout } from './InvoiceLayout';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  date?: string;
  createdAt?: string;
  total: number;
  grandTotal?: number;
  status?: string;
  paymentStatus?: string;
  customer?: { nameAr?: string; name?: string };
  supplier?: { nameAr?: string; name?: string };
}

const PAGE_SIZE = 20;

/* ────────────────────────────────────────────────────────────────────── */
/* Pagination                                                              */
/* ────────────────────────────────────────────────────────────────────── */
const Pagination = memo(function Pagination({
  page, totalPages, onPage,
}: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages = useMemo(() => {
    const all = Array.from({ length: totalPages }, (_, i) => i + 1);
    return all.filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  }, [totalPages, page]);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
        <ChevronRight className="w-4 h-4" />
      </button>
      {pages.map((p, i) => {
        const prev = pages[i - 1];
        const showEllipsis = typeof prev === 'number' && p - prev > 1;
        return (
          <span key={p} className="flex items-center gap-1">
            {showEllipsis && <span className="px-1 text-slate-400 text-sm">…</span>}
            <button onClick={() => onPage(p)}
              className={cn(
                'min-w-[32px] px-2 py-1 rounded-lg text-sm font-medium border',
                p === page
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              )}>
              {p}
            </button>
          </span>
        );
      })}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
});

/* ────────────────────────────────────────────────────────────────────── */
/* Confirm-delete dialog                                                   */
/* ────────────────────────────────────────────────────────────────────── */
function ConfirmDelete({
  invoiceNumber, error, busy, onConfirm, onCancel,
}: {
  invoiceNumber: string;
  error: string | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">حذف الفاتورة #{invoiceNumber}</h3>
            <p className="text-sm text-slate-600 mt-1">
              سيتم حذف هذه الفاتورة نهائياً وعكس أثرها على المخزون والمحاسبة.
              <br />هذا الإجراء لا يمكن التراجع عنه.
            </p>
          </div>
        </div>
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 disabled:opacity-50">
            إلغاء
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
            {busy && <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            نعم، احذف
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Main list                                                               */
/* ────────────────────────────────────────────────────────────────────── */
export function InvoiceList({ config }: { config: InvoiceConfig }) {
  const qc = useQueryClient();
  const [toast, showToast] = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [confirm,  setConfirm]  = useState<InvoiceRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const queryKey = useMemo(() => [config.kind, 'invoices', 'list'], [config.kind]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => apiGet<InvoiceRow[]>(config.listApi),
    staleTime: 30_000,
  });

  /* Filters */
  const filtered = useMemo(() => {
    const invoices = data ?? [];
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const toTs   = dateTo   ? new Date(dateTo).getTime() + 86_400_000 : Infinity;
    return invoices.filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      const t = new Date(inv.date ?? inv.createdAt ?? 0).getTime();
      if (!Number.isNaN(t) && (t < fromTs || t >= toTs)) return false;
      if (q) {
        const partyName = (inv.customer?.nameAr ?? inv.supplier?.nameAr ?? '').toLowerCase();
        if (!inv.invoiceNumber.toLowerCase().includes(q) && !partyName.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, statusFilter, dateFrom, dateTo]);

  /* KPIs over filtered set */
  const kpis = useMemo(() => {
    let total = 0, paid = 0, pending = 0, cancelled = 0;
    for (const inv of filtered) {
      const v = Number(inv.grandTotal ?? inv.total ?? 0);
      total += v;
      if (inv.status === 'paid' || inv.paymentStatus === 'paid') paid += v;
      else if (inv.status === 'cancelled') cancelled += v;
      else pending += v;
    }
    return { total, paid, pending, cancelled, count: filtered.length };
  }, [filtered]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  /* Delete */
  const doDelete = useCallback(async () => {
    if (!confirm) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`${config.listApi}?id=${encodeURIComponent(confirm.id)}`, {
        method: 'DELETE', credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        const raw = json.message || json.error || `فشل الحذف (HTTP ${res.status})`;
        setDeleteError(translateDeleteError(raw, config.partyLabel));
        return;
      }
      setConfirm(null);
      showToast('تم حذف الفاتورة بنجاح', 'success');
      qc.invalidateQueries({ queryKey });
      refetch();
    } catch {
      setDeleteError('تعذر الاتصال بالخادم');
    } finally {
      setDeleting(false);
    }
  }, [confirm, config.listApi, config.partyLabel, qc, queryKey, refetch, showToast]);

  const clearFilters = () => {
    setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo(''); setPage(1);
  };
  const hasFilters = search || statusFilter !== 'all' || dateFrom || dateTo;

  return (
    <InvoiceLayout
      title={config.title}
      subtitle={`${kpis.count} فاتورة • إجمالي ${fmtMoney(kpis.total)}`}
      toolbar={
        <Link href={`/invoices/${config.routeBase}/new`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> فاتورة جديدة
        </Link>
      }
    >
      <Toast toast={toast} />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox title="الإجمالي"   value={fmtMoney(kpis.total)}     count={kpis.count}     color="slate" />
        <KpiBox title="مدفوعة"     value={fmtMoney(kpis.paid)}      color="green" />
        <KpiBox title="معلقة/آجلة" value={fmtMoney(kpis.pending)}   color="amber" />
        <KpiBox title="ملغاة"      value={fmtMoney(kpis.cancelled)} color="red" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={`بحث بالرقم أو ${config.partyLabel}…`}
            className="w-full border border-slate-300 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {hasFilters && (
          <button onClick={clearFilters}
            className="md:col-span-5 text-xs text-slate-500 hover:text-slate-800 self-start flex items-center gap-1">
            <X className="w-3 h-3" /> مسح الفلاتر
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{(error as Error).message}</p>
            <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              إعادة المحاولة
            </button>
          </div>
        ) : isLoading ? (
          <TableSkeleton rows={6} cols={["w-20","w-28","w-16","w-24","w-16","w-16","w-16"]} />
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">
              {hasFilters ? 'لا توجد فواتير مطابقة للفلاتر' : 'لا توجد فواتير بعد'}
            </p>
            {!hasFilters && (
              <Link href={`/invoices/${config.routeBase}/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                <Plus className="w-4 h-4" /> أنشئ أول فاتورة
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs">رقم الفاتورة</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs">{config.partyLabel}</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs">التاريخ</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs">الإجمالي</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs">الحالة</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs">الدفع</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(inv => {
                  const partyName = inv.customer?.nameAr ?? inv.supplier?.nameAr ?? '—';
                  const statusInfo = STATUS_LABELS[inv.status ?? ''] ?? STATUS_LABELS.pending;
                  const payInfo = PAYMENT_LABELS[inv.paymentStatus ?? 'cash'] ?? PAYMENT_LABELS.cash;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-blue-600 font-mono text-xs">
                        <Link href={`/invoices/${config.routeBase}/${inv.id}`} className="hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{partyName}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs">{fmtDate(inv.date ?? inv.createdAt)}</td>
                      <td className="px-3 py-2.5 text-slate-900 font-semibold tabular-nums">
                        {fmtMoney(inv.grandTotal ?? inv.total)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs border', statusInfo.cls)}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs border', payInfo.cls)}>
                          {payInfo.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/invoices/${config.routeBase}/${inv.id}`}
                            title="عرض"
                            className="p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-md">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link href={`/invoices/${config.routeBase}/${inv.id}/edit`}
                            title="تعديل"
                            className="p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 rounded-md">
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button onClick={() => { setConfirm(inv); setDeleteError(null); }}
                            title="حذف"
                            className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-md">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500">
            <span>عرض {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} من {filtered.length}</span>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmDelete
          invoiceNumber={confirm.invoiceNumber}
          error={deleteError}
          busy={deleting}
          onConfirm={doDelete}
          onCancel={() => { setConfirm(null); setDeleteError(null); }}
        />
      )}
    </InvoiceLayout>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
function KpiBox({
  title, value, count, color,
}: {
  title: string; value: string; count?: number;
  color: 'slate' | 'green' | 'amber' | 'red';
}) {
  const palette: Record<string, string> = {
    slate: 'border-slate-200 text-slate-700',
    green: 'border-green-200 text-green-700',
    amber: 'border-amber-200 text-amber-700',
    red:   'border-red-200 text-red-700',
  };
  return (
    <div className={cn('bg-white rounded-xl border-r-4 shadow-sm p-3', palette[color])}>
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
      {count != null && <p className="text-xs text-slate-400 mt-0.5">{count} فاتورة</p>}
    </div>
  );
}

/* Translate a raw delete-API error into a user-friendly Arabic message. */
function translateDeleteError(raw: string, partyLabel: string): string {
  const r = raw.toLowerCase();
  if (r.includes('payment') || r.includes('foreign key') || r.includes('p2003')) {
    return `لا يمكن حذف هذه الفاتورة لأنها مرتبطة بمدفوعات أو قيود محاسبية. احذف المدفوعات المرتبطة أولاً، أو ألغِ الفاتورة (تغيير الحالة إلى "ملغاة") بدلاً من حذفها.`;
  }
  if (r.includes('return')) {
    return 'لا يمكن حذف هذه الفاتورة لأنها مرتبطة بمرتجع. احذف المرتجع أولاً.';
  }
  if (r.includes('not found')) {
    return 'الفاتورة غير موجودة (ربما تم حذفها بالفعل).';
  }
  return raw;
}
