import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Supplier statement
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const fromDate = searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : new Date();

    if (!supplierId) {
      return apiError('Supplier ID is required', 400);
    }

    // Get supplier details
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return apiError('Supplier not found', 404);
    }

    // Get purchase invoices
    const purchaseInvoices = await prisma.purchaseInvoice.findMany({
      where: {
        supplierId,
        date: { gte: fromDate, lte: toDate },
      },
      include: {
        items: true,
        payments: true,
      },
      orderBy: { date: 'asc' },
    });

    // Get purchase returns
    const purchaseReturns = await prisma.purchaseReturn.findMany({
      where: {
        supplierId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });

    // Get payments
    const payments = await prisma.payment.findMany({
      where: {
        supplierId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate opening balance
    const openingBalance = await prisma.purchaseInvoice.aggregate({
      where: {
        supplierId,
        date: { lt: fromDate },
      },
      _sum: { total: true },
    });

    const openingPayments = await prisma.payment.aggregate({
      where: {
        supplierId,
        date: { lt: fromDate },
      },
      _sum: { amount: true },
    });

    const openingBalanceAmount = (Number(openingBalance._sum.total || 0)) - (Number(openingPayments._sum.amount || 0));

    // Calculate totals
    const totalInvoices = purchaseInvoices.reduce((sum: number, inv: any) => sum + inv.total, 0);
    const totalReturns = purchaseReturns.reduce((sum: number, ret: any) => sum + ret.total, 0);
    const totalPayments = payments.reduce((sum: number, pay: any) => sum + pay.amount, 0);

    const closingBalance = openingBalanceAmount + totalInvoices - totalReturns - totalPayments;

    // Build transaction list
    const transactions: any[] = [];
    let runningBalance = openingBalanceAmount;

    // Add invoices
    purchaseInvoices.forEach((invoice: any) => {
      runningBalance += invoice.total;
      transactions.push({
        date: invoice.date,
        type: 'invoice',
        reference: invoice.invoiceNumber,
        description: `Purchase Invoice ${invoice.invoiceNumber}`,
        debit: invoice.total,
        credit: 0,
        balance: runningBalance,
      });
    });

    // Add returns
    purchaseReturns.forEach((ret: any) => {
      runningBalance -= ret.total;
      transactions.push({
        date: ret.date,
        type: 'return',
        reference: ret.returnNumber,
        description: `Supplier Credit ${ret.returnNumber}`,
        debit: 0,
        credit: ret.total,
        balance: runningBalance,
      });
    });

    // Add payments
    payments.forEach((payment: any) => {
      runningBalance -= payment.amount;
      transactions.push({
        date: payment.date,
        type: 'payment',
        reference: payment.id,
        description: 'Payment made',
        debit: 0,
        credit: payment.amount,
        balance: runningBalance,
      });
    });

    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return apiSuccess(
      {
        supplier: {
          id: supplier.id,
          code: supplier.code,
          nameAr: supplier.nameAr,
          nameEn: supplier.nameEn,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
        },
        period: { from: fromDate, to: toDate },
        openingBalance: openingBalanceAmount,
        transactions,
        summary: {
          totalInvoices,
          totalReturns,
          totalPayments,
          closingBalance,
        },
      },
      'Supplier statement generated successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Generate supplier statement');
  }
}
