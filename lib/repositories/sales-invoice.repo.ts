/**
 * Sales Invoice Repository (READ-ONLY)
 * Only the GET-handler queries are extracted. Mutations stay in the route
 * because they live inside $transaction blocks with stock + GL side-effects.
 */
import { prisma } from '@/lib/db';

export const salesInvoiceRepo = {
  listByTenant(tenantId: string) {
    return (prisma as any).salesInvoice.findMany({
      where: { tenantId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  findByIdAndTenant(id: string, tenantId: string) {
    return (prisma as any).salesInvoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: { orderBy: { date: 'desc' } },
      },
    });
  },
};
