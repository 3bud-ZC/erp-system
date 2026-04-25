/**
 * Supplier Repository
 * Pure Prisma data access for the Supplier entity.
 */
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export const supplierRepo = {
  listByTenant(tenantId: string) {
    return prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findByIdAndTenant(id: string, tenantId: string) {
    return prisma.supplier.findFirst({ where: { id, tenantId } });
  },

  create(data: Prisma.SupplierUncheckedCreateInput) {
    return prisma.supplier.create({ data });
  },

  update(id: string, data: Prisma.SupplierUpdateInput) {
    return prisma.supplier.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.supplier.delete({ where: { id } });
  },

  countLinkedDocuments(id: string, tenantId: string) {
    return Promise.all([
      prisma.purchaseOrder.count({ where: { supplierId: id, tenantId } }),
      prisma.purchaseInvoice.count({ where: { supplierId: id, tenantId } }),
    ]).then(([orders, invoices]) => ({ orders, invoices, total: orders + invoices }));
  },
};
