/**
 * CENTRALIZED AUTHENTICATION GUARD
 * Production-grade JWT verification with full signature validation
 * 
 * Usage:
 *   const auth = requireAuth(request);
 *   // auth.userId, auth.tenantId are now cryptographically verified
 * 
 * Throws on any authentication failure - never returns null/undefined
 */

import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { setTenantContext } from '@/lib/prisma-tenant-middleware';

// JWT Configuration
const JWT_SECRET: string = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Authentication Errors
 * Use these for type-safe error handling
 */
export class AuthError extends Error {
  constructor(
    public code: 'UNAUTHORIZED' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'TENANT_MISMATCH' | 'USER_INACTIVE',
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Authenticated User Context
 * Everything you need from a verified JWT
 */
export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  iat: number; // Issued at
  exp: number; // Expiration
}

/**
 * Extract token from request cookies
 */
function extractToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  // Parse cookies manually (works in Edge runtime)
  const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie) => {
    const [key, ...valueParts] = cookie.trim().split('=');
    if (key && valueParts.length > 0) {
      acc[key] = valueParts.join('='); // Handle values with = in them
    }
    return acc;
  }, {});

  return cookies['token'] || null;
}

/**
 * JWT Payload interface
 */
interface JWTPayload {
  userId: string;
  tenantId?: string;
  iat: number;
  exp: number;
}

/**
 * Verify JWT with FULL cryptographic signature validation
 * PRODUCTION-GRADE: Uses jsonwebtoken library with strict options
 */
function verifyJWT(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'], // STRICT: Only allow HS256 (prevents algorithm confusion attacks)
      complete: false,
    }) as unknown as JWTPayload;

    // Validate required fields
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      throw new AuthError('INVALID_TOKEN', 'Token missing userId');
    }

    if (!decoded.exp || typeof decoded.exp !== 'number') {
      throw new AuthError('INVALID_TOKEN', 'Token missing expiration');
    }

    // Check expiration explicitly (belt and suspenders)
    if (decoded.exp * 1000 < Date.now()) {
      throw new AuthError('EXPIRED_TOKEN', 'Token has expired');
    }

    return decoded;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    // Convert jsonwebtoken errors to AuthError
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError('EXPIRED_TOKEN', 'Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError('INVALID_TOKEN', `Invalid token: ${error.message}`);
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new AuthError('INVALID_TOKEN', 'Token not yet active');
    }
    
    throw new AuthError('INVALID_TOKEN', 'Token verification failed');
  }
}

/**
 * Get user from database with roles and permissions
 */
