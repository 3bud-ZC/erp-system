/**
 * PRODUCTION SYSTEM BOOTSTRAP
 * 
 * Security features:
 * - NO hardcoded passwords
 * - Uses environment variables or secure random generation
 * - Passwords logged once on creation (must be changed immediately)
 * - Idempotent operations only
 */

import { prisma } from './db';
import bcrypt from 'bcryptjs';
import { logger } from './logger';
import crypto from 'crypto';
import { getSystemState } from './system-state';

/**
 * Generate secure random password
 */
function generateSecurePassword(length = 16): string {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

/**
 * Get bootstrap credentials from environment or generate secure random
 * In production, ADMIN_PASSWORD and TEST_PASSWORD MUST be set
 */
const getBootstrapConfig = () => {
  const adminPassword = process.env.ADMIN_PASSWORD || generateSecurePassword();
  const testPassword = process.env.TEST_PASSWORD || generateSecurePassword();
  
  // Log warning if using generated passwords
  if (!process.env.ADMIN_PASSWORD || !process.env.TEST_PASSWORD) {
    logger.warn({
      adminPasswordGenerated: !process.env.ADMIN_PASSWORD,
      testPasswordGenerated: !process.env.TEST_PASSWORD,
    }, 'Using generated passwords - CHANGE IMMEDIATELY!');
  }
  
  return {
    tenant: {
      code: process.env.DEFAULT_TENANT_CODE || 'default',
      name: process.env.DEFAULT_TENANT_NAME || 'الشركة الافتراضية',
      nameEn: process.env.DEFAULT_TENANT_NAME_EN || 'Default Company',
      email: process.env.DEFAULT_TENANT_EMAIL || 'admin@default.com',
      status: 'active',
    },
    testUser: {
      email: process.env.TEST_USER_EMAIL || 'test@qa.com',
      password: testPassword,
      name: 'مستخدم اختبار',
      nameEn: 'Test User',
    },
    adminUser: {
      email: process.env.ADMIN_EMAIL || 'admin@erp.com',
      password: adminPassword,
      name: 'مدير النظام',
      nameEn: 'System Administrator',
    },
    sampleProduct: {
      code: process.env.SAMPLE_PRODUCT_CODE || 'SAMPLE-001',
      nameAr: 'منتج تجريبي',
      nameEn: 'Sample Product',
      type: 'finished_product',
      price: 100,
      cost: 50,
      stock: 100,
    },
  };
};

/**
 * System Initialization Status
 */
export interface SystemStatus {
  isInitialized: boolean;
  hasTenant: boolean;
  hasUser: boolean;
  hasProduct: boolean;
  missing: string[];
}

/**
 * Check system initialization status
 */
export async function checkSystemStatus(): Promise<SystemStatus> {
  const status: SystemStatus = {
    isInitialized: false,
    hasTenant: false,
    hasUser: false,
    hasProduct: false,
    missing: [],
  };

  try {
    // Check for any tenant
    const tenantCount = await prisma.tenant.count();
    status.hasTenant = tenantCount > 0;
    if (!status.hasTenant) status.missing.push('tenant');

    // Check for any user
    const userCount = await prisma.user.count();
    status.hasUser = userCount > 0;
    if (!status.hasUser) status.missing.push('user');

    // Check for any product
    const productCount = await prisma.product.count();
    status.hasProduct = productCount > 0;
    if (!status.hasProduct) status.missing.push('product');

    // System is initialized if all critical components exist
    status.isInitialized = status.hasTenant && status.hasUser;

    return status;
  } catch (error) {
    logger.error({ error }, 'Failed to check system status');
    // Return uninitialized state on error
    return {
      isInitialized: false,
      hasTenant: false,
      hasUser: false,
      hasProduct: false,
      missing: ['database_connection'],
    };
  }
}

/**
 * Bootstrap default tenant
 * Idempotent: safe to run multiple times
 */
export async function bootstrapTenant(): Promise<{ id: string; created: boolean }> {
  try {
    const config = getBootstrapConfig();
    
    // Check if default tenant exists
    const existing = await prisma.tenant.findUnique({
      where: { tenantCode: config.tenant.code },
    });

    if (existing) {
      logger.debug({ tenantId: existing.id }, 'Default tenant already exists');
      return { id: existing.id, created: false };
    }

    // Create default tenant
    const tenant = await prisma.tenant.create({
      data: {
        tenantCode: config.tenant.code,
        name: config.tenant.name,
        nameAr: config.tenant.name,
        email: config.tenant.email,
        status: config.tenant.status,
        subscriptionPlan: 'trial',
        maxUsers: 10,
        maxProducts: 1000,
      },
    });

    logger.info({ tenantId: tenant.id }, '✅ Default tenant created');
    return { id: tenant.id, created: true };
  } catch (error) {
    logger.error({ error }, 'Failed to bootstrap tenant');
    throw error;
  }
}

/**
 * Bootstrap required roles and permissions
 * Idempotent: safe to run multiple times
 */
export async function bootstrapRolesAndPermissions(): Promise<void> {
  try {
    // Create admin role if not exists
    const adminRole = await prisma.role.upsert({
      where: { code: 'admin' },
      update: {},
      create: {
        code: 'admin',
        nameAr: 'مدير النظام',
        nameEn: 'System Administrator',
        description: 'صلاحيات كاملة على النظام',
        isActive: true,
      },
    });

    // Create essential permissions
    const permissions = [
      { code: 'manage_users', nameAr: 'إدارة المستخدمين', module: 'auth' },
      { code: 'create_product', nameAr: 'إنشاء منتج', module: 'inventory' },
      { code: 'read_product', nameAr: 'عرض المنتجات', module: 'inventory' },
      { code: 'create_sales_invoice', nameAr: 'إنشاء فاتورة بيع', module: 'sales' },
      { code: 'read_sales_invoice', nameAr: 'عرض فواتير البيع', module: 'sales' },
    ];

    for (const perm of permissions) {
      await prisma.permission.upsert({
        where: { code: perm.code },
        update: {},
        create: {
          code: perm.code,
          nameAr: perm.nameAr,
          nameEn: perm.code.replace(/_/g, ' '),
          module: perm.module,
          action: 'manage',
          isActive: true,
        },
      });
    }

    // Assign all permissions to admin role
    const allPermissions = await prisma.permission.findMany();
    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      });
    }

    logger.info('✅ Roles and permissions bootstrapped');
  } catch (error) {
    logger.error({ error }, 'Failed to bootstrap roles and permissions');
    throw error;
  }
}

