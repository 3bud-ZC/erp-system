import { apiSuccess, apiError } from '@/lib/api-response';
import { loginUser, logAuditAction } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return apiError('البريد الإلكتروني وكلمة المرور مطلوبان', 400);
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

    // Set HttpOnly cookie with JWT token
    const cookieStore = cookies();
    cookieStore.set('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Return user data without token (token is in cookie)
    const { token, ...userData } = result;
    return apiSuccess(userData, 'تم تسجيل الدخول بنجاح');
  } catch (error: any) {
    console.error('Login error:', error);
    return apiError(error.message || 'فشل تسجيل الدخول', 401);
  }
}
