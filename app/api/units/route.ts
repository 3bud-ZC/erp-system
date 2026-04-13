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
      prisma.unit.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.unit.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}

function uniqueConflictMessage(error: any): string {
  const target: string[] = error?.meta?.target ?? [];
  if (target.includes('nameAr')) return 'اسم الوحدة مستخدم بالفعل';
  if (target.includes('code')) return 'كود الوحدة مستخدم بالفعل';
  return 'القيمة مستخدمة بالفعل';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;

    if (!code) {
      return NextResponse.json({ error: 'الكود مطلوب' }, { status: 400 });
    }
    if (!nameAr) {
      return NextResponse.json({ error: 'الاسم العربي مطلوب' }, { status: 400 });
    }

    const unit = await prisma.unit.create({
      data: { code, nameAr, nameEn },
    });
    return NextResponse.json(unit, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: uniqueConflictMessage(error) }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;

    if (!id) {
      return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: 'الكود مطلوب' }, { status: 400 });
    }
    if (!nameAr) {
      return NextResponse.json({ error: 'الاسم العربي مطلوب' }, { status: 400 });
    }

    const unit = await prisma.unit.update({
      where: { id },
      data: { code, nameAr, nameEn },
    });
    return NextResponse.json(unit);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: uniqueConflictMessage(error) }, { status: 409 });
    }
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'الوحدة غير موجودة' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await prisma.unit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 });
  }
}
