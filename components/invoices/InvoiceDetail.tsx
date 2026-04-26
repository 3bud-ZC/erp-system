'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Printer, Pencil, Trash2, AlertCircle, CheckCircle, Wallet,
} from 'lucide-react';
import { Toast, useToast } from '@/components/ui/patterns';
import {
  InvoiceConfig, STATUS_LABELS, PAYMENT_LABELS, fmtMoney, fmtDate,
} from './InvoiceConfig';
import { InvoiceLayout } from './InvoiceLayout';
import { cn } from '@/lib/utils';

interface DetailItem {
  id: string;
  productId: string;
  product?: { nameAr?: string; code?: string };
  description?: string | null;
  quantity: number;
  price: number;
  total: number;
}

interface DetailInvoice {
  id: string;
  invoiceNumber: string;
  customer?: { nameAr?: string; phone?: string | null; email?: string | null };
  supplier?: { nameAr?: string; phone?: string | null; email?: string | null };
  date: string;
  issueDate?: string | null;
  status?: string;
  paymentStatus?: string;
  paymentTermsDays?: number | null;
  currency?: string | null;
  notes?: string | null;
  total: number;
  discount?: number;
  tax?: number;
  grandTotal?: number;
  paidAmount?: number;
  items?: DetailItem[];
}

