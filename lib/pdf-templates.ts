import { prisma } from './db';
import { getTenantSettings } from './tenant-config';

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function money(n: any, sym = 'ر.س') {
  const v = Number(n) || 0;
  return `${v.toFixed(2)} ${sym}`;
}

const BASE_CSS = `
@page{size:A4;margin:15mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,sans-serif;color:#222;direction:rtl;font-size:12px}
.page{page-break-after:always}
.page:last-child{page-break-after:auto}
.page-break{page-break-before:always}
.avoid-break{page-break-inside:avoid}
.hdr{display:flex;justify-content:space-between;border-bottom:3px solid var(--brand,#2563eb);padding-bottom:15px;margin-bottom:20px;align-items:center}
.hdr h1{color:var(--brand,#2563eb);font-size:22px}
.hdr .logo{max-height:60px;max-width:180px}
.brand-name{font-size:15px;font-weight:bold;color:#111}
.meta{text-align:left;font-size:11px;line-height:1.6}
.party{display:flex;justify-content:space-between;gap:20px;margin:15px 0;font-size:12px}
.party>div{flex:1;border:1px solid #eee;padding:10px;border-radius:4px}
.party h3{font-size:12px;color:#666;margin-bottom:6px}
table{width:100%;border-collapse:collapse;margin:15px 0;font-size:11px}
thead{display:table-header-group}
tr{page-break-inside:avoid}
th{background:var(--brand,#2563eb);color:#fff;padding:8px;text-align:right}
td{padding:8px;border-bottom:1px solid #eee}
.totals{margin-top:10px;display:flex;justify-content:flex-end}
.totals table{width:300px}
.totals td{border:none;padding:4px 8px}
.totals .grand{font-weight:bold;font-size:13px;border-top:2px solid var(--brand,#2563eb);background:#f0f7ff}
.footer{position:fixed;bottom:5mm;left:15mm;right:15mm;text-align:center;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:6px}
.footer .page-num::after{content:counter(page) ' / ' counter(pages)}
@media print{body{padding:0}.no-print{display:none}}
`;

interface Branding {
  logoUrl?: string;
  brandColor?: string;
  companyName?: string;
  companyNameAr?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
}

function buildHeader(b: Branding, title: string, metaLines: string[]) {
  const logo = b.logoUrl ? `<img class="logo" src="${esc(b.logoUrl)}" alt="logo">` : '';
  return `<div class="hdr">
    <div>${logo}<h1>${esc(title)}</h1><p class="brand-name">${esc(b.companyNameAr || b.companyName || '')}</p></div>
    <div class="meta">${metaLines.map(l => `<div>${l}</div>`).join('')}</div>
  </div>`;
}

function buildFooter(b: Branding) {
  const parts = [b.address, b.phone, b.email, b.taxNumber ? `الرقم الضريبي: ${b.taxNumber}` : ''].filter(Boolean).map(esc);
  return `<div class="footer">${parts.join(' | ')}<div>صفحة <span class="page-num"></span></div></div>`;
}

function wrap(title: string, bodyHtml: string, branding: Branding) {
  const color = branding.brandColor || '#2563eb';
  return `<!doctype html><html lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>:root{--brand:${esc(color)}}${BASE_CSS}</style></head>
    <body>${bodyHtml}${buildFooter(branding)}
    <script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
    </body></html>`;
}

function itemsTable(items: any[], sym: string) {
  const rows = items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.product?.nameAr || it.product?.name || it.description || '')}</td><td>${it.quantity}</td><td>${money(it.price, sym)}</td><td>${money(it.total, sym)}</td></tr>`).join('');
  return `<table><thead><tr><th>#</th><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function totalsBlock(doc: any, sym: string) {
  return `<div class="totals avoid-break"><table>
    <tr><td>المجموع الفرعي</td><td>${money(doc.total, sym)}</td></tr>
    <tr><td>الخصم</td><td>${money(doc.discount || 0, sym)}</td></tr>
    <tr><td>الضريبة</td><td>${money(doc.tax || 0, sym)}</td></tr>
    <tr class="grand"><td>الإجمالي</td><td>${money(doc.grandTotal || doc.total, sym)}</td></tr>
  </table></div>`;
}

