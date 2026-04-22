import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { reversePurchaseOrderJournalEntry } from '@/lib/accounting';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Convert Purchase Order to Purchase Invoice
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_purchase_invoice')) return apiError('ليس لديك صلاحية', 403);

    const { id } = params;

    // Check if purchase order exists
    const purchaseOrder = await (prisma as any).purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      return apiError('Purchase order not found', 404);
    }

    // Generate invoice number
    const lastInvoice = await (prisma as any).purchaseInvoice.findFirst({
      orderBy: { invoiceNumber: 'desc' },
    });
    const nextNumber = lastInvoice ? parseInt(lastInvoice.invoiceNumber.slice(3)) + 1 : 1;
    const invoiceNumber = `PI-${String(nextNumber).padStart(6, '0')}`;

    // Calculate totals
    let total = 0;
    const invoiceItems = purchaseOrder.items.map((item: any) => {
      const itemTotal = item.quantity * item.price;
      total += itemTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal,
      };
    });

    const discount = 0;
    const tax = (total - discount) * 0.15;
    const grandTotal = total - discount + tax;

    // Create invoice with transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // Create purchase invoice
      const newInvoice = await (tx as any).purchaseInvoice.create({
        data: {
          invoiceNumber,
          supplierId: purchaseOrder.supplierId,
          date: new Date(),
          status: 'pending',
          paymentStatus: 'credit',
          paidAmount: 0,
          notes: purchaseOrder.notes,
          total,
          discount,
          tax,
          grandTotal,
          purchaseOrderId: purchaseOrder.id,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Increment stock for each item
      for (const item of invoiceItems) {
        await (tx as any).product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });

        // Create inventory transaction
        await (tx as any).inventoryTransaction.create({
          data: {
            productId: item.productId,
            type: 'purchase',
            quantity: item.quantity,
            referenceId: newInvoice.id,
            date: new Date(),
            notes: `Purchase Invoice ${invoiceNumber}`,
          },
        });
      }

      // Reverse purchase order journal entry if it exists
      await reversePurchaseOrderJournalEntry(purchaseOrder.id, user.id);

      // Update purchase order status
      await (tx as any).purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: {
          status: 'invoiced',
        },
      });

      return newInvoice;
    });

    return apiSuccess(invoice, 'Purchase order converted to invoice successfully');
  } catch (error) {
    return handleApiError(error, 'Convert purchase order to invoice');
  }
}
