/**
 * Inventory Reporting Service - Production-Grade
 * Read-only inventory reports with optimized queries
 */

import { prisma } from '../db';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface StockValuationItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  warehouseId?: string;
}

export interface StockValuationReport {
  tenantId: string;
  asOfDate: Date;
  totalValue: number;
  totalQuantity: number;
  items: StockValuationItem[];
  byWarehouse: Record<string, { quantity: number; value: number }>;
}

export interface LowStockItem {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: number;
  minStock: number;
  reorderQuantity: number;
  warehouseId?: string;
}

export interface LowStockReport {
  tenantId: string;
  asOfDate: Date;
  lowStockItems: LowStockItem[];
  totalItems: number;
}

export interface FIFOStockLayer {
  productId: string;
  productCode: string;
  transactionDate: Date;
  quantity: number;
  unitCost: number;
  remainingQuantity: number;
  totalValue: number;
  referenceId?: string;
}

export interface FIFOReport {
  tenantId: string;
  productId: string;
  productName: string;
  currentStock: number;
  layers: FIFOStockLayer[];
  totalValue: number;
  averageCost: number;
}

// ============================================================================
// STOCK VALUATION REPORT
// ============================================================================

/**
 * Generate Stock Valuation Report
 * Calculates total inventory value based on current stock and unit cost
 */
export async function generateStockValuation(
  tenantId: string,
  asOfDate: Date = new Date(),
  options: {
    warehouseId?: string;
    productIds?: string[];
  } = {}
): Promise<StockValuationReport> {
  const where: any = {
    tenantId,
  };

  if (options.warehouseId) {
    where.warehouseId = options.warehouseId;
  }

  if (options.productIds && options.productIds.length > 0) {
    where.id = { in: options.productIds };
  }

  // Get all products with stock
  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      code: true,
      nameAr: true,
      stock: true,
      cost: true,
      warehouseId: true,
    },
  });

  const items: StockValuationItem[] = [];
  let totalValue = 0;
  let totalQuantity = 0;
  const byWarehouse: Record<string, { quantity: number; value: number }> = {};

  for (const product of products) {
    const quantity = Number(product.stock);
    const unitCost = Number(product.cost);
    const totalValueItem = quantity * unitCost;

    if (quantity > 0) {
      items.push({
        productId: product.id,
        productCode: product.code,
        productName: product.nameAr,
        quantity,
        unitCost,
        totalValue: totalValueItem,
        warehouseId: product.warehouseId || undefined,
      });

      totalValue += totalValueItem;
      totalQuantity += quantity;

      // Aggregate by warehouse
      const warehouseId = product.warehouseId || 'unassigned';
      if (!byWarehouse[warehouseId]) {
        byWarehouse[warehouseId] = { quantity: 0, value: 0 };
      }
      byWarehouse[warehouseId].quantity += quantity;
      byWarehouse[warehouseId].value += totalValueItem;
    }
  }

  return {
    tenantId,
    asOfDate,
    totalValue,
    totalQuantity,
    items,
    byWarehouse,
  };
}

// ============================================================================
// LOW STOCK REPORT
// ============================================================================

/**
 * Generate Low Stock Report
 * Identifies products with stock below minimum threshold
 */
export async function generateLowStockReport(
  tenantId: string,
  asOfDate: Date = new Date(),
  options: {
    warehouseId?: string;
  } = {}
): Promise<LowStockReport> {
  const where: any = {
    tenantId,
  };

  if (options.warehouseId) {
    where.warehouseId = options.warehouseId;
  }

  // Get products with stock below minimum
  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      code: true,
      nameAr: true,
      stock: true,
      minStock: true,
      warehouseId: true,
    },
  });

  const lowStockItems: LowStockItem[] = [];

  for (const product of products) {
    const currentStock = Number(product.stock);
    const minStock = Number(product.minStock);

    if (currentStock < minStock) {
      const reorderQuantity = minStock - currentStock;
      lowStockItems.push({
        productId: product.id,
        productCode: product.code,
        productName: product.nameAr,
        currentStock,
        minStock,
        reorderQuantity,
        warehouseId: product.warehouseId || undefined,
      });
    }
  }

  // Sort by severity (lowest stock first)
  lowStockItems.sort((a, b) => {
    const aSeverity = a.currentStock / a.minStock;
    const bSeverity = b.currentStock / b.minStock;
    return aSeverity - bSeverity;
  });

  return {
    tenantId,
    asOfDate,
    lowStockItems,
    totalItems: lowStockItems.length,
  };
}

// ============================================================================
// FIFO COST TRACKING
// ============================================================================

/**
 * Generate FIFO Report for a specific product
 * Tracks cost layers using First-In-First-Out method
 */
