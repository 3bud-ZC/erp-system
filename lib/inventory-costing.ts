/**
 * Inventory Costing Engine
 * 
 * Implements FIFO (First-In, First-Out) costing method for inventory valuation.
 * - Cost updates on every stock movement
 * - InventoryValuation auto-recalculates
 * - Sales COGS calculated per transaction
 */

import { prisma } from '@/lib/db';

// ==================== COSTING METHODS ====================

export enum CostingMethod {
  FIFO = 'FIFO',
  WAC = 'WAC', // Weighted Average Cost
}

// ==================== FIFO LAYER ====================

interface FIFOLayer {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  remainingQuantity: number;
  transactionDate: Date;
  referenceType?: string;
  referenceId?: string;
}

// ==================== COSTING ENGINE CLASS ====================

class InventoryCostingEngine {
  private costingMethod: CostingMethod = CostingMethod.FIFO;
  private tenantId?: string;

  /**
   * Set the costing method (FIFO or WAC)
   */
  setCostingMethod(method: CostingMethod): void {
    this.costingMethod = method;
  }

  /**
   * Get the current costing method
   */
  getCostingMethod(): CostingMethod {
    return this.costingMethod;
  }

  /**
   * Set the tenant ID for multi-tenant operations
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Record stock inflow (purchase, production, etc.)
   * Creates a new FIFO layer with the incoming cost
   */
  async recordStockInflow(
    productId: string,
    quantity: number,
    unitCost: number,
    referenceType?: string,
    referenceId?: string
  ): Promise<void> {
    if (this.costingMethod === CostingMethod.FIFO) {
      await this.recordFIFOInflow(productId, quantity, unitCost, referenceType, referenceId);
    } else {
      await this.recordWACInflow(productId, quantity, unitCost, referenceType, referenceId);
    }

    // Update inventory valuation
    await this.updateInventoryValuation(productId);
  }

  /**
   * Record stock outflow (sale, consumption, etc.)
   * Calculates COGS based on FIFO or WAC
   */
  async recordStockOutflow(
    productId: string,
    quantity: number,
    referenceType?: string,
    referenceId?: string
  ): Promise<number> {
    let cogs = 0;

    if (this.costingMethod === CostingMethod.FIFO) {
      cogs = await this.recordFIFOOutflow(productId, quantity, referenceType, referenceId);
    } else {
      cogs = await this.recordWACOutflow(productId, quantity, referenceType, referenceId);
    }

    // Update inventory valuation
    await this.updateInventoryValuation(productId);

    return cogs;
  }

