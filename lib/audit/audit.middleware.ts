/**
 * Audit Middleware - Automatic Audit Logging
 * Automatically logs all changes to entities
 */

import { NextRequest } from 'next/server';
import { auditService } from './audit.service';

// ============================================================================
// AUDIT CONTEXT
// ============================================================================

export interface AuditContext {
  userId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// AUDIT MIDDLEWARE
// ============================================================================

/**
 * Decorator to automatically audit entity changes
 * Usage in service classes:
 * 
 * class MyService {
 *   @AuditLog('SalesInvoice')
 *   async createInvoice(data: any, auditCtx: AuditContext) {
 *     // Implementation
 *     return createdInvoice;
 *   }
 * }
 */
export function AuditLog(entityType: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // Find audit context in arguments
      const auditCtx = args.find((arg: any) => 
        arg && arg.userId && arg.tenantId
      ) as AuditContext;

      if (auditCtx) {
        // Determine action based on method name
        const action = getActionFromMethodName(propertyKey);

        // Log the audit entry
        try {
          await auditService.logAuditEntry({
            userId: auditCtx.userId,
            tenantId: auditCtx.tenantId,
            action,
            entityType,
            entityId: result?.id || args[0]?.id,
            afterState: result,
            metadata: {
              method: propertyKey,
            },
            ipAddress: auditCtx.ipAddress,
            userAgent: auditCtx.userAgent,
          });
        } catch (error) {
          // Log audit errors but don't fail the operation
          console.error('Failed to log audit entry:', error);
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator to audit entity updates with before/after state
 */
export function AuditUpdate(entityType: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const entityId = args[0];
      const updateData = args[1];
      const auditCtx = args.find((arg: any) => 
        arg && arg.userId && arg.tenantId
      ) as AuditContext;

      let beforeState: any = null;

      // Fetch before state if audit context is provided
      if (auditCtx) {
        try {
          beforeState = await fetchEntityBeforeState(entityType, entityId, auditCtx.tenantId);
        } catch (error) {
          console.error('Failed to fetch before state for audit:', error);
        }
      }

      // Execute the update
      const result = await originalMethod.apply(this, args);

      // Log the audit entry
      if (auditCtx && beforeState) {
        try {
          await auditService.logAuditEntry({
            userId: auditCtx.userId,
            tenantId: auditCtx.tenantId,
            action: 'UPDATE',
            entityType,
            entityId,
            beforeState,
            afterState: result || updateData,
            metadata: {
              method: propertyKey,
              changes: getChanges(beforeState, updateData),
            },
            ipAddress: auditCtx.ipAddress,
            userAgent: auditCtx.userAgent,
          });
        } catch (error) {
          console.error('Failed to log audit entry:', error);
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator to audit entity deletions
 */
export function AuditDelete(entityType: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const entityId = args[0];
      const auditCtx = args.find((arg: any) => 
        arg && arg.userId && arg.tenantId
      ) as AuditContext;

      let beforeState: any = null;

      // Fetch before state if audit context is provided
      if (auditCtx) {
        try {
          beforeState = await fetchEntityBeforeState(entityType, entityId, auditCtx.tenantId);
        } catch (error) {
          console.error('Failed to fetch before state for audit:', error);
        }
      }

      // Execute the deletion
      const result = await originalMethod.apply(this, args);

      // Log the audit entry
      if (auditCtx) {
        try {
          await auditService.logAuditEntry({
            userId: auditCtx.userId,
            tenantId: auditCtx.tenantId,
            action: 'DELETE',
            entityType,
            entityId,
            beforeState,
            afterState: null,
            metadata: {
              method: propertyKey,
            },
            ipAddress: auditCtx.ipAddress,
            userAgent: auditCtx.userAgent,
          });
        } catch (error) {
          console.error('Failed to log audit entry:', error);
        }
      }

      return result;
    };

    return descriptor;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get action from method name
 */
function getActionFromMethodName(methodName: string): string {
  const methodLower = methodName.toLowerCase();

  if (methodLower.startsWith('create') || methodLower.startsWith('add')) {
    return 'CREATE';
  } else if (methodLower.startsWith('update') || methodLower.startsWith('edit') || methodLower.startsWith('modify')) {
    return 'UPDATE';
  } else if (methodLower.startsWith('delete') || methodLower.startsWith('remove')) {
    return 'DELETE';
  } else if (methodLower.startsWith('post')) {
    return 'POST';
  } else if (methodLower.startsWith('approve')) {
    return 'APPROVE';
  } else if (methodLower.startsWith('reject')) {
    return 'REJECT';
  }

  return methodName.toUpperCase();
}

/**
 * Fetch entity before state for audit
 * This is a simplified implementation - you'd need to implement based on your actual entities
 */
async function fetchEntityBeforeState(
  entityType: string,
  entityId: string,
  tenantId: string
): Promise<any> {
  const { prisma } = await import('../db');

  // Map entity type to Prisma model
  const modelMap: Record<string, any> = {
    'SalesInvoice': prisma.salesInvoice,
    'PurchaseInvoice': prisma.purchaseInvoice,
    'JournalEntry': prisma.journalEntry,
    'Account': prisma.account,
    'Product': prisma.product,
    'Customer': prisma.customer,
    'Supplier': prisma.supplier,
    'User': prisma.user,
    'Role': prisma.role,
  };

  const model = modelMap[entityType];
  
  if (!model) {
    return null;
  }

  try {
    const entity = await model.findFirst({
      where: {
        id: entityId,
        // tenantId is not on all models, so we conditionally add it
        ...(model.fields.tenantId ? { tenantId } : {}),
      },
    });

    return entity;
  } catch (error) {
    return null;
  }
}

/**
 * Get changes between before and after state
 */
function getChanges(before: any, after: any): Record<string, { from: any; to: any }> {
  const changes: Record<string, { from: any; to: any }> = {};

  if (!before || !after) {
    return changes;
  }

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of Array.from(allKeys)) {
    const beforeValue = before[key];
    const afterValue = after[key];

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[key] = {
        from: beforeValue,
        to: afterValue,
      };
    }
  }

  return changes;
}

// ============================================================================
// REQUEST AUDIT HELPER
// ============================================================================

/**
 * Extract audit context from request
 * Integrates with your authentication system
 */
export function getAuditContextFromRequest(request: NextRequest): AuditContext {
  // This is a placeholder - integrate with your auth system
  const userId = request.headers.get('x-user-id') || '';
  const tenantId = request.headers.get('x-tenant-id') || '';
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  return {
    userId,
    tenantId,
    ipAddress,
    userAgent,
  };
}

// ============================================================================
// MIDDLEWARE WRAPPER FOR API ROUTES
// ============================================================================

/**
 * Wrapper for API routes that automatically logs audit entries
 * Usage:
 * 
 * export const POST = withAudit(async (request, auditCtx) => {
 *   const data = await request.json();
 *   const result = await myService.createInvoice(data, auditCtx);
 *   return NextResponse.json(result);
 * }, 'SalesInvoice');
 */
export function withAudit(
  handler: (request: NextRequest, auditCtx: AuditContext) => Promise<Response>,
  entityType: string
) {
  return async (request: NextRequest) => {
    const auditCtx = getAuditContextFromRequest(request);

    try {
      const result = await handler(request, auditCtx);

      // Log the successful operation
      try {
        await auditService.logAuditEntry({
          userId: auditCtx.userId,
          tenantId: auditCtx.tenantId,
          action: getActionFromMethodName(request.method),
          entityType,
          entityId: '', // Would be extracted from result if needed
          afterState: result,
          metadata: {
            method: request.method,
            path: request.url,
          },
          ipAddress: auditCtx.ipAddress,
          userAgent: auditCtx.userAgent,
        });
      } catch (error) {
        console.error('Failed to log audit entry:', error);
      }

      return result;
    } catch (error) {
      // Log the failed operation
      try {
        await auditService.logAuditEntry({
          userId: auditCtx.userId,
          tenantId: auditCtx.tenantId,
          action: getActionFromMethodName(request.method),
          entityType,
          entityId: '',
          afterState: null,
          metadata: {
            method: request.method,
            path: request.url,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          ipAddress: auditCtx.ipAddress,
          userAgent: auditCtx.userAgent,
        });
      } catch (auditError) {
        console.error('Failed to log audit entry:', auditError);
      }

      throw error;
    }
  };
}
