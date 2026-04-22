/**
 * Authorization Middleware - Production-Grade
 * Enforces RBAC on every API route
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizationService, Permission } from './authorization.service';

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

export interface AuthContext {
  userId: string;
  tenantId: string;
  permissions: Permission[];
  roles: string[];
}

// ============================================================================
// AUTHORIZATION ERROR
// ============================================================================

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Check if user has required permission
 * Throws AuthorizationError if not authorized
 */
export async function requirePermission(
  authContext: AuthContext,
  permission: Permission
): Promise<void> {
  const hasPermission = await authorizationService.hasPermission(
    authContext.userId,
    authContext.tenantId,
    permission
  );

  if (!hasPermission) {
    throw new AuthorizationError(
      `Permission denied: ${permission} required`,
      403
    );
  }
}

/**
 * Check if user has any of the required permissions
 * Throws AuthorizationError if not authorized
 */
export async function requireAnyPermission(
  authContext: AuthContext,
  permissions: Permission[]
): Promise<void> {
  const hasPermission = await authorizationService.hasAnyPermission(
    authContext.userId,
    authContext.tenantId,
    permissions
  );

  if (!hasPermission) {
    throw new AuthorizationError(
      `Permission denied: one of [${permissions.join(', ')}] required`,
      403
    );
  }
}

/**
 * Check if user has all of the required permissions
 * Throws AuthorizationError if not authorized
 */
export async function requireAllPermissions(
  authContext: AuthContext,
  permissions: Permission[]
): Promise<void> {
  const hasPermission = await authorizationService.hasAllPermissions(
    authContext.userId,
    authContext.tenantId,
    permissions
  );

  if (!hasPermission) {
    throw new AuthorizationError(
      `Permission denied: all of [${permissions.join(', ')}] required`,
      403
    );
  }
}

// ============================================================================
// NEXT.JS MIDDLEWARE HELPERS
// ============================================================================

/**
 * Helper to extract auth context from request
 * This would integrate with your authentication system
 * For now, it's a placeholder - you need to implement based on your auth system
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  // TODO: Implement based on your authentication system
  // This is a placeholder - you need to:
  // 1. Extract user ID from JWT token or session
  // 2. Extract tenant ID from token or request headers
  // 3. Fetch user permissions and roles
  
  // Placeholder implementation - replace with actual auth logic
  const authHeader = request.headers.get('authorization');
  const tenantHeader = request.headers.get('x-tenant-id');
  
  if (!authHeader || !tenantHeader) {
    throw new AuthorizationError('Authentication required', 401);
  }

  // This would typically decode a JWT and extract userId
  const userId = authHeader.replace('Bearer ', '');
  const tenantId = tenantHeader;
  
  // Fetch permissions and roles
  const [permissions, roles] = await Promise.all([
    authorizationService.getUserPermissions(userId, tenantId),
    authorizationService.getUserRoles(userId, tenantId),
  ]);

  return {
    userId,
    tenantId,
    permissions,
    roles,
  };
}

/**
 * Middleware factory to require a specific permission
 */
export function withPermission(permission: Permission) {
  return async (request: NextRequest) => {
    try {
      const authContext = await getAuthContext(request);
      await requirePermission(authContext, permission);
      return authContext;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      throw error;
    }
  };
}

/**
 * Middleware factory to require any of the specified permissions
 */
export function withAnyPermission(permissions: Permission[]) {
  return async (request: NextRequest) => {
    try {
      const authContext = await getAuthContext(request);
      await requireAnyPermission(authContext, permissions);
      return authContext;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      throw error;
    }
  };
}

/**
 * Middleware factory to require all of the specified permissions
 */
export function withAllPermissions(permissions: Permission[]) {
  return async (request: NextRequest) => {
    try {
      const authContext = await getAuthContext(request);
      await requireAllPermissions(authContext, permissions);
      return authContext;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      throw error;
    }
  };
}

// ============================================================================
// API ROUTE WRAPPER
// ============================================================================

/**
 * Wrapper for API route handlers that enforces authorization
 * Usage:
 * 
 * export const GET = withAuth(async (request, authContext) => {
 *   const data = await someService.getData(authContext.tenantId);
 *   return NextResponse.json(data);
 * }, PERMISSIONS.ACCOUNTING_READ);
 */
export function withAuth(
  handler: (request: NextRequest, authContext: AuthContext) => Promise<NextResponse>,
  requiredPermission?: Permission | Permission[],
  requireAll = false
) {
  return async (request: NextRequest) => {
    try {
      const authContext = await getAuthContext(request);

      // Check permissions
      if (requiredPermission) {
        if (Array.isArray(requiredPermission)) {
          if (requireAll) {
            await requireAllPermissions(authContext, requiredPermission);
          } else {
            await requireAnyPermission(authContext, requiredPermission);
          }
        } else {
          await requirePermission(authContext, requiredPermission);
        }
      }

      // Call the handler
      return await handler(request, authContext);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      
      // Log unexpected errors
      console.error('Authorization middleware error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// ============================================================================
// PERMISSION DECORATOR (for use in service layer)
// ============================================================================

/**
 * Decorator to check permission before executing a service method
 * Usage:
 * 
 * class MyService {
 *   @RequirePermission(PERMISSIONS.ACCOUNTING_WRITE)
 *   async updateAccount(data: any) {
 *     // Method implementation
 *   }
 * }
 */
export function RequirePermission(permission: Permission) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const authContext = args[0]; // Assume first arg is auth context
      
      if (!authContext || !authContext.userId || !authContext.tenantId) {
        throw new AuthorizationError('Authentication context required', 401);
      }

      await requirePermission(authContext, permission);

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Decorator to check any permission before executing a service method
 */
export function RequireAnyPermission(permissions: Permission[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const authContext = args[0]; // Assume first arg is auth context
      
      if (!authContext || !authContext.userId || !authContext.tenantId) {
        throw new AuthorizationError('Authentication context required', 401);
      }

      await requireAnyPermission(authContext, permissions);

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
