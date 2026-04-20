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
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const customerId = searchParams.get('customerId');
    const productId = searchParams.get('productId');
    const paymentStatus = searchParams.get('paymentStatus');

    // Default to current month
    const now = new Date();
    const from = fromDate ? new Date(fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toDate ? new Date(toDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Build where clause
    const where: any = {
      createdAt: { gte: from, lte: to },
    };
    if (customerId) {
      where.customerId = customerId;
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    // Get sales invoices within date range
    const invoices = await prisma.salesInvoice.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter by product if specified
    let filteredInvoices = invoices;
    let productDetails = null;

    if (productId) {
      filteredInvoices = invoices.filter(inv => 
        inv.items.some(item => item.productId === productId)
      );

      // Calculate product specific data
      const productItems = filteredInvoices.flatMap(inv => 
        inv.items.filter(item => item.productId === productId)
      );

      const totalSoldQuantity = productItems.reduce((sum, item) => sum + item.quantity, 0);
      const customers = Array.from(new Set(filteredInvoices.map(inv => inv.customer?.nameAr).filter(Boolean)));
      
      const saleDetails = productItems.map(item => ({
        price: item.price,
        quantity: item.quantity,
        date: invoices.find(inv => inv.items.includes(item))?.createdAt,
      }));

      // Calculate average selling price
      const avgPrice = saleDetails.length > 0 
        ? saleDetails.reduce((sum, s) => sum + s.price, 0) / saleDetails.length 
        : 0;

      // Get remaining stock for the product
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { stock: true }
      });

      productDetails = {
        totalSoldQuantity,
        customers,
        avgPrice,
        saleDetails,
        remainingStock: product?.stock || 0
      };
    }

    // Calculate metrics
    const totalSales = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalInvoices = filteredInvoices.length;
    const averageOrderValue = totalInvoices > 0 ? totalSales / totalInvoices : 0;

    // Group by customer
    const customerMap = new Map<string, { name: string; total: number; invoiceCount: number }>();
    filteredInvoices.forEach((inv) => {
      const key = inv.customer?.id || 'unknown';
      const customer = customerMap.get(key) || {
        name: inv.customer?.nameAr || 'غير معروف',
        total: 0,
        invoiceCount: 0,
      };
      customer.total += inv.total;
      customer.invoiceCount += 1;
      customerMap.set(key, customer);
    });

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Get monthly trends for the last 6 months
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthWhere: any = {
        createdAt: { gte: monthStart, lte: monthEnd },
      };
      if (customerId) monthWhere.customerId = customerId;
      if (paymentStatus) monthWhere.paymentStatus = paymentStatus;

      const monthData = await prisma.salesInvoice.aggregate({
        _sum: { total: true },
        where: monthWhere,
      });

      monthlyTrends.push({
        month: monthStart.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' }),
        total: Number(monthData._sum.total) || 0,
      });
    }

    return apiSuccess({
      totalSales,
      averageOrderValue,
      totalInvoices,
      topCustomers,
      monthlyTrends,
      invoices: filteredInvoices,
      productDetails,
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }, 'Sales reports fetched successfully');
  } catch (error) {
    console.error('Error fetching sales reports:', error);
    return apiError('فشل في تحميل تقارير المبيعات', 500);
  }
}
