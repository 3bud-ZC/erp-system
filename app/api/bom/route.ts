import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      const allBOMs = await prisma.bOMItem.findMany({
        include: {
          product: true,
          material: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(allBOMs);
    }

    const bom = await prisma.bOMItem.findMany({
      where: { productId },
      include: {
        product: true,
        material: true,
      },
    });

    return NextResponse.json(bom);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch BOM' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, materialId, quantity } = body;

    // Validate both products exist
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const material = await prisma.product.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material product not found' }, { status: 404 });
    }

    // Prevent circular BOM (e.g., product cannot be its own material)
    if (productId === materialId) {
      return NextResponse.json(
        { error: 'A product cannot be its own raw material' },
        { status: 400 }
      );
    }

    // Check if BOM item already exists
    const existing = await prisma.bOMItem.findFirst({
      where: { productId, materialId },
    });

    if (existing) {
      // Update instead of creating
      const updated = await prisma.bOMItem.update({
        where: { id: existing.id },
        data: { quantity },
        include: { product: true, material: true },
      });
      return NextResponse.json(updated);
    }

    // Create new BOM item
    const bomItem = await prisma.bOMItem.create({
      data: {
        productId,
        materialId,
        quantity,
      },
      include: {
        product: true,
        material: true,
      },
    });

    return NextResponse.json(bomItem);
  } catch (error) {
    console.error('Error creating BOM item:', error);
    return NextResponse.json({ error: 'Failed to create BOM item' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, quantity } = body;

    const bomItem = await prisma.bOMItem.update({
      where: { id },
      data: { quantity },
      include: { product: true, material: true },
    });

    return NextResponse.json(bomItem);
  } catch (error) {
    console.error('Error updating BOM item:', error);
    return NextResponse.json({ error: 'Failed to update BOM item' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.bOMItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting BOM item:', error);
    return NextResponse.json({ error: 'Failed to delete BOM item' }, { status: 500 });
  }
}
