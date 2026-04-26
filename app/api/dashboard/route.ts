import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateProfitAndLoss } from '@/lib/accounting';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth';

// Disable caching for dashboard data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Safe aggregate query with fallback — always tenant-scoped
async function safeAggregate(
  modelName: 'salesInvoice' | 'purchaseInvoice' | 'expense',
  sumField: string,
  startDate: Date,
  endDate: Date,
  tenantId: string
): Promise<number> {
  try {
    const model = prisma[modelName] as any;
    const result = await model.aggregate({
      _sum: { [sumField]: true },
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });
    return Number(result._sum[sumField]) || 0;
  } catch (error: any) {
    if (error.code === 'P2021') {
      console.warn(`Table ${modelName} not found, returning 0`);
      return 0;
    }
    throw error;
  }
}

// Helper: Calculate totals for a given date range
async function getFinancialData(startDate: Date, endDate: Date, tenantId: string) {
  const sales = await safeAggregate('salesInvoice', 'total', startDate, endDate, tenantId);
  const purchases = await safeAggregate('purchaseInvoice', 'total', startDate, endDate, tenantId);
  const expenses = await safeAggregate('expense', 'amount', startDate, endDate, tenantId);

  return { sales, purchases, expenses };
}

// Helper: Get monthly data for charts (last 6 months)
async function getMonthlyChartData(tenantId: string) {
  const months: string[] = [];
  const sales: number[] = [];
  const purchases: number[] = [];

  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const monthName = monthStart.toLocaleDateString('ar-EG', { month: 'short' });
    months.push(monthName);

    const data = await getFinancialData(monthStart, monthEnd, tenantId);
    sales.push(data.sales);
    purchases.push(data.purchases);
  }

  return { labels: months, sales, purchases };
}

// Safe find many with fallback — always tenant-scoped
async function safeFindMany<T>(
  modelName: 'product' | 'salesInvoice' | 'purchaseInvoice',
  tenantId: string,
  extraArgs?: any
): Promise<T[]> {
  try {
    const model = prisma[modelName] as any;
    const args = {
      ...extraArgs,
      where: { ...(extraArgs?.where ?? {}), tenantId },
    };
    return await model.findMany(args);
  } catch (error: any) {
    if (error.code === 'P2021') {
      console.warn(`Table ${modelName} not found, returning empty array`);
      return [];
    }
    throw error;
  }
}

// Helper: Get inventory breakdown by type
async function getInventoryBreakdown(tenantId: string) {
  const products = await safeFindMany('product', tenantId);

  const rawMaterials = products.filter((p: any) => p.type === 'raw_material').length;
  const finishedGoods = products.filter((p: any) => p.type === 'finished_product').length;
  const packaging = products.filter((p: any) => p.type === 'packaging').length;

  return { rawMaterials, finishedGoods, packaging };
}

// Helper: Generate recent activities — always tenant-scoped
async function getRecentActivities(tenantId: string) {
  const activities: any[] = [];

  try {
    const salesInvoices = await prisma.salesInvoice.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      where: { tenantId },
      include: { customer: true },
    });

    salesInvoices.forEach(invoice => {
      activities.push({
        id: `sale-${invoice.id}`,
        type: 'sale',
        title: `فاتورة بيع #${invoice.invoiceNumber || invoice.id.slice(-6)}`,
        description: invoice.customer?.nameAr || 'عميل غير معروف',
        amount: invoice.total,
        date: new Date(invoice.createdAt).toLocaleDateString('ar-EG'),
        status: invoice.status === 'completed' ? 'completed' : 'pending',
      });
    });
  } catch (e: any) {
    if (e.code !== 'P2021') {
      console.error('Error fetching sales invoices:', e.message);
    }
  }

  try {
    const purchaseInvoices = await prisma.purchaseInvoice.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      where: { tenantId },
      include: { supplier: true },
    });

    purchaseInvoices.forEach(invoice => {
      activities.push({
        id: `purchase-${invoice.id}`,
        type: 'purchase',
        title: `فاتورة شراء #${invoice.invoiceNumber || invoice.id.slice(-6)}`,
        description: invoice.supplier?.nameAr || 'مورد غير معروف',
        amount: invoice.total,
        date: new Date(invoice.createdAt).toLocaleDateString('ar-EG'),
        status: invoice.status === 'completed' ? 'completed' : 'pending',
      });
    });
  } catch (e: any) {
    if (e.code !== 'P2021') {
      console.error('Error fetching purchase invoices:', e.message);
    }
  }

  return activities
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
}

