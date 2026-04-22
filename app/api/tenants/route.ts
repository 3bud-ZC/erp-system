import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get all tenants (admin only)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_system')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');

    const where: any = {};
    if (status) where.status = status;

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
            companies: true,
            customers: true,
            suppliers: true,
            products: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.tenant.count({ where });

    return apiSuccess({ tenants, total, page, limit }, 'Tenants fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch tenants');
  }
}

// POST - Create new tenant
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_system')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { tenantCode, name, nameAr, email, phone, address, subscriptionPlan, maxUsers, maxProducts, settings } = body;

    if (!tenantCode || !name) {
      return apiError('Tenant code and name are required', 400);
    }

    // Check if tenant code already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { tenantCode },
    });

    if (existingTenant) {
      return apiError('Tenant code already exists', 400);
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        tenantCode,
        name,
        nameAr,
        email,
        phone,
        address,
        subscriptionPlan: subscriptionPlan || 'trial',
        maxUsers: maxUsers || 5,
        maxProducts: maxProducts || 100,
        subscriptionExpiry: subscriptionPlan === 'trial' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        settings: settings || {},
      },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE_TENANT', 'system', 'Tenant', tenant.id,
      { tenantCode, name, subscriptionPlan },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(tenant, 'Tenant created successfully');
  } catch (error) {
    return handleApiError(error, 'Create tenant');
  }
}