async function getUserWithAuth(userId: string): Promise<{
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  tenantId: string | null;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
      userTenantRoles: {
        take: 1,
        select: {
          tenantId: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Type-safe extraction of roles and permissions
  type UserRoleWithRelations = typeof user.roles[number];
  type RolePermissionWithRelations = UserRoleWithRelations['role']['permissions'][number];

  const roles: string[] = user.roles.map((ur: UserRoleWithRelations) => ur.role.code);
  const permissions: string[] = user.roles.flatMap((ur: UserRoleWithRelations) =>
    ur.role.permissions.map((rp: RolePermissionWithRelations) => rp.permission.code)
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    isActive: user.isActive,
    roles,
    permissions,
    tenantId: user.userTenantRoles[0]?.tenantId || null,
  };
}

/**
 * ============================================================================
 * MAIN EXPORT: requireAuth
 * ============================================================================
 * 
 * Centralized authentication guard that:
 * 1. Extracts JWT from cookies
 * 2. Verifies cryptographic signature (HS256 only)
 * 3. Validates expiration
 * 4. Loads user from database
 * 5. Verifies user is active
 * 6. Validates tenant binding (anti-spoofing)
 * 7. Sets tenant context for database queries
 * 
 * NEVER RETURNS NULL - always throws on failure
 * 
 * @throws AuthError with specific error codes
 */
export async function requireAuth(request: Request): Promise<AuthContext> {
  // Step 1: Extract token
  const token = extractToken(request);
  
  if (!token) {
    throw new AuthError('UNAUTHORIZED', 'No authentication token provided');
  }

  // Step 2: Verify JWT (cryptographic signature validation)
  const decoded = verifyJWT(token);

  // Step 3: Load user from database
  const user = await getUserWithAuth(decoded.userId);

  if (!user) {
    throw new AuthError('UNAUTHORIZED', 'User not found');
  }

  // Step 4: Verify user is active
  if (!user.isActive) {
    throw new AuthError('USER_INACTIVE', 'User account is deactivated');
  }

  // Step 5: Validate tenant binding (CRITICAL for multi-tenant security)
  let tenantId: string;

  if (decoded.tenantId) {
    // Token has tenantId - verify it matches database (anti-spoofing)
    if (user.tenantId && user.tenantId !== decoded.tenantId) {
      console.error('SECURITY: Tenant mismatch detected', {
        userId: user.id,
        tokenTenantId: decoded.tenantId,
        dbTenantId: user.tenantId,
      });
      throw new AuthError('TENANT_MISMATCH', 'Invalid tenant context');
    }
    tenantId = decoded.tenantId;
  } else {
    // Legacy token without tenantId - use database value
    if (!user.tenantId) {
      throw new AuthError('UNAUTHORIZED', 'User not assigned to any tenant');
    }
    tenantId = user.tenantId;
  }

  // Step 6: Set tenant context for all subsequent database queries
  setTenantContext(tenantId);

  // Return verified authentication context
  return {
    userId: user.id,
    tenantId,
    email: user.email,
    name: user.name,
    roles: user.roles,
    permissions: user.permissions,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}

/**
 * ============================================================================
 * requireAuthWithPermission
 * ============================================================================
 * Like requireAuth but also checks for specific permission
 * 
 * @throws AuthError if user lacks required permission
 */
export async function requireAuthWithPermission(
  request: Request,
  permissionCode: string
): Promise<AuthContext> {
  const auth = await requireAuth(request);

  // Admin bypass
  if (auth.roles.includes('admin')) {
    return auth;
  }

  if (!auth.permissions.includes(permissionCode)) {
    throw new AuthError('UNAUTHORIZED', `Missing required permission: ${permissionCode}`);
  }

  return auth;
}

/**
 * ============================================================================
 * requireAuthWithRole
 * ============================================================================
 * Like requireAuth but also checks for specific role
 * 
 * @throws AuthError if user lacks required role
 */
export async function requireAuthWithRole(
  request: Request,
  roleCode: string
): Promise<AuthContext> {
  const auth = await requireAuth(request);

  if (!auth.roles.includes(roleCode)) {
    throw new AuthError('UNAUTHORIZED', `Missing required role: ${roleCode}`);
  }

  return auth;
}

/**
 * ============================================================================
 * requireAuthWithAnyRole
 * ============================================================================
 * Like requireAuth but checks for ANY of the specified roles
 * 
 * @throws AuthError if user lacks all specified roles
 */
export async function requireAuthWithAnyRole(
  request: Request,
  roleCodes: string[]
): Promise<AuthContext> {
  const auth = await requireAuth(request);

  // Admin bypass
  if (auth.roles.includes('admin')) {
    return auth;
  }

  const hasAnyRole = roleCodes.some((role) => auth.roles.includes(role));
  
  if (!hasAnyRole) {
    throw new AuthError(
      'UNAUTHORIZED',
      `Missing required role. Need one of: ${roleCodes.join(', ')}`
    );
  }

  return auth;
}

/**
 * ============================================================================
 * isAuthenticated (non-throwing version)
 * ============================================================================
 * Use this when you want to check auth without throwing
 * Returns null instead of throwing on failure
 */
export async function isAuthenticated(request: Request): Promise<AuthContext | null> {
  try {
    return await requireAuth(request);
  } catch {
    return null;
  }
}

/**
 * ============================================================================
 * handleAuthError
 * ============================================================================
 * Helper to convert AuthError to API response
 */
export function handleAuthError(error: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (error instanceof AuthError) {
    const statusMap: Record<AuthError['code'], number> = {
      UNAUTHORIZED: 401,
      INVALID_TOKEN: 401,
      EXPIRED_TOKEN: 401,
      TENANT_MISMATCH: 403,
      USER_INACTIVE: 403,
    };

    return {
      status: statusMap[error.code],
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  // Unknown error
  return {
    status: 500,
    body: {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  };
}
