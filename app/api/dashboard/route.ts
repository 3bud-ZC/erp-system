import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateProfitAndLoss } from '@/lib/accounting';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth';

// Helper: Calculate totals for a given date range
async function getFinancialData(startDate: Date, endDate: Date) {
  const salesData = await prisma.salesInvoice.aggregate({
    _sum: { total: true },
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  const purchasesData = await prisma.purchaseInvoice.aggregate({
    _sum: { total: true },
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  const expensesData = await prisma.expense.aggregate({
    _sum: { amount: true },
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  return {
    sales: Number(salesData._sum.total) || 0,
    purchases: Number(purchasesData._sum.total) || 0,
    expenses: Number(expensesData._sum.amount) || 0,
  };
}

// Helper: Get monthly data for charts (last 6 months)
async function getMonthlyChartData() {
  const months: string[] = [];
  const sales: number[] = [];
  const purchases: number[] = [];

  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    
    const monthName = monthStart.toLocaleDateString('ar-EG', { month: 'short' });
    months.push(monthName);

    const data = await getFinancialData(monthStart, monthEnd);
    sales.push(data.sales);
    purchases.push(data.purchases);
  }

  return { labels: months, sales, purchases };
}

// Helper: Get inventory breakdown by type
async function getInventoryBreakdown() {
  const products = await prisma.product.findMany();
  
  const rawMaterials = products.filter(p => p.type === 'raw').length;
  const finishedGoods = products.filter(p => p.type === 'finished').length;
  const packaging = products.filter(p => p.type === 'packaging').length;

  return { rawMaterials, finishedGoods, packaging };
}

// Helper: Generate recent activities
async function getRecentActivities() {
  const activities: any[] = [];

  // Recent sales invoices
  const salesInvoices = await prisma.salesInvoice.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
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

  // Recent purchase invoices
  const purchaseInvoices = await prisma.purchaseInvoice.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
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

  // Sort by date descending and limit to 5
  return activities
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
}

export async function GET(request: Request) {
  try {
    // Get current month data
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get previous month data for comparison
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const currentData = await getFinancialData(currentMonthStart, currentMonthEnd);
    const previousData = await getFinancialData(prevMonthStart, prevMonthEnd);

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    // FIX: Count low-stock products by comparing stock to minStock field (not hardcoded 10)
    const lowStockProducts = await prisma.product.findMany({
      where: {},
    });

    const lowStockFilteredCount = lowStockProducts.filter(
      (p) => p.stock <= (p.minStock || 10)
    ).length;

    const lowStockDetails = lowStockProducts
      .filter((p) => p.stock <= (p.minStock || 10))
      .slice(0, 5)
      .map((p) => ({
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
      console.log('Accounting system not initialized');
    }

    // Get total inventory value and count
    const inventory = await prisma.product.findMany();
    const totalInventoryValue = inventory.reduce((sum, p) => sum + p.stock * p.cost, 0);
    const totalProducts = inventory.length;

    // Get chart data
    const chartData = await getMonthlyChartData();

    // Get inventory breakdown
    const inventoryData = await getInventoryBreakdown();

    // Get recent activities
    const recentActivities = await getRecentActivities();

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
      alerts,
    }, 'Dashboard data fetched successfully');
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return handleApiError(error, 'Fetch dashboard data');
  }
}
