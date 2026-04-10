import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const [
      totalSales,
      totalPurchases,
      totalExpenses,
      lowStockProducts,
      recentSalesInvoices,
      recentPurchaseInvoices,
    ] = await Promise.all([
      prisma.salesInvoice.aggregate({
        _sum: { total: true },
      }),
      prisma.purchaseInvoice.aggregate({
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
      }),
      prisma.product.count({
        where: {
          stock: {
            lte: 10, // Using a default value instead of prisma.product.fields.minStock
          },
        },
      }),
      prisma.salesInvoice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: true },
      }),
      prisma.purchaseInvoice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { supplier: true },
      }),
    ]);

    return NextResponse.json({
      totalSales: totalSales._sum.total || 0,
      totalPurchases: totalPurchases._sum.total || 0,
      totalExpenses: totalExpenses._sum.amount || 0,
      lowStockProducts,
      recentSalesInvoices: recentSalesInvoices.map((invoice: any) => ({
        ...invoice,
        customer: typeof invoice.customer?.nameAr === 'string' ? invoice.customer.nameAr : '-',
        supplier: typeof invoice.supplier?.nameAr === 'string' ? invoice.supplier.nameAr : '-',
      })),
      recentPurchaseInvoices: recentPurchaseInvoices.map((invoice: any) => ({
        ...invoice,
        customer: typeof invoice.customer?.nameAr === 'string' ? invoice.customer.nameAr : '-',
        supplier: typeof invoice.supplier?.nameAr === 'string' ? invoice.supplier.nameAr : '-',
      })),
    });
  } catch (error) {
    console.log('Database not initialized, returning default data');
    return NextResponse.json({
      totalSales: 0,
      totalPurchases: 0,
      totalExpenses: 0,
      lowStockProducts: 0,
      recentSalesInvoices: [],
      recentPurchaseInvoices: [],
    });
  }
}
