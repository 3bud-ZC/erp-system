/**
 * RESILIENCE HEALTH API
 * Returns complete system health status
 */

import { NextResponse } from 'next/server';
import { ResilienceLayer } from '@/lib/resilience';
import { healthEngine } from '@/lib/resilience';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get health report
    const health = await healthEngine.getHealthReport();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      health,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
