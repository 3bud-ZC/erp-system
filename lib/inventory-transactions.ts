import { prisma } from './db';
import { Prisma } from '@prisma/client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Inventory transaction types based on actual usage in the codebase
 * These align with the Prisma schema where 'type' is a String field
 */
export type InventoryTransactionType =
  | 'purchase'
  | 'sale'
  | 'production_in'
  | 'production_out'
  | 'adjustment'
  | 'return'
  | 'purchase_return';

/**
 * Interface for inventory transaction items
 */
export interface InventoryTransactionItem {
  productId: string;
  quantity: number;
}

/**
 * Prisma transaction client type for type-safe transaction operations
 */
type TransactionClient = Prisma.TransactionClient;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate tenantId and throw explicit error if missing
 * This prevents silent failures and ensures multi-tenant data isolation
 */
function validateTenantId(tenantId: string | undefined): void {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('tenantId is required and must be a non-empty string');
  }
}

/**
 * Validate inventory transaction type
 */
function validateTransactionType(type: string): asserts type is InventoryTransactionType {
  const validTypes: InventoryTransactionType[] = [
    'purchase',
    'sale',
    'production_in',
    'production_out',
    'adjustment',
    'return',
    'purchase_return',
  ];

  if (!validTypes.includes(type as InventoryTransactionType)) {
    throw new Error(`Invalid transaction type: ${type}. Valid types are: ${validTypes.join(', ')}`);
  }
}

/**
 * Validate inventory transaction item
 */
function validateInventoryItem(item: InventoryTransactionItem): void {
  if (!item.productId || typeof item.productId !== 'string' || item.productId.trim() === '') {
    throw new Error('productId is required and must be a non-empty string');
  }

  if (typeof item.quantity !== 'number' || isNaN(item.quantity)) {
    throw new Error('quantity must be a valid number');
  }

  if (item.quantity <= 0) {
    throw new Error('quantity must be greater than 0 (use negative values for decrements in calling functions)');
  }
}

// ============================================================================
// CORE INVENTORY TRANSACTION FUNCTIONS
// ============================================================================

/**
 * Create inventory transaction record
 * Centralized function for all inventory changes
 *
 * @param tx - Prisma transaction client
 * @param productId - Product ID
 * @param type - Transaction type (must be valid InventoryTransactionType)
 * @param quantity - Quantity (can be negative for out transactions)
 * @param tenantId - Tenant ID (required, will throw if missing)
 * @param referenceId - Optional reference ID for the transaction
 * @param notes - Optional notes
 * @returns Created inventory transaction
 */
export async function createInventoryTransaction(
  tx: TransactionClient,
  productId: string,
  type: InventoryTransactionType,
  quantity: number,
  tenantId: string,
  referenceId?: string,
  notes?: string
): Promise<Prisma.InventoryTransactionUncheckedCreateInput> {
  // Validate inputs
  validateTenantId(tenantId);
  validateTransactionType(type);

  if (!productId || typeof productId !== 'string' || productId.trim() === '') {
    throw new Error('productId is required and must be a non-empty string');
  }

  if (typeof quantity !== 'number' || isNaN(quantity)) {
    throw new Error('quantity must be a valid number');
  }

  // Create inventory transaction with proper typing
  // Use unchecked create input to allow scalar foreign keys (productId, tenantId)
  const data: Prisma.InventoryTransactionUncheckedCreateInput = {
    productId,
    type,
    quantity,
    referenceId: referenceId || null,
    date: new Date(),
    notes: notes || null,
    tenantId,
  };
  return await tx.inventoryTransaction.create({ data });
}

/**
 * Increment stock with inventory transaction
 * Used in purchase invoices, production completion
 * Uses optimistic locking with version field for concurrency safety
 *
 * @param tx - Prisma transaction client
 * @param items - Array of inventory items to increment
 * @param referenceId - Reference ID for the transaction
 * @param transactionType - Type of transaction (purchase or production_in)
 * @param tenantId - Tenant ID (required, will throw if missing)
 */
export async function incrementStockWithTransaction(
  tx: TransactionClient,
  items: InventoryTransactionItem[],
  referenceId: string,
  transactionType: 'purchase' | 'production_in',
  tenantId: string
): Promise<void> {
  // Validate inputs
  validateTenantId(tenantId);

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  if (!referenceId || typeof referenceId !== 'string' || referenceId.trim() === '') {
    throw new Error('referenceId is required and must be a non-empty string');
  }

  // Validate transaction type
  validateTransactionType(transactionType);

  for (const item of items) {
    validateInventoryItem(item);

    // Get current product version for optimistic locking
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { version: true, tenantId: true },
    });

    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    if (product.tenantId !== tenantId) {
      throw new Error(`Product belongs to different tenant`);
    }

    // Update product stock with version check (optimistic locking)
    await tx.product.update({
      where: { 
        id: item.productId,
        version: product.version,
      },
      data: { 
        stock: { increment: item.quantity },
        version: { increment: 1 },
      },
    });

    // Create inventory transaction record
    await createInventoryTransaction(
      tx,
      item.productId,
      transactionType,
      item.quantity,
      tenantId,
      referenceId
    );
  }
}

