import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateProfitAndLoss } from '@/lib/accounting';

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

export async function GET() {
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

    // Fetch recent invoices
    const recentSalesInvoices = await prisma.salesInvoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });

    const recentPurchaseInvoices = await prisma.purchaseInvoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { supplier: true },
    });

    // Calculate P&L (wrapped in try-catch since accounting models are new)
    let pnl = { grossProfit: 0, netProfit: 0 };
    try {
      pnl = await calculateProfitAndLoss(currentMonthStart, currentMonthEnd);
    } catch (e) {
      // Accounting system not yet initialized, use defaults
      console.log('Accounting system not initialized');
    }

    // Get total inventory value
    const inventory = await prisma.product.findMany();
    const totalInventoryValue = inventory.reduce((sum, p) => sum + p.stock * p.cost, 0);

    return NextResponse.json({
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

      // Recent transactions
      recentSalesInvoices,
      recentPurchaseInvoices,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'فشل في تحميل بيانات لوحة التحكم' },
      { status: 500 }
    );
  }
}
