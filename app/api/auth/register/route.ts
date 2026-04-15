import { apiSuccess, apiError } from '@/lib/api-response';
import { registerUser, assignRoleToUser, logAuditAction } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, password, confirmPassword } = body;

    // Validate input
    if (!email || !name || !password || !confirmPassword) {
      return apiError('جميع الحقول مطلوبة', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError('البريد الإلكتروني غير صحيح', 400);
    }

    // Validate password length
    if (password.length < 8) {
      return apiError('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 400);
    }

    // Validate password match
    if (password !== confirmPassword) {
      return apiError('كلمات المرور غير متطابقة', 400);
    }

    // Register user
    const user = await registerUser(email, name, password);

    // Assign default role (e.g., 'user' or 'sales_rep')
    try {
      await assignRoleToUser(user.id, 'sales_rep');
    } catch (error) {
      console.error('Error assigning default role:', error);
    }

    // Log audit action
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    await logAuditAction(
      user.id,
      'REGISTER',
      'auth',
      'User',
      undefined,
      undefined,
      ipAddress,
      userAgent
    );

    return apiSuccess({ user }, 'تم التسجيل بنجاح');
  } catch (error: any) {
    console.error('Registration error:', error);
    return apiError(error.message || 'فشل التسجيل', 400);
  }
}
