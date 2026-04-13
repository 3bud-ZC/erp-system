import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Sales Orders API
 * Important: Sales orders do NOT affect stock.
 * Stock is only affected when a Sales Invoice is created/confirmed.
 */

export async function GET() {
  try {
    const orders = await prisma.salesOrder.findMany({
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
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return NextResponse.json({ error: 'Failed to fetch sales orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, customerId, orderNumber, date, status, notes, total } = body;

    // Validate required fields
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check for duplicate order number
    if (orderNumber) {
      const existing = await prisma.salesOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return NextResponse.json({ error: `Order number ${orderNumber} already exists` }, { status: 400 });
      }
    }

    // Create order with items - use connect for customer relation
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: orderNumber || `SO-${Date.now()}`,
        date: new Date(date),
        status: status || 'pending',
        notes: notes || null,
        total: total || 0,
        customer: {
          connect: { id: customerId }
        },
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price || 0,
            total: (item.quantity || 0) * (item.price || 0),
          })),
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

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Error creating sales order:', error);
    const errorMessage = error.message || error.meta?.cause || 'Failed to create sales order';
    return NextResponse.json({ error: errorMessage, details: error.meta }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, items, orderNumber, date, status, notes, total, customerId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Verify order exists
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }

    // Check for duplicate order number (if changed)
    if (orderNumber && orderNumber !== existingOrder.orderNumber) {
      const existing = await prisma.salesOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return NextResponse.json({ error: `Order number ${orderNumber} already exists` }, { status: 400 });
      }
    }

    // Update order
    const order = await prisma.salesOrder.update({
      where: { id },
      data: {
        orderNumber,
        date: new Date(date),
        status: status || 'pending',
        notes: notes || null,
        total: total || 0,
        ...(customerId && {
          customer: {
            connect: { id: customerId }
          }
        }),
        items: {
          deleteMany: {},
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price || 0,
            total: (item.quantity || 0) * (item.price || 0),
          })),
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

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Error updating sales order:', error);
    const errorMessage = error.message || error.meta?.cause || 'Failed to update sales order';
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

    // Delete items first, then order
    await prisma.$transaction([
      prisma.salesOrderItem.deleteMany({
        where: { salesOrderId: id },
      }),
      prisma.salesOrder.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting sales order:', error);
    const errorMessage = error.message || error.meta?.cause || 'Failed to delete sales order';
    return NextResponse.json({ error: errorMessage, details: error.meta }, { status: 500 });
  }
}
