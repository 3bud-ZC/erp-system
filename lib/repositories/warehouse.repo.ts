/**
 * Warehouse Repository
 * Pure Prisma data access for the Warehouse entity.
 */
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export const warehouseRepo = {
  listByTenant(
    tenantId: string,
    opts?: { skip?: number; take?: number; search?: string; includeInactive?: boolean }
  ) {
    const where: Prisma.WarehouseWhereInput = opts?.search
      ? {
          tenantId,
          OR: [
            { nameAr: { contains: opts.search, mode: 'insensitive' } },
            { nameEn: { contains: opts.search, mode: 'insensitive' } },
            { code: { contains: opts.search, mode: 'insensitive' } },
          ],
        }
      : { tenantId };
    if (!opts?.includeInactive) where.isActive = true;
    return Promise.all([
      prisma.warehouse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts?.skip,
        take: opts?.take,
      }),
      prisma.warehouse.count({ where }),
    ]).then(([data, total]) => ({ data, total }));
  },

  findById(id: string) {
    return prisma.warehouse.findUnique({ where: { id } });
  },

  create(data: Prisma.WarehouseUncheckedCreateInput) {
    return prisma.warehouse.create({ data });
  },

  update(id: string, data: Prisma.WarehouseUpdateInput) {
    return prisma.warehouse.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.warehouse.delete({ where: { id } });
  },

  /** Soft delete — keeps the row for FK integrity, hides it from lists. */
  softDelete(id: string) {
    return prisma.warehouse.update({ where: { id }, data: { isActive: false } });
  },

  countAssignedProducts(id: string) {
    return prisma.product.count({ where: { warehouseId: id } });
  },
};
