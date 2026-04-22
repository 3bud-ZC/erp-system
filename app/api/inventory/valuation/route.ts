import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get inventory valuation
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const autoRecalculate = searchParams.get('autoRecalculate') === 'true';

    let products = productId 
      ? await (prisma as any).product.findMany({ where: { id: productId } })
      : await (prisma as any).product.findMany({ where: { stock: { gt: 0 } } });

    const valuations: any[] = [];

    for (const product of products) {
      // Get current valuation from InventoryValuation model
      let valuation = await (prisma as any).inventoryValuation.findUnique({
        where: { productId: product.id },
      });

      // Calculate real-time valuation
      const currentQuantity = product.stock;
      const currentCost = product.cost;
      const currentValue = currentQuantity * currentCost;

      if (autoRecalculate || !valuation) {
        // Update or create valuation
        if (valuation) {
          valuation = await (prisma as any).inventoryValuation.update({
            where: { productId: product.id },
            data: {
              totalQuantity: currentQuantity,
              totalValue: currentValue,
              averageCost: currentCost,
              lastUpdated: new Date(),
            },
          });
        } else {
          valuation = await (prisma as any).inventoryValuation.create({
            data: {
              productId: product.id,
              totalQuantity: currentQuantity,
              totalValue: currentValue,
              averageCost: currentCost,
              lastUpdated: new Date(),
            },
          });
        }
      }

      valuations.push({
        productId: product.id,
        productCode: product.code,
        productName: product.nameAr || product.nameEn,
        quantity: valuation.totalQuantity,
        averageCost: valuation.averageCost,
        totalValue: valuation.totalValue,
        lastUpdated: valuation.lastUpdated,
        isStale: Math.abs(valuation.totalValue - currentValue) > 0.01,
      });
    }

    const totalInventoryValue = valuations.reduce((sum, v) => sum + v.totalValue, 0);
    const totalQuantity = valuations.reduce((sum, v) => sum + v.quantity, 0);

    return apiSuccess(
      { valuations, summary: { totalInventoryValue, totalQuantity, productCount: valuations.length } },
      'Inventory valuation fetched successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Fetch inventory valuation');
  }
}

// POST - Force recalculation of inventory valuation
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { productId } = body;

    let products = productId 
      ? await (prisma as any).product.findMany({ where: { id: productId } })
      : await (prisma as any).product.findMany();

    const updatedValuations: any[] = [];

    for (const product of products) {
      const currentQuantity = product.stock;
      const currentCost = product.cost;
      const currentValue = currentQuantity * currentCost;

      // Update or create valuation
      const valuation = await (prisma as any).inventoryValuation.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          totalQuantity: currentQuantity,
          totalValue: currentValue,
          averageCost: currentCost,
          lastUpdated: new Date(),
        },
        update: {
          totalQuantity: currentQuantity,
          totalValue: currentValue,
          averageCost: currentCost,
          lastUpdated: new Date(),
        },
      });

      updatedValuations.push({
        productId: product.id,
        productCode: product.code,
        oldQuantity: valuation.totalQuantity,
        newQuantity: currentQuantity,
        oldValue: valuation.totalValue,
        newValue: currentValue,
      });
    }

    const totalValue = updatedValuations.reduce((sum, v) => sum + v.newValue, 0);

    return apiSuccess(
      { updatedValuations, summary: { totalValue, count: updatedValuations.length } },
      'Inventory valuation recalculated successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Recalculate inventory valuation');
  }
}
