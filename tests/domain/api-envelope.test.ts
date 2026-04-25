/**
 * API envelope contract test (type-level + runtime).
 *
 * Asserts the canonical response shape used across all /api routes:
 *   { success: boolean, data?: any, message?: string, error?: string | object, meta?: ... }
 *
 * Runtime test exercises the real apiSuccess / apiError helpers from
 * lib/api-response so future drift is caught here.
 */
import { describe, it, expect } from 'vitest';
import { apiSuccess, apiError } from '@/lib/api-response';

async function readEnvelope(res: Response) {
  const body = await res.json();
  return body as {
    success: boolean;
    data?: unknown;
    message?: string;
    error?: unknown;
    meta?: unknown;
  };
}

describe('API response envelope contract', () => {
  it('apiSuccess returns success:true with data and message', async () => {
    const res = apiSuccess({ id: 'x' }, 'ok');
    expect(res.status).toBe(200);
    const env = await readEnvelope(res);
    expect(env.success).toBe(true);
    expect(env.data).toEqual({ id: 'x' });
    expect(env.message).toBe('ok');
  });

  it('apiError returns success:false with a non-empty message', async () => {
    const res = apiError('boom', 400);
    expect(res.status).toBe(400);
    const env = await readEnvelope(res);
    expect(env.success).toBe(false);
    expect(typeof env.message === 'string' || typeof env.error === 'string').toBe(
      true
    );
  });

  it('apiError preserves a default 500 status when none supplied', async () => {
    const res = apiError('explode');
    expect(res.status).toBe(500);
    const env = await readEnvelope(res);
    expect(env.success).toBe(false);
  });
});