  /**
   * Get current cost of goods for a product
   */
  async getCurrentCost(productId: string): Promise<number> {
    const valuation = await prisma.inventoryValuation.findUnique({
      where: { productId },
    });

    if (!valuation || valuation.totalQuantity === 0) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { cost: true },
      });
      return product?.cost || 0;
    }

    return valuation.averageCost;
  }

  /**
   * Get total inventory value for a product
   */
  async getInventoryValue(productId: string): Promise<number> {
    const valuation = await prisma.inventoryValuation.findUnique({
      where: { productId },
    });

    if (!valuation) {
      return 0;
    }

    return valuation.totalValue;
  }

  // ==================== FIFO IMPLEMENTATION ====================

  /**
   * Record FIFO inflow
   */
  private async recordFIFOInflow(
    productId: string,
    quantity: number,
    unitCost: number,
    referenceType?: string,
    referenceId?: string
  ): Promise<void> {
    // Create a new FIFO layer
    await prisma.fIFOLayer.create({
      data: {
        productId,
        quantity,
        unitCost,
        remainingQuantity: quantity,
        transactionDate: new Date(),
        referenceType,
        referenceId,
        tenantId: this.tenantId!,
      },
    });
  }

  /**
   * Record FIFO outflow and calculate COGS
   */
  private async recordFIFOOutflow(
    productId: string,
    quantity: number,
    referenceType?: string,
    referenceId?: string
  ): Promise<number> {
    let remainingToDeduct = quantity;
    let totalCOGS = 0;

    // Get FIFO layers ordered by date (oldest first)
    const layers = await prisma.fIFOLayer.findMany({
      where: {
        productId,
        remainingQuantity: { gt: 0 },
      },
      orderBy: { transactionDate: 'asc' },
    });

    for (const layer of layers) {
      if (remainingToDeduct <= 0) break;

      const deductQuantity = Math.min(remainingToDeduct, layer.remainingQuantity);
      totalCOGS += deductQuantity * layer.unitCost;

      // Update layer
      await prisma.fIFOLayer.update({
        where: { id: layer.id },
        data: {
          remainingQuantity: layer.remainingQuantity - deductQuantity,
        },
      });

      remainingToDeduct -= deductQuantity;
    }

    // Record COGS transaction
    if (totalCOGS > 0) {
      await prisma.cOGSTransaction.create({
        data: {
          productId,
          quantity,
          totalCost: totalCOGS,
          averageCost: totalCOGS / quantity,
          referenceType,
          referenceId,
          date: new Date(),
          tenantId: this.tenantId!,
        },
      });
    }

    return totalCOGS;
  }

  // ==================== WAC IMPLEMENTATION ====================

  /**
   * Record WAC inflow
   */
  private async recordWACInflow(
    productId: string,
    quantity: number,
    unitCost: number,
    referenceType?: string,
    referenceId?: string
  ): Promise<void> {
    const valuation = await prisma.inventoryValuation.findUnique({
      where: { productId },
    });

    let newAverageCost = unitCost;
    let newTotalQuantity = quantity;
    let newTotalValue = quantity * unitCost;

    if (valuation && valuation.totalQuantity > 0) {
      // Calculate new weighted average cost
      const existingValue = valuation.totalValue;
      const existingQuantity = valuation.totalQuantity;
      
      newTotalQuantity = existingQuantity + quantity;
      newTotalValue = existingValue + (quantity * unitCost);
      newAverageCost = newTotalValue / newTotalQuantity;
    }

    // Update inventory valuation
    await prisma.inventoryValuation.upsert({
      where: { productId },
      update: {
        totalQuantity: newTotalQuantity,
        totalValue: newTotalValue,
        averageCost: newAverageCost,
        lastUpdated: new Date(),
      },
      create: {
        productId,
        totalQuantity: newTotalQuantity,
        totalValue: newTotalValue,
        averageCost: newAverageCost,
        tenantId: this.tenantId!,
      },
    });

    // Record cost layer for tracking
    await prisma.costLayer.create({
      data: {
        productId,
        quantity,
        unitCost,
        referenceType,
        referenceId,
        date: new Date(),
        tenantId: this.tenantId!,
      },
    });
  }

  /**
   * Record WAC outflow and calculate COGS
   */
  private async recordWACOutflow(
    productId: string,
    quantity: number,
    referenceType?: string,
    referenceId?: string
  ): Promise<number> {
    const valuation = await prisma.inventoryValuation.findUnique({
      where: { productId },
    });

    if (!valuation || valuation.totalQuantity === 0) {
      // Fallback to product cost
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { cost: true },
      });
      const cogs = (product?.cost || 0) * quantity;
      
      await prisma.cOGSTransaction.create({
        data: {
          productId,
          quantity,
          totalCost: cogs,
          averageCost: product?.cost || 0,
          referenceType,
          referenceId,
          date: new Date(),
          tenantId: this.tenantId!,
        },
      });

      return cogs;
    }

    const cogs = valuation.averageCost * quantity;

    // Update inventory valuation
    await prisma.inventoryValuation.update({
      where: { productId },
      data: {
        totalQuantity: { decrement: quantity },
        totalValue: { decrement: cogs },
        lastUpdated: new Date(),
      },
    });

    // Record COGS transaction
    await prisma.cOGSTransaction.create({
      data: {
        productId,
        quantity,
        totalCost: cogs,
        averageCost: valuation.averageCost,
        referenceType,
        referenceId,
        date: new Date(),
        tenantId: this.tenantId!,
      },
    });

    return cogs;
  }

  // ==================== INVENTORY VALUATION ====================

  /**
   * Update inventory valuation for a product
   */
  private async updateInventoryValuation(productId: string): Promise<void> {
    if (this.costingMethod === CostingMethod.FIFO) {
      await this.updateFIFOValuation(productId);
    } else {
      await this.updateWACValuation(productId);
    }
  }

  /**
   * Update FIFO valuation
   */
  private async updateFIFOValuation(productId: string): Promise<void> {
    const layers = await prisma.fIFOLayer.findMany({
      where: {
        productId,
        remainingQuantity: { gt: 0 },
      },
    });

    let totalQuantity = 0;
    let totalValue = 0;

    for (const layer of layers) {
      totalQuantity += layer.remainingQuantity;
      totalValue += layer.remainingQuantity * layer.unitCost;
    }

    const averageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    await prisma.inventoryValuation.upsert({
      where: { productId },
      update: {
        totalQuantity,
        totalValue,
        averageCost,
        lastUpdated: new Date(),
      },
      create: {
        productId,
        totalQuantity,
        totalValue,
        averageCost,
        tenantId: this.tenantId!,
      },
    });
  }

  /**
   * Update WAC valuation (already done in inflow/outflow methods)
   */
  private async updateWACValuation(productId: string): Promise<void> {
    // WAC is updated in real-time during inflow/outflow
    // This method is a no-op for WAC
  }

  // ==================== REPORTING ====================

  /**
   * Get COGS for a date range
   */
  async getCOGSForPeriod(startDate: Date, endDate: Date): Promise<number> {
    const transactions = await prisma.cOGSTransaction.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return transactions.reduce((sum, t) => sum + t.totalCost, 0);
  }

  /**
   * Get COGS by product for a date range
   */
  async getCOGSByProduct(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    const transactions = await prisma.cOGSTransaction.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const cogsByProduct: Record<string, number> = {};

    for (const transaction of transactions) {
      cogsByProduct[transaction.productId] = 
        (cogsByProduct[transaction.productId] || 0) + transaction.totalCost;
    }

    return cogsByProduct;
  }

  /**
   * Get inventory valuation report
   */
  async getInventoryValuationReport(): Promise<any[]> {
    const valuations = await prisma.inventoryValuation.findMany({
      include: {
        product: {
          select: {
            code: true,
            nameAr: true,
            nameEn: true,
            stock: true,
          },
        },
      },
    });

    return valuations.map((v) => ({
      productId: v.productId,
      productCode: v.product.code,
      productName: v.product.nameAr || v.product.nameEn,
      stock: v.product.stock,
      valuationQuantity: v.totalQuantity,
      valuationValue: v.totalValue,
      averageCost: v.averageCost,
      variance: v.product.stock - v.totalQuantity,
    }));
  }
}

// ==================== EXPORT SINGLETON ====================

export const inventoryCostingEngine = new InventoryCostingEngine();

// ==================== HELPER FUNCTIONS ====================

/**
 * Record stock inflow with automatic costing
 */
export async function recordStockInflow(
  productId: string,
  quantity: number,
  unitCost: number,
  referenceType?: string,
  referenceId?: string
): Promise<void> {
  await inventoryCostingEngine.recordStockInflow(
    productId,
    quantity,
    unitCost,
    referenceType,
    referenceId
  );
}

/**
 * Record stock outflow with automatic COGS calculation
 */
export async function recordStockOutflow(
  productId: string,
  quantity: number,
  referenceType?: string,
  referenceId?: string
): Promise<number> {
  return inventoryCostingEngine.recordStockOutflow(
    productId,
    quantity,
    referenceType,
    referenceId
  );
}

/**
 * Get current cost for a product
 */
export async function getCurrentCost(productId: string): Promise<number> {
  return inventoryCostingEngine.getCurrentCost(productId);
}

/**
 * Get inventory value for a product
 */
export async function getInventoryValue(productId: string): Promise<number> {
  return inventoryCostingEngine.getInventoryValue(productId);
}
