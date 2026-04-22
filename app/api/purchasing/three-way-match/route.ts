import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get three-way match status for purchase orders
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const purchaseOrderId = searchParams.get('purchaseOrderId');
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status'); // matched, unmatched, partial
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    // Get purchase orders with their goods receipts and invoices
    const purchaseOrders = await (prisma as any).purchaseOrder.findMany({
      where: purchaseOrderId ? { id: purchaseOrderId } : (supplierId ? { supplierId } : {}),
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
        goodsReceipts: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        purchaseInvoices: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    });

    // Calculate three-way match status for each PO
    const matchResults = purchaseOrders.map((po: any) => {
      const goodsReceipt = po.goodsReceipts[0] || null;
      const purchaseInvoice = po.purchaseInvoices[0] || null;

      let matchStatus = 'unmatched';
      let variances: any[] = [];

      if (goodsReceipt && purchaseInvoice) {
        matchStatus = 'matched';

        // Compare quantities
        po.items.forEach((poItem: any) => {
          const grItem = goodsReceipt.items.find((item: any) => item.productId === poItem.productId);
          const piItem = purchaseInvoice.items.find((item: any) => item.productId === poItem.productId);

          if (grItem && piItem) {
            const qtyVariance = (grItem.receivedQuantity - piItem.quantity) / poItem.quantity;
            const priceVariance = Math.abs((piItem.price - poItem.price) / poItem.price);

            if (Math.abs(qtyVariance) > 0.05 || priceVariance > 0.05) {
              matchStatus = 'partial';
              variances.push({
                productId: poItem.productId,
                productName: poItem.product.nameAr || poItem.product.nameEn,
                orderedQty: poItem.quantity,
                receivedQty: grItem.receivedQuantity,
                invoicedQty: piItem.quantity,
                orderedPrice: poItem.price,
                invoicedPrice: piItem.price,
                qtyVariance,
                priceVariance,
              });
            }
          } else {
            matchStatus = 'partial';
          }
        });
      } else if (goodsReceipt || purchaseInvoice) {
        matchStatus = 'partial';
      }

      return {
        purchaseOrder: po,
        goodsReceipt,
        purchaseInvoice,
        matchStatus,
        variances,
      };
    });

    // Filter by status if provided
    const filteredResults = status ? matchResults.filter((r: any) => r.matchStatus === status) : matchResults;

    return apiSuccess(
      { matches: filteredResults, total: filteredResults.length, page, limit },
      'Three-way match results fetched successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Fetch three-way match results');
  }
}

// POST - Perform three-way match and approve invoice for payment
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { purchaseOrderId, purchaseInvoiceId, goodsReceiptId } = body;

    if (!purchaseOrderId || !purchaseInvoiceId || !goodsReceiptId) {
      return apiError('Purchase order ID, invoice ID, and goods receipt ID are required', 400);
    }

    // Fetch all three documents
    const [purchaseOrder, purchaseInvoice, goodsReceipt] = await Promise.all([
      (prisma as any).purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { items: { include: { product: true } } },
      }),
      (prisma as any).purchaseInvoice.findUnique({
        where: { id: purchaseInvoiceId },
        include: { items: { include: { product: true } } },
      }),
      (prisma as any).goodsReceipt.findUnique({
        where: { id: goodsReceiptId },
        include: { items: { include: { product: true } } },
      }),
    ]);

    if (!purchaseOrder || !purchaseInvoice || !goodsReceipt) {
      return apiError('One or more documents not found', 404);
    }

    // Perform detailed three-way matching
    const matchResults = {
      matchStatus: 'matched' as string,
      variances: [] as any[],
      totalOrdered: 0,
      totalReceived: 0,
      totalInvoiced: 0,
    };

    purchaseOrder.items.forEach((poItem: any) => {
      matchResults.totalOrdered += poItem.quantity * poItem.price;

      const grItem = goodsReceipt.items.find((item: any) => item.productId === poItem.productId);
      const piItem = purchaseInvoice.items.find((item: any) => item.productId === poItem.productId);

      if (grItem) {
        matchResults.totalReceived += grItem.receivedQuantity * poItem.price;
      }

      if (piItem) {
        matchResults.totalInvoiced += piItem.quantity * piItem.price;
      }

      if (grItem && piItem) {
        const qtyVariance = (grItem.receivedQuantity - piItem.quantity) / poItem.quantity;
        const priceVariance = Math.abs((piItem.price - poItem.price) / poItem.price);

        if (Math.abs(qtyVariance) > 0.05 || priceVariance > 0.05) {
          matchResults.matchStatus = 'partial';
          matchResults.variances.push({
            productId: poItem.productId,
            productName: poItem.product.nameAr || poItem.product.nameEn,
            orderedQty: poItem.quantity,
            receivedQty: grItem.receivedQuantity,
            invoicedQty: piItem.quantity,
            orderedPrice: poItem.price,
            invoicedPrice: piItem.price,
            qtyVariance,
            priceVariance,
          });
        }
      } else {
        matchResults.matchStatus = 'partial';
        matchResults.variances.push({
          productId: poItem.productId,
          productName: poItem.product.nameAr || poItem.product.nameEn,
          orderedQty: poItem.quantity,
          receivedQty: grItem?.receivedQuantity || 0,
          invoicedQty: piItem?.quantity || 0,
          orderedPrice: poItem.price,
          invoicedPrice: piItem?.price || 0,
          qtyVariance: grItem ? (grItem.receivedQuantity - poItem.quantity) / poItem.quantity : -1,
          priceVariance: piItem ? Math.abs((piItem.price - poItem.price) / poItem.price) : 1,
        });
      }
    });

    // Audit logging
    await logAuditAction(
      user.id, 'THREE_WAY_MATCH', 'purchasing', 'PurchaseOrder', purchaseOrderId,
      { purchaseInvoiceId, goodsReceiptId, matchStatus: matchResults.matchStatus },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(
      { purchaseOrder, purchaseInvoice, goodsReceipt, matchResults },
      'Three-way match completed successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Perform three-way match');
  }
}
