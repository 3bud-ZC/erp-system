import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, createRequestLogger } from '@/lib/logger';
import { extractRequestMeta } from '@/lib/api/safe-response';

// Disable caching for health checks
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  duration: number;
  message?: string;
}

export async function GET(request: Request) {
  const meta = extractRequestMeta(request);
  const requestLogger = createRequestLogger(meta.requestId);
  const startTime = Date.now();
  const checks: HealthCheckResult[] = [];

  // Database health check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbDuration = Date.now() - dbStart;
    
    checks.push({
      name: 'database',
      status: dbDuration < 3000 ? 'healthy' : 'degraded',
      duration: dbDuration,
    });
  } catch (error) {
    checks.push({
      name: 'database',
      status: 'unhealthy',
      duration: 0,
      message: 'Database connection failed',
    });
  }

  // Memory usage check
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

    checks.push({
      name: 'memory',
      status: heapUsagePercent < 85 ? 'healthy' : 'degraded',
      duration: 0,
      message: `${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${heapUsagePercent.toFixed(1)}%)`,
    });
  } catch (error) {
    checks.push({
      name: 'memory',
      status: 'degraded',
      duration: 0,
      message: 'Unable to check memory usage',
    });
  }

  // Environment check
  try {
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    checks.push({
      name: 'environment',
      status: missingVars.length === 0 ? 'healthy' : 'unhealthy',
      duration: 0,
      message: missingVars.length > 0 ? `Missing: ${missingVars.join(', ')}` : undefined,
    });
  } catch (error) {
    checks.push({
      name: 'environment',
      status: 'degraded',
      duration: 0,
      message: 'Unable to check environment',
    });
  }

  // Overall status
  const overallStatus = checks.every(c => c.status === 'healthy')
    ? 'healthy'
    : checks.some(c => c.status === 'unhealthy')
    ? 'unhealthy'
    : 'degraded';

  const totalDuration = Date.now() - startTime;

  // Log health check
  requestLogger.info({
    type: 'health_check',
    status: overallStatus,
    checks: checks.map(c => ({ name: c.name, status: c.status, duration: c.duration })),
    duration: totalDuration,
  }, 'Health check completed');

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    duration: `${totalDuration}ms`,
    checks,
  };

  if (overallStatus === 'unhealthy') {
    return NextResponse.json(response, { status: 503 });
  }

  return NextResponse.json(response);
}
