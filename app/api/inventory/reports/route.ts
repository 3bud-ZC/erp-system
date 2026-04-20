import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // Auth check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

    // Build where clause - ONLY finished products
    const where: any = {
      type: 'finished_product',
    };
    if (productId) {
      where.id = productId;
    }
    if (lowStockOnly) {
      where.stock = { lt: prisma.product.fields.minStock };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        unitRef: true,
        warehouse: true,
        company: true,
        itemGroup: true,
      },
      orderBy: { nameAr: 'asc' },
    });

    // Calculate inventory metrics
    let totalStock = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    const productDetails = products.map((product) => {
      const value = product.stock * product.cost;
      totalStock += product.stock;
      totalValue += value;
      
      if (product.stock < product.minStock) {
        lowStockCount++;
      }

      return {
        id: product.id,
        code: product.code,
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        stock: product.stock,
        minStock: product.minStock,
        cost: product.cost,
        price: product.price,
        unit: product.unit,
        value,
        isLowStock: product.stock < product.minStock,
        unitRef: product.unitRef,
        warehouse: product.warehouse,
        company: product.company,
        itemGroup: product.itemGroup,
      };
    });

    return apiSuccess({
      products: productDetails,
      summary: {
        totalProducts: products.length,
        totalStock,
        totalValue,
        lowStockCount,
      },
    }, 'Inventory report fetched successfully');
  } catch (error) {
    console.error('Error fetching inventory report:', error);
    return apiError('فشل في تحميل تقرير المخزون', 500);
  }
}
