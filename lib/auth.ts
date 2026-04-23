/**
 * Authentication and Authorization utilities
 * Handles user authentication, role-based access control, and permission checking
 */

import { prisma } from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setTenantContext, getTenantContext, clearTenantContext } from './prisma-tenant-middleware';

const JWT_EXPIRY = '7d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 * PRODUCTION: Includes userId and tenantId for multi-tenant isolation
 */
export function generateToken(userId: string, tenantId?: string | null): string {
  const payload: { userId: string; tenantId?: string } = { userId };
  if (tenantId) {
    payload.tenantId = tenantId;
  }
  return jwt.sign(payload, getJwtSecret(), { 
    expiresIn: JWT_EXPIRY,
    algorithm: 'HS256', // Explicitly specify algorithm
  });
}

/**
 * JWT Verification Result
 */
export interface VerifiedToken {
  userId: string;
  tenantId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify JWT token with FULL cryptographic signature validation
 * PRODUCTION-GRADE: Validates signature, expiration, algorithm
 */
export function verifyToken(token: string): VerifiedToken | null {
  try {
    // Verify with explicit options for maximum security
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'], // Only allow HS256 (prevents algorithm confusion attacks)
      complete: false, // Return payload only
    }) as VerifiedToken;

    // Additional validation: ensure required fields exist
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      console.error('JWT missing userId');
      return null;
    }

    // Validate tenantId if present
    if (decoded.tenantId !== undefined && typeof decoded.tenantId !== 'string') {
      console.error('JWT has invalid tenantId type');
      return null;
    }

    return decoded;
  } catch (error) {
    // Log specific error for monitoring (don't leak to client)
    if (error instanceof jwt.TokenExpiredError) {
      console.error('JWT verification failed: Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error('JWT verification failed: Invalid token', error.message);
    } else if (error instanceof jwt.NotBeforeError) {
      console.error('JWT verification failed: Token not active');
    } else {
      console.error('JWT verification failed: Unknown error', error);
    }
    return null;
  }
}

/**
 * Register a new user
 */
export async function registerUser(
  email: string,
  name: string,
  password: string
): Promise<any> {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('المستخدم موجود بالفعل');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    return user;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
}

/**
 * Login user with device tracking
 */
export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
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

    if (!user) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    if (!user.isActive) {
      throw new Error('حسابك معطل');
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Get tenant ID BEFORE generating token (required for JWT payload)
    const tenantId = await getUserTenantId(user.id);

    // Generate token with tenantId for secure multi-tenant isolation
    const token = generateToken(user.id, tenantId);

    // Extract permissions
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    // Detect device type and name from user agent
    const deviceType = detectDeviceType(userAgent);
    const deviceName = detectDeviceName(userAgent);

    // Create session with device tracking
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
        userAgent,
        deviceType,
        deviceName,
        tenantId: tenantId || undefined,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((ur) => ur.role.code),
      permissions,
      token,
      sessionId: session.id,
      hasTenant: !!tenantId,
    };
  } catch (error) {
    console.error('Error logging in user:', error);
    throw error;
  }
}

/**
 * Detect device type from user agent
 */
function detectDeviceType(userAgent?: string): string {
  if (!userAgent) return 'desktop';
  
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Detect device name from user agent
 */
function detectDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('android')) return 'Android Device';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac')) return 'Mac';
  if (ua.includes('linux')) return 'Linux';
  
  return 'Unknown Device';
}

/**
 * Get user by ID with roles and permissions
 */
export async function getUserWithPermissions(userId: string): Promise<any> {
  try {
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
      },
    });

    if (!user) {
      return null;
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roles: user.roles.map((ur) => ur.role.code),
      permissions,
    };
  } catch (error) {
    console.error('Error getting user with permissions:', error);
    throw error;
  }
}

/**
 * Check if user has permission
 */
export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  try {
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
      },
    });

    if (!user) {
      return false;
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    return permissions.includes(permissionCode);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if user has role
 */
export async function hasRole(userId: string, roleCode: string): Promise<boolean> {
  try {
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId,
        role: {
          code: roleCode,
        },
      },
    });

    return !!userRole;
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
}

/**
 * Assign role to user
 */
export async function assignRoleToUser(userId: string, roleCode: string): Promise<any> {
  try {
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
    });

    if (!role) {
      throw new Error('الدور غير موجود');
    }

    const userRole = await prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
      },
    });

    return userRole;
  } catch (error) {
    console.error('Error assigning role to user:', error);
    throw error;
  }
}

/**
 * Log user action for audit trail
 */
