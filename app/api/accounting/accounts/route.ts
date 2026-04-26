/**
 * Accounts API Routes
 * REST endpoints for chart of accounts management.
 *
 * Lightweight implementation that hits Prisma directly so the
 * `/accounting/chart-of-accounts` UI has something to render.
 * Wired back from the previous 503 stub.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ============================================================================
// GET /api/accounting/accounts
// List accounts (chart of accounts) for the current tenant.
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    if (!checkPermission(user, 'view_accounting')) {
      return apiError('ليس لديك صلاحية لعرض المحاسبة', 403);
    }

    const accounts = await prisma.account.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        type: true,
        subType: true,
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    // Real balance per account = Σ debit − Σ credit across all *posted*
    // journal-entry lines for this tenant. The static `Account.balance`
    // column is unmaintained (no service writes to it), so we derive the
    // number on demand instead of showing the misleading 0 it always returns.
    const lineTotals = await prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      where: {
        tenantId: user.tenantId,
        journalEntry: { tenantId: user.tenantId, isPosted: true },
      },
      _sum: { debit: true, credit: true },
    });
    const balanceMap = new Map<string, number>(
      lineTotals.map(r => {
        const debit  = Number(r._sum.debit  ?? 0);
        const credit = Number(r._sum.credit ?? 0);
        return [r.accountCode, debit - credit];
      }),
    );

    // Sign the balance the way an accountant expects to read it:
    //   asset / expense  → debit-positive  (debit − credit)
    //   liability / equity / revenue → credit-positive  (credit − debit)
    const data = accounts.map(a => {
      const raw = balanceMap.get(a.code) ?? 0;
      const t = (a.type || '').toLowerCase();
      const creditPositive = t === 'liability' || t === 'equity' || t === 'revenue';
      const balance = creditPositive ? -raw : raw;
      return { ...a, balance };
    });

    return apiSuccess(data, `Accounts fetched (${data.length})`);
  } catch (error: any) {
    return handleApiError(error, 'List accounts');
  }
}

// ============================================================================
// POST /api/accounting/accounts
// Create a new account (force-save: minimal validation, accepts the user's
// payload and lets Prisma's @@unique([tenantId, code]) catch dupes).
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    if (!checkPermission(user, 'manage_accounting')) {
      return apiError('ليس لديك صلاحية لإدارة المحاسبة', 403);
    }

    const body = await req.json();
    const { code, nameAr, nameEn, type, subType, description, isActive } = body || {};

    if (!code?.trim()) return apiError('رمز الحساب مطلوب', 400);
    if (!nameAr?.trim()) return apiError('اسم الحساب بالعربية مطلوب', 400);
    if (!type?.trim()) return apiError('نوع الحساب مطلوب', 400);

    const created = await prisma.account.create({
      data: {
        tenantId: user.tenantId,
        code: code.trim(),
        nameAr: nameAr.trim(),
        nameEn: nameEn?.trim() || null,
        type: type.trim(),
        subType: subType?.trim() || null,
        description: description?.trim() || null,
        isActive: isActive !== false,
      },
    });

    return apiSuccess(created, 'تم إنشاء الحساب بنجاح');
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return apiError('رمز الحساب مستخدم بالفعل', 409);
    }
    return handleApiError(error, 'Create account');
  }
}
