import { apiSuccess, handleApiError } from '@/lib/api-response';
import { withDashboard } from '@/lib/dashboard-helpers';
import { salesAggregations } from '@/lib/aggregation-queries';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const data = await withDashboard(req, 'sales', async ({ startDate, endDate }) => {
      const [revenue, byCustomer, byProduct, trend, pending, invoices] = await Promise.all([
        salesAggregations.getTotalRevenue(startDate, endDate),
        salesAggregations.getSalesByCustomer(startDate, endDate),
        salesAggregations.getSalesByProduct(startDate, endDate),
        salesAggregations.getMonthlySalesTrend(endDate.getFullYear()),
        prisma.salesInvoice.count({ where: { status: 'pending' } }),
        prisma.salesInvoice.count({ where: { date: { gte: startDate, lte: endDate } } }),
      ]);
      const avgOrder = invoices ? Number(revenue) / invoices : 0;
      return {
        kpis: { totalRevenue: revenue, invoicesCount: invoices, pendingCount: pending, avgOrderValue: avgOrder },
        charts: { topCustomers: byCustomer.slice(0, 10), topProducts: byProduct.slice(0, 10) },
        trends: { monthlyRevenue: trend },
      };
    });
    return apiSuccess(data);
  } catch (e) { return handleApiError(e, 'Sales dashboard'); }
}
