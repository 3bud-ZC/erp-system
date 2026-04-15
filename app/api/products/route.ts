import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read products
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        unitRef: true,
        company: true,
        itemGroup: true,
        warehouse: true,
      },
    });
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

    // Whitelist allowed fields — prevent injection of unexpected Prisma fields
    const productData: any = {
      code: code.trim(),
      nameAr: nameAr.trim(),
      unit: body.unit?.toString()?.trim() || 'piece', // Required field with default
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

    const product = await prisma.product.create({
      data: productData,
    });

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

    const product = await prisma.product.update({
      where: { id },
      data,
    });

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

    // Check if product is used in any sales orders, purchase orders, invoices, stock movements, or production
    const [salesOrderItems, purchaseOrderItems, salesInvoiceItems, purchaseInvoiceItems, stockMovements, productionOrders] = await Promise.all([
      prisma.salesOrderItem.count({ where: { productId: id } }),
      prisma.purchaseOrderItem.count({ where: { productId: id } }),
      prisma.salesInvoiceItem.count({ where: { productId: id } }),
      prisma.purchaseInvoiceItem.count({ where: { productId: id } }),
      prisma.stockMovement.count({ where: { productId: id } }),
      prisma.productionOrder.count({ where: { productId: id } }),
    ]);

    const totalUsage = salesOrderItems + purchaseOrderItems + salesInvoiceItems + purchaseInvoiceItems + stockMovements + productionOrders;

    if (totalUsage > 0) {
      const lines = [];
      if (salesOrderItems > 0) lines.push(`- أوامر بيع: ${salesOrderItems}`);
      if (purchaseOrderItems > 0) lines.push(`- أوامر شراء: ${purchaseOrderItems}`);
      if (salesInvoiceItems > 0) lines.push(`- فواتير بيع: ${salesInvoiceItems}`);
      if (purchaseInvoiceItems > 0) lines.push(`- فواتير شراء: ${purchaseInvoiceItems}`);
      if (stockMovements > 0) lines.push(`- حركات مخزن: ${stockMovements}`);
      if (productionOrders > 0) lines.push(`- أوامر إنتاج: ${productionOrders}`);
      
      return apiError(
        `لا يمكن حذف المنتج لأنه مستخدم في ${totalUsage} سجل:\n${lines.join('\n')}\n\nيرجى حذف السجلات المرتبطة أولاً أو إلغاء تفعيل المنتج بدلاً من الحذف.`,
        409
      );
    }

    await prisma.product.delete({
      where: { id },
    });

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

    return apiSuccess({ id }, 'Product deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete product');
  }
}

