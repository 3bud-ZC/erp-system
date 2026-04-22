import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get order fulfillment status
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_sales')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const salesOrderId = searchParams.get('salesOrderId');
    const status = searchParams.get('status'); // 'pending', 'partial', 'fulfilled'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    if (salesOrderId) {
      // Get specific order fulfillment status
      const salesOrder = await prisma.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: {
          items: true,
          salesInvoices: true,
          customer: true,
        },
      });

      if (!salesOrder) {
        return apiError('Sales order not found', 404);
      }

      // Calculate fulfillment status
      let totalQuantity = 0;
      let totalInvoiced = 0;
      let totalFulfilled = 0;

      const itemsWithStatus = salesOrder.items.map((item) => {
        totalQuantity += item.quantity;
        totalInvoiced += item.invoicedQuantity || 0;
        totalFulfilled += item.fulfillmentStatus === 'fulfilled' ? item.quantity : 0;

        return {
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          invoicedQuantity: item.invoicedQuantity || 0,
          remainingQuantity: item.remainingQuantity || item.quantity,
          fulfillmentStatus: item.fulfillmentStatus || 'pending',
          fulfillmentPercentage: item.quantity > 0 ? ((item.invoicedQuantity || 0) / item.quantity) * 100 : 0,
        };
      });

      const overallFulfillmentPercentage = totalQuantity > 0 ? (totalInvoiced / totalQuantity) * 100 : 0;
      const overallStatus = overallFulfillmentPercentage >= 100 ? 'fulfilled' : overallFulfillmentPercentage > 0 ? 'partial' : 'pending';

      return apiSuccess(
        {
          salesOrder: {
            id: salesOrder.id,
            orderNumber: salesOrder.orderNumber,
            date: salesOrder.date,
            customer: salesOrder.customer,
          },
          items: itemsWithStatus,
          summary: {
            totalQuantity,
            totalInvoiced,
            totalFulfilled,
            overallFulfillmentPercentage,
            overallStatus,
          },
        },
        'Order fulfillment status fetched successfully'
      );
    }

    // Get all orders with fulfillment status
    const where: any = {};
    if (status) {
      // Filter by overall fulfillment status
      if (status === 'fulfilled') {
        where.items = {
          every: { fulfillmentStatus: 'fulfilled' },
        };
      } else if (status === 'partial') {
        where.items = {
          some: { fulfillmentStatus: 'partially_fulfilled' },
        };
      } else if (status === 'pending') {
        where.items = {
          every: { fulfillmentStatus: 'pending' },
        };
      }
    }

    const salesOrders = await prisma.salesOrder.findMany({
      where,
      include: {
        customer: true,
        items: true,
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.salesOrder.count({ where });

    // Calculate fulfillment status for each order
    const ordersWithStatus = salesOrders.map((order) => {
      let totalQuantity = 0;
      let totalInvoiced = 0;

      order.items.forEach((item) => {
        totalQuantity += item.quantity;
        totalInvoiced += item.invoicedQuantity || 0;
      });

      const overallFulfillmentPercentage = totalQuantity > 0 ? (totalInvoiced / totalQuantity) * 100 : 0;
      const overallStatus = overallFulfillmentPercentage >= 100 ? 'fulfilled' : overallFulfillmentPercentage > 0 ? 'partial' : 'pending';

      return {
        ...order,
        overallFulfillmentPercentage,
        overallStatus,
      };
    });

    return apiSuccess(
      { orders: ordersWithStatus, total, page, limit },
      'Order fulfillment status fetched successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Get order fulfillment status');
  }
}