async function getBranding(tenantId: string, tenant: any): Promise<Branding> {
  const s: any = await getTenantSettings(tenantId);
  return {
    logoUrl: s.logoUrl,
    brandColor: s.brandColor,
    companyName: tenant?.name,
    companyNameAr: tenant?.nameAr,
    address: tenant?.address || s.address,
    phone: tenant?.phone || s.phone,
    email: tenant?.email || s.email,
    taxNumber: s.taxNumber,
  };
}

export async function renderInvoice(id: string): Promise<string> {
  const inv: any = await prisma.salesInvoice.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } }, tenant: true },
  });
  if (!inv) throw new Error('Invoice not found');
  const s = await getTenantSettings(inv.tenantId);
  const branding = await getBranding(inv.tenantId, inv.tenant);
  const header = buildHeader(branding, 'فاتورة مبيعات', [
    `<b>رقم:</b> ${esc(inv.invoiceNumber)}`,
    `<b>التاريخ:</b> ${new Date(inv.date).toLocaleDateString('ar-EG')}`,
    `<b>الحالة:</b> ${esc(inv.status)}`,
  ]);
  const body = `<div class="page">${header}
    <div class="party"><div><h3>العميل</h3><p>${esc(inv.customer?.nameAr || inv.customer?.name)}</p><p>${esc(inv.customer?.phone || '')}</p></div></div>
    ${itemsTable(inv.items, s.currencySymbol)}
    ${totalsBlock(inv, s.currencySymbol)}
    ${inv.notes ? `<p style="margin-top:15px"><b>ملاحظات:</b> ${esc(inv.notes)}</p>` : ''}
    </div>`;
  return wrap(`Invoice ${inv.invoiceNumber}`, body, branding);
}

export async function renderPurchaseOrder(id: string): Promise<string> {
  const po: any = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { product: true } }, tenant: true },
  });
  if (!po) throw new Error('PO not found');
  const s = await getTenantSettings(po.tenantId);
  const branding = await getBranding(po.tenantId, po.tenant);
  const header = buildHeader(branding, 'أمر شراء', [
    `<b>رقم:</b> ${esc(po.orderNumber || po.poNumber || po.id)}`,
    `<b>التاريخ:</b> ${new Date(po.date || po.createdAt).toLocaleDateString('ar-EG')}`,
    `<b>الحالة:</b> ${esc(po.status)}`,
  ]);
  const body = `<div class="page">${header}
    <div class="party"><div><h3>المورد</h3><p>${esc(po.supplier?.nameAr || po.supplier?.name)}</p><p>${esc(po.supplier?.phone || '')}</p></div></div>
    ${itemsTable(po.items, s.currencySymbol)}
    ${totalsBlock(po, s.currencySymbol)}
    </div>`;
  return wrap(`PO ${po.orderNumber || po.id}`, body, branding);
}

export async function renderQuotation(id: string): Promise<string> {
  const q: any = await prisma.quotation.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } }, tenant: true },
  });
  if (!q) throw new Error('Quotation not found');
  const s = await getTenantSettings(q.tenantId);
  const branding = await getBranding(q.tenantId, q.tenant);
  const header = buildHeader(branding, 'عرض سعر', [
    `<b>رقم:</b> ${esc(q.quotationNumber || q.id)}`,
    `<b>التاريخ:</b> ${new Date(q.date || q.createdAt).toLocaleDateString('ar-EG')}`,
    `<b>صالح حتى:</b> ${q.validUntil ? new Date(q.validUntil).toLocaleDateString('ar-EG') : '-'}`,
  ]);
  const body = `<div class="page">${header}
    <div class="party"><div><h3>العميل</h3><p>${esc(q.customer?.nameAr || q.customer?.name)}</p></div></div>
    ${itemsTable(q.items, s.currencySymbol)}
    ${totalsBlock(q, s.currencySymbol)}
    </div>`;
  return wrap(`Quotation ${q.quotationNumber || q.id}`, body, branding);
}
