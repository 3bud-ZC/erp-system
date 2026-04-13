/**
 * API Client Utility
 * Provides safe API calls with proper error handling and data extraction
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Safely fetch data from API with authentication
 * Handles both wrapped ({success, data}) and unwrapped responses
 */
export async function fetchApi<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  const result = await response.json();

  // Handle wrapped response format {success: true, data: ...}
  if (result && typeof result === 'object' && 'success' in result) {
    return result.data as T;
  }

  // Handle direct response
  return result as T;
}

/**
 * Safely extract array from API response
 * Always returns an array, never undefined
 */
export function safeArray<T>(data: T[] | undefined | null): T[] {
  return Array.isArray(data) ? data : [];
}

/**
 * Safely extract object from API response
 * Returns empty object if undefined/null
 */
export function safeObject<T extends object>(data: T | undefined | null, defaults: Partial<T> = {}): T {
  return (data && typeof data === 'object' ? { ...defaults, ...data } : defaults) as T;
}
