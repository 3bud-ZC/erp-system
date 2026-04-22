import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { createJournalEntry, postJournalEntry } from '@/lib/accounting';
import { transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Create partial invoice from sales order
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_sales')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { salesOrderId, items } = body; // items: [{ salesOrderItemId, quantityToInvoice }]

    if (!salesOrderId || !items || !Array.isArray(items)) {
      return apiError('Sales order ID and items array are required', 400);
    }

    // Get sales order
    const salesOrder = await (prisma as any).salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!salesOrder) {
      return apiError('Sales order not found', 404);
    }

    // Generate invoice number
    const lastInvoice = await (prisma as any).salesInvoice.findFirst({
      orderBy: { invoiceNumber: 'desc' },
    });
    const nextNumber = lastInvoice ? parseInt(lastInvoice.invoiceNumber.slice(3)) + 1 : 1;
    const invoiceNumber = `INV-${String(nextNumber).padStart(6, '0')}`;

    // Calculate invoice totals
    let subtotal = 0;
    let totalTax = 0;
    const invoiceItems: any[] = [];

    for (const item of items) {
      const orderItem = salesOrder.items.find((oi: any) => oi.id === item.salesOrderItemId);
      if (!orderItem) {
        return apiError(`Order item ${item.salesOrderItemId} not found`, 404);
      }

      const quantityToInvoice = Math.min(item.quantityToInvoice, orderItem.quantity - orderItem.invoicedQuantity);
      if (quantityToInvoice <= 0) {
        return apiError(`Invalid quantity to invoice for item ${item.salesOrderItemId}`, 400);
      }

      const itemTotal = quantityToInvoice * orderItem.price;
      subtotal += itemTotal;

      invoiceItems.push({
        productId: orderItem.productId,
        quantity: quantityToInvoice,
        price: orderItem.price,
        total: itemTotal,
      });

      // Update order item
      await (prisma as any).salesOrderItem.update({
        where: { id: item.salesOrderItemId },
        data: {
          invoicedQuantity: orderItem.invoicedQuantity + quantityToInvoice,
          remainingQuantity: orderItem.quantity - (orderItem.invoicedQuantity + quantityToInvoice),
          fulfillmentStatus: (orderItem.invoicedQuantity + quantityToInvoice) >= orderItem.quantity ? 'fulfilled' : 'partially_fulfilled',
        },
      });
    }

    const discount = salesOrder.discount;
    const tax = subtotal * 0.15; // Assuming 15% tax
    const grandTotal = subtotal - discount + tax;

    // Create invoice
    const invoice = await (prisma as any).salesInvoice.create({
      data: {
        invoiceNumber,
        customerId: salesOrder.customerId,
        salesOrderId: salesOrder.id,
        date: new Date(),
        dueDate: new Date(),
        status: 'pending',
        subtotal,
        discount,
        tax,
        grandTotal,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        items: {
          create: invoiceItems,
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    // Create journal entry
    const journalEntry = await createJournalEntry({
      entryDate: new Date(),
      description: `Sales Invoice ${invoiceNumber}`,
      referenceType: 'SalesInvoice',
      referenceId: invoice.id,
      lines: [
        {
          accountCode: '1021', // Accounts Receivable
          debit: grandTotal,
          credit: 0,
          description: `Invoice ${invoiceNumber} for ${salesOrder.customer.nameAr || salesOrder.customer.nameEn}`,
        },
        {
          accountCode: '4010', // Sales Revenue
          debit: 0,
          credit: subtotal,
          description: `Sales revenue`,
        },
        {
          accountCode: '2010', // VAT Output
          debit: 0,
          credit: tax,
          description: `VAT on invoice ${invoiceNumber}`,
        },
      ],
    }, user.id);

    await postJournalEntry(journalEntry.id, user.id);

    // Check if order is fully invoiced
    const allItemsFulfilled = salesOrder.items.every((item: any) => item.fulfillmentStatus === 'fulfilled');
    if (allItemsFulfilled) {
      await transitionEntity('SalesOrder', salesOrder.id, 'fulfilled', user.id, { invoiceNumber });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'PARTIAL_INVOICE', 'sales', 'SalesOrder', salesOrderId,
      { invoiceNumber, grandTotal },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ invoice, journalEntry }, 'Partial invoice created successfully');
  } catch (error) {
    return handleApiError(error, 'Create partial invoice');
  }
}
