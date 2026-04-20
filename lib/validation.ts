import { prisma } from './db';

export interface StockItem {
  productId: string;
  quantity: number;
}

export interface BOMItem {
  materialId: string;
  quantity: number;
}

/**
 * Validate stock availability before sales or production
 * Prevents selling more than available stock
 */
export async function validateStockAvailability(items: StockItem[]): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { stock: true, nameAr: true, code: true }
    });

    if (!product) {
      errors.push(`Product ${item.productId} not found`);
      continue;
    }

    if (product.stock < item.quantity) {
      errors.push(`Insufficient stock for product ${product.code} - ${product.nameAr}. Available: ${product.stock}, Required: ${item.quantity}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate raw material availability before production
 * Prevents production without enough raw materials
 */
export async function validateRawMaterialAvailability(bomItems: BOMItem[]): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const item of bomItems) {
    const material = await prisma.product.findUnique({
      where: { id: item.materialId },
      select: { stock: true, nameAr: true, code: true }
    });

    if (!material) {
      errors.push(`Raw material ${item.materialId} not found`);
      continue;
    }

    if (material.stock < item.quantity) {
      errors.push(`Insufficient raw material ${material.code} - ${material.nameAr}. Available: ${material.stock}, Required: ${item.quantity}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate payment amount doesn't exceed remaining balance
 * Prevents overpayment
 */
export async function validatePaymentAmount(invoiceId: string, invoiceType: 'sales' | 'purchase', paymentAmount: number): Promise<{ valid: boolean; error?: string }> {
  if (invoiceType === 'sales') {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      select: { total: true, paidAmount: true, invoiceNumber: true }
    });

    if (!invoice) {
      return { valid: false, error: 'Sales invoice not found' };
    }

    const remaining = invoice.total - invoice.paidAmount;
    if (paymentAmount > remaining) {
      return { 
        valid: false, 
        error: `Payment amount ${paymentAmount} exceeds remaining balance ${remaining} for invoice ${invoice.invoiceNumber}` 
      };
    }
  } else {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      select: { total: true, paidAmount: true, invoiceNumber: true }
    });

    if (!invoice) {
      return { valid: false, error: 'Purchase invoice not found' };
    }

    const remaining = invoice.total - invoice.paidAmount;
    if (paymentAmount > remaining) {
      return { 
        valid: false, 
        error: `Payment amount ${paymentAmount} exceeds remaining balance ${remaining} for invoice ${invoice.invoiceNumber}` 
      };
    }
  }

  return { valid: true };
}

/**
 * Prevent negative stock in all operations
 */
export async function preventNegativeStock(productId: string, quantityChange: number): Promise<{ valid: boolean; error?: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true, nameAr: true, code: true }
  });

  if (!product) {
    return { valid: false, error: `Product ${productId} not found` };
  }

  if (product.stock + quantityChange < 0) {
    return { 
      valid: false, 
      error: `Operation would result in negative stock for product ${product.code} - ${product.nameAr}. Current: ${product.stock}, Change: ${quantityChange}` 
    };
  }

  return { valid: true };
}

/**
 * Validate product type enum values
 */
export function validateProductType(type: string): boolean {
  const validTypes = ['raw_material', 'finished_product'];
  return validTypes.includes(type);
}

/**
 * Validate payment status enum values
 */
export function validatePaymentStatus(status: string): boolean {
  const validStatuses = ['cash', 'credit'];
  return validStatuses.includes(status);
}

/**
 * Validate production order status transitions
 */
export function validateProductionStatusTransition(currentStatus: string, newStatus: string): { valid: boolean; error?: string } {
  const validTransitions: Record<string, string[]> = {
    pending: ['approved', 'cancelled'],
    approved: ['waiting', 'cancelled'],
    waiting: ['completed', 'cancelled'],
    completed: [],
    cancelled: []
  };

  const allowedTransitions = validTransitions[currentStatus] || [];
  
  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`
    };
  }

  return { valid: true };
}
