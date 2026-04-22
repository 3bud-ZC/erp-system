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

// POST - Convert Purchase Requisition to Purchase Order
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_purchase')) return apiError('ليس لديك صلاحية', 403);

    const { id } = params;

    // Check if requisition exists
    const requisition = await (prisma as any).purchaseRequisition.findUnique({
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

    if (!requisition) {
      return apiError('Purchase requisition not found', 404);
    }

    // Check if requisition is already converted
    if (requisition.status === 'converted') {
      return apiError('Purchase requisition is already converted to a purchase order', 400);
    }

    // Check if requisition is approved
    if (requisition.status !== 'approved') {
      return apiError('Only approved requisitions can be converted to purchase orders', 400);
    }

    // Generate purchase order number
    const lastPurchaseOrder = await (prisma as any).purchaseOrder.findFirst({
      orderBy: { orderNumber: 'desc' },
    });
    const nextNumber = lastPurchaseOrder ? parseInt(lastPurchaseOrder.orderNumber.slice(3)) + 1 : 1;
    const orderNumber = `PO-${String(nextNumber).padStart(6, '0')}`;

    // Calculate totals
    let total = 0;

    const orderItems = requisition.items.map((item: any) => {
      const itemTotal = item.quantity * item.estimatedPrice;
      total += itemTotal;

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: item.estimatedPrice,
        total: itemTotal,
      };
    });

    // Create purchase order with transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Create purchase order
      const order = await (tx as any).purchaseOrder.create({
        data: {
          orderNumber,
          supplierId: requisition.supplierId,
          date: new Date(),
          status: 'pending',
          total,
          notes: requisition.notes,
          requisitionId: requisition.id,
          items: {
            create: orderItems,
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

      // Update requisition status
      await (tx as any).purchaseRequisition.update({
        where: { id: requisition.id },
        data: {
          status: 'converted',
        },
      });

      return order;
    });

    // Trigger workflow transitions
    await transitionEntity('PurchaseRequisition', requisition.id, 'converted', user.id, { purchaseOrderId: purchaseOrder.id });
    await transitionEntity('PurchaseOrder', purchaseOrder.id, 'pending', user.id, { requisitionId: requisition.id, total });

    // Audit logging
    await logAuditAction(
      user.id, 'CONVERT', 'purchase', 'PurchaseRequisition', requisition.id,
      { convertedTo: purchaseOrder.id, purchaseOrderNumber: purchaseOrder.orderNumber },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    await logAuditAction(
      user.id, 'CREATE', 'purchase', 'PurchaseOrder', purchaseOrder.id,
      { fromRequisition: requisition.id, requisitionNumber: requisition.requisitionNumber },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(purchaseOrder, 'Purchase requisition converted to purchase order successfully');
  } catch (error) {
    return handleApiError(error, 'Convert purchase requisition to purchase order');
  }
}
