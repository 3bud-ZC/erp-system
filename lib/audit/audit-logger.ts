/**
 * AUDIT LOGGING SYSTEM
 * Tracks all critical operations for compliance and debugging
 * 
 * Logged Operations:
 * - Invoice creation, update, deletion
 * - Payments
 * - Inventory changes
 * - Login/logout attempts
 * - Permission changes
 */

import { prisma } from '@/lib/db';

/**
 * Audit Action Types
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'POST'
  | 'VOID'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'
  | 'EXPORT'
  | 'IMPORT'
  | 'ADJUSTMENT';

/**
 * Entity Types
 */
export type EntityType =
  | 'SalesInvoice'
  | 'PurchaseInvoice'
  | 'Payment'
  | 'Product'
  | 'Customer'
  | 'Supplier'
  | 'User'
  | 'Role'
  | 'JournalEntry'
  | 'StockAdjustment'
  | 'Session';

/**
 * Audit Log Entry Structure
 */
interface AuditLogEntry {
  userId: string;
  tenantId: string;
  action: AuditAction;
  module: string;
  entityType: EntityType;
  entityId?: string;
  changes?: Record<string, any>;
  status?: string;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        tenantId: entry.tenantId,
        action: entry.action,
        module: entry.module,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: entry.changes ? JSON.stringify(entry.changes) : null,
        status: entry.status || 'success',
        errorMessage: entry.errorMessage,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (error) {
    // Log to console but don't fail the operation
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Audit helper for invoice operations
 */
export async function auditInvoice(
  params: {
    userId: string;
    tenantId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'VOID';
    invoiceId: string;
    invoiceType: 'sales' | 'purchase';
    invoiceNumber: string;
    amount: number;
    ipAddress?: string;
    userAgent?: string;
    changes?: Record<string, any>;
  }
): Promise<void> {
  const entityType = params.invoiceType === 'sales' ? 'SalesInvoice' : 'PurchaseInvoice';
  
  await createAuditLog({
    userId: params.userId,
    tenantId: params.tenantId,
    action: params.action,
    module: 'sales',
    entityType,
    entityId: params.invoiceId,
    changes: {
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      ...params.changes,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Audit helper for payments
 */
export async function auditPayment(
  params: {
    userId: string;
    tenantId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    paymentId: string;
    amount: number;
    method: string;
    customerId?: string;
    supplierId?: string;
    invoiceId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId: params.userId,
    tenantId: params.tenantId,
    action: params.action,
    module: 'accounting',
    entityType: 'Payment',
    entityId: params.paymentId,
    changes: {
      amount: params.amount,
      method: params.method,
      customerId: params.customerId,
      supplierId: params.supplierId,
      invoiceId: params.invoiceId,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Audit helper for inventory changes
 */
export async function auditInventory(
  params: {
    userId: string;
    tenantId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ADJUSTMENT';
    productId: string;
    productName: string;
    quantityChange: number;
    oldStock: number;
    newStock: number;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId: params.userId,
    tenantId: params.tenantId,
    action: params.action,
    module: 'inventory',
    entityType: 'Product',
    entityId: params.productId,
    changes: {
      productName: params.productName,
      quantityChange: params.quantityChange,
      oldStock: params.oldStock,
      newStock: params.newStock,
      reason: params.reason,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Audit helper for authentication events
 */
export async function auditAuth(
  params: {
    userId?: string;
    tenantId?: string;
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED';
    email?: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId: params.userId || 'anonymous',
    tenantId: params.tenantId || 'system',
    action: params.action,
    module: 'auth',
    entityType: 'User',
    entityId: params.userId || 'unknown',
    changes: {
      email: params.email,
      reason: params.reason,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Middleware to extract request metadata for audit logging
 */
export function getRequestMetadata(request: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(params: {
  tenantId: string;
  userId?: string;
  entityType?: EntityType;
  entityId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const { tenantId, ...filters } = params;
  
  return await prisma.auditLog.findMany({
    where: {
      tenantId,
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.entityId && { entityId: filters.entityId }),
      ...(filters.action && { action: filters.action }),
      ...(filters.startDate && filters.endDate && {
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      }),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 50,
    skip: filters.offset || 0,
  });
}

/**
 * Cleanup old audit logs (retention policy)
 * Default: Keep 2 years of logs
 */
export async function cleanupOldAuditLogs(retentionDays = 730): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  try {
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
    
    console.log(`Cleaned up ${result.count} old audit logs`);
    return result.count;
  } catch (error) {
    console.error('Failed to cleanup audit logs:', error);
    return 0;
  }
}
