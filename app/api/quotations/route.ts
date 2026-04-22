import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Read quotations
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_sales')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).quotation.findMany({
        where,
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
          convertedToOrder: true,
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).quotation.count({ where }),
    ]);

    return apiSuccess({ quotations: data, total, page, limit }, 'Quotations fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch quotations');
  }
}

// POST - Create quotation
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_sales')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { customerId, date, validUntil, notes, items } = body;

    if (!customerId || !date || !validUntil) {
      return apiError('Customer ID, date, and valid until are required', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiError('At least one item is required', 400);
    }

    // Validate customer
    const customer = await (prisma as any).customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return apiError('Customer not found', 404);
    }

    // Generate quotation number
    const lastQuotation = await (prisma as any).quotation.findFirst({
      orderBy: { quotationNumber: 'desc' },
    });
    const nextNumber = lastQuotation ? parseInt(lastQuotation.quotationNumber.slice(4)) + 1 : 1;
    const quotationNumber = `QT-${String(nextNumber).padStart(6, '0')}`;

    // Calculate totals
    let total = 0;
    let discount = 0;
    let tax = 0;

    const validatedItems = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return apiError(`Product ${item.productId} not found`, 404);
      }

      const itemTotal = item.quantity * item.price;
      const itemDiscount = itemTotal * (item.discount || 0) / 100;
      const itemSubtotal = itemTotal - itemDiscount;

      total += itemSubtotal;
      discount += itemDiscount;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        total: itemSubtotal,
      });
    }

    // Calculate tax (assuming 15% VAT - should be configurable)
    tax = total * 0.15;
    const grandTotal = total + tax;

    const quotation = await (prisma as any).quotation.create({
      data: {
        quotationNumber,
        customerId,
        date: new Date(date),
        validUntil: new Date(validUntil),
        notes,
        total,
        discount,
        tax,
        grandTotal,
        items: {
          create: validatedItems,
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return apiSuccess(quotation, 'Quotation created successfully');
  } catch (error) {
    return handleApiError(error, 'Create quotation');
  }
}

// PUT - Update quotation
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'update_sales')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, customerId, date, validUntil, notes, status, items } = body;

    if (!id) {
      return apiError('Quotation ID is required', 400);
    }

    // Check if quotation exists
    const existingQuotation = await (prisma as any).quotation.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingQuotation) {
      return apiError('Quotation not found', 404);
    }

    // Prevent updates if already converted
    if (existingQuotation.status === 'converted') {
      return apiError('Cannot update a converted quotation', 400);
    }

    // Recalculate totals if items are provided
    let total = existingQuotation.total;
    let discount = existingQuotation.discount;
    let tax = existingQuotation.tax;
    let grandTotal = existingQuotation.grandTotal;

    if (items && Array.isArray(items)) {
      total = 0;
      discount = 0;

      // Delete existing items
      await (prisma as any).quotationItem.deleteMany({
        where: { quotationId: id },
      });

      // Create new items
      const validatedItems = [];
      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          return apiError(`Product ${item.productId} not found`, 404);
        }

        const itemTotal = item.quantity * item.price;
        const itemDiscount = itemTotal * (item.discount || 0) / 100;
        const itemSubtotal = itemTotal - itemDiscount;

        total += itemSubtotal;
        discount += itemDiscount;

        validatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount || 0,
          total: itemSubtotal,
        });
      }

      tax = total * 0.15;
      grandTotal = total + tax;

      const updatedQuotation = await (prisma as any).quotation.update({
        where: { id },
        data: {
          customerId,
          date: date ? new Date(date) : undefined,
          validUntil: validUntil ? new Date(validUntil) : undefined,
          notes,
          status,
          total,
          discount,
          tax,
          grandTotal,
          items: {
            create: validatedItems,
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Trigger workflow transition if status changed
      if (status && status !== existingQuotation.status) {
        await transitionEntity('Quotation', id, status, user.id, { grandTotal });
      }

      await logAuditAction(
        user.id, 'UPDATE', 'sales', 'Quotation', id, { body },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(updatedQuotation, 'Quotation updated successfully');
    } else {
      const updatedQuotation = await (prisma as any).quotation.update({
        where: { id },
        data: {
          customerId,
          date: date ? new Date(date) : undefined,
          validUntil: validUntil ? new Date(validUntil) : undefined,
          notes,
          status,
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Trigger workflow transition if status changed
      if (status && status !== existingQuotation.status) {
        await transitionEntity('Quotation', id, status, user.id, { grandTotal });
      }

      await logAuditAction(
        user.id, 'UPDATE', 'sales', 'Quotation', id, { body },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(updatedQuotation, 'Quotation updated successfully');
    }
  } catch (error) {
    return handleApiError(error, 'Update quotation');
  }
}

// DELETE - Delete quotation
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'delete_sales')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Quotation ID is required', 400);
    }

    // Check if quotation exists
    const quotation = await (prisma as any).quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      return apiError('Quotation not found', 404);
    }

    // Prevent deletion if already converted
    if (quotation.status === 'converted') {
      return apiError('Cannot delete a converted quotation', 400);
    }

    await (prisma as any).quotation.delete({
      where: { id },
    });

    return apiSuccess({ id }, 'Quotation deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete quotation');
  }
}