/**
 * Decrement stock with inventory transaction
 * Used in sales invoices, production approval
 * Uses optimistic locking with version field for concurrency safety
 *
 * @param tx - Prisma transaction client
 * @param items - Array of inventory items to decrement
 * @param referenceId - Reference ID for the transaction
 * @param transactionType - Type of transaction (sale or production_out)
 * @param tenantId - Tenant ID (required, will throw if missing)
 */
export async function decrementStockWithTransaction(
  tx: TransactionClient,
  items: InventoryTransactionItem[],
  referenceId: string,
  transactionType: 'sale' | 'production_out',
  tenantId: string
): Promise<void> {
  // Validate inputs
  validateTenantId(tenantId);

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  if (!referenceId || typeof referenceId !== 'string' || referenceId.trim() === '') {
    throw new Error('referenceId is required and must be a non-empty string');
  }

  // Validate transaction type
  validateTransactionType(transactionType);

  for (const item of items) {
    validateInventoryItem(item);

    // Get current product version for optimistic locking
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { version: true, tenantId: true, stock: true },
    });

    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    if (product.tenantId !== tenantId) {
      throw new Error(`Product belongs to different tenant`);
    }

    // Check stock availability
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for product ${item.productId}. Available: ${product.stock}, Required: ${item.quantity}`);
    }

    // Update product stock with version check (optimistic locking)
    await tx.product.update({
      where: { 
        id: item.productId,
        version: product.version,
      },
      data: { 
        stock: { decrement: item.quantity },
        version: { increment: 1 },
      },
    });

    // Create inventory transaction record (negative quantity for out)
    await createInventoryTransaction(
      tx,
      item.productId,
      transactionType,
      -item.quantity,
      tenantId,
      referenceId
    );
  }
}

/**
 * Atomically check and decrement stock within a transaction.
 * Race-condition safe: the stock check and decrement happen in one SQL statement.
 * Uses optimistic locking with version field for additional concurrency safety.
 * Throws with a descriptive Arabic error if stock is insufficient — the throw rolls back
 * the enclosing prisma.$transaction() automatically.
 *
 * @param tx - Prisma transaction client
 * @param items - Array of inventory items to decrement atomically
 * @param referenceId - Reference ID for the transaction
 * @param transactionType - Type of transaction (sale or production_out)
 * @param tenantId - Tenant ID (required, will throw if missing)
 */
export async function atomicDecrementStock(
  tx: TransactionClient,
  items: InventoryTransactionItem[],
  referenceId: string,
  transactionType: 'sale' | 'production_out',
  tenantId: string
): Promise<void> {
  // Validate inputs
  validateTenantId(tenantId);

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  if (!referenceId || typeof referenceId !== 'string' || referenceId.trim() === '') {
    throw new Error('referenceId is required and must be a non-empty string');
  }

  // Validate transaction type
  validateTransactionType(transactionType);

  for (const item of items) {
    validateInventoryItem(item);

    // Get current product version for optimistic locking
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { version: true, tenantId: true, nameAr: true, stock: true },
    });

    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    if (product.tenantId !== tenantId) {
      throw new Error(`Product belongs to different tenant`);
    }

    // Single atomic SQL: UPDATE product SET stock = stock - qty, version = version + 1 WHERE id = ? AND stock >= qty AND version = ?
    const result = await tx.product.updateMany({
      where: {
        id: item.productId,
        stock: { gte: item.quantity },
        version: product.version,
      },
      data: { 
        stock: { decrement: item.quantity },
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new Error(
        `رصيد المخزون غير كافٍ أو تم تعديل المنتج: ${product.nameAr || item.productId} (المتاح: ${product.stock ?? 0}، المطلوب: ${item.quantity})`
      );
    }

    // Record the inventory transaction
    await createInventoryTransaction(
      tx,
      item.productId,
      transactionType,
      -item.quantity,
      tenantId,
      referenceId
    );
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get inventory transaction history for a product
 *
 * @param productId - Product ID
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Array of inventory transactions with product details
 */
export async function getProductInventoryHistory(
  productId: string,
  limit: number = 50
): Promise<any[]> {
  if (!productId || typeof productId !== 'string' || productId.trim() === '') {
    throw new Error('productId is required and must be a non-empty string');
  }

  if (typeof limit !== 'number' || limit < 1 || limit > 1000) {
    throw new Error('limit must be a number between 1 and 1000');
  }

  return await prisma.inventoryTransaction.findMany({
    where: { productId },
    include: {
      product: {
        select: {
          code: true,
          nameAr: true,
        },
      },
    },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

/**
 * Get inventory summary by transaction type
 *
 * @param dateFrom - Optional start date filter
 * @param dateTo - Optional end date filter
 * @returns Array of transaction summaries grouped by type
 */
export async function getInventorySummary(
  dateFrom?: Date,
  dateTo?: Date
): Promise<Array<{ type: string; totalQuantity: number; transactionCount: number }>> {
  // Build where clause with proper typing
  const where: Prisma.InventoryTransactionWhereInput = {};

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = dateFrom;
    if (dateTo) where.date.lte = dateTo;
  }

  const transactions = await prisma.inventoryTransaction.groupBy({
    by: ['type'],
    where,
    _sum: {
      quantity: true,
    },
    _count: true,
  });

  return transactions.map((t) => ({
    type: t.type,
    totalQuantity: t._sum.quantity || 0,
    transactionCount: t._count,
  }));
}

// ============================================================================
// STOCK ADJUSTMENT FUNCTIONS
// ============================================================================

/**
 * Adjust stock manually with transaction record
 * Uses optimistic locking with version field for concurrency safety
 *
 * @param productId - Product ID
 * @param quantity - Quantity to adjust (can be positive or negative)
 * @param tenantId - Tenant ID (required, will throw if missing)
 * @param reason - Reason for the adjustment
 * @param userId - Optional user ID for audit trail
 * @returns Success indicator
 */
export async function adjustStock(
  productId: string,
  quantity: number,
  tenantId: string,
  reason: string,
  userId?: string
): Promise<{ success: boolean }> {
  // Validate inputs
  validateTenantId(tenantId);

  if (!productId || typeof productId !== 'string' || productId.trim() === '') {
    throw new Error('productId is required and must be a non-empty string');
  }

  if (typeof quantity !== 'number' || isNaN(quantity)) {
    throw new Error('quantity must be a valid number');
  }

  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('reason is required and must be a non-empty string');
  }

  return await prisma.$transaction(async (tx: TransactionClient) => {
    // Get current product version for optimistic locking
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { version: true, tenantId: true, stock: true },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    if (product.tenantId !== tenantId) {
      throw new Error(`Product belongs to different tenant`);
    }

    // Check if adjustment would result in negative stock
    if (product.stock + quantity < 0) {
      throw new Error(`Stock adjustment would result in negative stock. Current: ${product.stock}, Adjustment: ${quantity}`);
    }

    // Update product stock with version check (optimistic locking)
    await tx.product.update({
      where: { 
        id: productId,
        version: product.version,
      },
      data: { 
        stock: { increment: quantity },
        version: { increment: 1 },
      },
    });

    // Create inventory transaction
    await createInventoryTransaction(
      tx,
      productId,
      'adjustment',
      quantity,
      tenantId,
      undefined,
      reason
    );

    return { success: true };
  });
}

/**
 * Update stock with transaction record
 * Convenience function for stock updates that creates both stock change and transaction
 * Uses optimistic locking with version field for concurrency safety
 *
 * @param productId - Product ID
 * @param quantity - Quantity to adjust (can be positive or negative)
 * @param type - Transaction type
 * @param referenceId - Reference ID for the transaction
 * @param tenantId - Tenant ID (required, will throw if missing)
 * @param notes - Optional notes
 * @returns Success indicator
 */
export async function updateStock(
  productId: string,
  quantity: number,
  type: InventoryTransactionType,
  referenceId: string,
  tenantId: string,
  notes?: string
): Promise<{ success: boolean }> {
  // Validate inputs
  validateTenantId(tenantId);

  if (!productId || typeof productId !== 'string' || productId.trim() === '') {
    throw new Error('productId is required and must be a non-empty string');
  }

  if (typeof quantity !== 'number' || isNaN(quantity)) {
    throw new Error('quantity must be a valid number');
  }

  if (!referenceId || typeof referenceId !== 'string' || referenceId.trim() === '') {
    throw new Error('referenceId is required and must be a non-empty string');
  }

  // Validate transaction type
  validateTransactionType(type);

  return await prisma.$transaction(async (tx: TransactionClient) => {
    // Get current product version for optimistic locking
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { version: true, tenantId: true, stock: true },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    if (product.tenantId !== tenantId) {
      throw new Error(`Product belongs to different tenant`);
    }

    // Check if update would result in negative stock
    if (product.stock + quantity < 0) {
      throw new Error(`Stock update would result in negative stock. Current: ${product.stock}, Adjustment: ${quantity}`);
    }

    // Update product stock with version check (optimistic locking)
    await tx.product.update({
      where: { 
        id: productId,
        version: product.version,
      },
      data: { 
        stock: { increment: quantity },
        version: { increment: 1 },
      },
    });

    // Create inventory transaction
    await createInventoryTransaction(
      tx,
      productId,
      type,
      quantity,
      tenantId,
      referenceId,
      notes
    );

    return { success: true };
  });
}
