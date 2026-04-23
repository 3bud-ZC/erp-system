import { apiSuccess, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, generateToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { seedDemoData } from '@/lib/seed-demo-data';

export const dynamic = 'force-dynamic';

const ALL_PERMISSIONS = [
  { code: 'view_dashboard',          nameAr: 'عرض لوحة التحكم',          module: 'dashboard',      action: 'read' },
  { code: 'view_products',           nameAr: 'عرض المنتجات',              module: 'inventory',      action: 'read' },
  { code: 'create_product',          nameAr: 'إضافة منتج',                module: 'inventory',      action: 'create' },
  { code: 'update_product',          nameAr: 'تعديل منتج',                module: 'inventory',      action: 'update' },
  { code: 'delete_product',          nameAr: 'حذف منتج',                  module: 'inventory',      action: 'delete' },
  { code: 'view_warehouses',         nameAr: 'عرض المستودعات',            module: 'inventory',      action: 'read' },
  { code: 'create_warehouse',        nameAr: 'إضافة مستودع',              module: 'inventory',      action: 'create' },
  { code: 'update_warehouse',        nameAr: 'تعديل مستودع',              module: 'inventory',      action: 'update' },
  { code: 'delete_warehouse',        nameAr: 'حذف مستودع',                module: 'inventory',      action: 'delete' },
  { code: 'view_customers',          nameAr: 'عرض العملاء',               module: 'sales',          action: 'read' },
  { code: 'create_customer',         nameAr: 'إضافة عميل',                module: 'sales',          action: 'create' },
  { code: 'update_customer',         nameAr: 'تعديل عميل',                module: 'sales',          action: 'update' },
  { code: 'delete_customer',         nameAr: 'حذف عميل',                  module: 'sales',          action: 'delete' },
  { code: 'view_sales',              nameAr: 'عرض المبيعات',              module: 'sales',          action: 'read' },
  { code: 'create_sales_invoice',    nameAr: 'إنشاء فاتورة مبيعات',      module: 'sales',          action: 'create' },
  { code: 'read_sales_invoice',      nameAr: 'قراءة فاتورة مبيعات',      module: 'sales',          action: 'read' },
  { code: 'update_sales_invoice',    nameAr: 'تعديل فاتورة مبيعات',      module: 'sales',          action: 'update' },
  { code: 'delete_sales_invoice',    nameAr: 'حذف فاتورة مبيعات',        module: 'sales',          action: 'delete' },
  { code: 'view_sales_reports',      nameAr: 'عرض تقارير المبيعات',      module: 'reports',        action: 'read' },
  { code: 'view_suppliers',          nameAr: 'عرض الموردين',              module: 'purchases',      action: 'read' },
  { code: 'create_supplier',         nameAr: 'إضافة مورد',                module: 'purchases',      action: 'create' },
  { code: 'update_supplier',         nameAr: 'تعديل مورد',                module: 'purchases',      action: 'update' },
  { code: 'delete_supplier',         nameAr: 'حذف مورد',                  module: 'purchases',      action: 'delete' },
  { code: 'view_purchases',          nameAr: 'عرض المشتريات',             module: 'purchases',      action: 'read' },
  { code: 'create_purchase_invoice', nameAr: 'إنشاء فاتورة مشتريات',     module: 'purchases',      action: 'create' },
  { code: 'read_purchase_invoice',   nameAr: 'قراءة فاتورة مشتريات',     module: 'purchases',      action: 'read' },
  { code: 'update_purchase_invoice', nameAr: 'تعديل فاتورة مشتريات',     module: 'purchases',      action: 'update' },
  { code: 'delete_purchase_invoice', nameAr: 'حذف فاتورة مشتريات',       module: 'purchases',      action: 'delete' },
  { code: 'view_manufacturing',      nameAr: 'عرض التصنيع',               module: 'manufacturing',  action: 'read' },
  { code: 'create_production_order', nameAr: 'إنشاء أمر إنتاج',          module: 'manufacturing',  action: 'create' },
  { code: 'read_production_order',   nameAr: 'قراءة أمر إنتاج',          module: 'manufacturing',  action: 'read' },
  { code: 'update_production_order', nameAr: 'تعديل أمر إنتاج',          module: 'manufacturing',  action: 'update' },
  { code: 'delete_production_order', nameAr: 'حذف أمر إنتاج',            module: 'manufacturing',  action: 'delete' },
  { code: 'view_accounting',         nameAr: 'عرض المحاسبة',              module: 'accounting',     action: 'read' },
  { code: 'manage_accounts',         nameAr: 'إدارة الحسابات',            module: 'accounting',     action: 'manage' },
  { code: 'view_reports',            nameAr: 'عرض التقارير',              module: 'reports',        action: 'read' },
  { code: 'view_financial_reports',  nameAr: 'عرض التقارير المالية',      module: 'reports',        action: 'read' },
];

export async function POST(req: Request) {
  try {
    // Auth: only need userId, NOT tenantId
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('يجب تسجيل الدخول أولاً', 401);

    // Prevent double-init
    const existing = await prisma.userTenantRole.findFirst({ where: { userId: user.id } });
    if (existing) {
      return apiError('تم إعداد المستأجر مسبقاً. قم بتسجيل الخروج وإعادة الدخول.', 409);
    }

    const body = await req.json().catch(() => ({}));
    const {
      companyName = 'شركتي',
      companyNameAr,
      currency = 'SAR',
      taxRate = 15,
      country = 'SA',
    } = body;

    if (!companyName?.trim()) return apiError('اسم الشركة مطلوب', 400);

    const slug = companyName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'co';
    const uniqueSuffix = Date.now().toString(36);
    const tenantCode = `${slug}-${uniqueSuffix}`;
    const companyCode = `CO-${uniqueSuffix.toUpperCase()}`;

    // 1. Create Tenant
    const tenant = await prisma.tenant.create({
      data: {
        tenantCode,
        name: companyName.trim(),
        nameAr: companyNameAr?.trim() || companyName.trim(),
        status: 'active',
        subscriptionPlan: 'trial',
        settings: {
          currency,
          currencySymbol: currency === 'SAR' ? 'ر.س' : currency,
          taxRate,
          fiscalYearStartMonth: 1,
          language: 'ar',
          dateFormat: 'DD/MM/YYYY',
          onboardingCompleted: true,
          country,
        },
      },
    });

    // 2. Create Company linked to tenant (suffix on nameAr ensures global uniqueness)
    const nameAr = (companyNameAr?.trim() || companyName.trim()) + '-' + uniqueSuffix;
    await prisma.company.create({
      data: {
        code: companyCode,
        nameAr,
        nameEn: companyName.trim(),
        tenantId: tenant.id,
      },
    });

    // 3. Get or create admin role
    let adminRole = await (prisma as any).role.findUnique({ where: { code: 'admin' } });
    if (!adminRole) {
      adminRole = await (prisma as any).role.create({
        data: {
          code: 'admin',
          nameAr: 'مدير النظام',
          nameEn: 'System Administrator',
          description: 'Full system access',
          isActive: true,
        },
      });
    }

    // 4. Upsert all permissions and link to admin role
    for (const p of ALL_PERMISSIONS) {
      const perm = await (prisma as any).permission.upsert({
        where: { code: p.code },
        update: {},
        create: {
          code: p.code,
          nameAr: p.nameAr,
          nameEn: p.code,
          module: p.module,
          action: p.action,
          isActive: true,
        },
      });
      await (prisma as any).rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      });
    }

    // 5. Link user to tenant with admin role
    await prisma.userTenantRole.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        roleId: adminRole.id,
      },
    });

    // 6. Also assign UserRole globally so permissions are visible in JWT
    await (prisma as any).userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id },
    });

    // 7. Issue new JWT with tenantId embedded
    const newToken = generateToken(user.id, tenant.id);

    // 8. Create new session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: newToken,
        tenantId: tenant.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // 9. Replace cookie
    const cookieStore = cookies();
    cookieStore.set('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // 10. Seed demo data (non-blocking — errors don't fail onboarding)
    let seedResult = null;
    try {
      seedResult = await seedDemoData(tenant.id);
    } catch (seedErr) {
      console.error('Demo seed failed (non-fatal):', seedErr);
    }

    return apiSuccess(
      { tenantId: tenant.id, tenantCode, companyName: companyName.trim(), seed: seedResult },
      'تم إعداد الشركة بنجاح'
    );
  } catch (e: any) {
    console.error('Onboarding init error:', e);
    return apiError(e.message || 'فشل إعداد الشركة', 500);
  }
}
