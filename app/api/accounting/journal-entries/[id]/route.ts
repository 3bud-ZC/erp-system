/**
 * /api/accounting/journal-entries/[id]
 *
 *   GET    — fetch a single entry with its lines
 *   PUT    — update a DRAFT entry (description / entryDate / lines)
 *   DELETE — delete a DRAFT entry
 *
 * POSTED entries are immutable here — to change them, callers must POST
 * to /api/accounting/journal-entries/[id]/reverse, which writes a new
 * inverse entry and links the two together (audit-trail preserved).
 */

import { NextRequest } from 'next/server';
import { journalEntryService } from '@/lib/accounting/journal-entry.service';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { apiError, apiSuccess, handleApiError } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const entry = await journalEntryService.getEntry(params.id, user.tenantId!);
    if (!entry) return apiError('القيد غير موجود', 404);

    return apiSuccess(entry);
  } catch (error: any) {
    return handleApiError(error, 'Get journal entry');
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await req.json();

    const updated = await journalEntryService.updateDraftEntry(
      params.id,
      user.tenantId!,
      {
        entryDate: body.entryDate ? new Date(body.entryDate) : undefined,
        description: body.description,
        lines: Array.isArray(body.lines) ? body.lines : undefined,
      },
    );

    return apiSuccess(updated, 'Journal entry updated');
  } catch (error: any) {
    // Surface domain validation messages (e.g. "Only draft entries…")
    // as 400s rather than 500s.
    const msg: string = error?.message || '';
    if (
      msg.includes('Only draft entries') ||
      msg.includes('belongs to a different tenant') ||
      msg.includes('not found')
    ) {
      return apiError(msg, 400);
    }
    return handleApiError(error, 'Update journal entry');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const result = await journalEntryService.deleteDraftEntry(params.id, user.tenantId!);
    return apiSuccess(result, 'Journal entry deleted');
  } catch (error: any) {
    const msg: string = error?.message || '';
    if (
      msg.includes('Only draft entries') ||
      msg.includes('belongs to a different tenant') ||
      msg.includes('not found')
    ) {
      return apiError(msg, 400);
    }
    return handleApiError(error, 'Delete journal entry');
  }
}
