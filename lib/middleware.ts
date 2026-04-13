/**
 * Middleware for authentication and authorization checks
 * Used in API routes to verify user identity and permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';
import { prisma } from './db';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    roles: string[];
    permissions: string[];
  };
}

/**
 * Middleware to verify authentication token
 */
export async function withAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      const authHeader = req.headers.get('authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'لم يتم توفير توكن المصادقة' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      if (!decoded) {
        return NextResponse.json(
          { error: 'توكن المصادقة غير صحيح أو منتهي الصلاحية' },
          { status: 401 }
        );
      }

      // Get user with permissions
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user || !user.isActive) {
        return NextResponse.json(
          { error: 'المستخدم غير موجود أو معطل' },
          { status: 401 }
        );
      }

      // Attach user to request
      const authReq = req as AuthenticatedRequest;
      authReq.user = {
        id: user.id,
        email: user.email,
        name: user.name || '',
        roles: user.roles.map((ur) => ur.role.code),
        permissions: user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.code)
        ),
      };

      return handler(authReq);
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.json(
        { error: 'خطأ في المصادقة' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware to check if user has specific permission
 */
export function requirePermission(permissionCode: string) {
  return (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) => {
    return async (req: AuthenticatedRequest) => {
      if (!req.user) {
        return NextResponse.json(
          { error: 'لم يتم المصادقة' },
          { status: 401 }
        );
      }

      if (!req.user.permissions.includes(permissionCode)) {
        return NextResponse.json(
          { error: 'ليس لديك صلاحية للقيام بهذا الإجراء' },
          { status: 403 }
        );
      }

      return handler(req);
    };
  };
}

/**
 * Middleware to check if user has specific role
 */
export function requireRole(roleCode: string) {
  return (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) => {
    return async (req: AuthenticatedRequest) => {
      if (!req.user) {
        return NextResponse.json(
          { error: 'لم يتم المصادقة' },
          { status: 401 }
        );
      }

      if (!req.user.roles.includes(roleCode)) {
        return NextResponse.json(
          { error: 'ليس لديك الدور المطلوب للقيام بهذا الإجراء' },
          { status: 403 }
        );
      }

      return handler(req);
    };
  };
}

/**
 * Middleware to check if user has any of the specified roles
 */
export function requireAnyRole(roleCodes: string[]) {
  return (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) => {
    return async (req: AuthenticatedRequest) => {
      if (!req.user) {
        return NextResponse.json(
          { error: 'لم يتم المصادقة' },
          { status: 401 }
        );
      }

      const hasRole = req.user.roles.some((role) => roleCodes.includes(role));
      if (!hasRole) {
        return NextResponse.json(
          { error: 'ليس لديك أحد الأدوار المطلوبة للقيام بهذا الإجراء' },
          { status: 403 }
        );
      }

      return handler(req);
    };
  };
}
