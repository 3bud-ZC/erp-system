import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get AR/AP aging report
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'ar', 'ap', 'all'
    const asOfDate = searchParams.get('asOfDate') || new Date().toISOString();
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const asOf = new Date(asOfDate);
    const now = new Date();

    // Define aging buckets (in days)
    const buckets = {
      current: 0,
      days1to30: 30,
      days31to60: 60,
      days61to90: 90,
      over90: 999,
    };

    const agingData = [];

    // Process Accounts Receivable (Sales Invoices)
    if (type === 'ar' || type === 'all') {
      const salesInvoices = await prisma.salesInvoice.findMany({
        where: {
          paymentStatus: { not: 'paid' },
          date: { lte: asOf },
        },
        include: {
          customer: true,
        },
        orderBy: { date: 'asc' },
        skip,
        take: limit,
      });

      for (const invoice of salesInvoices) {
        const daysOverdue = Math.floor((now.getTime() - new Date(invoice.date).getTime()) / (1000 * 60 * 60 * 24));
        const remainingAmount = invoice.total - invoice.paidAmount;

        let bucket = 'current';
        if (daysOverdue > 90) bucket = 'over90';
        else if (daysOverdue > 60) bucket = 'days61to90';
        else if (daysOverdue > 30) bucket = 'days31to60';
        else if (daysOverdue > 0) bucket = 'days1to30';

        agingData.push({
          type: 'ar',
          entityId: invoice.id,
          entityNumber: invoice.invoiceNumber,
          entityName: invoice.customer.nameAr || invoice.customer.nameEn || 'Unknown',
          date: invoice.date,
          dueDate: new Date(invoice.date), // Assuming due date is same as invoice date for now
          daysOverdue,
          totalAmount: invoice.total,
          paidAmount: invoice.paidAmount,
          remainingAmount,
          bucket,
          status: daysOverdue > 0 ? 'overdue' : 'current',
        });
      }
    }

    // Process Accounts Payable (Purchase Invoices)
    if (type === 'ap' || type === 'all') {
      const purchaseInvoices = await prisma.purchaseInvoice.findMany({
        where: {
          paymentStatus: { not: 'paid' },
          date: { lte: asOf },
        },
        include: {
          supplier: true,
        },
        orderBy: { date: 'asc' },
        skip,
        take: limit,
      });

      for (const invoice of purchaseInvoices) {
        const daysOverdue = Math.floor((now.getTime() - new Date(invoice.date).getTime()) / (1000 * 60 * 60 * 24));
        const remainingAmount = invoice.total - invoice.paidAmount;

        let bucket = 'current';
        if (daysOverdue > 90) bucket = 'over90';
        else if (daysOverdue > 60) bucket = 'days61to90';
        else if (daysOverdue > 30) bucket = 'days31to60';
        else if (daysOverdue > 0) bucket = 'days1to30';

        agingData.push({
          type: 'ap',
          entityId: invoice.id,
          entityNumber: invoice.invoiceNumber,
          entityName: invoice.supplier.nameAr || invoice.supplier.nameEn || 'Unknown',
          date: invoice.date,
          dueDate: new Date(invoice.date), // Assuming due date is same as invoice date for now
          daysOverdue,
          totalAmount: invoice.total,
          paidAmount: invoice.paidAmount,
          remainingAmount,
          bucket,
          status: daysOverdue > 0 ? 'overdue' : 'current',
        });
      }
    }

    // Sort by days overdue (most overdue first)
    agingData.sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Calculate summary by bucket
    const summary = {
      ar: { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 },
      ap: { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 },
    };

    for (const item of agingData) {
      // @ts-ignore - Index signature issue
      const typeSummary: any = summary[item.type];
      typeSummary[item.bucket] += item.remainingAmount;
      typeSummary.total += item.remainingAmount;
    }

    return apiSuccess(
      { agingData, summary, asOfDate: asOf, total: agingData.length, page, limit },
      'Aging report fetched successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Fetch aging report');
  }
}
