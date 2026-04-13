import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read journal entries (requires view_accounting permission)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'view_accounting')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
      const fromDate = searchParams.get('fromDate');
      const toDate = searchParams.get('toDate');
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
      const skip = (page - 1) * limit;

      const where: any = {};

      if (fromDate || toDate) {
        where.entryDate = {};
        if (fromDate) where.entryDate.gte = new Date(fromDate);
        if (toDate) where.entryDate.lte = new Date(toDate + 'T23:59:59.999Z');
      }

      const [data, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          include: {
            lines: {
              include: {
                account: true,
              },
            },
          },
          orderBy: { entryDate: 'desc' },
          skip,
          take: limit,
        }),
        prisma.journalEntry.count({ where }),
      ]);

      return apiSuccess({ data, total, page, limit });
    } catch (error) {
      return handleApiError(error, 'Fetch journal entries');
    }
  }
