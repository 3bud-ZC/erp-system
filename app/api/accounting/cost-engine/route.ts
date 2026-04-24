import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get cost analysis and validation
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const validateOnly = searchParams.get('validateOnly') === 'true';

    const products = productId
      ? await prisma.product.findMany({ where: { id: productId, tenantId: user.tenantId } })
      : await prisma.product.findMany({ where: { tenantId: user.tenantId, stock: { gt: 0 } } });

    const analysis: any[] = [];
    const inconsistencies: any[] = [];

    for (const product of products) {
      // Get FIFO layers
      // @ts-ignore - Prisma client type issue
      const fifoLayers = await prisma.fIFOLayer.findMany({
        where: { productId: product.id, remainingQuantity: { gt: 0 } },
        orderBy: { transactionDate: 'asc' },
      });

      // Get cost layers
      // @ts-ignore - Prisma client type issue
      const costLayers = await prisma.costLayer.findMany({
        where: { productId: product.id, quantity: { gt: 0 } },
        orderBy: { date: 'asc' },
      });

      // Calculate FIFO cost
      let fifoCost = 0;
      let fifoQuantity = 0;
      fifoLayers.forEach((layer: any) => {
        fifoCost += layer.remainingQuantity * layer.unitCost;
        fifoQuantity += layer.remainingQuantity;
      });
      const fifoAverageCost = fifoQuantity > 0 ? fifoCost / fifoQuantity : 0;

      // Calculate WAC cost
      let wacCost = 0;
      let wacQuantity = 0;
      costLayers.forEach((layer: any) => {
        wacCost += layer.remainingQuantity * layer.unitCost;
        wacQuantity += layer.remainingQuantity;
      });
      const wacAverageCost = wacQuantity > 0 ? wacCost / wacQuantity : 0;

      // Current product cost
      const currentCost = product.cost;

      // Check for inconsistencies
      const variance = Math.abs(fifoAverageCost - wacAverageCost);
      const isConsistent = variance < 0.01; // Allow small rounding differences

      const productAnalysis = {
        productId: product.id,
        productCode: product.code,
        productName: product.nameAr || product.nameEn,
        currentStock: product.stock,
        currentCost,
        fifo: {
          layers: fifoLayers.length,
          totalQuantity: fifoQuantity,
          averageCost: fifoAverageCost,
          totalValue: fifoCost,
        },
        wac: {
          layers: costLayers.length,
          totalQuantity: wacQuantity,
          averageCost: wacAverageCost,
          totalValue: wacCost,
        },
        consistency: {
          isConsistent,
          variance,
          variancePercentage: currentCost > 0 ? (variance / currentCost) * 100 : 0,
        },
      };

      analysis.push(productAnalysis);

      if (!isConsistent) {
        inconsistencies.push({
          productId: product.id,
          productCode: product.code,
          productName: product.nameAr || product.nameEn,
          fifoCost: fifoAverageCost,
          wacCost: wacAverageCost,
          currentCost,
          variance,
          recommendedCost: (fifoAverageCost + wacAverageCost) / 2,
        });
      }
    }

    if (validateOnly) {
      return apiSuccess(
        { inconsistencies, totalProducts: products.length, inconsistentCount: inconsistencies.length },
        'Cost validation completed'
      );
    }

    return apiSuccess(
      { analysis, inconsistencies, summary: { totalProducts: products.length, inconsistentCount: inconsistencies.length } },
      'Cost engine analysis completed'
    );
  } catch (error) {
    return handleApiError(error, 'Analyze cost engine');
  }
}

// POST - Recalculate and sync costs
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { productId, method } = body; // method: 'fifo', 'wac', 'average'

    if (!method || !['fifo', 'wac', 'average'].includes(method)) {
      return apiError('Method must be fifo, wac, or average', 400);
    }

    const products = productId
      ? await prisma.product.findMany({ where: { id: productId, tenantId: user.tenantId } })
      : await prisma.product.findMany({ where: { tenantId: user.tenantId, stock: { gt: 0 } } });

    const updatedProducts: any[] = [];

    for (const product of products) {
      let newCost = 0;

      if (method === 'fifo') {
        // @ts-ignore - Prisma client type issue
        const fifoLayers = await prisma.fIFOLayer.findMany({
          where: { productId: product.id, remainingQuantity: { gt: 0 } },
        });
        let totalCost = 0;
        let totalQuantity = 0;
        fifoLayers.forEach((layer: any) => {
          totalCost += layer.remainingQuantity * layer.unitCost;
          totalQuantity += layer.remainingQuantity;
        });
        newCost = totalQuantity > 0 ? totalCost / totalQuantity : product.cost;
      } else if (method === 'wac') {
        // @ts-ignore - Prisma client type issue
        const costLayers = await prisma.costLayer.findMany({
          where: { productId: product.id, quantity: { gt: 0 } },
        });
        let totalCost = 0;
        let totalQuantity = 0;
        costLayers.forEach((layer: any) => {
          totalCost += layer.quantity * layer.unitCost;
          totalQuantity += layer.quantity;
        });
        newCost = totalQuantity > 0 ? totalCost / totalQuantity : product.cost;
      } else {
        // Average of both methods
        // @ts-ignore - Prisma client type issue
        const fifoLayers = await prisma.fIFOLayer.findMany({
          where: { productId: product.id, remainingQuantity: { gt: 0 } },
        });
        // @ts-ignore - Prisma client type issue
        const costLayers = await prisma.costLayer.findMany({
          where: { productId: product.id, quantity: { gt: 0 } },
        });

        let fifoTotalCost = 0;
        let fifoTotalQuantity = 0;
        fifoLayers.forEach((layer: any) => {
          fifoTotalCost += layer.remainingQuantity * layer.unitCost;
          fifoTotalQuantity += layer.remainingQuantity;
        });
        const fifoAvg = fifoTotalQuantity > 0 ? fifoTotalCost / fifoTotalQuantity : 0;

        let wacTotalCost = 0;
        let wacTotalQuantity = 0;
        costLayers.forEach((layer: any) => {
          wacTotalCost += layer.quantity * layer.unitCost;
          wacTotalQuantity += layer.quantity;
        });
        const wacAvg = wacTotalQuantity > 0 ? wacTotalCost / wacTotalQuantity : 0;

        newCost = (fifoAvg + wacAvg) / 2;
      }

      // Update product cost
      await prisma.product.update({
        where: { id: product.id },
        data: { cost: newCost },
      });

      updatedProducts.push({
        productId: product.id,
        productCode: product.code,
        oldCost: product.cost,
        newCost,
      });
    }

    return apiSuccess(
      { updatedProducts, method, count: updatedProducts.length },
      'Costs recalculated and synchronized successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Recalculate costs');
  }
}