/**
 * Bootstrap test user
 * Idempotent: safe to run multiple times
 */
interface UserConfig {
  email: string;
  password: string;
  name: string;
  nameEn: string;
}

export async function bootstrapUser(
  tenantId: string,
  userConfig: UserConfig
): Promise<{ id: string; created: boolean }> {
  try {
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: userConfig.email },
    });

    if (existing) {
      logger.debug({ userId: existing.id }, `User ${userConfig.email} already exists`);
      return { id: existing.id, created: false };
    }

    // Hash password with bcrypt (cost factor 12 for production)
    const hashedPassword = await bcrypt.hash(userConfig.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: userConfig.email,
        name: userConfig.name,
        password: hashedPassword,
        isActive: true,
      },
    });
    
    // Log credentials ONCE for initial setup (production warning)
    logger.warn({
      email: userConfig.email,
      password: userConfig.password,
      userId: user.id,
    }, 'INITIAL CREDENTIALS CREATED - CHANGE IMMEDIATELY!');

    // Assign admin role
    const adminRole = await prisma.role.findUnique({
      where: { code: 'admin' },
    });

    if (adminRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });
    }

    // Assign to tenant
    if (adminRole) {
      await prisma.userTenantRole.create({
        data: {
          userId: user.id,
          tenantId: tenantId,
          roleId: adminRole.id,
        },
      });
    }

    logger.info({ userId: user.id, email: userConfig.email }, '✅ User created');
    return { id: user.id, created: true };
  } catch (error) {
    logger.error({ error, email: userConfig.email }, 'Failed to bootstrap user');
    throw error;
  }
}

/**
 * Bootstrap sample product
 * Idempotent: safe to run multiple times
 */
