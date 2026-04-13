import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { nameAr: { contains: search, mode: 'insensitive' as const } },
            { nameEn: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.warehouse.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.warehouse.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}

function uniqueConflictMessage(error: any): string {
  const target: string[] = error?.meta?.target ?? [];
  if (target.includes('nameAr')) return 'اسم المخزن مستخدم بالفعل';
  if (target.includes('code')) return 'كود المخزن مستخدم بالفعل';
  return 'القيمة مستخدمة بالفعل';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;
    const address = body.address?.toString().trim() || null;
    const phone = body.phone?.toString().trim() || null;
    const manager = body.manager?.toString().trim() || null;

    if (!code) {
      return NextResponse.json({ error: 'الكود مطلوب' }, { status: 400 });
    }
    if (!nameAr) {
      return NextResponse.json({ error: 'الاسم العربي مطلوب' }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.create({
      data: { code, nameAr, nameEn, address, phone, manager },
    });
    return NextResponse.json(warehouse, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: uniqueConflictMessage(error) }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create warehouse' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;
    const address = body.address?.toString().trim() || null;
    const phone = body.phone?.toString().trim() || null;
    const manager = body.manager?.toString().trim() || null;

    if (!id) {
      return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: 'الكود مطلوب' }, { status: 400 });
    }
    if (!nameAr) {
      return NextResponse.json({ error: 'الاسم العربي مطلوب' }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: { code, nameAr, nameEn, address, phone, manager },
    });
    return NextResponse.json(warehouse);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: uniqueConflictMessage(error) }, { status: 409 });
    }
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update warehouse' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
    }

    await prisma.warehouse.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete warehouse' }, { status: 500 });
  }
}
