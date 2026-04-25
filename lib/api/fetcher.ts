/**
 * Thin fetch wrapper for use with TanStack Query.
 * - Honors existing API contract: { success, data, message?, error?, meta? }
 * - Throws on { success: false } so React Query routes to onError
 * - Always sends credentials (cookie auth)
 *
 * Does NOT change any API; only standardizes how the UI consumes them.
 */

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string | { code?: string; message?: string };
  meta?: { page?: number; limit?: number; total?: number; timestamp?: string };
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function extractMessage(env: ApiEnvelope): string {
  if (typeof env.error === 'string') return env.error;
  if (env.error && typeof env.error === 'object' && env.error.message) return env.error.message;
  return env.message || 'فشل الطلب';
}

export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    if (!res.ok) {
      throw new ApiError('تعذر الاتصال بالخادم', res.status);
    }
    return undefined as unknown as T;
  }

  if (!res.ok || body?.success === false) {
    const code =
      body && typeof body.error === 'object' && body.error?.code
        ? body.error.code
        : undefined;
    throw new ApiError(extractMessage(body || { success: false }), res.status, code);
  }

  // Most APIs put payload under .data; pass through if not enveloped.
  return (body && 'data' in body ? (body.data as T) : (body as unknown as T));
}

export function apiGet<T = unknown>(url: string) {
  return apiFetch<T>(url, { method: 'GET' });
}
export function apiPost<T = unknown>(url: string, body?: unknown) {
  return apiFetch<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}
export function apiPut<T = unknown>(url: string, body?: unknown) {
  return apiFetch<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
}
export function apiDelete<T = unknown>(url: string) {
  return apiFetch<T>(url, { method: 'DELETE' });
}
