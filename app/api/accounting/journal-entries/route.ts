/**
 * Journal Entries API Routes
 * REST endpoints for journal entry management
 */

import { NextRequest } from 'next/server';
import { journalEntryService, CreateJournalEntryInput } from '@/lib/accounting/journal-entry.service';
import { journalEntryValidator } from '@/lib/accounting/validation.service';
import { validationEngine, ValidationContext } from '@/lib/validation/validation-engine';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { apiError, apiSuccess, handleApiError } from '@/lib/api-response';

// ============================================================================
// POST /api/accounting/journal-entries
// Create a new journal entry
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await req.json();

    const input: CreateJournalEntryInput = {
      ...body,
      tenantId: user.tenantId!,
      createdBy: user.id,
    };

    // Validate using validation engine
    const validationContext: ValidationContext = {
      tenantId: user.tenantId!,
      userId: user.id,
      requestId: `req_${Date.now()}`,
      timestamp: new Date(),
      prisma: null as any,
      snapshot: {
        products: new Map(),
        customers: new Map(),
        suppliers: new Map(),
        accounts: new Map(),
        stock: new Map(),
      },
    };

    const validationResult = await journalEntryValidator.validate(input, validationContext);

    if (!validationResult.isValid) {
      return apiError('Validation failed', 400, {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
    }

    // Create journal entry
    const entry = await journalEntryService.createDraftEntry(input);

    return apiSuccess(entry, 'Journal entry created');
  } catch (error: any) {
    return handleApiError(error, 'Create journal entry');
  }
}

// ============================================================================
// GET /api/accounting/journal-entries
// List journal entries
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const referenceType = searchParams.get('referenceType');
    const referenceId = searchParams.get('referenceId');
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10);

    const result = await journalEntryService.listEntries(user.tenantId!, {
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      referenceType: referenceType || undefined,
      referenceId: referenceId || undefined,
      limit,
      offset,
    });

    return apiSuccess(result);
  } catch (error: any) {
    return handleApiError(error, 'List journal entries');
  }
}
