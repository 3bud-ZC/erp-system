/**
 * Accounts API Routes
 * REST endpoints for chart of accounts management
 * TODO: Re-enable when chart-of-accounts.service is fixed for schema
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { apiError } from '@/lib/api-response';
// import { chartOfAccountsService, CreateAccountInput } from '@/lib/accounting/chart-of-accounts.service';

// ============================================================================
// POST /api/accounting/accounts
// Create a new account
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    // TODO: Re-enable when chart-of-accounts.service is fixed for schema
    return NextResponse.json(
      { error: 'Account creation temporarily disabled due to schema migration' },
      { status: 503 }
    );
  } catch (error: any) {
    // Secure logging only
    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/accounting/accounts
// List accounts
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    // TODO: Re-enable when chart-of-accounts.service is fixed for schema
    return NextResponse.json(
      { error: 'Account listing temporarily disabled due to schema migration' },
      { status: 503 }
    );
  } catch (error: any) {
    // Secure logging only
    return NextResponse.json(
      { error: error.message || 'Failed to list accounts' },
      { status: 500 }
    );
  }
}
