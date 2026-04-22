/**
 * RESILIENCE STRESS TEST API
 * Run controlled stress tests
 * 
 * Query params:
 * - preset: LIGHT | MEDIUM | HEAVY
 * - type: LOGIN | INVOICE_CREATE | PRODUCT_READ | MIXED | FAILURE_INJECTION
 * - concurrentUsers: number
 * - requestsPerUser: number
 * - duration: seconds
 */

import { NextResponse } from 'next/server';
import { stressTestEngine, StressTestType } from '@/lib/resilience';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request
    const preset = body.preset || 'MEDIUM';
    const validPresets = ['LIGHT', 'MEDIUM', 'HEAVY'];
    
    if (!validPresets.includes(preset)) {
      return NextResponse.json(
        { success: false, error: `Invalid preset: ${preset}. Use LIGHT, MEDIUM, or HEAVY.` },
        { status: 400 }
      );
    }

    // Check if test already running
    if (stressTestEngine.isRunning()) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Test already running',
          currentTest: stressTestEngine.getCurrentTest(),
        },
        { status: 409 }
      );
    }

    logger.warn({ preset }, '🚨 Stress test starting');

    // Run the test
    const result = await stressTestEngine.runQuickTest(preset);

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error: any) {
    logger.error({ error: error.message }, 'Stress test failed');
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return current test status
  return NextResponse.json({
    running: stressTestEngine.isRunning(),
    currentTest: stressTestEngine.getCurrentTest(),
  });
}
