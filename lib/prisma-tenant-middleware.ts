import { Prisma } from '@prisma/client';

// Current tenant context (will be set by auth middleware)
let currentTenantId: string | null = null;

export function setTenantContext(tenantId: string | null) {
  currentTenantId = tenantId;
}

export function getTenantContext(): string | null {
  return currentTenantId;
}

export function clearTenantContext() {
  currentTenantId = null;
}

// Prisma middleware for tenant isolation
export const tenantMiddleware: Prisma.Middleware = async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
  // Skip tenant isolation for system-level models
  const systemModels = [
    'User',
    'Role',
    'Permission',
    'UserRole',
    'RolePermission',
    'Unit',
    'ItemGroup',
    'Account',
    'JournalEntryTemplate',
    'RecurringJournalEntry',
    'AccountingPeriod',
    'Tenant',
    'UserTenantRole',
  ];

  const model = params.model;
  if (!model || systemModels.includes(model)) {
    return next(params);
  }

  // Skip if no tenant context (e.g., during migrations)
  if (!currentTenantId) {
    return next(params);
  }

  // Add tenantId filter to all queries
  if (params.action === 'findUnique' || params.action === 'findFirst') {
    params.args.where = {
      ...params.args.where,
      tenantId: currentTenantId,
    };
  } else if (params.action === 'findMany') {
    if (params.args.where) {
      if (params.args.where.AND) {
        params.args.where.AND.push({ tenantId: currentTenantId });
      } else {
        params.args.where = {
          AND: [params.args.where, { tenantId: currentTenantId }],
        };
      }
    } else {
      params.args.where = { tenantId: currentTenantId };
    }
  } else if (params.action === 'create' || params.action === 'createMany') {
    if (params.action === 'create') {
      params.args.data = {
        ...params.args.data,
        tenantId: currentTenantId,
      };
    } else if (params.action === 'createMany') {
      if (Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((item: any) => ({
          ...item,
          tenantId: currentTenantId,
        }));
      } else {
        params.args.data = {
          ...params.args.data,
          tenantId: currentTenantId,
        };
      }
    }
  } else if (params.action === 'update' || params.action === 'updateMany') {
    if (params.action === 'update') {
      if (params.args.where) {
        params.args.where = {
          ...params.args.where,
          tenantId: currentTenantId,
        };
      } else {
        params.args.where = { tenantId: currentTenantId };
      }
    } else if (params.action === 'updateMany') {
      if (params.args.where) {
        if (params.args.where.AND) {
          params.args.where.AND.push({ tenantId: currentTenantId });
        } else {
          params.args.where = {
            AND: [params.args.where, { tenantId: currentTenantId }],
          };
        }
      } else {
        params.args.where = { tenantId: currentTenantId };
      }
    }
  } else if (params.action === 'delete' || params.action === 'deleteMany') {
    if (params.action === 'delete') {
      if (params.args.where) {
        params.args.where = {
          ...params.args.where,
          tenantId: currentTenantId,
        };
      } else {
        params.args.where = { tenantId: currentTenantId };
      }
    } else if (params.action === 'deleteMany') {
      if (params.args.where) {
        if (params.args.where.AND) {
          params.args.where.AND.push({ tenantId: currentTenantId });
        } else {
          params.args.where = {
            AND: [params.args.where, { tenantId: currentTenantId }],
          };
        }
      } else {
        params.args.where = { tenantId: currentTenantId };
      }
    }
  }

  return next(params);
};
