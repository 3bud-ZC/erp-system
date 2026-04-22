import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get low stock alerts
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId');
    const threshold = searchParams.get('threshold'); // Custom threshold override

    // Find products with stock below reorder point
    const products = await (prisma as any).product.findMany({
      where: {
        stock: {
          lt: threshold ? parseFloat(threshold) : (prisma as any).product.fields.stock,
        },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        warehouse: true,
        itemGroup: true,
      },
      orderBy: {
        stock: 'asc',
      },
    });

    // Calculate reorder urgency
    const alerts = products.map((product: any) => {
      const reorderPoint = threshold ? parseFloat(threshold) : product.minStock;
      const stockLevel = product.stock;
      const shortage = reorderPoint - stockLevel;
      const urgency = shortage / (reorderPoint || 1); // 0-1 scale, higher is more urgent

      return {
        productId: product.id,
        productCode: product.code,
        productName: product.nameAr || product.nameEn || 'Unknown',
        currentStock: stockLevel,
        reorderPoint: reorderPoint,
        shortage,
        urgency,
        warehouse: product.warehouse?.nameAr || product.warehouse?.nameEn || 'Default',
        itemGroup: product.itemGroup?.nameAr || product.itemGroup?.nameEn || null,
        recommendedOrderQuantity: Math.ceil(reorderPoint * 1.5 - stockLevel), // Order to reach 150% of reorder point
      };
    });

    // Sort by urgency (most urgent first)
    alerts.sort((a: any, b: any) => b.urgency - a.urgency);

    return apiSuccess(
      { alerts, total: alerts.length },
      'Low stock alerts fetched successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Fetch low stock alerts');
  }
}

// POST - Create purchase requisitions for low stock items
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_purchase')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { warehouseId, threshold, supplierId, autoCreate } = body;

    // Find products with stock below reorder point
    const products = await (prisma as any).product.findMany({
      where: {
        stock: {
          lt: threshold ? parseFloat(threshold) : (prisma as any).product.fields.stock,
        },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        warehouse: true,
      },
    });

    if (products.length === 0) {
      return apiSuccess({ created: 0, message: 'No products below reorder point' }, 'No purchase requisitions created');
    }

    let createdCount = 0;

    if (autoCreate) {
      // Generate purchase requisition number
      const lastRequisition = await (prisma as any).purchaseRequisition.findFirst({
        orderBy: { requisitionNumber: 'desc' },
      });
      const nextNumber = lastRequisition ? parseInt(lastRequisition.requisitionNumber.slice(3)) + 1 : 1;
      const requisitionNumber = `PR-${String(nextNumber).padStart(6, '0')}`;

      // Create requisition items
      const requisitionItems = products.map((product: any) => {
        const reorderPoint = threshold ? parseFloat(threshold) : product.minStock;
        const stockLevel = product.stock;
        const recommendedQuantity = Math.ceil(reorderPoint * 1.5 - stockLevel);
        const estimatedPrice = product.cost || 0;
        const total = recommendedQuantity * estimatedPrice;

        return {
          productId: product.id,
          quantity: recommendedQuantity,
          estimatedPrice,
          total,
        };
      });

      // Calculate total
      const total = requisitionItems.reduce((sum: number, item: any) => sum + item.total, 0);

      // Use provided supplier or default to first available supplier
      let finalSupplierId = supplierId;
      if (!finalSupplierId) {
        const firstSupplier = await (prisma as any).supplier.findFirst();
        if (!firstSupplier) {
          return apiError('No supplier found. Please specify a supplier.', 400);
        }
        finalSupplierId = firstSupplier.id;
      }

      // Create purchase requisition
      const requisition = await (prisma as any).purchaseRequisition.create({
        data: {
          requisitionNumber,
          supplierId: finalSupplierId,
          date: new Date(),
          requiredBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          status: 'draft',
          total,
          notes: 'Auto-generated from low stock alerts',
          items: {
            create: requisitionItems,
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      createdCount = 1;

      // Audit logging
      await logAuditAction(
        user.id, 'CREATE', 'purchase', 'PurchaseRequisition', requisition.id,
        { requisitionNumber: requisition.requisitionNumber, autoGenerated: true, itemCount: products.length },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(
        { requisition, createdCount, itemCount: products.length },
        'Purchase requisition created from low stock alerts'
      );
    }

    return apiSuccess(
      { created: createdCount, itemCount: products.length, alerts: products },
      'Low stock alerts processed successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Process low stock alerts');
  }
}
