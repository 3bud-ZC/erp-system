import { prisma } from './db';
import { Prisma } from '@prisma/client';

/**
 * Safe database operations wrapper
 * Handles cases where tables don't exist yet
 */

export interface SafeQueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Safely execute a Prisma query with error handling
 */
export async function safeQuery<T>(
  queryFn: () => Promise<T>,
  fallbackData?: T
): Promise<SafeQueryResult<T>> {
  try {
    const data = await queryFn();
    return { success: true, data };
  } catch (error: any) {
    // Handle specific Prisma errors
    if (error.code === 'P2021') {
      // Table does not exist
      console.warn(`Table not found, returning fallback: ${error.meta?.table || 'unknown'}`);
      return {
        success: false,
        error: `Table not found: ${error.meta?.table || 'unknown table'}`,
        code: 'P2021',
        data: fallbackData,
      };
    }

    if (error.code === 'P2002') {
      return {
        success: false,
        error: 'Duplicate entry',
        code: 'P2002',
      };
    }

    console.error('Database query error:', error);
    return {
      success: false,
      error: error.message || 'Database error',
      code: error.code || 'UNKNOWN',
      data: fallbackData,
    };
  }
}

/**
 * Safely count records with fallback to 0
 */
export async function safeCount(
  modelName: keyof typeof prisma,
  where?: any
): Promise<number> {
  try {
    const model = prisma[modelName] as any;
    if (!model || typeof model.count !== 'function') {
      return 0;
    }
    return await model.count({ where });
  } catch (error: any) {
    if (error.code === 'P2021') {
      return 0; // Table doesn't exist yet
    }
    throw error;
  }
}

/**
 * Safely find many with fallback to empty array
 */
export async function safeFindMany<T>(
  modelName: keyof typeof prisma,
  args?: any
): Promise<T[]> {
  try {
    const model = prisma[modelName] as any;
    if (!model || typeof model.findMany !== 'function') {
      return [];
    }
    return await model.findMany(args);
  } catch (error: any) {
    if (error.code === 'P2021') {
      return []; // Table doesn't exist yet
    }
    throw error;
  }
}

/**
 * Check if a table exists
 */
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM "${tableName}" LIMIT 1`);
    return true;
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.code === 'P2021') {
      return false;
    }
    throw error;
  }
}

/**
 * Get list of missing tables from critical tables
 */
export async function getMissingTables(): Promise<string[]> {
  const criticalTables = [
    'User', 'Role', 'Permission', 'Product', 'Warehouse',
    'Customer', 'Supplier', 'SalesInvoice', 'PurchaseInvoice'
  ];

  const missing: string[] = [];

  for (const table of criticalTables) {
    const exists = await tableExists(table).catch(() => false);
    if (!exists) {
      missing.push(table);
    }
  }

  return missing;
}

/**
 * Initialize database if needed (run on startup)
 */
export async function ensureDatabase(): Promise<{
  initialized: boolean;
  missingTables: string[];
}> {
  const missingTables = await getMissingTables();

  if (missingTables.length > 0) {
    console.warn(`Missing tables detected: ${missingTables.join(', ')}`);
    console.warn('Run /api/init to initialize the database');
  }

  return {
    initialized: missingTables.length === 0,
    missingTables,
  };
}
