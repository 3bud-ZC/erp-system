import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const invoices = await prisma.salesInvoice.findMany({
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
    return NextResponse.json(invoices);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sales invoices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, ...invoiceData } = body;

    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.salesInvoice.create({
        data: {
          ...invoiceData,
          items: {
            create: items,
          },
        },
        include: {
          items: true,
        },
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return newInvoice;
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error creating sales invoice:', error);
    return NextResponse.json({ error: 'Failed to create sales invoice' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, items, ...invoiceData } = body;

    const invoice = await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.salesInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingInvoice) {
        throw new Error('Invoice not found');
      }

      for (const item of existingInvoice.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      await tx.salesInvoiceItem.deleteMany({
        where: { salesInvoiceId: id },
      });

      const updatedInvoice = await tx.salesInvoice.update({
        where: { id },
        data: {
          ...invoiceData,
          items: {
            create: items,
          },
        },
        include: {
          items: true,
        },
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return updatedInvoice;
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error updating sales invoice:', error);
    return NextResponse.json({ error: 'Failed to update sales invoice' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      for (const item of invoice.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      await tx.salesInvoice.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sales invoice:', error);
    return NextResponse.json({ error: 'Failed to delete sales invoice' }, { status: 500 });
  }
}
