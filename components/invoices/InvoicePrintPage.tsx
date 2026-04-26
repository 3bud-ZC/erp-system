'use client';

/**
 * Generic print-preview client used by both
 * /invoices/sales/[id]/print and /invoices/purchases/[id]/print.
 *
 * Loads the invoice + the company branding, builds a normalized
 * `InvoicePrintData`, and renders the shared template behind a
 * non-printing toolbar (Back / Print).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Printer } from 'lucide-react';
import {
  InvoicePrintTemplate,
  type InvoicePrintData,
} from './InvoicePrintTemplate';
import { InvoiceConfig } from './InvoiceConfig';

interface ItemRaw {
  productId: string;
  product?: { nameAr?: string; nameEn?: string; code?: string };
  description?: string | null;
  quantity: number;
  price: number;
  total: number;
  discountPercent?: number;
}

interface InvoiceRaw {
  id: string;
  invoiceNumber: string;
  date: string;
  issueDate?: string | null;
  paymentTermsDays?: number | null;
  currency?: string;
  notes?: string | null;
  total: number;
  discount?: number;
  tax?: number;
  grandTotal?: number;
  paidAmount?: number;
  customer?: { nameAr?: string; name?: string; phone?: string | null; email?: string | null; address?: string | null };
  supplier?: { nameAr?: string; name?: string; phone?: string | null; email?: string | null; address?: string | null };
  items?: ItemRaw[];
}

interface CompanyRaw {
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
}

export function InvoicePrintPage({ config }: { config: InvoiceConfig }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? '';

  const [invoice, setInvoice] = useState<InvoiceRaw | null>(null);
  const [company, setCompany] = useState<CompanyRaw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [invJ, sysJ] = await Promise.all([
          fetch(config.detailApi(id), { credentials: 'include' }).then(r => r.json()),
          fetch('/api/system-settings', { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false })),
        ]);
        if (cancelled) return;
        if (!invJ.success) {
          setError(invJ.message || invJ.error || 'تعذر تحميل الفاتورة');
        } else {
          setInvoice(invJ.data);
        }
        if (sysJ?.success && sysJ.data) {
          setCompany({
            name:    sysJ.data.companyName ?? sysJ.data.tenantName ?? undefined,
            address: sysJ.data.companyAddress ?? null,
            phone:   sysJ.data.companyPhone   ?? null,
            email:   sysJ.data.companyEmail   ?? null,
            taxId:   sysJ.data.taxId          ?? null,
          });
        }
      } catch {
        if (!cancelled) setError('تعذر الاتصال بالخادم');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, config]);

  const printData: InvoicePrintData | null = useMemo(() => {
    if (!invoice) return null;
    const subtotal = Number(invoice.total ?? 0);
    const discount = Number(invoice.discount ?? 0);
    const tax      = Number(invoice.tax ?? 0);
    const grand    = Number(invoice.grandTotal ?? subtotal - discount + tax);
    const paid     = Number(invoice.paidAmount ?? 0);
    const party    = invoice.customer ?? invoice.supplier;
    return {
      kind: config.kind,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date,
      issueDate: invoice.issueDate ?? null,
      paymentTermsDays: invoice.paymentTermsDays ?? 0,
      currency: invoice.currency ?? 'EGP',
      notes: invoice.notes ?? null,
      party: {
        name:    party?.nameAr ?? party?.name ?? '—',
        phone:   party?.phone   ?? null,
        email:   party?.email   ?? null,
        address: party?.address ?? null,
      },
      lines: (invoice.items ?? []).map(it => ({
        description: (it.description?.trim() || it.product?.nameAr || it.product?.nameEn || it.productId),
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
        total: Number(it.total || 0),
        discountAmount: it.discountPercent
          ? Number(it.price || 0) * Number(it.quantity || 0) * (Number(it.discountPercent) / 100)
          : 0,
      })),
      subtotal,
      discount,
      tax,
      grandTotal: grand,
      paid,
      balance: grand - paid,
      company: company ?? undefined,
    };
  }, [invoice, company, config.kind]);

  if (loading) {
    return <div dir="rtl" className="flex items-center justify-center h-64 text-slate-500">جاري التحميل…</div>;
  }
  if (error || !printData) {
    return (
      <div dir="rtl" className="p-6 text-center">
        <p className="text-red-600 mb-3">{error ?? 'تعذر عرض الفاتورة'}</p>
        <button onClick={() => router.push(`/invoices/${config.routeBase}`)}
          className="px-4 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">
          رجوع
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="bg-slate-100 min-h-screen py-6">
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-2">
        <button onClick={() => router.push(`/invoices/${config.routeBase}`)}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowRight className="w-4 h-4" /> رجوع
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Printer className="w-4 h-4" /> طباعة
        </button>
      </div>
      <InvoicePrintTemplate data={printData} />
    </div>
  );
}
