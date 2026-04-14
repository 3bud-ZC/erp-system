import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    database: false,
    tables: {} as Record<string, boolean>,
    missingTables: [] as string[],
    errors: [] as string[],
  };

  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;

    // Check critical tables
    const criticalTables = [
      'User', 'Role', 'Permission', 'Product', 'Warehouse',
      'SalesInvoice', 'PurchaseInvoice', 'Customer', 'Supplier', 'Expense'
    ];

    for (const table of criticalTables) {
      try {
        // @ts-ignore - dynamic table access
        await prisma[table.toLowerCase()].count();
        checks.tables[table] = true;
      } catch (e: any) {
        checks.tables[table] = false;
        checks.missingTables.push(table);
        checks.errors.push(`${table}: ${e.message}`);
      }
    }

    const allOk = checks.database && checks.missingTables.length === 0;

    return NextResponse.json({
      success: allOk,
      status: allOk ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    }, { status: allOk ? 200 : 503 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      status: 'error',
      error: error.message,
      checks,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
