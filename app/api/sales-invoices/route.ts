import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateStockAvailability, decrementStockInTransaction } from '@/lib/inventory';
import { createSalesInvoiceEntry, postJournalEntry } from '@/lib/accounting';

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

    // STEP 1: Validate stock availability BEFORE transaction
    const validation = await validateStockAvailability(items);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Insufficient stock for one or more items',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // STEP 2: Create invoice, decrement stock, and create journal entry atomically
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

      // Calculate total
      const total = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

      // Decrement stock (safe because we already validated) - WITH stock movement recording
      await decrementStockInTransaction(tx, items, newInvoice.id, 'SalesInvoice');

      return newInvoice;
    });

    // STEP 3: Create journal entry AFTER transaction completes (for accounting)
    const total = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
    const journalEntry = await createSalesInvoiceEntry(invoice.id, total);
    if (journalEntry) {
      await postJournalEntry(journalEntry.id);
    }

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

    // STEP 1: Fetch existing invoice to calculate stock delta
    const existingInvoice = await prisma.salesInvoice.findUnique({
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

    // STEP 3: Validate stock for net increases
    const itemsNeedingValidation = stockDeltas
      .filter((d) => d.delta > 0)
      .map((d) => ({ productId: d.productId, quantity: d.delta }));

    if (itemsNeedingValidation.length > 0) {
      const validation = await validateStockAvailability(itemsNeedingValidation);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Insufficient stock for updated items',
            details: validation.errors,
          },
          { status: 400 }
        );
      }
    }

    // STEP 4: Execute update and stock adjustments atomically
    const invoice = await prisma.$transaction(async (tx) => {
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

      // Apply stock deltas with movement recording
      for (const delta of stockDeltas) {
        await tx.product.update({
          where: { id: delta.productId },
          data: {
            stock: {
              decrement: delta.delta,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: delta.productId,
            type: 'OUT',
            quantity: -delta.delta,
            reference: id,
            referenceType: 'SalesInvoice',
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

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'OUT', // Reversal
            quantity: item.quantity,
            reference: id,
            referenceType: 'SalesInvoice',
            notes: 'Deleted invoice reversal',
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
