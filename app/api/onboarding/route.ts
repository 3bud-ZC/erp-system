import { apiSuccess, apiError, handleApiError } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { seedChartOfAccounts } from '@/lib/chart-of-accounts';
import { getTenantSettings, updateTenantSettings, isOnboardingComplete } from '@/lib/tenant-config';

export const dynamic = 'force-dynamic';

async function getUserTenant(userId: string) {
  const utr = await prisma.userTenantRole.findFirst({ where: { userId }, select: { tenantId: true } });
  return utr?.tenantId || null;
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const tenantId = await getUserTenant(user.id);
    if (!tenantId) return apiError('لا يوجد مستأجر مرتبط', 404);
    const settings = await getTenantSettings(tenantId);
    const completed = await isOnboardingComplete(tenantId);
    const accountsCount = await prisma.account.count();
    return apiSuccess({ tenantId, settings, completed, accountsCount });
  } catch (e) { return handleApiError(e, 'Onboarding status'); }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const tenantId = await getUserTenant(user.id);
    if (!tenantId) return apiError('لا يوجد مستأجر مرتبط', 404);

    const body = await req.json();
    const {
      companyName, companyNameAr, email, phone, address,
      currency, currencySymbol, taxRate, fiscalYearStartMonth, language,
      initializeCoA = true,
    } = body;

    if (!companyName) return apiError('اسم الشركة مطلوب', 400);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: companyName,
        nameAr: companyNameAr,
        email, phone, address,
      },
    });

    let accountsCreated = 0;
    if (initializeCoA) accountsCreated = await seedChartOfAccounts();

    const settings = await updateTenantSettings(tenantId, {
      currency, currencySymbol, taxRate, fiscalYearStartMonth, language,
      onboardingCompleted: true,
    });

    return apiSuccess({ settings, accountsCreated }, 'تم إكمال الإعداد بنجاح');
  } catch (e) { return handleApiError(e, 'Onboarding submit'); }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req);
    const tenantId = await getUserTenant(user.id);
    if (!tenantId) return apiError('لا يوجد مستأجر مرتبط', 404);
    const patch = await req.json();
    const settings = await updateTenantSettings(tenantId, patch);
    return apiSuccess({ settings });
  } catch (e) { return handleApiError(e, 'Update settings'); }
}