export async function generateFIFOReport(
  tenantId: string,
  productId: string
): Promise<FIFOReport> {
  // Validate product exists
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      tenantId,
    },
    select: {
      id: true,
      code: true,
      nameAr: true,
      stock: true,
      cost: true,
    },
  });

  if (!product) {
    throw new Error(`Product ${productId} not found for tenant ${tenantId}`);
  }

  // Get FIFO layers (assuming FIFOLayer model exists in schema)
  const fifoLayers = await prisma.fIFOLayer.findMany({
    where: {
      tenantId,
      productId,
      remainingQuantity: { gt: 0 },
    },
    orderBy: { transactionDate: 'asc' },
  });

  const layers: FIFOStockLayer[] = [];
  let totalValue = 0;
  let totalQuantity = 0;

  for (const layer of fifoLayers) {
    const remainingQuantity = Number(layer.remainingQuantity);
    const unitCost = Number(layer.unitCost);
    const layerValue = remainingQuantity * unitCost;

    layers.push({
      productId: layer.productId,
      productCode: product.code,
      transactionDate: layer.transactionDate,
      quantity: Number(layer.quantity),
      unitCost,
      remainingQuantity,
      totalValue: layerValue,
      referenceId: layer.referenceId || undefined,
    });

    totalValue += layerValue;
    totalQuantity += remainingQuantity;
  }

  const averageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  return {
    tenantId,
    productId,
    productName: product.nameAr,
    currentStock: Number(product.stock),
    layers,
    totalValue,
    averageCost,
  };
}

// ============================================================================
// INVENTORY MOVEMENT REPORT
// ============================================================================

export interface InventoryMovement {
  date: Date;
  transactionType: string;
  quantity: number;
  referenceId?: string;
  productName?: string;
  productCode?: string;
}

export interface InventoryMovementReport {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  productId?: string;
  movements: InventoryMovement[];
  totalIn: number;
  totalOut: number;
  netChange: number;
}

/**
 * Generate Inventory Movement Report
 * Tracks all inventory transactions for a period
 */
export async function generateInventoryMovementReport(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  options: {
    productId?: string;
    transactionType?: string;
  } = {}
): Promise<InventoryMovementReport> {
  const where: any = {
    tenantId,
    date: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (options.productId) {
    where.productId = options.productId;
  }

  if (options.transactionType) {
    where.type = options.transactionType;
  }

  const transactions = await prisma.inventoryTransaction.findMany({
    where,
    include: {
      product: {
        select: {
          code: true,
          nameAr: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  const movements: InventoryMovement[] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (const tx of transactions) {
    const quantity = Number(tx.quantity);
    const movement: InventoryMovement = {
      date: tx.date,
      transactionType: tx.type,
      quantity,
      referenceId: tx.referenceId || undefined,
      productName: tx.product.nameAr,
      productCode: tx.product.code,
    };

    movements.push(movement);

    if (quantity > 0) {
      totalIn += quantity;
    } else {
      totalOut += Math.abs(quantity);
    }
  }

  const netChange = totalIn - totalOut;

  return {
    tenantId,
    startDate,
    endDate,
    productId: options.productId,
    movements,
    totalIn,
    totalOut,
    netChange,
  };
}

// ============================================================================
// STOCK TAKE REPORT
// ============================================================================

export interface StockTakeDiscrepancy {
  productId: string;
  productCode: string;
  productName: string;
  expectedStock: number;
  actualStock: number;
  difference: number;
  differenceValue: number;
}

export interface StockTakeReport {
  tenantId: string;
  stocktakeId: string;
  stocktakeDate: Date;
  totalDiscrepancies: number;
  totalValueDifference: number;
  discrepancies: StockTakeDiscrepancy[];
}

/**
 * Generate Stock Take Report
 * Compares expected vs actual stock from stocktake
 */
export async function generateStockTakeReport(
  tenantId: string,
  stocktakeId: string
): Promise<StockTakeReport> {
  // Get stocktake
  const stocktake = await prisma.stocktake.findFirst({
    where: {
      id: stocktakeId,
      tenantId,
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              code: true,
              nameAr: true,
              cost: true,
              stock: true,
            },
          },
        },
      },
    },
  });

  if (!stocktake) {
    throw new Error(`Stocktake ${stocktakeId} not found for tenant ${tenantId}`);
  }

  const discrepancies: StockTakeDiscrepancy[] = [];
  let totalValueDifference = 0;

  for (const item of stocktake.items) {
    const expectedStock = Number(item.product.stock);
    const actualStock = Number(item.physicalQuantity);
    const difference = actualStock - expectedStock;
    const differenceValue = difference * Number(item.product.cost);

    if (difference !== 0) {
      discrepancies.push({
        productId: item.productId,
        productCode: item.product.code,
        productName: item.product.nameAr,
        expectedStock,
        actualStock,
        difference,
        differenceValue,
      });

      totalValueDifference += differenceValue;
    }
  }

  return {
    tenantId,
    stocktakeId,
    stocktakeDate: stocktake.date,
    totalDiscrepancies: discrepancies.length,
    totalValueDifference,
    discrepancies,
  };
}
