/**
 * Transaction Validator
 * Validates all ERP transactions before execution
 */

import { ERPTransaction } from '../types';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/structured-logger';

export class TransactionValidator {
  static async validate(tx: ERPTransaction): Promise<void> {
    // Basic validation
    if (!tx.type) {
      throw new Error('Missing transaction type');
    }
    if (!tx.payload) {
      throw new Error('Missing payload');
    }
    if (!tx.context?.tenantId) {
      throw new Error('Tenant required');
    }

    // Type-specific validation
    switch (tx.type) {
      case 'SALES_INVOICE':
        await this.validateSalesInvoice(tx);
        break;
      
      case 'SALES_ORDER':
        await this.validateSalesOrder(tx);
        break;
      
      case 'PURCHASE_INVOICE':
        await this.validatePurchaseInvoice(tx);
        break;
      
      case 'PURCHASE_ORDER':
        await this.validatePurchaseOrder(tx);
        break;
      
      case 'PAYMENT':
        await this.validatePayment(tx);
        break;
      
      case 'STOCK_TRANSFER':
        await this.validateStockTransfer(tx);
        break;
      
      case 'STOCK_ADJUSTMENT':
        await this.validateStockAdjustment(tx);
        break;
    }

    // Validate accounting period is open
    await this.validateAccountingPeriod(tx);
  }

  private static async validateSalesInvoice(tx: ERPTransaction): Promise<void> {
    const { payload, context } = tx;

    // Validate stock availability
    if (payload.items && payload.items.length > 0) {
      for (const item of payload.items) {
        const product = await prisma.product.findFirst({
          where: { 
            id: item.productId,
          },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for product ${product.nameAr || product.nameEn}. ` +
            `Available: ${product.stock}, Required: ${item.quantity}`
          );
        }
      }
    }

    // Validate customer exists
    if (payload.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: payload.customerId },
      });

      if (!customer) {
        throw new Error(`Customer not found: ${payload.customerId}`);
      }
    }
  }

  private static async validateSalesOrder(tx: ERPTransaction): Promise<void> {
    const { payload, context } = tx;

    // Validate customer credit limit
    if (payload.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: payload.customerId },
      });

      if (!customer) {
        throw new Error(`Customer not found: ${payload.customerId}`);
      }

      // Check credit limit
      const creditLimit = customer.creditLimit || 0;
      const orderTotal = payload.total || payload.items?.reduce((sum: number, item: any) => 
        sum + (item.total || 0), 0) || 0;

      if (creditLimit > 0 && orderTotal > creditLimit) {
        throw new Error(
          `Credit limit exceeded for customer ${customer.nameAr || customer.nameEn}. ` +
          `Order: ${orderTotal}, Limit: ${creditLimit}`
        );
      }
    }
  }

  private static async validatePurchaseInvoice(tx: ERPTransaction): Promise<void> {
    const { payload, context } = tx;

    // Validate supplier exists
    if (payload.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: payload.supplierId },
      });

      if (!supplier) {
        throw new Error(`Supplier not found: ${payload.supplierId}`);
      }
    }
  }

  private static async validatePurchaseOrder(tx: ERPTransaction): Promise<void> {
    const { payload, context } = tx;

    // Validate supplier exists
    if (payload.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: payload.supplierId },
      });

      if (!supplier) {
        throw new Error(`Supplier not found: ${payload.supplierId}`);
      }
    }
  }

  private static async validatePayment(tx: ERPTransaction): Promise<void> {
    const { payload, context } = tx;

    // Validate related entity exists
    if (!payload.salesInvoiceId && !payload.purchaseInvoiceId) {
      throw new Error('Payment must be linked to an invoice');
    }

    if (payload.salesInvoiceId) {
      const invoice = await prisma.salesInvoice.findFirst({
        where: { id: payload.salesInvoiceId },
      });

      if (!invoice) {
        throw new Error(`Sales invoice not found: ${payload.salesInvoiceId}`);
      }
    }

    if (payload.purchaseInvoiceId) {
      const invoice = await prisma.purchaseInvoice.findFirst({
        where: { id: payload.purchaseInvoiceId },
      });

      if (!invoice) {
        throw new Error(`Purchase invoice not found: ${payload.purchaseInvoiceId}`);
      }
    }

    // Validate payment amount
    if (!payload.amount || payload.amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
  }

  private static async validateStockTransfer(tx: ERPTransaction): Promise<void> {
    const { payload, context } = tx;

    // Validate warehouses are different
    if (payload.fromWarehouseId === payload.toWarehouseId) {
      throw new Error('Source and destination warehouses must be different');
    }

    // Validate stock availability in source warehouse
    if (payload.items && payload.items.length > 0) {
      for (const item of payload.items) {
        const product = await prisma.product.findFirst({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for product ${product.nameAr || product.nameEn}. ` +
            `Available: ${product.stock}, Required: ${item.quantity}`
          );
        }
      }
    }
  }

  private static async validateStockAdjustment(tx: ERPTransaction): Promise<void> {
    const { payload, context } = tx;

    // Validate warehouse exists
    if (payload.warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: payload.warehouseId },
      });

      if (!warehouse) {
        throw new Error(`Warehouse not found: ${payload.warehouseId}`);
      }
    }

    // Validate product exists
    if (payload.productId) {
      const product = await prisma.product.findFirst({
        where: { id: payload.productId },
      });

      if (!product) {
        throw new Error(`Product not found: ${payload.productId}`);
      }
    }
  }

  private static async validateAccountingPeriod(tx: ERPTransaction): Promise<void> {
    const { context } = tx;

    // Check if there's an open accounting period
    const openPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        status: 'open',
      },
    });

    if (!openPeriod) {
      throw new Error('No open accounting period found. Transaction cannot be processed.');
    }
  }
}
