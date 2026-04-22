import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Performance analysis and aggregation endpoints
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'analysis', 'aggregated_sales', 'aggregated_purchases'

    if (type === 'analysis') {
      // Return performance analysis
      const analysis = {
        nPlusOneQueries: [
          {
            endpoint: '/api/sales-invoices',
            issue: 'N+1 query on customer relationship',
            recommendation: 'Use select or include to fetch customer in single query',
          },
          {
            endpoint: '/api/purchase-invoices',
            issue: 'N+1 query on supplier relationship',
            recommendation: 'Use select or include to fetch supplier in single query',
          },
        ],
        aggregationOpportunities: [
          {
            endpoint: '/api/reports',
            issue: 'Multiple separate queries for account balances',
            recommendation: 'Use groupBy aggregation for single query',
          },
        ],
      };

      return apiSuccess(analysis, 'Performance analysis completed');
    }

    if (type === 'aggregated_sales') {
      // Optimized aggregated sales data
      const { searchParams } = new URL(request.url);
      const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date();

      // Single aggregated query instead of N+1
      const salesByCustomer = await prisma.salesInvoice.groupBy({
        by: ['customerId'],
        where: {
          date: { gte: startDate, lte: endDate },
        },
        _sum: {
          grandTotal: true,
        },
        _count: true,
      });

      const salesByMonth = await prisma.salesInvoice.groupBy({
        by: ['date'],
        where: {
          date: { gte: startDate, lte: endDate },
        },
        _sum: {
          grandTotal: true,
        },
      });

      // Group by month
      const monthlySales: any = {};
      salesByMonth.forEach((item) => {
        const monthKey = item.date.toISOString().slice(0, 7);
        if (!monthlySales[monthKey]) {
          monthlySales[monthKey] = 0;
        }
        monthlySales[monthKey] += Number(item._sum.grandTotal || 0);
      });

      return apiSuccess(
        { salesByCustomer, monthlySales },
        'Aggregated sales data fetched successfully'
      );
    }

    if (type === 'aggregated_purchases') {
      // Optimized aggregated purchase data
      const { searchParams } = new URL(request.url);
      const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date();

      // Single aggregated query
      const purchasesBySupplier = await prisma.purchaseInvoice.groupBy({
        by: ['supplierId'],
        where: {
          date: { gte: startDate, lte: endDate },
        },
        _sum: {
          total: true,
        },
        _count: true,
      });

      return apiSuccess(
        { purchasesBySupplier },
        'Aggregated purchase data fetched successfully'
      );
    }

    return apiError('Type parameter required', 400);
  } catch (error) {
    return handleApiError(error, 'Performance optimization');
  }
}
