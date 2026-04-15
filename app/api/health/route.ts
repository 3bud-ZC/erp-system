import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for health checks
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database connection failed'
    }, { status: 500 });
  }
}
