/**
 * Activity Log System
 * Tracks all CRUD operations on critical entities
 * Provides complete audit trail for business operations
 */

import { prisma } from './db';

export interface LogActivityParams {
  entity: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userId?: string;
  before?: any;
  after?: any;
}

/**
 * Log activity for audit trail
 * Rules:
 * - CREATE → afterData only
 * - UPDATE → before + after
 * - DELETE → before only
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const { entity, entityId, action, userId, before, after } = params;

    let beforeData: any = null;
    let afterData: any = null;

    // Apply logging rules
    switch (action) {
      case 'CREATE':
        afterData = after;
        break;
      case 'UPDATE':
        beforeData = before;
        afterData = after;
        break;
      case 'DELETE':
        beforeData = before;
        break;
    }

    await prisma.activityLog.create({
      data: {
        entity,
        entityId,
        action,
        performedBy: userId,
        beforeData,
        afterData,
      },
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}

/**
 * Get activity history for an entity
 */
export async function getActivityHistory(entity: string, entityId: string) {
  try {
    return await prisma.activityLog.findMany({
      where: {
        entity,
        entityId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  } catch (error) {
    console.error('Error getting activity history:', error);
    return [];
  }
}

/**
 * Get recent activity across all entities
 */
export async function getRecentActivity(limit = 20) {
  try {
    return await prisma.activityLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return [];
  }
}
