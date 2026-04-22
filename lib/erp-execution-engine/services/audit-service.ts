/**
 * Audit Service
 * Logs all transaction executions for audit trail
 */

import { prisma } from '@/lib/db';
import { ERPTransaction } from '../types';

export class AuditService {
  static async log(data: {
    tx: ERPTransaction;
    beforeState: any;
    afterState: any;
    journalEntries?: any[];
  }): Promise<void> {
    const { tx, beforeState, afterState, journalEntries } = data;

    await prisma.auditLog.create({
      data: {
        userId: tx.context.userId,
        action: tx.type,
        module: this.getModuleFromType(tx.type),
        entityType: tx.type,
        entityId: afterState?.id,
        changes: JSON.stringify({
          before: beforeState,
          after: afterState,
          journalEntries,
          payload: tx.payload,
        }),
        ipAddress: tx.context.ipAddress,
        userAgent: tx.context.userAgent,
        status: 'success',
        tenantId: tx.context.tenantId,
      },
    });
  }

  private static getModuleFromType(type: string): string {
    const moduleMap: { [key: string]: string } = {
      'SALES_ORDER': 'sales',
      'SALES_INVOICE': 'sales',
      'SALES_RETURN': 'sales',
      'PURCHASE_ORDER': 'purchases',
      'PURCHASE_INVOICE': 'purchases',
      'PURCHASE_RETURN': 'purchases',
      'PAYMENT': 'accounting',
      'STOCK_TRANSFER': 'inventory',
      'STOCK_ADJUSTMENT': 'inventory',
      'PRODUCTION_ORDER': 'manufacturing',
    };

    return moduleMap[type] || 'general';
  }
}
