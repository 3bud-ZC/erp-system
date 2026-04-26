/**
 * Single source of truth for sales-vs-purchase invoice differences.
 *
 * The form / list / detail pages are otherwise identical, so we keep the
 * differences in one config object instead of branching with `if` everywhere.
 */

export type InvoiceKind = 'sales' | 'purchase';

export interface InvoiceConfig {
  kind: InvoiceKind;
  /** Human-readable title (Arabic). */
  title: string;
  titleSingular: string;
  /** "العميل" vs "المورد". */
  partyLabel: string;
  partyLabelGenitive: string;
  /** "إضافة عميل" vs "إضافة مورد". */
  addPartyLabel: string;
  /** Route prefix under /invoices. */
  routeBase: string;          // 'sales' | 'purchases'
  /** API endpoints. */
  listApi: string;            // /api/sales-invoices
  partyApi: string;           // /api/customers | /api/suppliers
  /** /api/sales-invoices?id={id} */
  detailApi: (id: string) => string;
  /** Field name on Invoice that holds the party id. */
  partyIdField: 'customerId' | 'supplierId';
  /** Field name for the invoice's party object inside API responses. */
  partyObjectField: 'customer' | 'supplier';
  /** Field name for the rep dropdown. */
  repIdField: 'salesRepId' | 'purchaseRepId';
  /** Theme color used in cards / accents. */
  theme: 'blue' | 'amber';
  /** Default invoice-number prefix shown in placeholder. */
  numberPrefix: string;
}

export const SALES_CONFIG: InvoiceConfig = {
  kind: 'sales',
  title: 'فواتير المبيعات',
  titleSingular: 'فاتورة مبيعات',
  partyLabel: 'العميل',
  partyLabelGenitive: 'العميل',
  addPartyLabel: 'إضافة عميل',
  routeBase: 'sales',
  listApi: '/api/sales-invoices',
  partyApi: '/api/customers',
  detailApi: (id: string) => `/api/sales-invoices?id=${encodeURIComponent(id)}`,
  partyIdField: 'customerId',
  partyObjectField: 'customer',
  repIdField: 'salesRepId',
  theme: 'blue',
  numberPrefix: 'INV',
};

export const PURCHASE_CONFIG: InvoiceConfig = {
  kind: 'purchase',
  title: 'فواتير المشتريات',
  titleSingular: 'فاتورة مشتريات',
  partyLabel: 'المورد',
  partyLabelGenitive: 'المورد',
  addPartyLabel: 'إضافة مورد',
  routeBase: 'purchases',
  listApi: '/api/purchase-invoices',
  partyApi: '/api/suppliers',
  detailApi: (id: string) => `/api/purchase-invoices?id=${encodeURIComponent(id)}`,
  partyIdField: 'supplierId',
  partyObjectField: 'supplier',
  repIdField: 'purchaseRepId',
  theme: 'amber',
  numberPrefix: 'PI',
};

export function getInvoiceConfig(kind: InvoiceKind): InvoiceConfig {
  return kind === 'sales' ? SALES_CONFIG : PURCHASE_CONFIG;
}

/** Status / payment-status labels — shared. */
export const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  paid:      { label: 'مدفوعة',  cls: 'bg-green-50 text-green-700 border-green-200' },
  pending:   { label: 'معلقة',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  completed: { label: 'مكتملة',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  cancelled: { label: 'ملغاة',   cls: 'bg-red-50 text-red-600 border-red-200' },
  draft:     { label: 'مسودة',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const PAYMENT_LABELS: Record<string, { label: string; cls: string }> = {
  cash:          { label: 'نقدي',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  credit:        { label: 'آجل',        cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  partial:       { label: 'جزئي',       cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  bank_transfer: { label: 'تحويل بنكي', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
};

/* ─── Shared formatters ─── */
export function fmtMoney(v?: number | null): string {
  if (v == null) return '—';
  return `${Number(v).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

export function fmtDate(d?: string | Date | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ar-EG');
}
