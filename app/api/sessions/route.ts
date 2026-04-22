import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get user's active sessions
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);

    const sessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    return apiSuccess(sessions, 'Sessions fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch sessions');
  }
}

// DELETE - Revoke specific session
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return apiError('Session ID is required', 400);
    }

    // Verify session belongs to user
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== user.id) {
      return apiError('Session not found', 404);
    }

    // Revoke session
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'REVOKE_SESSION', 'auth', 'Session', sessionId,
      { deviceId: session.deviceName },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(null, 'Session revoked successfully');
  } catch (error) {
    return handleApiError(error, 'Revoke session');
  }
}
