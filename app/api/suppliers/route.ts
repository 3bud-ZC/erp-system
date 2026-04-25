import { supplierRepo } from '@/lib/repositories/supplier.repo';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read suppliers
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const suppliers = await supplierRepo.listByTenant(user.tenantId);
    return apiSuccess(suppliers, 'Suppliers fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch suppliers');
  }
}

// POST - Create supplier
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_supplier')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const body = await request.json();
    const { tenantId: _t, ...supplierData } = body;
    const supplier = await supplierRepo.create({
      code: supplierData.code,
      nameAr: supplierData.nameAr,
      ...(supplierData.nameEn && { nameEn: supplierData.nameEn }),
      ...(supplierData.phone && { phone: supplierData.phone }),
      ...(supplierData.email && { email: supplierData.email }),
      ...(supplierData.creditLimit != null && { creditLimit: Number(supplierData.creditLimit) }),
      ...(supplierData.address && { address: supplierData.address }),
      tenantId: user.tenantId,
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'purchases',
      'Supplier',
      supplier.id,
      { supplier },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(supplier, 'Supplier created successfully');
  } catch (error) {
    return handleApiError(error, 'Create supplier');
  }
}

// PUT - Update supplier
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_supplier')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const { id, ...data } = body;

    // SECURITY: Verify supplier belongs to user's tenant
    const existingSupplier = await supplierRepo.findByIdAndTenant(id, user.tenantId!);
    if (!existingSupplier) {
      return apiError('المورد غير موجود', 404);
    }

    const supplier = await supplierRepo.update(id, data);

    await logAuditAction(
      user.id,
      'UPDATE',
      'purchases',
      'Supplier',
      supplier.id,
      { data },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(supplier, 'Supplier updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update supplier');
  }
}

// DELETE - Delete supplier
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_supplier')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return handleApiError(new Error('ID is required'), 'Delete supplier');
    }

    // SECURITY: Verify supplier belongs to user's tenant
    const existingSupplier = await supplierRepo.findByIdAndTenant(id, user.tenantId!);
    if (!existingSupplier) {
      return apiError('المورد غير موجود', 404);
    }

    // SECURITY: Check linked records with tenant scope
    const linked = await supplierRepo.countLinkedDocuments(id, user.tenantId!);
    if (linked.total > 0) {
      return apiError('Cannot delete supplier with existing orders or invoices', 400);
    }

    await supplierRepo.delete(id);

    await logAuditAction(
      user.id,
      'DELETE',
      'purchases',
      'Supplier',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Supplier deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete supplier');
  }
}
