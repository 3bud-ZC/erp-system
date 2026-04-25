import { apiSuccess, apiError } from '@/lib/api-response';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // Clear HttpOnly cookie
    const cookieStore = cookies();
    cookieStore.delete('token');

    return apiSuccess({}, 'تم تسجيل الخروج بنجاح');
  } catch (error: any) {
    // Secure logging only
    return apiError(error.message || 'فشل تسجيل الخروج', 500);
  }
}
