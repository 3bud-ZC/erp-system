/**
 * State Loader Service
 * Loads the current state of an entity before transaction execution
 */

import { prisma } from '@/lib/db';
import { ERPTransaction, ERPTransactionType } from '../types';

export class StateLoader {
  static async load(tx: ERPTransaction): Promise<any> {
    const { type, payload, context } = tx;
    const { tenantId } = context;

    switch (type) {
      case 'SALES_ORDER':
        return this.loadSalesOrderState(payload, tenantId);
      
      case 'SALES_INVOICE':
        return this.loadSalesInvoiceState(payload, tenantId);
      
      case 'SALES_RETURN':
        return this.loadSalesReturnState(payload, tenantId);
      
      case 'PURCHASE_ORDER':
        return this.loadPurchaseOrderState(payload, tenantId);
      
      case 'PURCHASE_INVOICE':
        return this.loadPurchaseInvoiceState(payload, tenantId);
      
      case 'PURCHASE_RETURN':
        return this.loadPurchaseReturnState(payload, tenantId);
      
      case 'PAYMENT':
        return this.loadPaymentState(payload, tenantId);
      
      case 'STOCK_TRANSFER':
        return this.loadStockTransferState(payload, tenantId);
      
      case 'STOCK_ADJUSTMENT':
        return this.loadStockAdjustmentState(payload, tenantId);
      
      case 'PRODUCTION_ORDER':
        return this.loadProductionOrderState(payload, tenantId);
      
      default:
        return null;
    }
  }

  private static async loadSalesOrderState(payload: any, tenantId: string) {
    const customer = payload.customerId ? await prisma.customer.findFirst({
      where: { id: payload.customerId, tenantId },
    }) : null;

    const products = payload.items ? await prisma.product.findMany({
      where: { 
        id: { in: payload.items.map((i: any) => i.productId) },
        tenantId 
      },
    }) : [];

    return { customer, products };
  }

  private static async loadSalesInvoiceState(payload: any, tenantId: string) {
    const salesOrder = payload.salesOrderId ? await prisma.salesOrder.findFirst({
      where: { id: payload.salesOrderId, tenantId },
      include: { items: { include: { product: true } } },
    }) : null;

    const customer = payload.customerId ? await prisma.customer.findFirst({
      where: { id: payload.customerId, tenantId },
    }) : null;

    return { salesOrder, customer };
  }

  private static async loadSalesReturnState(payload: any, tenantId: string) {
    const salesInvoice = payload.salesInvoiceId ? await prisma.salesInvoice.findFirst({
      where: { id: payload.salesInvoiceId, tenantId },
      include: { items: { include: { product: true } } },
    }) : null;

    return { salesInvoice };
  }

  private static async loadPurchaseOrderState(payload: any, tenantId: string) {
    const supplier = payload.supplierId ? await prisma.supplier.findFirst({
      where: { id: payload.supplierId, tenantId },
    }) : null;

    const products = payload.items ? await prisma.product.findMany({
      where: { 
        id: { in: payload.items.map((i: any) => i.productId) },
        tenantId 
      },
    }) : [];

    return { supplier, products };
  }

  private static async loadPurchaseInvoiceState(payload: any, tenantId: string) {
    const purchaseOrder = payload.purchaseOrderId ? await prisma.purchaseOrder.findFirst({
      where: { id: payload.purchaseOrderId, tenantId },
      include: { items: { include: { product: true } } },
    }) : null;

    const supplier = payload.supplierId ? await prisma.supplier.findFirst({
      where: { id: payload.supplierId, tenantId },
    }) : null;

    return { purchaseOrder, supplier };
  }

  private static async loadPurchaseReturnState(payload: any, tenantId: string) {
    const purchaseInvoice = payload.purchaseInvoiceId ? await prisma.purchaseInvoice.findFirst({
      where: { id: payload.purchaseInvoiceId, tenantId },
      include: { items: { include: { product: true } } },
    }) : null;

    return { purchaseInvoice };
  }

  private static async loadPaymentState(payload: any, tenantId: string) {
    let entity = null;
    
    if (payload.salesInvoiceId) {
      entity = await prisma.salesInvoice.findFirst({
        where: { id: payload.salesInvoiceId, tenantId },
      });
    } else if (payload.purchaseInvoiceId) {
      entity = await prisma.purchaseInvoice.findFirst({
        where: { id: payload.purchaseInvoiceId, tenantId },
      });
    }

    return { entity };
  }

  private static async loadStockTransferState(payload: any, tenantId: string) {
    const fromWarehouse = payload.fromWarehouseId ? await prisma.warehouse.findFirst({
      where: { id: payload.fromWarehouseId, tenantId },
    }) : null;

    const toWarehouse = payload.toWarehouseId ? await prisma.warehouse.findFirst({
      where: { id: payload.toWarehouseId, tenantId },
    }) : null;

    const products = payload.items ? await prisma.product.findMany({
      where: { 
        id: { in: payload.items.map((i: any) => i.productId) },
        tenantId 
      },
    }) : [];

    return { fromWarehouse, toWarehouse, products };
  }

  private static async loadStockAdjustmentState(payload: any, tenantId: string) {
    const warehouse = payload.warehouseId ? await prisma.warehouse.findFirst({
      where: { id: payload.warehouseId, tenantId },
    }) : null;

    const product = payload.productId ? await prisma.product.findFirst({
      where: { id: payload.productId, tenantId },
    }) : null;

    return { warehouse, product };
  }

  private static async loadProductionOrderState(payload: any, tenantId: string) {
    const product = payload.productId ? await prisma.product.findFirst({
      where: { id: payload.productId, tenantId },
    }) : null;

    return { product };
  }
}
