import { apiError, handleApiError } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { renderInvoice, renderPurchaseOrder, renderQuotation } from '@/lib/pdf-templates';

export const dynamic = 'force-dynamic';

const renderers: Record<string, (id: string) => Promise<string>> = {
  invoice: renderInvoice,
  'purchase-order': renderPurchaseOrder,
  quotation: renderQuotation,
};

export async function GET(req: Request, { params }: { params: { type: string; id: string } }) {
  try {
    await requireAuth(req);
    const renderer = renderers[params.type];
    if (!renderer) return apiError('نوع غير مدعوم', 400);
    const html = await renderer(params.id);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${params.type}-${params.id}.html"`,
      },
    });
  } catch (e) { return handleApiError(e, 'PDF generation'); }
}
