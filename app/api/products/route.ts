import { productRepo } from '@/lib/repositories/product.repo';

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { validateProductType } from '@/lib/validation';
import { logActivity } from '@/lib/activity-log';

// GET - Read products (finished products only)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type') || undefined;
    const products = await productRepo.listByTenant(user.tenantId, { type: typeParam });
    return apiSuccess(products, 'Products fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch products');
  }
}

// POST - Create product (requires create_product permission)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_product')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();

    // Validate required fields and field types
    const { code, nameAr, nameEn, type, unitId, price, cost, stock, minStock, warehouseId, itemGroupId, companyId } = body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      return apiError('كود المنتج مطلوب', 400);
    }
    if (!nameAr || typeof nameAr !== 'string' || !nameAr.trim()) {
      return apiError('اسم المنتج بالعربية مطلوب', 400);
    }
    if (type && !validateProductType(type)) {
      return apiError('نوع المنتج يجب أن يكون raw_material أو finished_product', 400);
    }
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return apiError('السعر يجب أن يكون رقماً موجباً أو صفراً', 400);
    }
    if (cost !== undefined && (typeof cost !== 'number' || cost < 0)) {
      return apiError('التكلفة يجب أن تكون رقماً موجباً أو صفراً', 400);
    }
    if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
      return apiError('المخزون يجب أن يكون رقماً موجباً أو صفراً', 400);
    }
    if (minStock !== undefined && (typeof minStock !== 'number' || minStock < 0)) {
      return apiError('الحد الأدنى للمخزون يجب أن يكون رقماً موجباً أو صفراً', 400);
    }

    // Check tenantId exists
    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    // Whitelist allowed fields — prevent injection of unexpected Prisma fields
    const productData: any = {
      code: code.trim(),
      nameAr: nameAr.trim(),
      unit: body.unit?.toString()?.trim() || 'piece', // Required field with default
      tenantId: user.tenantId, // Direct tenantId assignment
      ...(nameEn && { nameEn: String(nameEn).trim() }),
      ...(type && { type: String(type) }),
      ...(price !== undefined && { price: Number(price) }),
      ...(cost !== undefined && { cost: Number(cost) }),
      ...(stock !== undefined && { stock: Number(stock) }),
      ...(minStock !== undefined && { minStock: Number(minStock) }),
      ...(unitId && { unitId: String(unitId) }),
      ...(warehouseId && { warehouseId: String(warehouseId) }),
      ...(itemGroupId && { itemGroupId: String(itemGroupId) }),
      ...(companyId && { companyId: String(companyId) }),
    };

    const product = await productRepo.create(productData);

    // Log audit action
    await logAuditAction(
      user.id,
      'CREATE',
      'inventory',
      'Product',
      product.id,
      { product },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    // Log activity for audit trail
    await logActivity({
      entity: 'Product',
      entityId: product.id,
      action: 'CREATE',
      userId: user.id,
      after: product,
    });

    return apiSuccess(product, 'Product created successfully');
  } catch (error) {
    return handleApiError(error, 'Create product');
  }
}

// PUT - Update product (requires update_product permission)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_product')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const { id, stock, ...data } = body;

    // SECURITY: Prevent direct stock manipulation via generic product endpoint
    // Stock must only be modified through inventory operations (invoices, adjustments, etc.)
    if (stock !== undefined) {
      return handleApiError(
        new Error('Cannot modify stock directly. Use inventory operations (invoices, adjustments).'),
        'Update product'
      );
    }

    // Fetch existing product for activity logging
    const existingProduct = await productRepo.findById(id);

    const product = await productRepo.update(id, data);

    // Log audit action
    await logAuditAction(
      user.id,
      'UPDATE',
      'inventory',
      'Product',
      product.id,
      { data },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    // Log activity for audit trail
    await logActivity({
      entity: 'Product',
      entityId: product.id,
      action: 'UPDATE',
      userId: user.id,
      before: existingProduct,
      after: product,
    });

    return apiSuccess(product, 'Product updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update product');
  }
}

// DELETE - Delete product (requires delete_product permission)
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_product')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return handleApiError(new Error('ID is required'), 'Delete product');
    }

    // Check if product is used in any sales orders, purchase orders, invoices, or production
    const usage = await productRepo.countUsage(id);
    const { salesOrderItems, purchaseOrderItems, salesInvoiceItems, purchaseInvoiceItems, inventoryTransactions, productionOrders } = usage;
    const totalUsage = usage.total;

    if (totalUsage > 0) {
      const lines = [];
      if (salesOrderItems > 0) lines.push(`- أوامر بيع: ${salesOrderItems}`);
      if (purchaseOrderItems > 0) lines.push(`- أوامر شراء: ${purchaseOrderItems}`);
      if (salesInvoiceItems > 0) lines.push(`- فواتير بيع: ${salesInvoiceItems}`);
      if (purchaseInvoiceItems > 0) lines.push(`- فواتير شراء: ${purchaseInvoiceItems}`);
      if (inventoryTransactions > 0) lines.push(`- حركات المخزون: ${inventoryTransactions}`);
      if (productionOrders > 0) lines.push(`- أوامر إنتاج: ${productionOrders}`);
      
      return apiError(
        `لا يمكن حذف المنتج لأنه مستخدم في ${totalUsage} سجل:\n${lines.join('\n')}\n\nيرجى حذف السجلات المرتبطة أولاً أو إلغاء تفعيل المنتج بدلاً من الحذف.`,
        409
      );
    }

    // Fetch existing product for activity logging
    const existingProduct = await productRepo.findById(id);

    // Delete inventory transactions first (these are history records)
    if (inventoryTransactions > 0) {
      await productRepo.deleteInventoryTransactions(id);
    }

    await productRepo.delete(id);

    // Log audit action
    await logAuditAction(
      user.id,
      'DELETE',
      'inventory',
      'Product',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    // Log activity for audit trail
    await logActivity({
      entity: 'Product',
      entityId: id,
      action: 'DELETE',
      userId: user.id,
      before: existingProduct,
    });

    return apiSuccess({ id }, 'Product deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete product');
  }
}

