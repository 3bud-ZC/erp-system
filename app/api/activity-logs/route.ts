import { apiSuccess, handleApiError } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SEVERITY_MAP: Record<string, 'info' | 'warn' | 'critical'> = {
  CREATE: 'info',
  UPDATE: 'info',
  READ: 'info',
  LOGIN: 'info',
  LOGOUT: 'info',
  DELETE: 'warn',
  PERMISSION_CHANGE: 'warn',
  PASSWORD_RESET: 'warn',
  FAILED_LOGIN: 'critical',
  SECURITY_VIOLATION: 'critical',
};

function severityFor(action: string): 'info' | 'warn' | 'critical' {
  return SEVERITY_MAP[action?.toUpperCase()] || 'info';
}

export async function GET(req: Request) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') || '25'));
    const entity = url.searchParams.get('entity') || undefined;
    const entityId = url.searchParams.get('entityId') || undefined;
    const action = url.searchParams.get('action') || undefined;
    const performedBy = url.searchParams.get('performedBy') || undefined;
    const severity = url.searchParams.get('severity') as 'info' | 'warn' | 'critical' | null;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const sort = (url.searchParams.get('sort') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where: any = {};
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (performedBy) where.performedBy = performedBy;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (severity) {
      const actions = Object.entries(SEVERITY_MAP).filter(([, s]) => s === severity).map(([a]) => a);
      where.action = { in: actions };
    }

    const [rows, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: sort as any },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activityLog.count({ where }),
    ]);

    const items = rows.map(r => ({ ...r, severity: severityFor(r.action) }));

    return apiSuccess({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), sort },
    });
  } catch (e) { return handleApiError(e, 'Activity logs'); }
}
