/**
 * Business Router
 * Routes transactions to appropriate workflow handlers
 */

import { ERPTransaction, ERPTransactionType } from '../types';
import { prisma } from '@/lib/db';

// Workflow handlers
class SalesWorkflow {
  static async handleOrder(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    // Create sales order in database
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: payload.orderNumber || `SO-${Date.now()}`,
        customerId: payload.customerId,
        date: payload.date ? new Date(payload.date) : new Date(),
        status: payload.status || 'pending',
        total: payload.total || 0,
        notes: payload.notes,
        tenantId: context.tenantId,
        items: {
          create: payload.items?.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })) || [],
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return order;
  }

  static async handleInvoice(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    // Calculate totals
    const items = payload.items || [];
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    const tax = payload.tax || subtotal * 0.15; // 15% VAT or use provided tax
    const total = payload.total || (subtotal + tax);
    const discount = payload.discount || 0;
    const grandTotal = total - discount;

    // Create sales invoice in database
    const invoice = await prisma.salesInvoice.create({
      data: {
        invoiceNumber: payload.invoiceNumber || `INV-${Date.now()}`,
        customerId: payload.customerId,
        date: payload.date ? new Date(payload.date) : new Date(),
        status: payload.status || 'posted',
        paymentStatus: payload.paymentStatus || 'cash',
        paidAmount: payload.paidAmount || 0,
        tax,
        total,
        discount,
        grandTotal,
        salesOrderId: payload.salesOrderId,
        notes: payload.notes,
        tenantId: context.tenantId,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })) || [],
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return invoice;
  }

  static async handleReturn(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    const returnOrder = await prisma.salesReturn.create({
      data: {
        returnNumber: payload.returnNumber || `RET-${Date.now()}`,
        customerId: payload.customerId,
        date: payload.date ? new Date(payload.date) : new Date(),
        reason: payload.reason || 'Customer return',
        status: payload.status || 'posted',
        total: payload.total || 0,
        notes: payload.notes,
        tenantId: context.tenantId,
        items: {
          create: payload.items?.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })) || [],
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return returnOrder;
  }
}

class PurchaseWorkflow {
  static async handleOrder(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber: payload.orderNumber || `PO-${Date.now()}`,
        supplierId: payload.supplierId,
        date: payload.date ? new Date(payload.date) : new Date(),
        status: payload.status || 'pending',
        total: payload.total || 0,
        notes: payload.notes,
        requisitionId: payload.requisitionId,
        tenantId: context.tenantId,
        items: {
          create: payload.items?.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })) || [],
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return order;
  }

  static async handleInvoice(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    const items = payload.items || [];
    const total = items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);

    const invoice = await prisma.purchaseInvoice.create({
      data: {
        invoiceNumber: payload.invoiceNumber || `PI-${Date.now()}`,
        supplierId: payload.supplierId,
        date: payload.date ? new Date(payload.date) : new Date(),
        status: payload.status || 'posted',
        paymentStatus: payload.paymentStatus || 'cash',
        paidAmount: payload.paidAmount || 0,
        total,
        notes: payload.notes,
        tenantId: context.tenantId,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })) || [],
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return invoice;
  }

  static async handleReturn(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    const returnOrder = await prisma.purchaseReturn.create({
      data: {
        returnNumber: payload.returnNumber || `PR-${Date.now()}`,
        supplierId: payload.supplierId,
        purchaseInvoiceId: payload.purchaseInvoiceId,
        date: payload.date ? new Date(payload.date) : new Date(),
        reason: payload.reason,
        status: payload.status || 'posted',
        total: payload.total || 0,
        notes: payload.notes,
        tenantId: context.tenantId,
        items: {
          create: payload.items?.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })) || [],
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return returnOrder;
  }
}

class PaymentWorkflow {
  static async handle(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    const payment = await prisma.payment.create({
      data: {
        amount: payload.amount,
        date: payload.date ? new Date(payload.date) : new Date(),
        type: payload.type || (payload.salesInvoiceId ? 'incoming' : 'outgoing'),
        salesInvoiceId: payload.salesInvoiceId,
        purchaseInvoiceId: payload.purchaseInvoiceId,
        customerId: payload.customerId,
        supplierId: payload.supplierId,
        notes: payload.notes,
        tenantId: context.tenantId,
      },
      include: {
        customer: true,
        supplier: true,
        salesInvoice: true,
        purchaseInvoice: true,
      },
    });

    return payment;
  }
}

class InventoryWorkflow {
  static async transfer(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    const transfer = await prisma.stockTransfer.create({
      data: {
        transferNumber: payload.transferNumber || `ST-${Date.now()}`,
        productId: payload.productId,
        fromWarehouseId: payload.fromWarehouseId,
        toWarehouseId: payload.toWarehouseId,
        quantity: payload.quantity,
        date: payload.date ? new Date(payload.date) : new Date(),
        status: payload.status || 'pending',
        notes: payload.notes,
        tenantId: context.tenantId,
      },
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
    });

    return transfer;
  }

  static async adjust(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    const adjustment = await prisma.stockAdjustment.create({
      data: {
        adjustmentNumber: payload.adjustmentNumber || `SA-${Date.now()}`,
        productId: payload.productId,
        type: payload.type || payload.adjustmentType,
        quantity: payload.quantity,
        reason: payload.reason,
        status: payload.status || 'pending',
        journalEntryId: payload.journalEntryId,
        date: payload.date ? new Date(payload.date) : new Date(),
        notes: payload.notes,
        tenantId: context.tenantId,
      },
      include: {
        product: true,
      },
    });

    return adjustment;
  }
}

class ProductionWorkflow {
  static async handleOrder(tx: ERPTransaction, state: any): Promise<any> {
    const { payload, context } = tx;
    
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber: payload.orderNumber || `PROD-${Date.now()}`,
        productId: payload.productId,
        quantity: payload.quantity,
        plannedQuantity: payload.plannedQuantity || payload.quantity,
        actualOutputQuantity: payload.actualOutputQuantity || 0,
        produced: payload.produced || 0,
        remaining: payload.remaining || payload.quantity,
        cost: payload.cost || 0,
        status: payload.status || 'pending',
        date: payload.date ? new Date(payload.date) : new Date(),
        notes: payload.notes,
        productionLineId: payload.productionLineId,
        tenantId: context.tenantId,
      },
      include: {
        product: true,
        productionLine: true,
      },
    });

    return order;
  }
}

export class BusinessRouter {
  static async route(tx: ERPTransaction, state: any): Promise<any> {
    const { type } = tx;

    switch (type) {
      case 'SALES_ORDER':
        return SalesWorkflow.handleOrder(tx, state);

      case 'SALES_INVOICE':
        return SalesWorkflow.handleInvoice(tx, state);

      case 'SALES_RETURN':
        return SalesWorkflow.handleReturn(tx, state);

      case 'PURCHASE_ORDER':
        return PurchaseWorkflow.handleOrder(tx, state);

      case 'PURCHASE_INVOICE':
        return PurchaseWorkflow.handleInvoice(tx, state);

      case 'PURCHASE_RETURN':
        return PurchaseWorkflow.handleReturn(tx, state);

      case 'PAYMENT':
        return PaymentWorkflow.handle(tx, state);

      case 'STOCK_TRANSFER':
        return InventoryWorkflow.transfer(tx, state);

      case 'STOCK_ADJUSTMENT':
        return InventoryWorkflow.adjust(tx, state);

      case 'PRODUCTION_ORDER':
        return ProductionWorkflow.handleOrder(tx, state);

      default:
        throw new Error(`Unsupported transaction type: ${type}`);
    }
  }
}
