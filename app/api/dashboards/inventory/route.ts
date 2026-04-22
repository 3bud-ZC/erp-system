import { apiSuccess, handleApiError } from '@/lib/api-response';
import { withDashboard } from '@/lib/dashboard-helpers';
import { inventoryAggregations } from '@/lib/aggregation-queries';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const data = await withDashboard(req, 'inventory', async ({ startDate, endDate }) => {
      const [valueByWh, lowStock, movement, totalValue, productCount] = await Promise.all([
        inventoryAggregations.getInventoryValueByWarehouse(),
        inventoryAggregations.getLowStockProducts(10),
        inventoryAggregations.getInventoryMovementSummary(startDate, endDate),
        prisma.inventoryValuation.aggregate({ _sum: { totalValue: true } }).then(r => Number(r._sum.totalValue) || 0).catch(() => 0),
        prisma.product.count(),
      ]);
      return {
        kpis: {
          totalInventoryValue: totalValue,
          totalProducts: productCount,
          lowStockCount: lowStock.length,
          inbound: movement.inbound,
          outbound: movement.outbound,
        },
        charts: { valueByWarehouse: valueByWh, lowStockItems: lowStock.slice(0, 20) },
        trends: { movement: [{ label: 'inbound', value: movement.inbound }, { label: 'outbound', value: movement.outbound }] },
      };
    });
    return apiSuccess(data);
  } catch (e) { return handleApiError(e, 'Inventory dashboard'); }
}
