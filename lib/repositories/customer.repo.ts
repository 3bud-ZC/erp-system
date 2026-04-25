/**
 * Customer Repository
 * Pure Prisma data access for the Customer entity.
 * No business logic, no auth, no validation — those stay in the route/service.
 */
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export const customerRepo = {
  listByTenant(tenantId: string) {
    return prisma.customer.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findByIdAndTenant(id: string, tenantId: string) {
    return prisma.customer.findFirst({ where: { id, tenantId } });
  },

  create(data: Prisma.CustomerUncheckedCreateInput) {
    return prisma.customer.create({ data });
  },

  update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.customer.delete({ where: { id } });
  },

  countLinkedDocuments(id: string, tenantId: string) {
    return Promise.all([
      prisma.salesOrder.count({ where: { customerId: id, tenantId } }),
      prisma.salesInvoice.count({ where: { customerId: id, tenantId } }),
    ]).then(([orders, invoices]) => ({ orders, invoices, total: orders + invoices }));
  },
};
