/**
 * Inventory Adapter - PRODUCTION-GRADE with ATOMIC stock operations
 * Synchronizes stock changes for all inventory-related transactions
 * 
 * CRITICAL: All stock decrement operations use ATOMIC database operations
 * to prevent race conditions and ensure data integrity under concurrent load.
 */

import { ERPTransaction, ERPTransactionType } from '../types';
import { prisma } from '@/lib/db';

/**
 * Stock Operation Errors
 */
export class StockError extends Error {
  constructor(
    public code: 'INSUFFICIENT_STOCK' | 'PRODUCT_NOT_FOUND' | 'DB_ERROR',
    message: string,
    public productId?: string
  ) {
    super(message);
    this.name = 'StockError';
  }
}

/**
 * ============================================================================
 * ATOMIC STOCK OPERATIONS
 * ============================================================================
 * These functions use raw SQL with RETURNING to ensure true atomicity.
 * The database performs the check and update in a single operation.
 */

/**
 * Atomically decrement stock with tenant isolation
 * Uses raw SQL: UPDATE ... SET stock = stock - qty WHERE stock >= qty AND tenantId = ?
 * 
 * ATOMIC GUARANTEE: Two concurrent requests CANNOT both decrement below zero.
 * Only one will succeed, the other gets "no rows returned".
 */
async function atomicDecrementStock(
  productId: string,
  quantity: number,
  tenantId: string,
  txClient?: any
): Promise<void> {
  const client = txClient || prisma;

  // CRITICAL: Use raw SQL for true atomicity
  // This is a single database operation: check + update + return
  const result = await client.$queryRaw`
    UPDATE "Product"
    SET stock = stock - ${quantity}
    WHERE id = ${productId}
      AND "tenantId" = ${tenantId}
      AND stock >= ${quantity}
    RETURNING id, stock;
  `;

  // If no row returned → stock was insufficient or product doesn't exist
  const rows = result as Array<{ id: string; stock: number }>;
  
  if (rows.length === 0) {
    // Check if product exists (for better error message)
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true },
    });

    if (!product) {
      throw new StockError(
        'PRODUCT_NOT_FOUND',
        `Product ${productId} not found`,
        productId
      );
    }

    throw new StockError(
      'INSUFFICIENT_STOCK',
      `Insufficient stock for product ${productId}. Available: ${product.stock}, Required: ${quantity}`,
      productId
    );
  }

  // Success: stock was atomically decremented
  const newStock = rows[0].stock;
  
  if (newStock < 0) {
    // This should never happen due to WHERE clause, but belt-and-suspenders
    throw new StockError(
      'INSUFFICIENT_STOCK',
      `Stock would go negative for product ${productId}`,
      productId
    );
  }
}

/**
 * Atomically increment stock with tenant isolation
 * Safer than decrement - can't go negative, but still atomic
 */
async function atomicIncrementStock(
  productId: string,
  quantity: number,
  tenantId: string,
  txClient?: any
): Promise<void> {
  const client = txClient || prisma;

  const result = await client.$queryRaw`
    UPDATE "Product"
    SET stock = stock + ${quantity}
    WHERE id = ${productId}
      AND "tenantId" = ${tenantId}
    RETURNING id, stock;
  `;

  const rows = result as Array<{ id: string; stock: number }>;
  
  if (rows.length === 0) {
    throw new StockError(
      'PRODUCT_NOT_FOUND',
      `Product ${productId} not found in tenant ${tenantId}`,
      productId
    );
  }
}

/**
 * Record inventory transaction for audit trail
 */
async function recordInventoryTransaction(
  data: {
    productId: string;
    type: string;
    quantity: number;
    referenceId: string;
    referenceType: string;
    unitCost: number;
    totalCost: number;
    tenantId: string;
    warehouseId?: string;
  },
  txClient?: any
): Promise<void> {
  const client = txClient || prisma;

  await client.inventoryTransaction.create({
    data: {
      ...data,
      date: new Date(),
    },
  });
}

/**
 * ============================================================================
 * MAIN INVENTORY ADAPTER
 * ============================================================================
 */
