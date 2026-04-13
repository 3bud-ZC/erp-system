import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Purchase Orders API
 * Important: Purchase orders do NOT affect stock.
 * Stock is only affected when a Purchase Invoice is created/received.
 */

export async function GET() {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, supplierId, orderNumber, date, status, notes, total, branch, warehouse } = body;

    // Validate required fields
    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Check for duplicate order number
    if (orderNumber) {
      const existing = await prisma.purchaseOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return NextResponse.json({ error: `Order number ${orderNumber} already exists` }, { status: 400 });
      }
    }

    // Create order with items - use connect for supplier relation
    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        date: new Date(date),
        status: status || 'pending',
        notes: notes || null,
        total: total || 0,
        supplier: {
          connect: { id: supplierId }
        },
        items: {
          create: items.map((item: any) => {
            const quantity = item.quantity || 0;
            const price = item.unitPrice || item.price || 0;
            const total = quantity * price;
            return {
              productId: item.productId,
              quantity,
              price,
              total,
            };
          }),
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

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    // Return more detailed error message
    const errorMessage = error.message || error.meta?.cause || 'Failed to create purchase order';
    return NextResponse.json({ error: errorMessage, details: error.meta }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, items, orderNumber, date, status, notes, total, supplierId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Verify order exists
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    // Check for duplicate order number (if changed)
    if (orderNumber && orderNumber !== existingOrder.orderNumber) {
      const existing = await prisma.purchaseOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return NextResponse.json({ error: `Order number ${orderNumber} already exists` }, { status: 400 });
      }
    }

    // Update order
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        orderNumber,
        date: new Date(date),
        status: status || 'pending',
        notes: notes || null,
        total: total || 0,
        ...(supplierId && {
          supplier: {
            connect: { id: supplierId }
          }
        }),
        items: {
          deleteMany: {},
          create: items.map((item: any) => {
            const quantity = item.quantity || 0;
            const price = item.unitPrice || item.price || 0;
            const total = quantity * price;
            return {
              productId: item.productId,
              quantity,
              price,
              total,
            };
          }),
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

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Error updating purchase order:', error);
    const errorMessage = error.message || error.meta?.cause || 'Failed to update purchase order';
    return NextResponse.json({ error: errorMessage, details: error.meta }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.purchaseOrder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 });
  }
}
