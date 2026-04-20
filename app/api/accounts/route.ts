import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

// GET - Read all accounts
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        journalLines: {
          where: {
            journalEntry: { isPosted: true },
          },
          select: {
            debit: true,
            credit: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const accountsWithBalances = accounts.map((account) => {
      const totalDebit = account.journalLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
      const totalCredit = account.journalLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
      
      const isCreditNormal = ['Liability', 'Equity', 'Revenue'].includes(account.type);
      const balance = isCreditNormal
        ? Number(account.balance) + (totalCredit - totalDebit)
        : Number(account.balance) + (totalDebit - totalCredit);

      return {
        ...account,
        calculatedBalance: balance,
        journalLines: undefined,
      };
    });

    return apiSuccess(accountsWithBalances, 'Accounts fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch accounts');
  }
}

// POST - Create new account
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    // Check permission
    const hasPermission = checkPermission(user, 'create_account');
    if (!hasPermission) {
      return apiError('ليس لديك صلاحية إنشاء حسابات', 403);
    }

    const body = await request.json();
    const { code, nameAr, nameEn, type, subType, description, parentId } = body;

    // Validate required fields
    if (!code || !nameAr || !type) {
      return apiError('الكود والاسم بالعربية والنوع مطلوبان', 400);
    }

    // Validate account type
    const validTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
    if (!validTypes.includes(type)) {
      return apiError('نوع الحساب غير صالح', 400);
    }

    // Check if code already exists
    const existingAccount = await prisma.account.findUnique({
      where: { code },
    });

    if (existingAccount) {
      return apiError('كود الحساب موجود بالفعل', 400);
    }

    // Validate parent account if provided
    if (parentId) {
      const parentAccount = await prisma.account.findUnique({
        where: { id: parentId },
      });

      if (!parentAccount) {
        return apiError('الحساب الرئيسي غير موجود', 400);
      }
    }

    const account = await prisma.account.create({
      data: {
        code,
        nameAr,
        nameEn,
        type,
        subType,
        description,
        isActive: true,
        balance: 0,
      },
    });

    // Log audit action
    await logAuditAction(
      user.id,
      'CREATE',
      'accounting',
      'Account',
      account.id
    );

    // Log activity for audit trail
    await logActivity({
      entity: 'Account',
      entityId: account.id,
      action: 'CREATE',
      userId: user.id,
      after: account,
    });

    return apiSuccess(account, 'Account created successfully');
  } catch (error) {
    return handleApiError(error, 'Create account');
  }
}

// PUT - Update account
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    // Check permission
    const hasPermission = checkPermission(user, 'update_account');
    if (!hasPermission) {
      return apiError('ليس لديك صلاحية تعديل حسابات', 403);
    }

    const body = await request.json();
    const { id, code, nameAr, nameEn, type, subType, description, isActive } = body;

    if (!id) {
      return apiError('معرف الحساب مطلوب', 400);
    }

    // Check if account exists
    const existingAccount = await prisma.account.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return apiError('الحساب غير موجود', 404);
    }

    // Check if code is being changed and if new code already exists
    if (code && code !== existingAccount.code) {
      const codeExists = await prisma.account.findUnique({
        where: { code },
      });

      if (codeExists) {
        return apiError('كود الحساب موجود بالفعل', 400);
      }
    }

    // Check if account has journal entries before changing code
    if (code && code !== existingAccount.code) {
      const journalEntryCount = await prisma.journalEntryLine.count({
        where: { accountCode: existingAccount.code },
      });

      if (journalEntryCount > 0) {
        return apiError('لا يمكن تغيير كود الحساب الذي له قيود دفترية', 400);
      }
    }

    // Validate account type if being changed
    if (type) {
      const validTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
      if (!validTypes.includes(type)) {
        return apiError('نوع الحساب غير صالح', 400);
      }
    }

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: {
        ...(code && { code }),
        ...(nameAr && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(type && { type }),
        ...(subType !== undefined && { subType }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Log audit action
    await logAuditAction(
      user.id,
      'UPDATE',
      'accounting',
      'Account',
      id,
      { before: existingAccount, after: updatedAccount },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    // Log activity for audit trail
    await logActivity({
      entity: 'Account',
      entityId: id,
      action: 'UPDATE',
      userId: user.id,
      before: existingAccount,
      after: updatedAccount,
    });

    return apiSuccess(updatedAccount, 'Account updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update account');
  }
}

// DELETE - Soft delete account
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    // Check permission
    const hasPermission = checkPermission(user, 'delete_account');
    if (!hasPermission) {
      return apiError('ليس لديك صلاحية حذف حسابات', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('معرف الحساب مطلوب', 400);
    }

    // Check if account exists
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        journalLines: true,
      },
    });

    if (!account) {
      return apiError('الحساب غير موجود', 404);
    }

    // Check if account has journal entries
    if (account.journalLines.length > 0) {
      return apiError('لا يمكن حذف الحساب الذي له قيود دفترية', 400);
    }

    // Soft delete by setting isActive to false
    const deletedAccount = await prisma.account.update({
      where: { id },
      data: { isActive: false },
    });

    // Log audit action
    await logAuditAction(
      user.id,
      'DELETE',
      'accounting',
      'Account',
      id,
      { deletedAccount },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    // Log activity for audit trail
    await logActivity({
      entity: 'Account',
      entityId: id,
      action: 'DELETE',
      userId: user.id,
      before: account,
    });

    return apiSuccess({ id }, 'Account deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete account');
  }
}