export class InventoryAdapter {
  static async sync(tx: ERPTransaction, result: any): Promise<void> {
    switch (tx.type) {
      case 'SALES_INVOICE':
        await this.handleSalesInvoice(result);
        break;

      case 'SALES_RETURN':
        await this.handleSalesReturn(result);
        break;

      case 'PURCHASE_INVOICE':
        await this.handlePurchaseInvoice(result);
        break;

      case 'PURCHASE_RETURN':
        await this.handlePurchaseReturn(result);
        break;

      case 'STOCK_TRANSFER':
        await this.handleStockTransfer(result);
        break;

      case 'STOCK_ADJUSTMENT':
        await this.handleStockAdjustment(result);
        break;

      case 'PRODUCTION_ORDER':
        await this.handleProductionOrder(result);
        break;
    }
  }

  /**
   * Handle Sales Invoice - ATOMIC stock decrement
   * All items processed in a single transaction
   */
  private static async handleSalesInvoice(result: any): Promise<void> {
    if (!result.items || result.items.length === 0) return;

    // Use transaction to ensure ALL items succeed or ALL fail
    await prisma.$transaction(async (tx) => {
      for (const item of result.items) {
        // ATOMIC: Decrement stock with check
        await atomicDecrementStock(
          item.productId,
          item.quantity,
          result.tenantId,
          tx
        );

        // Record inventory transaction
        await recordInventoryTransaction({
          productId: item.productId,
          type: 'sale',
          quantity: -item.quantity,
          referenceId: result.id,
          referenceType: 'SalesInvoice',
          unitCost: item.unitCost || 0,
          totalCost: (item.unitCost || 0) * item.quantity,
          tenantId: result.tenantId,
        }, tx);
      }
    }, {
      // Transaction options for better concurrency handling
      isolationLevel: 'Serializable', // Highest isolation for stock operations
      maxWait: 5000, // Max 5s waiting for lock
      timeout: 10000, // 10s total timeout
    });
  }