export async function GET(request: Request) {
  try {
    // Auth check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbError: any) {
      console.error('Database connection failed:', dbError.message);
      return apiError('Database connection failed', 500);
    }
    
    // Get current month data
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get previous month data for comparison
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const tenantId = user.tenantId;
    if (!tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const currentData = await getFinancialData(currentMonthStart, currentMonthEnd, tenantId);
    const previousData = await getFinancialData(prevMonthStart, prevMonthEnd, tenantId);

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    const lowStockProducts = await safeFindMany('product', tenantId);

    const lowStockFilteredCount = lowStockProducts.filter(
      (p: any) => p.stock <= (p.minStock ?? 0)
    ).length;

    const lowStockDetails = lowStockProducts
      .filter((p: any) => p.stock <= (p.minStock || 10))
      .slice(0, 5)
      .map((p: any) => ({
        id: p.id,
        code: p.code,
        nameAr: p.nameAr,
        stock: p.stock,
        minStock: p.minStock,
      }));

    // Calculate P&L (wrapped in try-catch since accounting models are new)
    let pnl = { grossProfit: 0, netProfit: 0 };
    try {
      pnl = await calculateProfitAndLoss(currentMonthStart, currentMonthEnd);
    } catch (e) {
      // Accounting system not yet initialized, use defaults
      // Silently continue with zero values
    }

    // Get total inventory value and count
    const inventory = await safeFindMany('product', tenantId);
    const totalInventoryValue = inventory.reduce((sum: number, p: any) => sum + p.stock * p.cost, 0);
    const totalProducts = inventory.length;

    // Get chart data
    const chartData = await getMonthlyChartData(tenantId);

    // Get inventory breakdown
    const inventoryData = await getInventoryBreakdown(tenantId);

    // Get recent activities
    const recentActivities = await getRecentActivities(tenantId);

    // Get recent journal entries (last 5) — gracefully degrade if model unavailable
    let recentJournalEntries: Array<{
      id: string;
      entryNumber: string;
      entryDate: string;
      description: string | null;
      totalDebit: number;
      totalCredit: number;
      isPosted: boolean;
    }> = [];
    try {
      const entries = await prisma.journalEntry.findMany({
        where: { tenantId },
        orderBy: { entryDate: 'desc' },
        take: 5,
        select: {
          id: true,
          entryNumber: true,
          entryDate: true,
          description: true,
          totalDebit: true,
          totalCredit: true,
          isPosted: true,
        },
      });
      recentJournalEntries = entries.map((e) => ({
        id: e.id,
        entryNumber: e.entryNumber,
        entryDate: e.entryDate.toISOString(),
        description: e.description,
        totalDebit: Number(e.totalDebit),
        totalCredit: Number(e.totalCredit),
        isPosted: e.isPosted,
      }));
    } catch (e: any) {
      if (e.code !== 'P2021') {
        console.error('Error fetching journal entries:', e.message);
      }
    }

    // Build alerts
    const alerts: any[] = [];
    
    if (lowStockFilteredCount > 0) {
      alerts.push({
        id: 'low-stock',
        type: 'stock',
        title: 'مخزون منخفض',
        description: `${lowStockFilteredCount} منتج أقل من الحد الأدنى للمخزون`,
        severity: 'high',
        date: 'الآن',
      });
    }

    return apiSuccess({
      // Current month totals
      totalSales: currentData.sales,
      totalPurchases: currentData.purchases,
      totalExpenses: currentData.expenses,

      // Trend percentages (month-over-month)
      salesTrend: calculateChange(currentData.sales, previousData.sales),
      purchasesTrend: calculateChange(currentData.purchases, previousData.purchases),
      expensesTrend: calculateChange(currentData.expenses, previousData.expenses),

      // Profitability metrics
      grossProfit: pnl.grossProfit,
      netProfit: pnl.netProfit,
      profitMargin:
        currentData.sales > 0 ? parseFloat(((pnl.netProfit / currentData.sales) * 100).toFixed(1)) : 0,

      // Inventory metrics
      lowStockProducts: lowStockFilteredCount,
      lowStockDetails,
      totalInventoryValue,
      totalProducts,

      // Chart data
      chartData,
      inventoryData,

      // Activities and alerts
      recentActivities,
      recentJournalEntries,
      alerts,
    }, 'Dashboard data fetched successfully');
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return handleApiError(error, 'Fetch dashboard data');
  }
}
