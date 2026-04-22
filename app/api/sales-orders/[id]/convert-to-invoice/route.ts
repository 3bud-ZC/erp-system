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

// POST - Convert Sales Order to Sales Invoice
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_sales_invoice')) return apiError('ليس لديك صلاحية', 403);

    const { id } = params;

    // Check if sales order exists
    const salesOrder = await (prisma as any).salesOrder.findUnique({
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

    if (!salesOrder) {
      return apiError('Sales order not found', 404);
    }

    // Check if order is already invoiced
    if (salesOrder.salesInvoices && salesOrder.salesInvoices.length > 0) {
      return apiError('Sales order already has invoices', 400);
    }

    // Validate stock availability for all items
    for (const item of salesOrder.items) {
      if (item.product.stock < item.quantity) {
        return apiError(
          `Insufficient stock for product ${item.product.nameAr || item.product.nameEn}. Available: ${item.product.stock}, Required: ${item.quantity}`,
          400
        );
      }
    }

    // Generate invoice number
    const lastInvoice = await (prisma as any).salesInvoice.findFirst({
      orderBy: { invoiceNumber: 'desc' },
    });
    const nextNumber = lastInvoice ? parseInt(lastInvoice.invoiceNumber.slice(3)) + 1 : 1;
    const invoiceNumber = `SI-${String(nextNumber).padStart(6, '0')}`;

    // Calculate totals
    let total = 0;
    const invoiceItems = salesOrder.items.map((item: any) => {
      const itemTotal = item.quantity * item.price;
      total += itemTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal,
      };
    });

    const discount = salesOrder.discount || 0;
    const tax = (total - discount) * 0.15;
    const grandTotal = total - discount + tax;

    // Create invoice with transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // Create sales invoice
      const newInvoice = await (tx as any).salesInvoice.create({
        data: {
          invoiceNumber,
          customerId: salesOrder.customerId,
          date: new Date(),
          status: 'pending',
          paymentStatus: 'credit',
          paidAmount: 0,
          notes: salesOrder.notes,
          total,
          tax,
          grandTotal,
          salesOrderId: salesOrder.id,
          items: {
            create: invoiceItems,
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

      // Update sales order status
      await (tx as any).salesOrder.update({
        where: { id: salesOrder.id },
        data: {
          status: 'invoiced',
        },
      });

      return newInvoice;
    });

    // Trigger workflow transitions
    await transitionEntity('SalesOrder', salesOrder.id, 'invoiced', user.id, { invoiceId: invoice.id, grandTotal });
    await transitionEntity('SalesInvoice', invoice.id, 'pending', user.id, { salesOrderId: salesOrder.id, grandTotal });

    // Audit logging
    await logAuditAction(
      user.id, 'CONVERT', 'sales', 'SalesOrder', salesOrder.id,
      { convertedTo: invoice.id, invoiceNumber: invoice.invoiceNumber },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    await logAuditAction(
      user.id, 'CREATE', 'sales', 'SalesInvoice', invoice.id,
      { fromSalesOrder: salesOrder.id, salesOrderNumber: salesOrder.orderNumber },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(invoice, 'Sales order converted to invoice successfully');
  } catch (error) {
    return handleApiError(error, 'Convert sales order to invoice');
  }
}
