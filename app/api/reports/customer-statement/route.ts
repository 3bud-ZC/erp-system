import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Customer statement
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const fromDate = searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : new Date();

    if (!customerId) {
      return apiError('Customer ID is required', 400);
    }

    // Get customer details
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return apiError('Customer not found', 404);
    }

    // Get sales invoices
    const salesInvoices = await prisma.salesInvoice.findMany({
      where: {
        customerId,
        date: { gte: fromDate, lte: toDate },
      },
      include: {
        items: true,
        payments: true,
      },
      orderBy: { date: 'asc' },
    });

    // Get sales returns (credit notes)
    const salesReturns = await prisma.salesReturn.findMany({
      where: {
        customerId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });

    // Get payments
    const payments = await prisma.payment.findMany({
      where: {
        customerId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate opening balance
    const openingBalance = await prisma.salesInvoice.aggregate({
      where: {
        customerId,
        date: { lt: fromDate },
      },
      _sum: { grandTotal: true },
    });

    const openingPayments = await prisma.payment.aggregate({
      where: {
        customerId,
        date: { lt: fromDate },
      },
      _sum: { amount: true },
    });

    const openingBalanceAmount = (Number(openingBalance._sum.grandTotal || 0)) - (Number(openingPayments._sum.amount || 0));

    // Calculate totals
    const totalInvoices = salesInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalReturns = salesReturns.reduce((sum, ret) => sum + ret.total, 0);
    const totalPayments = payments.reduce((sum, pay) => sum + pay.amount, 0);

    const closingBalance = openingBalanceAmount + totalInvoices - totalReturns - totalPayments;

    // Build transaction list
    const transactions: any[] = [];
    let runningBalance = openingBalanceAmount;

    // Add invoices
    salesInvoices.forEach((invoice) => {
      runningBalance += invoice.grandTotal;
      transactions.push({
        date: invoice.date,
        type: 'invoice',
        reference: invoice.invoiceNumber,
        description: `Invoice ${invoice.invoiceNumber}`,
        debit: invoice.grandTotal,
        credit: 0,
        balance: runningBalance,
      });
    });

    // Add returns
    salesReturns.forEach((ret) => {
      runningBalance -= ret.total;
      transactions.push({
        date: ret.date,
        type: 'return',
        reference: ret.returnNumber,
        description: `Credit Note ${ret.returnNumber}`,
        debit: 0,
        credit: ret.total,
        balance: runningBalance,
      });
    });

    // Add payments
    payments.forEach((payment) => {
      runningBalance -= payment.amount;
      transactions.push({
        date: payment.date,
        type: 'payment',
        reference: payment.id,
        description: 'Payment received',
        debit: 0,
        credit: payment.amount,
        balance: runningBalance,
      });
    });

    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return apiSuccess(
      {
        customer: {
          id: customer.id,
          code: customer.code,
          nameAr: customer.nameAr,
          nameEn: customer.nameEn,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
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
      'Customer statement generated successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Generate customer statement');
  }
}
