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

// GET - Read stocktakes
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).stocktake.findMany({
        where,
        include: {
          warehouse: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).stocktake.count({ where }),
    ]);

    return apiSuccess({ stocktakes: data, total, page, limit }, 'Stocktakes fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch stocktakes');
  }
}

// POST - Create stocktake
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { warehouseId, date, notes, items } = body;

    if (!warehouseId || !date || !items || !Array.isArray(items) || items.length === 0) {
      return apiError('Warehouse ID, date, and items are required', 400);
    }

    // Validate warehouse
    const warehouse = await (prisma as any).warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      return apiError('Warehouse not found', 404);
    }

    // Generate stocktake number
    const lastStocktake = await (prisma as any).stocktake.findFirst({
      orderBy: { stocktakeNumber: 'desc' },
    });
    const nextNumber = lastStocktake ? parseInt(lastStocktake.stocktakeNumber.slice(3)) + 1 : 1;
    const stocktakeNumber = `STK-${String(nextNumber).padStart(6, '0')}`;

    // Validate items and calculate variances
    const validatedItems = [];
    let totalVarianceValue = 0;

    for (const item of items) {
      const product = await (prisma as any).product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return apiError(`Product ${item.productId} not found`, 404);
      }

      const systemQuantity = product.stock;
      const physicalQuantity = item.physicalQuantity;
      const variance = physicalQuantity - systemQuantity;
      const varianceValue = variance * product.cost;

      totalVarianceValue += varianceValue;

      validatedItems.push({
        productId: item.productId,
        systemQuantity,
        physicalQuantity,
        variance,
        varianceValue,
        reason: item.reason,
      });
    }

    // Create stocktake
    const stocktake = await (prisma as any).stocktake.create({
      data: {
        stocktakeNumber,
        warehouseId,
        date: new Date(date),
        status: 'in_progress',
        notes,
        items: {
          create: validatedItems,
        },
      },
      include: {
        warehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Trigger workflow transition
    await transitionEntity('Stocktake', stocktake.id, 'in_progress', user.id, { totalVarianceValue });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'inventory', 'Stocktake', stocktake.id,
      { stocktakeNumber: stocktake.stocktakeNumber, warehouseId, totalVarianceValue },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(stocktake, 'Stocktake created successfully');
  } catch (error) {
    return handleApiError(error, 'Create stocktake');
  }
}

// PUT - Update stocktake (complete and post variances)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id) {
      return apiError('Stocktake ID is required', 400);
    }

    // Check if stocktake exists
    const existingStocktake = await (prisma as any).stocktake.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        warehouse: true,
      },
    });

    if (!existingStocktake) {
      return apiError('Stocktake not found', 404);
    }

    // If completing, post variances to journal
    if (status === 'completed' && existingStocktake.status !== 'completed') {
      await prisma.$transaction(async (tx) => {
        let totalVarianceValue = 0;

        // Process each item
        for (const item of existingStocktake.items) {
          if (item.variance !== 0 && !item.adjusted) {
            const product = item.product;

            // Update stock
            await (tx as any).product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  increment: item.variance,
                },
              },
            });

            // Create inventory transaction
            await (tx as any).inventoryTransaction.create({
              data: {
                productId: item.productId,
                type: item.variance > 0 ? 'stocktake_increase' : 'stocktake_decrease',
                quantity: Math.abs(item.variance),
                referenceId: existingStocktake.id,
                date: new Date(),
                notes: `Stocktake ${existingStocktake.stocktakeNumber} - ${item.variance > 0 ? 'Increase' : 'Decrease'} for ${product.nameAr || product.nameEn}`,
              },
            });

            // Create journal entry for variance
            const journalEntry = await createJournalEntry({
              entryDate: new Date(),
              description: `Stocktake Variance ${existingStocktake.stocktakeNumber} - ${product.nameAr || product.nameEn}`,
              referenceType: 'Stocktake',
              referenceId: existingStocktake.id,
              lines: item.variance > 0 ? [
                {
                  accountCode: '1030', // Inventory
                  debit: item.varianceValue,
                  credit: 0,
                  description: `Inventory increase from stocktake for ${product.nameAr || product.nameEn}`,
                },
                {
                  accountCode: '5070', // Inventory Adjustment
                  debit: 0,
                  credit: item.varianceValue,
                  description: `Inventory adjustment credit for ${product.nameAr || product.nameEn}`,
                },
              ] : [
                {
                  accountCode: '5070', // Inventory Adjustment
                  debit: Math.abs(item.varianceValue),
                  credit: 0,
                  description: `Inventory decrease from stocktake for ${product.nameAr || product.nameEn}`,
                },
                {
                  accountCode: '1030', // Inventory
                  debit: 0,
                  credit: Math.abs(item.varianceValue),
                  description: `Inventory adjustment debit for ${product.nameAr || product.nameEn}`,
                },
              ],
            }, user.id);

            await postJournalEntry(journalEntry.id, user.id);

            // Mark item as adjusted
            await (tx as any).stocktakeItem.update({
              where: { id: item.id },
              data: {
                adjusted: true,
              },
            });

            totalVarianceValue += item.varianceValue;
          }
        }
      });
    }

    // Update stocktake
    const stocktake = await (prisma as any).stocktake.update({
      where: { id },
      data: {
        status: status || existingStocktake.status,
        notes: notes || existingStocktake.notes,
      },
      include: {
        warehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingStocktake.status) {
      await transitionEntity('Stocktake', id, status, user.id, { status });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'inventory', 'Stocktake', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(stocktake, 'Stocktake updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update stocktake');
  }
}

// DELETE - Delete stocktake
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Stocktake ID is required', 400);
    }

    // Check if stocktake exists
    const stocktake = await (prisma as any).stocktake.findUnique({
      where: { id },
    });

    if (!stocktake) {
      return apiError('Stocktake not found', 404);
    }

    // Prevent deletion if already completed
    if (stocktake.status === 'completed') {
      return apiError('Cannot delete a completed stocktake', 400);
    }

    await (prisma as any).stocktake.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'inventory', 'Stocktake', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Stocktake deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete stocktake');
  }
}