export function InvoiceDetail({ config }: { config: InvoiceConfig }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? '';
  const [toast, showToast] = useToast();

  const [inv, setInv] = useState<DetailInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(config.detailApi(id), { credentials: 'include' });
        const j = await r.json();
        if (cancelled) return;
        if (!j.success) {
          setError(j.message || j.error || 'تعذر تحميل الفاتورة');
        } else {
          setInv(j.data);
        }
      } catch {
        if (!cancelled) setError('تعذر الاتصال بالخادم');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, config]);

  const totals = useMemo(() => {
    if (!inv) return null;
    const subtotal = Number(inv.total ?? 0);
    const discount = Number(inv.discount ?? 0);
    const tax      = Number(inv.tax ?? 0);
    const grand    = Number(inv.grandTotal ?? subtotal - discount + tax);
    const paid     = Number(inv.paidAmount ?? 0);
    return { subtotal, discount, tax, grand, paid, balance: grand - paid };
  }, [inv]);

  async function handleDelete() {
    if (!inv) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`${config.listApi}?id=${encodeURIComponent(inv.id)}`, {
        method: 'DELETE', credentials: 'include',
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.success === false) {
        const raw = j.message || j.error || `فشل الحذف (HTTP ${res.status})`;
        setDeleteError(translateDeleteError(raw));
        return;
      }
      showToast('تم حذف الفاتورة', 'success');
      setTimeout(() => router.push(`/invoices/${config.routeBase}`), 800);
    } catch {
      setDeleteError('تعذر الاتصال بالخادم');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <InvoiceLayout title="جاري التحميل…">
        <div className="flex items-center justify-center h-64 text-slate-500">جاري التحميل…</div>
      </InvoiceLayout>
    );
  }
  if (error || !inv || !totals) {
    return (
      <InvoiceLayout title="خطأ">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <p className="text-red-600 mb-4">{error ?? 'الفاتورة غير موجودة'}</p>
          <Link href={`/invoices/${config.routeBase}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">
            <ArrowRight className="w-4 h-4" /> رجوع للقائمة
          </Link>
        </div>
      </InvoiceLayout>
    );
  }

  const statusInfo = STATUS_LABELS[inv.status ?? ''] ?? STATUS_LABELS.pending;
  const payInfo = PAYMENT_LABELS[inv.paymentStatus ?? 'cash'] ?? PAYMENT_LABELS.cash;
  const party = inv.customer ?? inv.supplier;

  return (
    <InvoiceLayout
      title={`فاتورة #${inv.invoiceNumber}`}
      subtitle={`${config.titleSingular} • ${fmtDate(inv.date)}`}
      toolbar={
        <>
          <Link href={`/invoices/${config.routeBase}`}
            className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">
            <ArrowRight className="w-4 h-4" /> رجوع
          </Link>
          <Link href={`/invoices/${config.routeBase}/${inv.id}/print`}
            className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">
            <Printer className="w-4 h-4" /> طباعة
          </Link>
          <Link href={`/invoices/${config.routeBase}/${inv.id}/edit`}
            className="text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-1 border border-amber-200 rounded-lg px-3 py-2">
            <Pencil className="w-4 h-4" /> تعديل
          </Link>
          <button onClick={() => { setConfirmDelete(true); setDeleteError(null); }}
            className="text-sm text-red-700 hover:bg-red-50 flex items-center gap-1 border border-red-200 rounded-lg px-3 py-2">
            <Trash2 className="w-4 h-4" /> حذف
          </button>
        </>
      }
    >
      <Toast toast={toast} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Party */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">{config.partyLabel}</h3>
          <p className="text-base font-bold text-slate-900">{party?.nameAr ?? '—'}</p>
          {party?.phone && <p className="text-sm text-slate-500 mt-1">📞 {party.phone}</p>}
          {party?.email && <p className="text-sm text-slate-500 mt-0.5">✉️ {party.email}</p>}
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">الحالة</h3>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs border', statusInfo.cls)}>
              {statusInfo.label}
            </span>
            <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs border', payInfo.cls)}>
              {payInfo.label}
            </span>
          </div>
          {(inv.paymentTermsDays ?? 0) > 0 && (
            <p className="text-xs text-slate-500">شروط الدفع: خلال {inv.paymentTermsDays} يوم</p>
          )}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">الإجماليات</h3>
          <div className="text-2xl font-bold text-blue-700 tabular-nums">{fmtMoney(totals.grand)}</div>
          {totals.balance > 0 && (
            <p className="text-xs text-red-600 mt-1">رصيد مستحق: {fmtMoney(totals.balance)}</p>
          )}
          {totals.paid > 0 && totals.balance <= 0 && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> مسدّدة بالكامل
            </p>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">البنود</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">المنتج</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">البيان</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">الكمية</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">السعر</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(inv.items ?? []).map(it => (
              <tr key={it.id}>
                <td className="px-3 py-2 text-slate-700">
                  {it.product?.nameAr ?? it.productId}
                  {it.product?.code && <span className="text-xs text-slate-400 me-2 font-mono">{it.product.code}</span>}
                </td>
                <td className="px-3 py-2 text-slate-500 text-xs">{it.description ?? '—'}</td>
                <td className="px-3 py-2 text-center tabular-nums">{it.quantity}</td>
                <td className="px-3 py-2 text-center tabular-nums">{fmtMoney(it.price)}</td>
                <td className="px-3 py-2 text-left tabular-nums font-semibold">{fmtMoney(it.total)}</td>
              </tr>
            ))}
            {(!inv.items || inv.items.length === 0) && (
              <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-sm">لا توجد بنود</td></tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="ms-auto max-w-xs space-y-1 text-sm">
            <Row label="المجموع الفرعي" value={fmtMoney(totals.subtotal)} />
            {totals.discount > 0 && <Row label="الخصم" value={`- ${fmtMoney(totals.discount)}`} red />}
            {totals.tax > 0 && <Row label="الضريبة" value={`+ ${fmtMoney(totals.tax)}`} />}
            <Row label="الإجمالي" value={fmtMoney(totals.grand)} bold />
            {totals.paid > 0 && <Row label="المدفوع" value={fmtMoney(totals.paid)} green />}
            {totals.balance > 0 && <Row label="الرصيد المستحق" value={fmtMoney(totals.balance)} red bold />}
          </div>
        </div>
      </div>

      {/* Notes */}
      {inv.notes && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">ملاحظات</h3>
          <p className="text-sm text-slate-600 whitespace-pre-line">{inv.notes}</p>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">حذف الفاتورة #{inv.invoiceNumber}</h3>
                <p className="text-sm text-slate-600 mt-1">
                  سيتم حذف هذه الفاتورة نهائياً وعكس أثرها على المخزون والمحاسبة.
                  <br />هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmDelete(false); setDeleteError(null); }} disabled={deleting}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 disabled:opacity-50">
                إلغاء
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'جاري الحذف…' : 'نعم، احذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </InvoiceLayout>
  );
}

/* ─── Helpers ─── */
function Row({
  label, value, bold, red, green,
}: { label: string; value: string; bold?: boolean; red?: boolean; green?: boolean }) {
  const tone = red ? 'text-red-600' : green ? 'text-green-700' : 'text-slate-700';
  return (
    <div className={cn(
      'flex justify-between',
      bold ? 'border-t border-slate-300 pt-1.5 mt-1 font-bold' : 'text-slate-600',
      tone,
    )}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function translateDeleteError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('payment') || r.includes('foreign key') || r.includes('p2003')) {
    return 'لا يمكن حذف هذه الفاتورة لأنها مرتبطة بمدفوعات أو قيود محاسبية. احذف المدفوعات أولاً، أو ألغِ الفاتورة (تغيير الحالة إلى "ملغاة") بدلاً من حذفها.';
  }
  if (r.includes('return')) return 'لا يمكن حذف هذه الفاتورة لأنها مرتبطة بمرتجع.';
  if (r.includes('not found')) return 'الفاتورة غير موجودة (ربما تم حذفها بالفعل).';
  return raw;
}
