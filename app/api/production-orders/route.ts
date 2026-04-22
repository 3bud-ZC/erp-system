import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { validateRawMaterialAvailability, validateProductionStatusTransition } from '@/lib/validation';
import { decrementStockWithTransaction, incrementStockWithTransaction, atomicDecrementStock, createInventoryTransaction } from '@/lib/inventory-transactions';
import {
  createManufacturingEntry,
  recordRawMaterialConsumption,
  recordManufacturingLabor,
  recordManufacturingOverhead,
  postJournalEntry,
  reverseJournalEntry,
} from '@/lib/accounting';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read production orders (requires read_production_order permission)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'read_production_order')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const orders = await (prisma as any).productionOrder.findMany({
      include: {
        product: true,
        productionLine: true,
        items: {
          include: {
            product: true,
          },
        },
        workInProgress: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return apiSuccess(orders, 'Production orders fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch production orders');
  }
}

// POST - Create production order (requires create_production_order permission)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_production_order')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
      const { productId, quantity, laborCost = 0, overheadCost = 0, ...orderData } = body;

      // Auto-generate orderNumber in format PO-YYYY-XXXX
      const year = new Date().getFullYear();
      const lastOrder = await (prisma as any).productionOrder.findFirst({
        where: {
          orderNumber: {
            startsWith: `PO-${year}-`
          }
        },
        orderBy: {
          orderNumber: 'desc'
        }
      });
      
      let nextNumber = 1;
      if (lastOrder && lastOrder.orderNumber) {
        const lastNumber = parseInt(lastOrder.orderNumber.split('-')[2]);
        nextNumber = lastNumber + 1;
      }
      
      const orderNumber = `PO-${year}-${String(nextNumber).padStart(4, '0')}`;

      // STEP 1: Fetch the BOM for this product
      const bomItems = await (prisma as any).bOMItem.findMany({
        where: { productId },
        include: { material: true },
      });

      if (bomItems.length === 0) {
        return apiError('لا يوجد قائمة مواد (BOM) محددة لهذا المنتج. يرجى إضافة المواد الخام المطلوبة في صفحة عمليات الإنتاج أولاً.', 400);
      }

      // STEP 2: Calculate total raw materials needed (BOM explosion)
      const rawMaterialsNeeded = bomItems.map((bom: any) => ({
        materialId: bom.materialId,
        quantity: bom.quantity * quantity,
      }));

      // Convert to inventory transaction format (productId instead of materialId)
      const inventoryItems = rawMaterialsNeeded.map((rm: any) => ({
        productId: rm.materialId,
        quantity: rm.quantity,
      }));

      // STEP 3: Validate stock availability for all raw materials
      const validation = await validateRawMaterialAvailability(rawMaterialsNeeded);
      if (!validation.valid) {
        return apiError(
          'المواد الخام غير كافية للإنتاج',
          400,
          { details: validation.errors }
        );
      }

      // STEP 4: Create production order, consume raw materials, and record WIP atomically
      // Calculate raw material cost before transaction
      let totalRawMaterialCost = 0;
      for (const rm of rawMaterialsNeeded) {
        const material = await (prisma as any).product.findUnique({
          where: { id: rm.materialId },
          select: { cost: true },
        });
        if (material) {
          totalRawMaterialCost += rm.quantity * material.cost;
        }
      }

      const totalManufacturingCost = totalRawMaterialCost + (laborCost || 0) + (overheadCost || 0);

      const order = await (prisma as any).$transaction(async (tx: any) => {
        const newOrder = await (tx as any).productionOrder.create({
          data: {
            ...orderData,
            orderNumber,
            productId,
            quantity,
            plannedQuantity: quantity,
            actualOutputQuantity: 0,
            date: new Date(orderData.date),
            tenantId: user.tenantId,
            items: {
              create: inventoryItems.map((rm: any) => ({
                productId: rm.productId,
                quantity: rm.quantity,
                cost: 0,
                total: 0,
              })),
            },
          },
          include: {
            items: true,
            product: true,
            productionLine: true,
          },
        });

        const wipEntry = await (tx as any).workInProgress.create({
          data: {
            productionOrderId: newOrder.id,
            rawMaterialCost: totalRawMaterialCost,
            laborCost: laborCost || 0,
            overheadCost: overheadCost || 0,
            totalCost: totalManufacturingCost,
            tenantId: user.tenantId,
          },
        });

        // Only consume raw materials immediately if order is created as 'approved'.
        // Orders created as 'pending' consume stock when transitioned to 'approved' via PUT.
        // atomicDecrementStock is race-condition safe (throws + rolls back if stock insufficient).
        if ((orderData.status || 'pending') === 'approved') {
          await atomicDecrementStock(tx, inventoryItems, newOrder.id, 'production_out', user.tenantId || orderData.tenantId);
        }

        // Create WIP journal entry inside transaction for atomicity
        const wipJournal = await recordRawMaterialConsumption(
          newOrder.id,
          totalRawMaterialCost,
          inventoryItems
        );

        if (wipJournal) {
          await postJournalEntry(wipJournal.id);
        }

        return newOrder;
      });

      // Log audit action
      await logAuditAction(
        user.id,
        'CREATE',
        'manufacturing',
        'ProductionOrder',
        order.id,
        { order },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(order, 'Production order created successfully');
    } catch (error) {
      return handleApiError(error, 'Create production order');
    }
  }

