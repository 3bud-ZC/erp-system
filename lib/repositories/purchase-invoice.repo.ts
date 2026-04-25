/**
 * Purchase Invoice Repository (READ-ONLY)
 * Only the GET-handler queries are extracted. Mutations stay in the route
 * because they live inside $transaction blocks with stock + GL side-effects.
 */
import { prisma } from '@/lib/db';

export const purchaseInvoiceRepo = {
  listByTenant(tenantId: string) {
    return (prisma as any).purchaseInvoice.findMany({
      where: { tenantId },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  findByIdAndTenant(id: string, tenantId: string) {
    return (prisma as any).purchaseInvoice.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        items: { include: { product: true } },
        payments: { orderBy: { date: 'desc' } },
      },
    });
  },
};
