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
    const supplierId = searchParams.get('supplierId');
    const rawMaterialId = searchParams.get('rawMaterialId');

    // Default to current month
    const now = new Date();
    const from = fromDate ? new Date(fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toDate ? new Date(toDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Build where clause
    const where: any = {
      createdAt: { gte: from, lte: to },
    };
    if (supplierId) {
      where.supplierId = supplierId;
    }

    // Get purchase invoices within date range
    const invoices = await prisma.purchaseInvoice.findMany({
      where,
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

    // Filter by raw material if specified
    let filteredInvoices = invoices;
    let rawMaterialDetails = null;

    if (rawMaterialId) {
      filteredInvoices = invoices.filter(inv => 
        inv.items.some(item => item.productId === rawMaterialId)
      );

      // Calculate raw material specific data
      const materialItems = filteredInvoices.flatMap(inv => 
        inv.items.filter(item => item.productId === rawMaterialId)
      );

      const totalQuantity = materialItems.reduce((sum, item) => sum + item.quantity, 0);
      const suppliers = Array.from(new Set(filteredInvoices.map(inv => inv.supplier?.nameAr).filter(Boolean)));
      
      const purchaseDetails = materialItems.map(item => ({
        price: item.price,
        quantity: item.quantity,
        date: invoices.find(inv => inv.items.includes(item))?.createdAt,
      }));

      // CRITICAL: Calculate average raw material price
      const avgPrice = purchaseDetails.length > 0 
        ? purchaseDetails.reduce((sum, p) => sum + p.price, 0) / purchaseDetails.length 
        : 0;

      rawMaterialDetails = {
        totalQuantity,
        suppliers,
        avgPrice,
        purchaseDetails
      };
    }

    // Calculate metrics
    const totalPurchases = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalInvoices = filteredInvoices.length;
    const averageOrderValue = totalInvoices > 0 ? totalPurchases / totalInvoices : 0;

    // Group by supplier
    const supplierMap = new Map<string, { name: string; total: number; invoiceCount: number }>();
    filteredInvoices.forEach((inv) => {
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
    filteredInvoices.forEach((inv) => {
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

      const monthWhere: any = {
        createdAt: { gte: monthStart, lte: monthEnd },
      };
      if (supplierId) monthWhere.supplierId = supplierId;

      const monthData = await prisma.purchaseInvoice.aggregate({
        _sum: { total: true },
        where: monthWhere,
      });

      monthlyTrends.push({
        month: monthStart.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' }),
        total: Number(monthData._sum.total) || 0,
      });
    }

    return apiSuccess({
      totalPurchases,
      totalExpenses: totalPurchases,
      averageOrderValue,
      totalInvoices,
      topSuppliers,
      categoryBreakdown,
      monthlyTrends,
      invoices: filteredInvoices,
      rawMaterialDetails,
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
