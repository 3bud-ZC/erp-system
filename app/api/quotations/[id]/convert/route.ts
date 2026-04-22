import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Convert quotation to sales order
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_sales')) return apiError('ليس لديك صلاحية', 403);

    const { id } = params;

    // Check if quotation exists
    const quotation = await (prisma as any).quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!quotation) {
      return apiError('Quotation not found', 404);
    }

    // Check if quotation is already converted
    if (quotation.status === 'converted') {
      return apiError('Quotation is already converted to a sales order', 400);
    }

    // Check if quotation is expired
    if (quotation.status === 'expired') {
      return apiError('Cannot convert an expired quotation', 400);
    }

    // Generate sales order number
    const lastSalesOrder = await (prisma as any).salesOrder.findFirst({
      orderBy: { orderNumber: 'desc' },
    });
    const nextNumber = lastSalesOrder ? parseInt(lastSalesOrder.orderNumber.slice(3)) + 1 : 1;
    const orderNumber = `SO-${String(nextNumber).padStart(6, '0')}`;

    // Calculate totals
    let total = 0;
    let discount = 0;
    let tax = 0;

    const orderItems = quotation.items.map((item: any) => {
      const itemTotal = item.quantity * item.price;
      const itemDiscount = itemTotal * (item.discount || 0) / 100;
      const itemSubtotal = itemTotal - itemDiscount;

      total += itemSubtotal;
      discount += itemDiscount;

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: itemSubtotal,
      };
    });

    tax = total * 0.15;
    const grandTotal = total + tax;

    // Create sales order with transaction
    const salesOrder = await prisma.$transaction(async (tx) => {
      // Create sales order
      const order = await (tx as any).salesOrder.create({
        data: {
          orderNumber,
          customerId: quotation.customerId,
          date: new Date(),
          status: 'pending',
          total,
          discount,
          tax,
          grandTotal,
          quotationId: quotation.id,
          notes: quotation.notes,
          items: {
            create: orderItems,
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Update quotation status
      await (tx as any).quotation.update({
        where: { id: quotation.id },
        data: {
          status: 'converted',
        },
      });

      return order;
    });

    // Trigger workflow transitions
    await transitionEntity('Quotation', quotation.id, 'converted', user.id, { salesOrderId: salesOrder.id });
    await transitionEntity('SalesOrder', salesOrder.id, 'pending', user.id, { quotationId: quotation.id, grandTotal });

    // Audit logging
    await logAuditAction(
      user.id, 'CONVERT', 'sales', 'Quotation', quotation.id, 
      { convertedTo: salesOrder.id, salesOrderNumber: salesOrder.orderNumber },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    await logAuditAction(
      user.id, 'CREATE', 'sales', 'SalesOrder', salesOrder.id,
      { fromQuotation: quotation.id, quotationNumber: quotation.quotationNumber },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(salesOrder, 'Quotation converted to sales order successfully');
  } catch (error) {
    return handleApiError(error, 'Convert quotation to sales order');
  }
}