  /**
   * Handle Sales Return - Stock increase (less critical, but still atomic)
   */
  private static async handleSalesReturn(result: any): Promise<void> {
    if (!result.items || result.items.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const item of result.items) {
        await atomicIncrementStock(
          item.productId,
          item.quantity,
          result.tenantId,
          tx
        );

        await recordInventoryTransaction({
          productId: item.productId,
          type: 'sales_return',
          quantity: item.quantity,
          referenceId: result.id,
          referenceType: 'SalesReturn',
          unitCost: item.unitCost || 0,
          totalCost: (item.unitCost || 0) * item.quantity,
          tenantId: result.tenantId,
        }, tx);
      }
    });
  }

  /**
   * Handle Purchase Invoice - Stock increase
   */
  private static async handlePurchaseInvoice(result: any): Promise<void> {
    if (!result.items || result.items.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const item of result.items) {
        // Update stock AND cost atomically
        const updateResult = await tx.$queryRaw`
          UPDATE "Product"
          SET 
            stock = stock + ${item.quantity},
            cost = ${item.unitCost || 0}
          WHERE id = ${item.productId}
            AND "tenantId" = ${result.tenantId}
          RETURNING id;
        `;

        if ((updateResult as any[]).length === 0) {
          throw new StockError(
            'PRODUCT_NOT_FOUND',
            `Product ${item.productId} not found`,
            item.productId
          );
        }

        await recordInventoryTransaction({
          productId: item.productId,
          type: 'purchase',
          quantity: item.quantity,
          referenceId: result.id,
          referenceType: 'PurchaseInvoice',
          unitCost: item.unitCost || 0,
          totalCost: item.total || 0,
          tenantId: result.tenantId,
        }, tx);
      }
    });
  }

  /**
   * Handle Purchase Return - ATOMIC stock decrement
   */
  private static async handlePurchaseReturn(result: any): Promise<void> {
    if (!result.items || result.items.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const item of result.items) {
        await atomicDecrementStock(
          item.productId,
          item.quantity,
          result.tenantId,
          tx
        );

        await recordInventoryTransaction({
          productId: item.productId,
          type: 'purchase_return',
          quantity: -item.quantity,
          referenceId: result.id,
          referenceType: 'PurchaseReturn',
          unitCost: item.unitCost || 0,
          totalCost: (item.unitCost || 0) * item.quantity,
          tenantId: result.tenantId,
        }, tx);
      }
    }, {
      isolationLevel: 'Serializable',
    });
  }

  /**
   * Handle Stock Transfer - Two-phase: decrement then increment
   * CRITICAL: Both must succeed or both fail
   */
  private static async handleStockTransfer(result: any): Promise<void> {
    if (!result.items || result.items.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const item of result.items) {
        // Phase 1: Atomically decrement from source
        await atomicDecrementStock(
          item.productId,
          item.quantity,
          result.tenantId,
          tx
        );

        // Phase 2: Increment to destination (same product for now)
        await atomicIncrementStock(
          item.productId,
          item.quantity,
          result.tenantId,
          tx
        );

        // Record both transactions
        await recordInventoryTransaction({
          productId: item.productId,
          type: 'transfer_out',
          quantity: -item.quantity,
          referenceId: result.id,
          referenceType: 'StockTransfer',
          warehouseId: result.fromWarehouseId,
          unitCost: item.unitCost || 0,
          totalCost: (item.unitCost || 0) * item.quantity,
          tenantId: result.tenantId,
        }, tx);

        await recordInventoryTransaction({
          productId: item.productId,
          type: 'transfer_in',
          quantity: item.quantity,
          referenceId: result.id,
          referenceType: 'StockTransfer',
          warehouseId: result.toWarehouseId,
          unitCost: item.unitCost || 0,
          totalCost: (item.unitCost || 0) * item.quantity,
          tenantId: result.tenantId,
        }, tx);
      }
    }, {
      isolationLevel: 'Serializable',
    });
  }

  /**
   * Handle Stock Adjustment - Can increase or decrease
   */
  private static async handleStockAdjustment(result: any): Promise<void> {
    const { productId, warehouseId, adjustmentType, quantity, value } = result;

    if (adjustmentType === 'INCREASE') {
      // Increase stock
      await prisma.$transaction(async (tx) => {
        await atomicIncrementStock(productId, quantity, result.tenantId, tx);

        await recordInventoryTransaction({
          productId,
          type: 'adjustment_in',
          quantity,
          referenceId: result.id,
          referenceType: 'StockAdjustment',
          warehouseId,
          unitCost: value / quantity,
          totalCost: value,
          tenantId: result.tenantId,
        }, tx);
      });
    } else {
      // Decrease stock - ATOMIC
      await prisma.$transaction(async (tx) => {
        await atomicDecrementStock(productId, quantity, result.tenantId, tx);

        await recordInventoryTransaction({
          productId,
          type: 'adjustment_out',
          quantity: -quantity,
          referenceId: result.id,
          referenceType: 'StockAdjustment',
          warehouseId,
          unitCost: value / quantity,
          totalCost: value,
          tenantId: result.tenantId,
        }, tx);
      }, {
        isolationLevel: 'Serializable',
      });
    }
  }

  /**
   * Handle Production Order - Consume materials, produce goods
   */
  private static async handleProductionOrder(result: any): Promise<void> {
    if (result.status !== 'completed') return;

    await prisma.$transaction(async (tx) => {
      // Consume raw materials
      if (result.rawMaterials && result.rawMaterials.length > 0) {
        for (const material of result.rawMaterials) {
          await atomicDecrementStock(
            material.productId,
            material.quantity,
            result.tenantId,
            tx
          );

          await recordInventoryTransaction({
            productId: material.productId,
            type: 'production_consumption',
            quantity: -material.quantity,
            referenceId: result.id,
            referenceType: 'ProductionOrder',
            unitCost: material.unitCost,
            totalCost: material.totalCost,
            tenantId: result.tenantId,
          }, tx);
        }
      }

      // Produce finished goods
      await atomicIncrementStock(
        result.productId,
        result.quantity,
        result.tenantId,
        tx
      );

      await recordInventoryTransaction({
        productId: result.productId,
        type: 'production_completion',
        quantity: result.quantity,
        referenceId: result.id,
        referenceType: 'ProductionOrder',
        unitCost: result.unitCost,
        totalCost: result.totalCost,
        tenantId: result.tenantId,
      }, tx);
    }, {
      isolationLevel: 'Serializable',
    });
  }
}

/**
 * Export error handler for API routes
 */
export function handleStockError(error: unknown): {
  status: number;
  body: { error: string; code: string; productId?: string };
} {
  if (error instanceof StockError) {
    const statusMap: Record<StockError['code'], number> = {
      INSUFFICIENT_STOCK: 409, // Conflict
      PRODUCT_NOT_FOUND: 404,
      DB_ERROR: 500,
    };

    return {
      status: statusMap[error.code],
      body: {
        error: error.message,
        code: error.code,
        productId: error.productId,
      },
    };
  }

  // Unknown error
  return {
    status: 500,
    body: {
      error: 'Internal server error during inventory operation',
      code: 'INTERNAL_ERROR',
    },
  };
}
