import { apiSuccess, handleApiError } from '@/lib/api-response';
import { withDashboard } from '@/lib/dashboard-helpers';
import { dashboardKPIs, salesAggregations } from '@/lib/aggregation-queries';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const data = await withDashboard(req, 'financial', async ({ startDate, endDate }) => {
      const [kpis, monthly] = await Promise.all([
        dashboardKPIs.getAllKPIs(startDate, endDate),
        salesAggregations.getMonthlySalesTrend(endDate.getFullYear()),
      ]);
      const profitMargin = kpis.totalRevenue > 0 ? (kpis.grossProfit / kpis.totalRevenue) * 100 : 0;
      return {
        kpis: { ...kpis, profitMargin: Number(profitMargin.toFixed(2)) },
        charts: {},
        trends: { monthlyRevenue: monthly },
      };
    });
    return apiSuccess(data);
  } catch (e) { return handleApiError(e, 'Financial dashboard'); }
}
