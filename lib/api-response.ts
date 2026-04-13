/**
 * Standardized API response format
 * Ensures consistent error handling across all API routes
 */

import { NextResponse } from 'next/server';

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: number;
  details?: any;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Create a standardized error response
 */
export function apiError(message: string, code: number = 500, details?: any): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      message,
      code,
      ...(details && { details }),
    },
    { status: code }
  );
}

/**
 * Create a standardized success response
 */
export function apiSuccess<T>(data: T, message?: string): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message }),
  });
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: any, context: string = 'Operation'): NextResponse<ApiErrorResponse> {
  console.error(`${context} error:`, error);
  
  // Prisma unique constraint violation
  if (error.code === 'P2002') {
    return apiError('هذا العنصر موجود بالفعل', 409);
  }
  
  // Prisma record not found
  if (error.code === 'P2025') {
    return apiError('العنصر المطلوب غير موجود', 404);
  }
  
  // Prisma foreign key constraint
  if (error.code === 'P2003') {
    return apiError('علاقة مرجعية غير صحيحة', 400);
  }
  
  // Custom error with message
  if (error.message) {
    return apiError(error.message, 400);
  }
  
  // Generic error
  return apiError(`${context} failed`, 500);
}
