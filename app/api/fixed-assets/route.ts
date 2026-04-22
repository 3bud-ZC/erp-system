import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { createJournalEntry, postJournalEntry } from '@/lib/accounting';
import { transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Read fixed assets
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).fixedAsset.findMany({
        where,
        include: {
          depreciationSchedules: {
            orderBy: { period: 'desc' },
          },
        },
        orderBy: { purchaseDate: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).fixedAsset.count({ where }),
    ]);

    return apiSuccess({ fixedAssets: data, total, page, limit }, 'Fixed assets fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch fixed assets');
  }
}

// POST - Create fixed asset
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { name, description, accountCode, purchaseDate, purchaseCost, usefulLife, salvageValue, depreciationMethod } = body;

    if (!name || !accountCode || !purchaseDate || !purchaseCost || !usefulLife) {
      return apiError('Name, account code, purchase date, purchase cost, and useful life are required', 400);
    }

    // Validate account
    const account = await prisma.account.findUnique({
      where: { tenantId_code: { tenantId: user.tenantId!, code: accountCode } },
    });

    if (!account) {
      return apiError('Account not found', 400);
    }

    // Generate asset number
    const lastAsset = await (prisma as any).fixedAsset.findFirst({
      orderBy: { assetNumber: 'desc' },
    });
    const nextNumber = lastAsset ? parseInt(lastAsset.assetNumber.slice(3)) + 1 : 1;
    const assetNumber = `FA-${String(nextNumber).padStart(6, '0')}`;

    // Calculate initial net book value
    const netBookValue = purchaseCost - (salvageValue || 0);

    // Create fixed asset
    const asset = await (prisma as any).fixedAsset.create({
      data: {
        assetNumber,
        name,
        description,
        accountCode,
        purchaseDate: new Date(purchaseDate),
        purchaseCost,
        usefulLife: parseInt(usefulLife),
        salvageValue: salvageValue || 0,
        depreciationMethod: depreciationMethod || 'straight_line',
        accumulatedDepreciation: 0,
        netBookValue,
        status: 'active',
        tenantId: user.tenantId,
      },
    });

    // Create journal entry for asset purchase
    const journalEntry = await createJournalEntry({
      entryDate: new Date(purchaseDate),
      description: `Purchase of fixed asset ${assetNumber} - ${name}`,
      referenceType: 'FixedAsset',
      referenceId: asset.id,
      lines: [
        {
          accountCode: accountCode, // Fixed asset account
          debit: purchaseCost,
          credit: 0,
          description: `Fixed asset ${name}`,
        },
        {
          accountCode: '1010', // Cash or accounts payable
          debit: 0,
          credit: purchaseCost,
          description: `Payment for fixed asset ${name}`,
        },
      ],
    }, user.id);

    await postJournalEntry(journalEntry.id, user.id);

    // Generate depreciation schedule
    const depreciationSchedules = [];
    const monthlyDepreciation = (purchaseCost - (salvageValue || 0)) / (parseInt(usefulLife));
    let accumulatedDepreciation = 0;

    for (let i = 0; i < parseInt(usefulLife); i++) {
      const periodDate = new Date(purchaseDate);
      periodDate.setMonth(periodDate.getMonth() + i);
      const period = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;

      accumulatedDepreciation += monthlyDepreciation;
      const currentNetBookValue = purchaseCost - accumulatedDepreciation;

      const schedule = await (prisma as any).depreciationSchedule.create({
        data: {
          fixedAssetId: asset.id,
          period,
          depreciationAmount: monthlyDepreciation,
          accumulatedDepreciation,
          netBookValue: Math.max(0, currentNetBookValue),
          posted: false,
        },
      });

      depreciationSchedules.push(schedule);
    }

    // Trigger workflow transition
    await transitionEntity('FixedAsset', asset.id, 'active', user.id, { purchaseCost, usefulLife });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'accounting', 'FixedAsset', asset.id,
      { assetNumber: asset.assetNumber, name, purchaseCost },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ asset, depreciationSchedules }, 'Fixed asset created successfully');
  } catch (error) {
    return handleApiError(error, 'Create fixed asset');
  }
}

// PUT - Update fixed asset
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, description } = body;

    if (!id) {
      return apiError('Fixed asset ID is required', 400);
    }

    // Check if asset exists
    const existingAsset = await (prisma as any).fixedAsset.findUnique({
      where: { id },
    });

    if (!existingAsset) {
      return apiError('Fixed asset not found', 404);
    }

    // Handle disposal
    if (status === 'disposed' && existingAsset.status !== 'disposed') {
      await prisma.$transaction(async (tx) => {
        // Update asset
        await (tx as any).fixedAsset.update({
          where: { id },
          data: {
            status: 'disposed',
            disposedAt: new Date(),
            disposedBy: user.id,
          },
        });

        // Create journal entry for disposal
        const journalEntry = await createJournalEntry({
          entryDate: new Date(),
          description: `Disposal of fixed asset ${existingAsset.assetNumber} - ${existingAsset.name}`,
          referenceType: 'FixedAsset',
          referenceId: existingAsset.id,
          lines: [
            {
              accountCode: existingAsset.accountCode, // Remove from fixed asset account
              debit: 0,
              credit: existingAsset.netBookValue,
              description: `Disposal of ${existingAsset.name}`,
            },
            {
              accountCode: '5020', // Loss on disposal or gain account
              debit: existingAsset.netBookValue,
              credit: 0,
              description: `Net book value of disposed asset`,
            },
          ],
        }, user.id);

        await postJournalEntry(journalEntry.id, user.id);
      });

      // Trigger workflow transition
      await transitionEntity('FixedAsset', id, 'disposed', user.id, { disposedAt: new Date() });

      // Audit logging
      await logAuditAction(
        user.id, 'DISPOSE', 'accounting', 'FixedAsset', id,
        { assetNumber: existingAsset.assetNumber },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess({ id, status: 'disposed' }, 'Fixed asset disposed successfully');
    }

    // Regular update
    const asset = await (prisma as any).fixedAsset.update({
      where: { id },
      data: {
        description: description || undefined,
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingAsset.status) {
      await transitionEntity('FixedAsset', id, status, user.id, { status });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'accounting', 'FixedAsset', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(asset, 'Fixed asset updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update fixed asset');
  }
}

// DELETE - Delete fixed asset
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Fixed asset ID is required', 400);
    }

    // Check if asset exists
    const asset = await (prisma as any).fixedAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return apiError('Fixed asset not found', 404);
    }

    // Prevent deletion if already disposed
    if (asset.status === 'disposed') {
      return apiError('Cannot delete a disposed fixed asset', 400);
    }

    await (prisma as any).fixedAsset.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'accounting', 'FixedAsset', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Fixed asset deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete fixed asset');
  }
}
