/**
 * Print-optimized invoice template.
 *
 * Renders an A4-sized invoice document with @media print rules so it can
 * be sent to the browser's native print dialog (`window.print()`) without
 * any extra dependencies.
 *
 * Both sales and purchase invoices share the same layout — the only
 * difference is which counterparty is shown in the header (`customer` vs
 * `supplier`) and the invoice number prefix (`INV-` vs `PI-`).
 */

import React from 'react';

export type InvoiceKind = 'sales' | 'purchase';

export interface InvoicePrintParty {
  /** Display name (Arabic). */
  name: string;
  /** Optional phone, email, address — printed below the name. */
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface InvoicePrintLine {
  description: string;
  quantity: number;
  price: number;
  total: number;
  /** Optional per-line discount (% or amount) — already-resolved amount in currency. */
  discountAmount?: number;
}

export interface InvoicePrintData {
  kind: InvoiceKind;
  invoiceNumber: string;
  date: string | Date;
  issueDate?: string | Date | null;
  paymentTermsDays?: number | null;
  currency?: string;
  /** Optional notes block. */
  notes?: string | null;
  /** Counterparty (customer for sales, supplier for purchase). */
  party: InvoicePrintParty;
  lines: InvoicePrintLine[];
  /** Header-level totals. */
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paid: number;
  /** Computed: grandTotal - paid. */
  balance: number;
  /** Optional company info for the header. */
  company?: {
    name?: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    /** Tax registration number, etc. */
    taxId?: string | null;
  };
}

function fmtMoney(v: number, currency: string = 'EGP'): string {
  // toLocaleString gives nice Arabic numerals; we append a short currency symbol.
  const symbol = currency === 'EGP' ? 'ج.م' : currency;
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

function fmtDate(d?: string | Date | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  // dd/mm/yyyy is what the print samples show.
  return date.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function InvoicePrintTemplate({ data }: { data: InvoicePrintData }) {
  const c = data.currency ?? 'EGP';
  const isSales = data.kind === 'sales';
  const headerLabel = isSales ? 'فاتورة' : 'فاتورة مشتريات';
  const partyLabel = isSales ? 'فاتورة إلى:' : 'مورد:';

  return (
    <div dir="rtl" className="invoice-print-root mx-auto bg-white text-slate-900 p-8" style={{ width: '210mm', minHeight: '297mm', fontFamily: 'Cairo, Tajawal, system-ui, sans-serif' }}>
      {/* ── Print-only style ── */}
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          html, body { background: #fff; }
          body * { visibility: hidden !important; }
          .invoice-print-root, .invoice-print-root * { visibility: visible !important; }
          .invoice-print-root { position: absolute; left: 0; top: 0; box-shadow: none !important; padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header className="text-center border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">{headerLabel}</h1>
        {data.company?.name && (
          <p className="text-xl font-semibold text-blue-700 mt-2">{data.company.name}</p>
        )}
        {data.company?.address && (
          <p className="text-sm text-slate-600 mt-1">{data.company.address}</p>
        )}
        {(data.company?.phone || data.company?.email) && (
          <p className="text-xs text-slate-500 mt-1">
            {data.company.phone && <span>📞 {data.company.phone}</span>}
            {data.company.phone && data.company.email && <span className="mx-2">·</span>}
            {data.company.email && <span>✉️ {data.company.email}</span>}
          </p>
        )}
        {data.company?.taxId && (
          <p className="text-xs text-slate-500 mt-1">رقم البطاقة الضريبية: {data.company.taxId}</p>
        )}
      </header>

      {/* ── Counterparty + meta ── */}
      <section className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-1">{partyLabel}</h2>
          <p className="text-base font-bold">{data.party.name}</p>
          {data.party.address && <p className="text-sm text-slate-600">{data.party.address}</p>}
          {data.party.phone   && <p className="text-sm text-slate-600">📞 {data.party.phone}</p>}
          {data.party.email   && <p className="text-sm text-slate-600">✉️ {data.party.email}</p>}
        </div>
        <div className="text-left">
          <table className="ms-auto text-sm">
            <tbody>
              <tr>
                <td className="text-slate-500 pl-4">رقم الفاتورة:</td>
                <td className="font-semibold font-mono">{data.invoiceNumber}</td>
              </tr>
              <tr>
                <td className="text-slate-500 pl-4">تاريخ الفاتورة:</td>
                <td className="font-semibold">{fmtDate(data.date)}</td>
              </tr>
              {data.issueDate && (
                <tr>
                  <td className="text-slate-500 pl-4">تاريخ الإصدار:</td>
                  <td className="font-semibold">{fmtDate(data.issueDate)}</td>
                </tr>
              )}
              {(data.paymentTermsDays ?? 0) > 0 && (
                <tr>
                  <td className="text-slate-500 pl-4">شروط الدفع:</td>
                  <td className="font-semibold">خلال {data.paymentTermsDays} يوم</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Items table ── */}
      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2 py-2 text-right font-semibold">البند</th>
            <th className="border border-slate-300 px-2 py-2 text-center font-semibold w-20">كمية</th>
            <th className="border border-slate-300 px-2 py-2 text-center font-semibold w-28">سعر</th>
            <th className="border border-slate-300 px-2 py-2 text-center font-semibold w-24">التخفيض</th>
            <th className="border border-slate-300 px-2 py-2 text-center font-semibold w-32">المجموع</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.length === 0 ? (
            <tr>
              <td colSpan={5} className="border border-slate-300 py-4 text-center text-slate-400">
                لا توجد بنود
              </td>
            </tr>
          ) : data.lines.map((line, i) => (
            <tr key={i}>
              <td className="border border-slate-300 px-2 py-1.5">{line.description}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">{line.quantity}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">{fmtMoney(line.price, c)}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">{fmtMoney(line.discountAmount ?? 0, c)}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center font-semibold tabular-nums">{fmtMoney(line.total, c)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <section className="flex justify-end mb-6">
        <table className="text-sm min-w-[280px]">
          <tbody>
            <tr>
              <td className="py-1 pl-6 text-slate-600">المجموع</td>
              <td className="py-1 text-left font-semibold tabular-nums">{fmtMoney(data.subtotal, c)}</td>
            </tr>
            {data.discount > 0 && (
              <tr>
                <td className="py-1 pl-6 text-slate-600">الخصم</td>
                <td className="py-1 text-left tabular-nums text-red-600">- {fmtMoney(data.discount, c)}</td>
              </tr>
            )}
            {data.tax > 0 && (
              <tr>
                <td className="py-1 pl-6 text-slate-600">الضريبة</td>
                <td className="py-1 text-left tabular-nums">+ {fmtMoney(data.tax, c)}</td>
              </tr>
            )}
            <tr className="border-t border-slate-900">
              <td className="py-2 pl-6 font-bold">الإجمالي</td>
              <td className="py-2 text-left font-bold tabular-nums text-blue-700">{fmtMoney(data.grandTotal, c)}</td>
            </tr>
            <tr>
              <td className="py-1 pl-6 text-slate-600">مدفوع</td>
              <td className="py-1 text-left tabular-nums">{fmtMoney(data.paid, c)}</td>
            </tr>
            <tr className="bg-slate-50">
              <td className="py-1.5 pl-6 font-semibold">الرصيد المستحق</td>
              <td className="py-1.5 text-left font-bold tabular-nums">{fmtMoney(data.balance, c)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Notes ── */}
      {data.notes && (
        <section className="border-t border-slate-200 pt-3 mb-6">
          <h3 className="text-xs font-semibold text-slate-500 mb-1">ملاحظات</h3>
          <p className="text-sm text-slate-700 whitespace-pre-line">{data.notes}</p>
        </section>
      )}

      {/* ── Footer / signature ── */}
      <footer className="border-t border-slate-200 pt-6 mt-auto grid grid-cols-2 gap-6 text-xs text-slate-500">
        <div>
          <p>تم إصدار هذه الفاتورة إلكترونياً.</p>
        </div>
        <div className="text-left">
          <p className="border-b border-slate-300 inline-block pb-1 px-12">توقيع المستلم</p>
        </div>
      </footer>
    </div>
  );
}

export default InvoicePrintTemplate;