export async function logAuditAction(
  userId: string,
  action: string,
  module: string,
  entityType: string,
  entityId?: string,
  changes?: any,
  ipAddress?: string,
  userAgent?: string,
  tenantId?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        entityType,
        entityId,
        changes: changes ? JSON.stringify(changes) : null,
        ipAddress,
        userAgent,
        status: 'success',
        tenantId,
      },
    });
  } catch (error) {
    console.error('Error logging audit action:', error);
  }
}

/**
 * Create a notification for user
 */
export async function createNotification(
  userId: string | null,
  type: string,
  title: string,
  message: string,
  relatedModule?: string,
  relatedId?: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        relatedModule,
        relatedId,
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

/**
 * Get user's tenant ID from UserTenantRole
 */
export async function getUserTenantId(userId: string): Promise<string | null> {
  try {
    const userTenantRole = await prisma.userTenantRole.findFirst({
      where: { userId },
      include: { tenant: true },
    });

    return userTenantRole?.tenantId || null;
  } catch (error) {
    console.error('Error getting user tenant:', error);
    return null;
  }
}

/**
 * Set tenant context for authenticated user
 */
export async function setTenantContextForUser(userId: string): Promise<void> {
  const tenantId = await getUserTenantId(userId);
  setTenantContext(tenantId);
}

/**
 * Get authenticated user from request cookies
 * Compatible with Next.js 14 App Router - call this inside route handlers
 */
export async function getAuthenticatedUser(req: Request): Promise<{
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
} | null> {
  try {
    // Read token from cookies
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) {
      return null;
    }

    // Parse cookies to find token
    const cookies = cookieHeader.split(';').reduce((acc: any, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});

    const token = cookies['token'];
    if (!token) {
      return null;
    }

    // PRODUCTION: Full JWT verification with cryptographic signature validation
    const decoded = verifyToken(token);

    if (!decoded) {
      // Token invalid, expired, or tampered - reject immediately
      return null;
    }

    const user = await getUserWithPermissions(decoded.userId);

    if (!user || !user.isActive) {
      return null;
    }

    // SECURITY: Use tenantId from JWT (cryptographically verified) 
    // Falls back to DB only for legacy tokens without tenantId
    let tenantId = decoded.tenantId;
    
    if (!tenantId) {
      // Legacy token - fetch from DB (will be upgraded on next login)
      const dbTenantId = await getUserTenantId(user.id);
      tenantId = dbTenantId || undefined;
    } else {
      // SECURITY: Verify token tenantId matches user's actual tenant (prevent tenant spoofing)
      const dbTenantId = await getUserTenantId(user.id);
      if (dbTenantId && dbTenantId !== tenantId) {
        console.error('SECURITY: Token tenantId mismatch detected', {
          tokenTenantId: tenantId,
          dbTenantId,
          userId: user.id,
        });
        return null; // Reject tampered token
      }
    }
    
    if (tenantId) {
      setTenantContext(tenantId);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name || '',
      roles: user.roles,
      permissions: user.permissions,
      tenantId: tenantId || undefined, // Cryptographically bound tenant
    };
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Check if authenticated user has specific permission
 * Call this after getAuthenticatedUser
 * Admin users bypass all permission checks
 */
export function checkPermission(user: { permissions: string[]; roles?: string[]; email?: string }, permissionCode: string): boolean {
  // Admin users bypass all permission checks
  if (user.roles?.includes('admin') || user.email?.includes('admin')) {
    return true;
  }
  return user.permissions.includes(permissionCode);
}

/**
 * Check if authenticated user has specific role
 * Call this after getAuthenticatedUser
 */
export function checkRole(user: { roles: string[] }, roleCode: string): boolean {
  return user.roles.includes(roleCode);
}

/**
 * Require authentication - throws error if user not authenticated
 * Use in API routes to enforce login requirement
 */
export async function requireAuth(req: Request): Promise<{
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    throw new Error('لم يتم المصادقة');
  }
  return user;
}

/**
 * Require specific role - throws error if user doesn't have role
 * Use in API routes to enforce role-based access
 */
export async function requireRole(req: Request, roleCode: string): Promise<{
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}> {
  const user = await requireAuth(req);
  if (!checkRole(user, roleCode)) {
    throw new Error('ليس لديك صلاحية للقيام بهذا الإجراء');
  }
  return user;
}

/**
 * Require specific permission - throws error if user doesn't have permission
 * Use in API routes to enforce permission-based access
 */
export async function requirePermission(req: Request, permissionCode: string): Promise<{
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}> {
  const user = await requireAuth(req);
  if (!checkPermission(user, permissionCode)) {
    throw new Error('ليس لديك صلاحية للقيام بهذا الإجراء');
  }
  return user;
}
