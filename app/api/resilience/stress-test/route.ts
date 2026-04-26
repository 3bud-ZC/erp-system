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

import { stressTestEngine, StressTestType } from '@/lib/resilience';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request
    const preset = body.preset || 'MEDIUM';
    const validPresets = ['LIGHT', 'MEDIUM', 'HEAVY'];
    
    if (!validPresets.includes(preset)) {
      return apiError(`Invalid preset: ${preset}. Use LIGHT, MEDIUM, or HEAVY.`, 400);
    }

    // Check if test already running
    if (stressTestEngine.isRunning()) {
      return apiError('Test already running', 409, {
        currentTest: stressTestEngine.getCurrentTest(),
      });
    }

    logger.warn({ preset }, '🚨 Stress test starting');

    // Run the test
    const result = await stressTestEngine.runQuickTest(preset);

    return apiSuccess(result);

  } catch (error: any) {
    logger.error({ error: error.message }, 'Stress test failed');
    return apiError(error.message || 'Stress test failed', 500);
  }
}

export async function GET() {
  // Return current test status
  return apiSuccess({
    running: stressTestEngine.isRunning(),
    currentTest: stressTestEngine.getCurrentTest(),
  });
}
