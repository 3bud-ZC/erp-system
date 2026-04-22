import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, createRequestLogger } from '@/lib/logger';
import { extractRequestMeta } from '@/lib/api/safe-response';

export const dynamic = 'force-dynamic';

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
}

export async function GET(request: Request) {
  const meta = extractRequestMeta(request);
  const requestLogger = createRequestLogger(meta.requestId);
  const startTime = Date.now();
  
  const checks = {
    database: false,
    tables: {} as Record<string, boolean>,
    missingTables: [] as string[],
    errors: [] as string[],
    memory: {
      status: 'unknown' as 'healthy' | 'degraded' | 'unhealthy' | 'unknown',
      heapUsed: '',
      heapTotal: '',
      usage: '',
    },
    uptime: {
      seconds: 0,
      formatted: '',
    },
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

    // Memory check
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      checks.memory = {
        status: heapUsagePercent < 80 ? 'healthy' : heapUsagePercent < 95 ? 'degraded' : 'unhealthy',
        heapUsed: `${heapUsedMB.toFixed(2)}MB`,
        heapTotal: `${heapTotalMB.toFixed(2)}MB`,
        usage: `${heapUsagePercent.toFixed(1)}%`,
      };
    } catch (e) {
      checks.errors.push('Memory check failed');
    }
    
    // Uptime
    checks.uptime = {
      seconds: Math.floor(process.uptime()),
      formatted: formatUptime(process.uptime()),
    };
    
    const allOk = checks.database && checks.missingTables.length === 0 && checks.memory.status !== 'unhealthy';
    const totalDuration = Date.now() - startTime;
    
    // Log detailed health check
    requestLogger.info({
      type: 'health_check_detailed',
      status: allOk ? 'healthy' : 'unhealthy',
      duration: totalDuration,
      checks: {
        database: checks.database,
        tableCount: Object.keys(checks.tables).length,
        missingTables: checks.missingTables.length,
        memory: checks.memory,
        uptime: checks.uptime,
      },
    }, 'Detailed health check completed');

    return NextResponse.json({
      success: allOk,
      status: allOk ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
      duration: `${totalDuration}ms`,
      requestId: meta.requestId,
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
