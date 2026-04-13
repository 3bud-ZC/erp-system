import { NextResponse } from 'next/server';
import { loginUser, logAuditAction } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      );
    }

    // Login user
    const result = await loginUser(email, password);

    // Log audit action
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    await logAuditAction(
      result.id,
      'LOGIN',
      'auth',
      'User',
      undefined,
      undefined,
      ipAddress,
      userAgent
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error.message || 'فشل تسجيل الدخول' },
      { status: 401 }
    );
  }
}
