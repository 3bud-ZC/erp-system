/**
 * Product Repository
 * Pure Prisma data access for the Product entity (and its inventory transactions).
 */
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export const productRepo = {
  listByTenant(tenantId: string, opts?: { type?: string }) {
    const where: Prisma.ProductWhereInput = { tenantId };
    if (opts?.type && opts.type !== 'all') (where as any).type = opts.type;
    return prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        unitRef: true,
        company: true,
        itemGroup: true,
        warehouse: true,
      },
    });
  },

  findById(id: string) {
    return prisma.product.findUnique({ where: { id } });
  },

  create(data: Prisma.ProductUncheckedCreateInput) {
    return prisma.product.create({ data });
  },

  update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },

  deleteInventoryTransactions(productId: string) {
    return prisma.inventoryTransaction.deleteMany({ where: { productId } });
  },

  /**
   * Aggregate usage of a product across all dependent tables.
   * Used to gate deletes — does NOT delete anything.
   */
  countUsage(productId: string) {
    return Promise.all([
      prisma.salesOrderItem.count({ where: { productId } }),
      prisma.purchaseOrderItem.count({ where: { productId } }),
      prisma.salesInvoiceItem.count({ where: { productId } }),
      prisma.purchaseInvoiceItem.count({ where: { productId } }),
      prisma.inventoryTransaction.count({ where: { productId } }),
      prisma.productionOrder.count({ where: { productId } }),
    ]).then(
      ([salesOrderItems, purchaseOrderItems, salesInvoiceItems, purchaseInvoiceItems, inventoryTransactions, productionOrders]) => ({
        salesOrderItems,
        purchaseOrderItems,
        salesInvoiceItems,
        purchaseInvoiceItems,
        inventoryTransactions,
        productionOrders,
        total:
          salesOrderItems +
          purchaseOrderItems +
          salesInvoiceItems +
          purchaseInvoiceItems +
          inventoryTransactions +
          productionOrders,
      })
    );
  },
};
