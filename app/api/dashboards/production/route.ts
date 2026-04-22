import { apiSuccess, handleApiError } from '@/lib/api-response';
import { withDashboard } from '@/lib/dashboard-helpers';
import { productionAggregations } from '@/lib/aggregation-queries';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const data = await withDashboard(req, 'production', async ({ startDate, endDate }) => {
      const [byLine, efficiency, inProgress, completed, waste] = await Promise.all([
        productionAggregations.getProductionByLine(startDate, endDate),
        productionAggregations.getProductionEfficiency(startDate, endDate),
        (prisma as any).productionOrder.count({ where: { status: 'in_progress' } }),
        (prisma as any).productionOrder.count({ where: { status: 'completed', startDate: { gte: startDate, lte: endDate } } }),
        (prisma as any).productionWaste.aggregate({
          _sum: { quantity: true },
          where: { createdAt: { gte: startDate, lte: endDate } },
        }).then((r: any) => Number(r._sum.quantity) || 0).catch(() => 0),
      ]);
      return {
        kpis: { efficiency, inProgress, completed, totalWaste: waste },
        charts: { productionByLine: byLine },
        trends: {},
      };
    });
    return apiSuccess(data);
  } catch (e) { return handleApiError(e, 'Production dashboard'); }
}
