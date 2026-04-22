/**
 * Common Types
 */

export interface PaginationParams {
  limit?: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    previousCursor?: string;
    limit: number;
    total: number;
  };
}

export interface ApiResponse<T> {
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
