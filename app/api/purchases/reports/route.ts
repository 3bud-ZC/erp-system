import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // Auth check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // Default to current month
    const now = new Date();
    const from = fromDate ? new Date(fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toDate ? new Date(toDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get purchase invoices within date range
    const invoices = await prisma.purchaseInvoice.findMany({
      where: {
        createdAt: { gte: from, lte: to },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate metrics
    const totalPurchases = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalInvoices = invoices.length;
    const averageOrderValue = totalInvoices > 0 ? totalPurchases / totalInvoices : 0;

    // Group by supplier
    const supplierMap = new Map<string, { name: string; total: number; invoiceCount: number }>();
    invoices.forEach((inv) => {
      const key = inv.supplier?.id || 'unknown';
      const supplier = supplierMap.get(key) || {
        name: inv.supplier?.nameAr || 'غير معروف',
        total: 0,
        invoiceCount: 0,
      };
      supplier.total += inv.total;
      supplier.invoiceCount += 1;
      supplierMap.set(key, supplier);
    });

    const topSuppliers = Array.from(supplierMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Get category breakdown by summing products by unit (since no category field exists)
    const unitMap = new Map<string, number>();
    invoices.forEach((inv) => {
      inv.items?.forEach((item) => {
        const unit = item.product?.unit || 'أخرى';
        unitMap.set(unit, (unitMap.get(unit) || 0) + item.total);
      });
    });

    const categoryBreakdown = Array.from(unitMap.entries()).map(([category, total]) => ({
      category,
      total,
      percentage: totalPurchases > 0 ? ((total / totalPurchases) * 100).toFixed(1) : '0',
    }));

    // Get monthly trends for the last 6 months
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthData = await prisma.purchaseInvoice.aggregate({
        _sum: { total: true },
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      });

      monthlyTrends.push({
        month: monthStart.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' }),
        total: Number(monthData._sum.total) || 0,
      });
    }

    return apiSuccess({
      totalPurchases,
      totalExpenses: totalPurchases, // For backward compatibility
      averageOrderValue,
      totalInvoices,
      topSuppliers,
      categoryBreakdown,
      monthlyTrends,
      invoices,
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }, 'Purchase reports fetched successfully');
  } catch (error) {
    console.error('Error fetching purchase reports:', error);
    return apiError('فشل في تحميل تقارير المشتريات', 500);
  }
}