// PUT - Update production order (requires update_production_order permission)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_production_order')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
      const { id, status, actualOutputQuantity, ...updateData } = body;

      const order = await (prisma as any).productionOrder.findUnique({
        where: { id },
        include: { items: true, workInProgress: true },
      });

      if (!order) {
        return apiError('أمر الإنتاج غير موجود', 404);
      }

      // Validate status transition
      if (status && status !== order.status) {
        const { valid, error } = validateProductionStatusTransition(order.status, status);
        if (!valid) {
          return apiError(error || 'Invalid status transition', 400);
        }
      }

      // Handle approval (pending → approved): Deduct raw materials atomically
      if (status === 'approved' && order.status === 'pending') {
        const inventoryItems = order.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
        }));

        await (prisma as any).$transaction(async (tx: any) => {
          await atomicDecrementStock(tx, inventoryItems, order.id, 'production_out', user.tenantId || order.tenantId);
        });
      }

      // Handle completion (waiting → completed): Add finished product, calculate waste
      if (status === 'completed' && order.status !== 'completed') {
        const outputQuantity = actualOutputQuantity || order.plannedQuantity || order.quantity;
        const waste = (order.plannedQuantity || order.quantity) - outputQuantity;

        const updatedOrder = await (prisma as any).$transaction(async (tx: any) => {
          const updated = await (tx as any).productionOrder.update({
            where: { id },
            data: { 
              status, 
              actualOutputQuantity: outputQuantity,
              ...updateData 
            },
            include: { product: true, items: true, workInProgress: true },
          });

          const wip = await tx.workInProgress.findUnique({
            where: { productionOrderId: id },
          });

          if (wip) {
            // Add finished product to inventory
            await incrementStockWithTransaction(tx, [{ productId: updated.productId, quantity: outputQuantity }], order.id, 'production_in', user.tenantId || order.tenantId);

            // Calculate waste and create record
            if (waste > 0) {
              await tx.productionWaste.create({
                data: {
                  productId: updated.productId,
                  quantity: waste,
                  date: new Date(),
                  productionOrderId: order.id,
                  notes: 'Production waste calculated on completion'
                }
              });
            }

            const existingProduct = await tx.product.findUnique({
              where: { id: updated.productId },
              select: { cost: true },
            });

            if (existingProduct && outputQuantity > 0) {
              const newCost = wip.totalCost / outputQuantity;
              await tx.product.update({
                where: { id: updated.productId },
                data: { cost: newCost },
              });
            }

            await tx.workInProgress.update({
              where: { productionOrderId: id },
              data: { status: 'completed' },
            });
          }

          return updated;
        });

        const wip = updatedOrder.workInProgress;
        if (wip) {
          const journalEntry = await createManufacturingEntry(
            id,
            outputQuantity,
            wip.totalCost
          );
          if (journalEntry) {
            await postJournalEntry(journalEntry.id);
          }
        }

        // Log audit action
        await logAuditAction(
          user.id,
          'UPDATE',
          'manufacturing',
          'ProductionOrder',
          order.id,
          { status: 'completed', actualOutputQuantity: outputQuantity, waste },
          request.headers.get('x-forwarded-for') || undefined,
          request.headers.get('user-agent') || undefined
        );

        return apiSuccess(updatedOrder, 'Production order completed successfully');
      }

      const updated = await (prisma as any).productionOrder.update({
        where: { id },
        data: { status, actualOutputQuantity, ...updateData },
        include: { items: true, workInProgress: true },
      });

      // Log audit action
      await logAuditAction(
        user.id,
        'UPDATE',
        'manufacturing',
        'ProductionOrder',
        order.id,
        { updateData },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(updated, 'Production order updated successfully');
    } catch (error) {
      return handleApiError(error, 'Update production order');
    }
  }

// DELETE - Delete production order (requires delete_production_order permission)
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_production_order')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return apiError('معرف أمر الإنتاج مطلوب', 400);
      }

      // STEP 1: Reverse all journal entries for this production order
      const journalEntries = await prisma.journalEntry.findMany({
        where: { referenceType: 'ProductionOrder', referenceId: id },
      });
      for (const entry of journalEntries) {
        await reverseJournalEntry(entry.id);
      }

      // STEP 2: Delete production order and reverse stock in transaction
      await prisma.$transaction(async (tx) => {
        const order = await (tx as any).productionOrder.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!order) {
          throw new Error('أمر الإنتاج غير موجود');
        }

        // TASK 4: If the order was completed, the finished product was added to inventory.
        // Deleting a completed order must reverse that finished product increment.
        if (order.status === 'completed' && order.actualOutputQuantity > 0) {
          await tx.product.update({
            where: { id: order.productId },
            data: { stock: { decrement: order.actualOutputQuantity } },
          });
          await createInventoryTransaction(
            tx,
            order.productId,
            'adjustment',
            -order.actualOutputQuantity,
            id,
            'Deleted completed production order — finished product reversed'
          );
        }

        // Restore raw material stock for all consumed items
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
          // TASK 5+6: InventoryTransaction as single source of truth; positive adjustment = stock returning
          await createInventoryTransaction(
            tx,
            item.productId,
            'adjustment',
            item.quantity,
            id,
            'Deleted production order — raw materials restored'
          );
        }

        await tx.workInProgress.deleteMany({
          where: { productionOrderId: id },
        });

        await (tx as any).productionOrder.delete({
          where: { id },
        });
      });

      // Log audit action
      await logAuditAction(
        user.id,
        'DELETE',
        'manufacturing',
        'ProductionOrder',
        id,
        undefined,
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess({ id }, 'Production order deleted successfully');
    } catch (error) {
      return handleApiError(error, 'Delete production order');
    }
  }
