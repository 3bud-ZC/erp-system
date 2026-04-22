/**
 * Aggregation-based reporting queries
 * Optimized queries for dashboard KPIs and reports
 */

import { prisma } from './db';

/**
 * Sales aggregation queries
 */
export const salesAggregations = {
  /**
   * Get total sales revenue for a period
   */
  async getTotalRevenue(startDate: Date, endDate: Date) {
    const result = await prisma.salesInvoice.aggregate({
      where: {
        date: { gte: startDate, lte: endDate },
        status: { in: ['paid', 'partial'] },
      },
      _sum: { total: true },
    });
    return result._sum.total || 0;
  },

  /**
   * Get sales by customer
   */
  async getSalesByCustomer(startDate: Date, endDate: Date) {
    return prisma.salesInvoice.groupBy({
      by: ['customerId'],
      where: {
        date: { gte: startDate, lte: endDate },
      },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
    });
  },

  /**
   * Get sales by product
   */
  async getSalesByProduct(startDate: Date, endDate: Date) {
    return prisma.salesInvoiceItem.groupBy({
      by: ['productId'],
      where: {
        salesInvoice: {
          date: { gte: startDate, lte: endDate },
        },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
    });
  },

  /**
   * Get monthly sales trend
   */
  async getMonthlySalesTrend(year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const invoices = await prisma.salesInvoice.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      select: {
        date: true,
        total: true,
      },
    });

    const monthlyData = Array(12).fill(0).map((_, month) => ({
      month,
      total: 0,
    }));

    invoices.forEach((invoice) => {
      const month = invoice.date.getMonth();
      monthlyData[month].total += invoice.total;
    });

    return monthlyData;
  },
};

/**
 * Purchase aggregation queries
 */
export const purchaseAggregations = {
  /**
   * Get total purchases for a period
   */
  async getTotalPurchases(startDate: Date, endDate: Date) {
    const result = await prisma.purchaseInvoice.aggregate({
      where: {
        date: { gte: startDate, lte: endDate },
        status: { in: ['paid', 'partial'] },
      },
      _sum: { total: true },
    });
    return result._sum.total || 0;
  },

  /**
   * Get purchases by supplier
   */
  async getPurchasesBySupplier(startDate: Date, endDate: Date) {
    return prisma.purchaseInvoice.groupBy({
      by: ['supplierId'],
      where: {
        date: { gte: startDate, lte: endDate },
      },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
    });
  },
};

/**
 * Inventory aggregation queries
 */
export const inventoryAggregations = {
  /**
   * Get inventory value by warehouse
   */
  async getInventoryValueByWarehouse() {
    // InventoryValuation doesn't have warehouseId, returning total instead
    const valuations = await prisma.inventoryValuation.aggregate({
      _sum: { totalValue: true },
    });
    return valuations;
  },

  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold: number = 10) {
    return prisma.product.findMany({
      where: {
        stock: { lte: threshold },
      },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        stock: true,
      },
    });
  },

  /**
   * Get inventory movement summary
   */
  async getInventoryMovementSummary(startDate: Date, endDate: Date) {
    const [inbound, outbound] = await Promise.all([
      prisma.inventoryTransaction.aggregate({
        where: {
          date: { gte: startDate, lte: endDate },
          type: 'IN',
        },
        _sum: { quantity: true },
      }),
      prisma.inventoryTransaction.aggregate({
        where: {
          date: { gte: startDate, lte: endDate },
          type: 'OUT',
        },
        _sum: { quantity: true },
      }),
    ]);

    return {
      inbound: inbound._sum.quantity || 0,
      outbound: outbound._sum.quantity || 0,
    };
  },
};

/**
 * Accounting aggregation queries
 */
export const accountingAggregations = {
  /**
   * Get accounts receivable total
   */
  async getAccountsReceivable() {
    const result = await prisma.salesInvoice.aggregate({
      where: {
        status: { in: ['pending', 'partial'] },
      },
      _sum: { total: true },
    });
    return result._sum.total || 0;
  },

  /**
   * Get accounts payable total
   */
  async getAccountsPayable() {
    const result = await prisma.purchaseInvoice.aggregate({
      where: {
        status: { in: ['pending', 'partial'] },
      },
      _sum: { total: true },
    });
    return result._sum.total || 0;
  },

  /**
   * Get revenue by account
   */
  async getRevenueByAccount(startDate: Date, endDate: Date) {
    return prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      where: {
        journalEntry: {
          entryDate: { gte: startDate, lte: endDate },
        },
        account: {
          type: 'REVENUE',
        },
      },
      _sum: { credit: true },
    });
  },

  /**
   * Get expenses by account
   */
  async getExpensesByAccount(startDate: Date, endDate: Date) {
    return prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      where: {
        journalEntry: {
          entryDate: { gte: startDate, lte: endDate },
        },
        account: {
          type: 'EXPENSE',
        },
      },
      _sum: { debit: true },
    });
  },
};

/**
 * Production aggregation queries
 */
export const productionAggregations = {
  /**
   * Get production output by line
   */
  async getProductionByLine(startDate: Date, endDate: Date) {
    return prisma.productionOrder.groupBy({
      by: ['productionLineId'],
      where: {
        date: { gte: startDate, lte: endDate },
      },
      _sum: { quantity: true },
    });
  },

  /**
   * Get production efficiency
   */
  async getProductionEfficiency(startDate: Date, endDate: Date) {
    const orders = await prisma.productionOrder.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: 'completed',
      },
      select: {
        quantity: true,
        actualOutputQuantity: true,
      },
    });

    if (orders.length === 0) return 0;

    const totalPlanned = orders.reduce((sum, o) => sum + o.quantity, 0);
    const totalActual = orders.reduce((sum, o) => sum + (o.actualOutputQuantity || 0), 0);

    return totalActual > 0 ? (totalActual / totalPlanned) * 100 : 0;
  },
};

/**
 * Dashboard KPI aggregation
 */
export const dashboardKPIs = {
  /**
   * Get all dashboard KPIs
   */
  async getAllKPIs(startDate: Date, endDate: Date) {
    const [
      totalRevenue,
      totalPurchases,
      accountsReceivable,
      accountsPayable,
      inventoryValue,
      productionEfficiency,
    ] = await Promise.all([
      salesAggregations.getTotalRevenue(startDate, endDate),
      purchaseAggregations.getTotalPurchases(startDate, endDate),
      accountingAggregations.getAccountsReceivable(),
      accountingAggregations.getAccountsPayable(),
      prisma.inventoryValuation.aggregate({
        _sum: { totalValue: true },
      }).then(r => r._sum.totalValue || 0),
      productionAggregations.getProductionEfficiency(startDate, endDate),
    ]);

    return {
      totalRevenue,
      totalPurchases,
      accountsReceivable,
      accountsPayable,
      inventoryValue,
      productionEfficiency,
      grossProfit: totalRevenue - totalPurchases,
    };
  },
};
