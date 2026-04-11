import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateStockAvailability, decrementStockInTransaction, incrementStockInTransaction } from '@/lib/inventory';
import {
  createManufacturingEntry,
  recordRawMaterialConsumption,
  recordManufacturingLabor,
  recordManufacturingOverhead,
  postJournalEntry,
} from '@/lib/accounting';

export async function GET() {
  try {
    const orders = await prisma.productionOrder.findMany({
      include: {
        product: true,
        items: {
          include: {
            product: true,
          },
        },
        workInProgress: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch production orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, quantity, laborCost = 0, overheadCost = 0, ...orderData } = body;

    // STEP 1: Fetch the BOM for this product
    const bomItems = await prisma.bOMItem.findMany({
      where: { productId },
      include: { material: true },
    });

    if (bomItems.length === 0) {
      return NextResponse.json(
        { error: 'No Bill of Materials (BOM) found for this product' },
        { status: 400 }
      );
    }

    // STEP 2: Calculate total raw materials needed (BOM explosion)
    const rawMaterialsNeeded = bomItems.map((bom) => ({
      productId: bom.materialId,
      quantity: bom.quantity * quantity, // Scale BOM by production quantity
    }));

    // STEP 3: Validate stock availability for all raw materials
    const validation = await validateStockAvailability(rawMaterialsNeeded);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Insufficient raw materials for production',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // STEP 4: Create production order, consume raw materials, and record WIP atomically
    const order = await prisma.$transaction(async (tx) => {
      // Create the production order
      const newOrder = await tx.productionOrder.create({
        data: {
          ...orderData,
          productId,
          quantity,
          date: new Date(orderData.date),
          items: {
            create: rawMaterialsNeeded.map((rm) => ({
              productId: rm.productId,
              quantity: rm.quantity,
              cost: 0, // Will be calculated from material cost
              total: 0,
            })),
          },
        },
        include: {
          items: true,
          product: true,
        },
      });

      // Create WIP record
      const wipEntry = await tx.workInProgress.create({
        data: {
          productionOrderId: newOrder.id,
          rawMaterialCost: 0, // Will be updated when materials are consumed
          laborCost: laborCost || 0,
          overheadCost: overheadCost || 0,
          totalCost: laborCost || overheadCost || 0,
        },
      });

      // Decrement raw material stock with movement recording
      await decrementStockInTransaction(tx, rawMaterialsNeeded, newOrder.id, 'ProductionOrder');

      return newOrder;
    });

    // STEP 5: Calculate raw material cost and create accounting entries
    let totalRawMaterialCost = 0;
    for (const rm of rawMaterialsNeeded) {
      const material = await prisma.product.findUnique({
        where: { id: rm.productId },
        select: { cost: true },
      });
      if (material) {
        totalRawMaterialCost += rm.quantity * material.cost;
      }
    }

    const totalManufacturingCost = totalRawMaterialCost + (laborCost || 0) + (overheadCost || 0);

    // Record raw material consumption to WIP
    await prisma.workInProgress.update({
      where: { productionOrderId: order.id },
      data: {
        rawMaterialCost: totalRawMaterialCost,
        totalCost: totalManufacturingCost,
      },
    });

    // STEP 6: Create manufacturing accounting entries (WIP to Finished Goods on completion)
    // For now, just record the WIP entry - actual GL posting happens when order is completed
    const journalEntry = await createManufacturingEntry(
      order.id,
      quantity,
      totalManufacturingCost
    );

    if (journalEntry) {
      await postJournalEntry(journalEntry.id);
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error creating production order:', error);
    return NextResponse.json({ error: 'Failed to create production order' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, ...updateData } = body;

    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: { items: true, workInProgress: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Production order not found' }, { status: 404 });
    }

    // If status is changing to "completed", finalize the manufacturing
    if (status === 'completed' && order.status !== 'completed') {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // Update order status
        const updated = await tx.productionOrder.update({
          where: { id },
          data: { status, ...updateData },
          include: { product: true, items: true, workInProgress: true },
        });

        // Get the total WIP cost
        const wip = await tx.workInProgress.findUnique({
          where: { productionOrderId: id },
        });

        if (wip) {
          // Create finished goods (add to finished product inventory)
          await tx.product.update({
            where: { id: updated.productId },
            data: {
              stock: {
                increment: updated.quantity,
              },
            },
          });

          // Record stock movement for finished goods
          await tx.stockMovement.create({
            data: {
              productId: updated.productId,
              type: 'MANUFACTURING_IN',
              quantity: updated.quantity,
              reference: id,
              referenceType: 'ProductionOrder',
              notes: `Finished goods from manufacturing (Cost: ${wip.totalCost})`,
            },
          });

          // Update the finished product cost (FIFO: use WIP cost)
          const existingProduct = await tx.product.findUnique({
            where: { id: updated.productId },
            select: { cost: true },
          });

          if (existingProduct) {
            const newCost = wip.totalCost / updated.quantity;
            await tx.product.update({
              where: { id: updated.productId },
              data: { cost: newCost },
            });
          }

          // Mark WIP as completed
          await tx.workInProgress.update({
            where: { productionOrderId: id },
            data: { status: 'completed' },
          });
        }

        return updated;
      });

      return NextResponse.json(updatedOrder);
    }

    // Simple update if not completing
    const updated = await prisma.productionOrder.update({
      where: { id },
      data: { status, ...updateData },
      include: { items: true, workInProgress: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating production order:', error);
    return NextResponse.json({ error: 'Failed to update production order' }, { status: 500 });
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
      const order = await tx.productionOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order) {
        throw new Error('Production order not found');
      }

      // Restore raw material stock (reverse the deduction)
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });

        // Record stock movement reversal
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'MANUFACTURING_OUT', // Reversal
            quantity: -item.quantity,
            reference: id,
            referenceType: 'ProductionOrder',
            notes: 'Deleted production order - raw materials restored',
          },
        });
      }

      // Delete WIP
      await tx.workInProgress.deleteMany({
        where: { productionOrderId: id },
      });

      // Delete production order
      await tx.productionOrder.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting production order:', error);
    return NextResponse.json({ error: 'Failed to delete production order' }, { status: 500 });
  }
}