export async function bootstrapProduct(
  tenantId: string
): Promise<{ id: string; created: boolean }> {
  try {
    const config = getBootstrapConfig();
    
    // Check if sample product exists
    const existing = await prisma.product.findFirst({
      where: {
        code: config.sampleProduct.code,
        tenantId: tenantId,
      },
    });

    if (existing) {
      logger.debug({ productId: existing.id }, 'Sample product already exists');
      return { id: existing.id, created: false };
    }

    // Create default unit if not exists
    const unit = await prisma.unit.upsert({
      where: { code: 'pcs' },
      update: {},
      create: {
        code: 'pcs',
        nameAr: 'قطعة',
        nameEn: 'Pieces',
      },
    });

    // Create sample product
    const product = await prisma.product.create({
      data: {
        code: config.sampleProduct.code,
        nameAr: config.sampleProduct.nameAr,
        nameEn: config.sampleProduct.nameEn,
        type: config.sampleProduct.type,
        unit: unit.nameAr, // Required string field
        price: config.sampleProduct.price,
        cost: config.sampleProduct.cost,
        stock: config.sampleProduct.stock,
        unitId: unit.id,
        tenantId: tenantId,
      },
    });

    logger.info({ productId: product.id }, '✅ Sample product created');
    return { id: product.id, created: true };
  } catch (error) {
    logger.error({ error }, 'Failed to bootstrap product');
    throw error;
  }
}

/**
 * Full system bootstrap
 * Runs all initialization steps idempotently
 */
export async function bootstrapSystem(): Promise<{
  success: boolean;
  created: string[];
  errors: string[];
}> {
  const result = {
    success: true,
    created: [] as string[],
    errors: [] as string[],
  };

  logger.info('🚀 Starting system bootstrap...');

  try {
    const config = getBootstrapConfig();
    
    // Step 1: Bootstrap tenant
    const tenantResult = await bootstrapTenant();
    if (tenantResult.created) {
      result.created.push(`tenant:${config.tenant.code}`);
    }

    // Step 2: Bootstrap roles and permissions
    await bootstrapRolesAndPermissions();
    result.created.push('roles_and_permissions');

    // Step 3: Bootstrap admin user
    const adminResult = await bootstrapUser(tenantResult.id, config.adminUser);
    if (adminResult.created) {
      result.created.push(`user:${config.adminUser.email}`);
      // Log admin credentials with strong warning
      logger.warn({
        email: config.adminUser.email,
        password: config.adminUser.password,
      }, '⚠️  ADMIN CREDENTIALS - CHANGE IMMEDIATELY AFTER FIRST LOGIN!');
    }

    // Step 4: Bootstrap test user
    const testResult = await bootstrapUser(tenantResult.id, config.testUser);
    if (testResult.created) {
      result.created.push(`user:${config.testUser.email}`);
      logger.warn({
        email: config.testUser.email,
        password: config.testUser.password,
      }, '⚠️  TEST USER CREDENTIALS - CHANGE IMMEDIATELY!');
    }

    // Step 5: Bootstrap sample product
    const productResult = await bootstrapProduct(tenantResult.id);
    if (productResult.created) {
      result.created.push(`product:${config.sampleProduct.code}`);
    }

    logger.info({ created: result.created }, '✅ System bootstrap completed');
    return result;
  } catch (error) {
    logger.error({ error }, '❌ System bootstrap failed');
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

/**
 * Ensure system is initialized before critical operations
 * Auto-bootstraps if needed
 */
export async function ensureSystemInitialized(): Promise<{
  initialized: boolean;
  message: string;
}> {
  const status = await checkSystemStatus();

  if (status.isInitialized) {
    return {
      initialized: true,
      message: 'System is initialized',
    };
  }

  // Auto-bootstrap
  logger.warn({ missing: status.missing }, 'System not initialized, auto-bootstrapping...');
  const result = await bootstrapSystem();

  if (result.success) {
    return {
      initialized: true,
      message: `System auto-initialized. Created: ${result.created.join(', ')}`,
    };
  } else {
    return {
      initialized: false,
      message: `System initialization failed: ${result.errors.join(', ')}`,
    };
  }
}

/**
 * Safe login wrapper - PRODUCTION VERSION
 * NO auto-bootstrap - just checks system state
 */
export async function safeLogin(
  email: string,
  password: string
): Promise<{
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}> {
  // Check system state ONLY - no modification
  const { state, blocked } = await getSystemState();
  
  if (blocked) {
    return {
      success: false,
      error: {
        code: 'SYSTEM_NOT_INITIALIZED',
        message: `System is not initialized (state: ${state}). Contact administrator.`,
      },
    };
  }

  try {
    // Import here to avoid circular dependency
    const { loginUser } = await import('./auth');
    const result = await loginUser(email, password);
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';

    return {
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message,
      },
    };
  }
}

// Default export
const systemBootstrap = {
  bootstrapSystem,
  ensureSystemInitialized,
  checkSystemStatus,
  safeLogin,
};

export default systemBootstrap;
