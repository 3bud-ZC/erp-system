import { prisma } from './db';

export interface InventoryTransactionItem {
  productId: string;
  quantity: number;
}

/**
 * Create inventory transaction record
 * Centralized function for all inventory changes
 */
export async function createInventoryTransaction(
  tx: any,
  productId: string,
  type: 'purchase' | 'sale' | 'production_in' | 'production_out' | 'adjustment',
  quantity: number,
  referenceId?: string,
  notes?: string
) {
  return await tx.inventoryTransaction.create({
    data: {
      productId,
      type,
      quantity,
      referenceId,
      date: new Date(),
      notes
    }
  });
}

/**
 * Increment stock with inventory transaction
 * Used in purchase invoices, production completion
 */
export async function incrementStockWithTransaction(
  tx: any,
  items: InventoryTransactionItem[],
  referenceId: string,
  transactionType: 'purchase' | 'production_in'
) {
  for (const item of items) {
    // Update product stock
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } }
    });

    // Create inventory transaction record
    await createInventoryTransaction(
      tx,
      item.productId,
      transactionType,
      item.quantity,
      referenceId
    );
  }
}

/**
 * Decrement stock with inventory transaction
 * Used in sales invoices, production approval
 */
export async function decrementStockWithTransaction(
  tx: any,
  items: InventoryTransactionItem[],
  referenceId: string,
  transactionType: 'sale' | 'production_out'
) {
  for (const item of items) {
    // Update product stock
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } }
    });

    // Create inventory transaction record (negative quantity for out)
    await createInventoryTransaction(
      tx,
      item.productId,
      transactionType,
      -item.quantity,
      referenceId
    );
  }
}

/**
 * Atomically check and decrement stock within a transaction.
 * Race-condition safe: the stock check and decrement happen in one SQL statement.
 * Throws with a descriptive Arabic error if stock is insufficient — the throw rolls back
 * the enclosing prisma.$transaction() automatically.
 */
export async function atomicDecrementStock(
  tx: any,
  items: InventoryTransactionItem[],
  referenceId: string,
  transactionType: 'sale' | 'production_out'
) {
  for (const item of items) {
    // Single atomic SQL: UPDATE product SET stock = stock - qty WHERE id = ? AND stock >= qty
    const result = await tx.product.updateMany({
      where: { id: item.productId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });

    if (result.count === 0) {
      // Fetch product details for a meaningful error message
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { nameAr: true, stock: true },
      });
      throw new Error(
        `رصيد المخزون غير كافٍ: ${product?.nameAr || item.productId} (المتاح: ${product?.stock ?? 0}، المطلوب: ${item.quantity})`
      );
    }

    // Record the inventory transaction
    await createInventoryTransaction(
      tx,
      item.productId,
      transactionType,
      -item.quantity,
      referenceId
    );
  }
}

/**
 * Get inventory transaction history for a product
 */
export async function getProductInventoryHistory(productId: string, limit = 50) {
  return await prisma.inventoryTransaction.findMany({
    where: { productId },
    include: {
      product: {
        select: {
          code: true,
          nameAr: true
        }
      }
    },
    orderBy: { date: 'desc' },
    take: limit
  });
}

/**
 * Get inventory summary by transaction type
 */
export async function getInventorySummary(dateFrom?: Date, dateTo?: Date) {
  const where: any = {};
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = dateFrom;
    if (dateTo) where.date.lte = dateTo;
  }

  const transactions = await prisma.inventoryTransaction.groupBy({
    by: ['type'],
    where,
    _sum: {
      quantity: true
    },
    _count: true
  });

  return transactions.map(t => ({
    type: t.type,
    totalQuantity: t._sum.quantity || 0,
    transactionCount: t._count
  }));
}

/**
 * Adjust stock manually with transaction record
 */
export async function adjustStock(
  productId: string,
  quantity: number,
  reason: string,
  userId?: string
) {
  return await prisma.$transaction(async (tx) => {
    // Update product stock
    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } }
    });

    // Create inventory transaction
    await createInventoryTransaction(
      tx,
      productId,
      'adjustment',
      quantity,
      undefined,
      reason
    );

    return { success: true };
  });
}
