/**
 * Authentication and Authorization utilities
 * Handles user authentication, role-based access control, and permission checking
 */

import { prisma } from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

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
 */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
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
 * Login user
 */
export async function loginUser(email: string, password: string): Promise<any> {
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

    // Generate token
    const token = generateToken(user.id);

    // Extract permissions
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((ur) => ur.role.code),
      permissions,
      token,
    };
  } catch (error) {
    console.error('Error logging in user:', error);
    throw error;
  }
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
  userAgent?: string
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
