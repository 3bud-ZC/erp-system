import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List all users (ADMIN only)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    // Only ADMIN can list users
    if (!checkRole(user, 'ADMIN')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        roles: {
          include: {
            role: {
              select: {
                code: true,
                nameAr: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(users, 'Users fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch users');
  }
}

// POST - Create new user (ADMIN only)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    // Only ADMIN can create users
    if (!checkRole(user, 'ADMIN')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const { email, name, password, role } = body;

    // Validate required fields
    if (!email || !name || !password) {
      return apiError('البريد الإلكتروني والاسم وكلمة المرور مطلوبة', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError('تنسيق البريد الإلكتروني غير صالح', 400);
    }

    // Validate password strength (min 8 characters)
    if (password.length < 8) {
      return apiError('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 400);
    }

    // Validate role if provided
    const validRoles = ['ADMIN', 'ACCOUNTANT', 'USER'];
    if (role && !validRoles.includes(role)) {
      return apiError('صلاحية غير صالحة', 400);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return apiError('المستخدم موجود بالفعل', 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Assign role if specified
    if (role) {
      const roleRecord = await prisma.role.findUnique({
        where: { code: role },
      });

      if (roleRecord) {
        await prisma.userRole.create({
          data: {
            userId: newUser.id,
            roleId: roleRecord.id,
          },
        });
      }
    }

    // Log activity for audit trail
    await logActivity({
      entity: 'User',
      entityId: newUser.id,
      action: 'CREATE',
      userId: user.id,
      after: { ...newUser, role },
    });

    return apiSuccess(newUser, 'User created successfully');
  } catch (error) {
    return handleApiError(error, 'Create user');
  }
}

// PUT - Update user (ADMIN only)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    // Only ADMIN can update users
    if (!checkRole(user, 'ADMIN')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const { id, name, email, isActive, role } = body;

    if (!id) {
      return apiError('معرف المستخدم مطلوب', 400);
    }

    // Prevent role escalation: user cannot change their own role
    if (id === user.id && role) {
      return apiError('لا يمكن تغيير صلاحيتك الخاصة', 403);
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return apiError('تنسيق البريد الإلكتروني غير صالح', 400);
      }
    }

    // Validate role if provided
    const validRoles = ['ADMIN', 'ACCOUNTANT', 'USER'];
    if (role && !validRoles.includes(role)) {
      return apiError('صلاحية غير صالحة', 400);
    }

    // Fetch existing user for activity logging
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    if (!existingUser) {
      return apiError('المستخدم غير موجود', 404);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Update role if specified
    if (role) {
      const roleRecord = await prisma.role.findUnique({
        where: { code: role },
      });

      if (roleRecord) {
        // Remove existing roles
        await prisma.userRole.deleteMany({
          where: { userId: id },
        });

        // Assign new role
        await prisma.userRole.create({
          data: {
            userId: id,
            roleId: roleRecord.id,
          },
        });
      }
    }

    // Log activity for audit trail
    await logActivity({
      entity: 'User',
      entityId: id,
      action: 'UPDATE',
      userId: user.id,
      before: existingUser,
      after: { ...updatedUser, role },
    });

    return apiSuccess(updatedUser, 'User updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update user');
  }
}

// DELETE - Deactivate user (ADMIN only)
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    // Only ADMIN can deactivate users
    if (!checkRole(user, 'ADMIN')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('معرف المستخدم مطلوب', 400);
    }

    // Prevent self-deletion
    if (id === user.id) {
      return apiError('لا يمكن حذف حسابك الخاص', 403);
    }

    // Fetch existing user for activity logging
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    if (!existingUser) {
      return apiError('المستخدم غير موجود', 404);
    }

    // Deactivate user (soft delete)
    const deactivatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    // Log activity for audit trail
    await logActivity({
      entity: 'User',
      entityId: id,
      action: 'DELETE',
      userId: user.id,
      before: existingUser,
    });

    return apiSuccess(deactivatedUser, 'User deactivated successfully');
  } catch (error) {
    return handleApiError(error, 'Deactivate user');
  }
}
