import { apiSuccess, handleApiError } from '@/lib/api-response';
import { withDashboard } from '@/lib/dashboard-helpers';
import { purchaseAggregations } from '@/lib/aggregation-queries';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const data = await withDashboard(req, 'purchase', async ({ startDate, endDate }) => {
      const [total, bySupplier, openPO, pendingGR, invoicesCount] = await Promise.all([
        purchaseAggregations.getTotalPurchases(startDate, endDate),
        purchaseAggregations.getPurchasesBySupplier(startDate, endDate),
        prisma.purchaseOrder.count({ where: { status: { in: ['pending', 'approved'] } } }),
        prisma.goodsReceipt.count({ where: { status: 'pending' } }).catch(() => 0),
        prisma.purchaseInvoice.count({ where: { date: { gte: startDate, lte: endDate } } }),
      ]);
      return {
        kpis: { totalPurchases: total, openPurchaseOrders: openPO, pendingGoodsReceipts: pendingGR, invoicesCount },
        charts: { topSuppliers: bySupplier.slice(0, 10) },
        trends: {},
      };
    });
    return apiSuccess(data);
  } catch (e) { return handleApiError(e, 'Purchase dashboard'); }
}
