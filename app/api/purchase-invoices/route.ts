import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { incrementStockInTransaction } from '@/lib/inventory';
import { createPurchaseInvoiceEntry, postJournalEntry } from '@/lib/accounting';

export async function GET() {
  try {
    const invoices = await prisma.purchaseInvoice.findMany({
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
    return NextResponse.json(invoices);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch purchase invoices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, ...invoiceData } = body;

    // STEP 1: Create invoice and increment stock atomically
    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.purchaseInvoice.create({
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

      // Increment stock with movement recording
      await incrementStockInTransaction(tx, items, newInvoice.id, 'PurchaseInvoice');

      return newInvoice;
    });

    // STEP 2: Create journal entry AFTER transaction completes (for accounting)
    const total = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
    const journalEntry = await createPurchaseInvoiceEntry(invoice.id, total);
    if (journalEntry) {
      await postJournalEntry(journalEntry.id);
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error creating purchase invoice:', error);
    return NextResponse.json({ error: 'Failed to create purchase invoice' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, items, ...invoiceData } = body;

    // STEP 1: Fetch existing invoice to calculate stock delta
    const existingInvoice = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // STEP 2: Calculate net stock effect by comparing old vs new items
    const oldItemMap = new Map(existingInvoice.items.map((i: any) => [i.productId, i.quantity]));
    const newItemMap = new Map(items.map((i: any) => [i.productId, i.quantity]));

    const stockDeltas: { productId: string; delta: number }[] = [];
    const allProductIds = new Set([...Array.from(oldItemMap.keys()), ...Array.from(newItemMap.keys())]);

    for (const productId of Array.from(allProductIds)) {
      const oldQty = oldItemMap.get(productId) || 0;
      const newQty = newItemMap.get(productId) || 0;
      const delta = (newQty as number) - (oldQty as number);
      if (delta !== 0) {
        stockDeltas.push({ productId, delta });
      }
    }

    // STEP 3: Execute update and stock adjustments atomically
    const invoice = await prisma.$transaction(async (tx) => {
      await tx.purchaseInvoiceItem.deleteMany({
        where: { purchaseInvoiceId: id },
      });

      const updatedInvoice = await tx.purchaseInvoice.update({
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

      // Apply stock deltas with movement recording
      for (const delta of stockDeltas) {
        await tx.product.update({
          where: { id: delta.productId },
          data: {
            stock: {
              increment: delta.delta,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: delta.productId,
            type: 'IN',
            quantity: delta.delta,
            reference: id,
            referenceType: 'PurchaseInvoice',
          },
        });
      }

      return updatedInvoice;
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error updating purchase invoice:', error);
    return NextResponse.json({ error: 'Failed to update purchase invoice' }, { status: 500 });
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
      const invoice = await tx.purchaseInvoice.findUnique({
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
              decrement: item.quantity,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'IN', // Reversal
            quantity: -item.quantity,
            reference: id,
            referenceType: 'PurchaseInvoice',
            notes: 'Deleted invoice reversal',
          },
        });
      }

      await tx.purchaseInvoice.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting purchase invoice:', error);
    return NextResponse.json({ error: 'Failed to delete purchase invoice' }, { status: 500 });
  }
}
