import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get expiry alerts
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const daysThreshold = searchParams.get('daysThreshold') || '30';
    const status = searchParams.get('status'); // expiring_soon, expired, all
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const threshold = parseInt(daysThreshold);
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + threshold);

    const where: any = {
      expiryDate: {
        not: null,
      },
    };

    if (productId) where.productId = productId;

    if (status === 'expiring_soon') {
      where.expiryDate = {
        gte: now,
        lte: thresholdDate,
      };
      where.status = 'active';
    } else if (status === 'expired') {
      where.expiryDate = {
        lt: now,
      };
    } else if (status === 'all' || !status) {
      // Get all batches with expiry dates
      where.expiryDate = {
        not: null,
      };
    }

    const [data, total] = await Promise.all([
      (prisma as any).batch.findMany({
        where,
        include: {
          product: true,
        },
        orderBy: { expiryDate: 'asc' },
        skip,
        take: limit,
      }),
      (prisma as any).batch.count({ where }),
    ]);

    // Calculate days until expiry for each batch
    const alerts = data.map((batch: any) => {
      const daysUntilExpiry = batch.expiryDate
        ? Math.ceil((new Date(batch.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
      const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= threshold;

      return {
        ...batch,
        daysUntilExpiry,
        isExpired,
        isExpiringSoon,
        urgency: isExpired ? 'expired' : (isExpiringSoon ? 'critical' : 'normal'),
      };
    });

    // Sort by urgency (expired first, then expiring soon, then normal)
    alerts.sort((a: any, b: any) => {
      const urgencyOrder: any = { expired: 0, critical: 1, normal: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    return apiSuccess(
      { alerts, total, page, limit, threshold },
      'Expiry alerts fetched successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Fetch expiry alerts');
  }
}

// POST - Mark expired batches
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { batchIds, autoMarkAll } = body;

    let batchesToUpdate: string[] = [];

    if (autoMarkAll) {
      // Find all expired batches that are still marked as active
      const expiredBatches = await (prisma as any).batch.findMany({
        where: {
          expiryDate: {
            lt: new Date(),
          },
          status: 'active',
        },
        select: { id: true },
      });
      batchesToUpdate = expiredBatches.map((b: any) => b.id);
    } else if (batchIds && Array.isArray(batchIds)) {
      batchesToUpdate = batchIds;
    } else {
      return apiError('Either batchIds or autoMarkAll is required', 400);
    }

    if (batchesToUpdate.length === 0) {
      return apiSuccess({ updated: 0, message: 'No batches to update' }, 'No expired batches marked');
    }

    // Update batches to expired status
    const updated = await (prisma as any).batch.updateMany({
      where: {
        id: { in: batchesToUpdate },
        status: 'active',
      },
      data: {
        status: 'expired',
      },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'MARK_EXPIRED', 'inventory', 'Batch', '',
      { count: updated.count, autoMarkAll },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(
      { updated: updated.count, batchIds: batchesToUpdate },
      'Batches marked as expired successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Mark expired batches');
  }
}
