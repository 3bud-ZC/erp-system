/**
 * Audit Service - Production-Grade Immutable Audit Logging
 * Every change is logged with before/after state
 */

import { prisma } from '../db';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AuditLogEntry {
  id: string;
  userId: string;
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AuditFilter {
  tenantId?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// AUDIT SERVICE
// ============================================================================

export class AuditService {
  /**
   * Log an audit entry
   * This is the primary method for recording audit trails
   */
  async logAuditEntry(entry: {
    userId: string;
    tenantId: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeState?: any;
    afterState?: any;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        tenantId: entry.tenantId,
        action: entry.action,
        module: this.getModuleFromEntityType(entry.entityType),
        entityType: entry.entityType,
        entityId: entry.entityId || null,
        changes: entry.beforeState || entry.afterState
          ? JSON.stringify({ before: entry.beforeState, after: entry.afterState })
          : null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        status: 'success',
      },
    });
  }

  /**
   * Get audit history for an entity
   */
  async getEntityHistory(
    tenantId: string,
    entityType: string,
    entityId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AuditLogEntry[]> {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return auditLogs.map((log) => this.mapToAuditLogEntry(log));
  }

  /**
   * Get audit history for a user
   */
  async getUserHistory(
    tenantId: string,
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AuditLogEntry[]> {
    const where: any = {
      tenantId,
      userId,
    };

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return auditLogs.map((log) => this.mapToAuditLogEntry(log));
  }

  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(filter: AuditFilter): Promise<{
    entries: AuditLogEntry[];
    total: number;
  }> {
    const where: any = {};

    if (filter.tenantId) where.tenantId = filter.tenantId;
    if (filter.userId) where.userId = filter.userId;
    if (filter.action) where.action = filter.action;
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = filter.startDate;
      if (filter.endDate) where.createdAt.lte = filter.endDate;
    }

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit || 50,
        skip: filter.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      entries: entries.map((log) => this.mapToAuditLogEntry(log)),
      total,
    };
  }

  /**
   * Get audit statistics for a tenant
   */
  async getAuditStats(
    tenantId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    totalLogs: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    const where: any = {
      tenantId,
    };

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [totalLogs, byAction, byEntityType, byUser] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
      }),
      prisma.auditLog.groupBy({
        by: ['entityType'],
        where,
        _count: true,
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where,
        _count: true,
      }),
    ]);

    const byActionMap: Record<string, number> = {};
    for (const item of byAction) {
      byActionMap[item.action] = item._count;
    }

    const byEntityTypeMap: Record<string, number> = {};
    for (const item of byEntityType) {
      byEntityTypeMap[item.entityType] = item._count;
    }

    const byUserMap: Record<string, number> = {};
    for (const item of byUser) {
      byUserMap[item.userId] = item._count;
    }

    return {
      totalLogs,
      byAction: byActionMap,
      byEntityType: byEntityTypeMap,
      byUser: byUserMap,
    };
  }

  /**
   * Map database record to AuditLogEntry
   */
  private mapToAuditLogEntry(log: any): AuditLogEntry {
    return {
      id: log.id,
      userId: log.userId,
      tenantId: log.tenantId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      beforeState: log.beforeState ? JSON.parse(log.beforeState) : undefined,
      afterState: log.afterState ? JSON.parse(log.afterState) : undefined,
      metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      timestamp: log.createdAt,
    };
  }

  /**
   * Get module name from entity type
   */
  private getModuleFromEntityType(entityType: string): string {
    const moduleMapping: Record<string, string> = {
      // Accounting
      'JournalEntry': 'accounting',
      'Account': 'accounting',
      'FiscalYear': 'accounting',
      'AccountingPeriod': 'accounting',
      
      // Inventory
      'Product': 'inventory',
      'InventoryTransaction': 'inventory',
      'Warehouse': 'inventory',
      
      // Sales
      'SalesInvoice': 'sales',
      'SalesOrder': 'sales',
      'Customer': 'sales',
      
      // Purchasing
      'PurchaseInvoice': 'purchasing',
      'PurchaseOrder': 'purchasing',
      'Supplier': 'purchasing',
      
      // Users
      'User': 'users',
      'Role': 'users',
      
      // System
      'Tenant': 'system',
    };

    return moduleMapping[entityType] || 'unknown';
  }

  /**
   * Cleanup old audit logs (for maintenance)
   * Note: This should be used with caution as audit logs should be immutable
   * Only logs older than the specified retention period will be deleted
   */
  async cleanupOldLogs(
    tenantId: string,
    retentionDays: number = 365
  ): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: {
        tenantId,
        createdAt: {
          lte: cutoffDate,
        },
      },
    });

    return { deleted: result.count };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const auditService = new AuditService();
