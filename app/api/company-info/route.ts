/**
 * GET /api/company-info
 *
 * Returns the current user's tenant company-branding info — name, address,
 * phone, email, taxId — for the invoice print template (and any other
 * "show our company at the top of the document" use case).
 *
 * Read-only and tenant-scoped. No special permission required: any
 * authenticated user belonging to the tenant can read its own company info.
 */
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user)            return apiError('لم يتم المصادقة', 401);
    if (!user.tenantId)   return apiError('لم يتم تعيين مستأجر للمستخدم', 400);

    const tenant = await prisma.tenant.findUnique({
      where:  { id: user.tenantId },
      select: {
        name:    true,
        nameAr:  true,
        email:   true,
        phone:   true,
        address: true,
        settings: true,
      },
    });

    if (!tenant) return apiError('Tenant not found', 404);

    // taxId may live inside the JSON `settings` blob (set during onboarding).
    const settings = (tenant.settings as { taxId?: string | null } | null) ?? {};

    return apiSuccess({
      // Prefer Arabic name on invoices; fall back to English/legal name.
      companyName:    tenant.nameAr || tenant.name || '',
      companyNameEn:  tenant.name   || '',
      companyAddress: tenant.address ?? null,
      companyPhone:   tenant.phone   ?? null,
      companyEmail:   tenant.email   ?? null,
      taxId:          settings.taxId ?? null,
    }, 'Company info fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch company info');
  }
}
