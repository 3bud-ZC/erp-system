/**
 * Standardized API response format
 * Ensures consistent error handling across all API routes
 */

import { NextResponse } from 'next/server';

export function apiOnboardingRequired() {
  return NextResponse.json(
    { success: false, message: 'يجب إكمال إعداد النظام أولاً', code: 428, onboardingRequired: true },
    { status: 428 }
  );
}

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

  if (error?.message === 'ONBOARDING_REQUIRED') {
    return NextResponse.json(
      { success: false, message: 'يجب إكمال إعداد النظام أولاً', code: 428, onboardingRequired: true } as any,
      { status: 428 }
    ) as NextResponse<ApiErrorResponse>;
  }
  if (error?.message === 'NO_TENANT') return apiError('لا يوجد مستأجر مرتبط بالمستخدم', 403);

  // Prisma table does not exist
  if (error.code === 'P2021') {
    const tableName = error.meta?.table || 'unknown table';
    return apiError(
      `قاعدة البيانات غير مهيأة: الجدول ${tableName} غير موجود. يرجى تشغيل /api/init`,
      503,
      { code: 'P2021', table: tableName, initUrl: '/api/init' }
    );
  }

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
