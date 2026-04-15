/**
 * API Client Utility
 * Provides safe API calls with proper error handling and data extraction
 * Includes authentication token from localStorage
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Get auth token from localStorage (client-side only)
 */
function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

/**
 * Get authenticated headers for fetch requests
 * Returns headers object with Authorization if token exists
 */
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
}

/**
 * Get authenticated headers for non-JSON requests (like DELETE)
 */
export function getAuthHeadersOnly(): HeadersInit {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Safely fetch data from API
 * Handles both wrapped ({success, data}) and unwrapped responses
 * Automatically includes auth token from localStorage
 */
export async function fetchApi<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
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
