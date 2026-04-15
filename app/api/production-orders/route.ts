import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { validateStockAvailability, decrementStockInTransaction, incrementStockInTransaction } from '@/lib/inventory';
import {
  createManufacturingEntry,
  recordRawMaterialConsumption,
  recordManufacturingLabor,
  recordManufacturingOverhead,
  postJournalEntry,
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

    const orders = await prisma.productionOrder.findMany({
      include: {
        product: true,
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
      const lastOrder = await prisma.productionOrder.findFirst({
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
      const bomItems = await prisma.bOMItem.findMany({
        where: { productId },
        include: { material: true },
      });

      if (bomItems.length === 0) {
        return apiError('لا يوجد قائمة مواد (BOM) محددة لهذا المنتج. يرجى إضافة المواد الخام المطلوبة في صفحة عمليات الإنتاج أولاً.', 400);
      }

      // STEP 2: Calculate total raw materials needed (BOM explosion)
      const rawMaterialsNeeded = bomItems.map((bom) => ({
        productId: bom.materialId,
        quantity: bom.quantity * quantity,
      }));

      // STEP 3: Validate stock availability for all raw materials
      const validation = await validateStockAvailability(rawMaterialsNeeded);
      if (!validation.valid) {
        return apiError(
          'Insufficient raw materials for production',
          400,
          { details: validation.errors }
        );
      }

      // STEP 4: Create production order, consume raw materials, and record WIP atomically
      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.productionOrder.create({
          data: {
            ...orderData,
            orderNumber,
            productId,
            quantity,
            date: new Date(orderData.date),
            items: {
              create: rawMaterialsNeeded.map((rm) => ({
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
          },
        });

        const wipEntry = await tx.workInProgress.create({
          data: {
            productionOrderId: newOrder.id,
            rawMaterialCost: 0,
            laborCost: laborCost || 0,
            overheadCost: overheadCost || 0,
            totalCost: laborCost || overheadCost || 0,
          },
        });

        await decrementStockInTransaction(tx, rawMaterialsNeeded, newOrder.id, 'ProductionOrder');

        return newOrder;
      });

      // STEP 5: Calculate raw material cost and create accounting entries
      let totalRawMaterialCost = 0;
      for (const rm of rawMaterialsNeeded) {
        const material = await prisma.product.findUnique({
          where: { id: rm.productId },
          select: { cost: true },
        });
        if (material) {
          totalRawMaterialCost += rm.quantity * material.cost;
        }
      }

      const totalManufacturingCost = totalRawMaterialCost + (laborCost || 0) + (overheadCost || 0);

      await prisma.workInProgress.update({
        where: { productionOrderId: order.id },
        data: {
          rawMaterialCost: totalRawMaterialCost,
          totalCost: totalManufacturingCost,
        },
      });

      const wipJournal = await recordRawMaterialConsumption(
        order.id,
        totalRawMaterialCost,
        rawMaterialsNeeded
      );

      if (wipJournal) {
        await postJournalEntry(wipJournal.id);
      }

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
      const { id, status, ...updateData } = body;

      const order = await prisma.productionOrder.findUnique({
        where: { id },
        include: { items: true, workInProgress: true },
      });

      if (!order) {
        return apiError('أمر الإنتاج غير موجود', 404);
      }

      if (status === 'completed' && order.status !== 'completed') {
        const updatedOrder = await prisma.$transaction(async (tx) => {
          const updated = await tx.productionOrder.update({
            where: { id },
            data: { status, ...updateData },
            include: { product: true, items: true, workInProgress: true },
          });

          const wip = await tx.workInProgress.findUnique({
            where: { productionOrderId: id },
          });

          if (wip) {
            await tx.product.update({
              where: { id: updated.productId },
              data: {
                stock: {
                  increment: updated.quantity,
                },
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: updated.productId,
                type: 'MANUFACTURING_IN',
                quantity: updated.quantity,
                reference: id,
                referenceType: 'ProductionOrder',
                notes: `Finished goods from manufacturing (Cost: ${wip.totalCost})`,
              },
            });

            const existingProduct = await tx.product.findUnique({
              where: { id: updated.productId },
              select: { cost: true },
            });

            if (existingProduct) {
              const newCost = wip.totalCost / updated.quantity;
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
            updatedOrder.quantity,
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
          { status: 'completed' },
          request.headers.get('x-forwarded-for') || undefined,
          request.headers.get('user-agent') || undefined
        );

        return apiSuccess(updatedOrder, 'Production order completed successfully');
      }

      const updated = await prisma.productionOrder.update({
        where: { id },
        data: { status, ...updateData },
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

      await prisma.$transaction(async (tx) => {
        const order = await tx.productionOrder.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!order) {
          throw new Error('أمر الإنتاج غير موجود');
        }

        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'MANUFACTURING_OUT',
              quantity: -item.quantity,
              reference: id,
              referenceType: 'ProductionOrder',
              notes: 'Deleted production order - raw materials restored',
            },
          });
        }

        await tx.workInProgress.deleteMany({
          where: { productionOrderId: id },
        });

        await tx.productionOrder.delete({
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
