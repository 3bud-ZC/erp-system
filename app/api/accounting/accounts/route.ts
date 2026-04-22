/**
 * Accounts API Routes
 * REST endpoints for chart of accounts management
 * TODO: Re-enable when chart-of-accounts.service is fixed for schema
 */

import { NextRequest, NextResponse } from 'next/server';
// import { chartOfAccountsService, CreateAccountInput } from '@/lib/accounting/chart-of-accounts.service';

// ============================================================================
// POST /api/accounting/accounts
// Create a new account
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // TODO: Re-enable when chart-of-accounts.service is fixed for schema
    return NextResponse.json(
      { error: 'Account creation temporarily disabled due to schema migration' },
      { status: 503 }
    );
  } catch (error: any) {
    console.error('Error creating account:', error);
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
    // TODO: Re-enable when chart-of-accounts.service is fixed for schema
    return NextResponse.json(
      { error: 'Account listing temporarily disabled due to schema migration' },
      { status: 503 }
    );
  } catch (error: any) {
    console.error('Error listing accounts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list accounts' },
      { status: 500 }
    );
  }
}
