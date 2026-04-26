/**
 * ERP API Gateway - SINGLE ENTRY POINT
 * All ERP operations MUST go through this endpoint
 * NO EXCEPTIONS
 */

import { NextRequest } from 'next/server';
import { ERPExecutionEngine } from '@/lib/erp-execution-engine';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/structured-logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, payload, context } = body;

    // Validate required fields
    if (!type) {
      return apiError('Transaction type is required', 400);
    }

    if (!payload) {
      return apiError('Payload is required', 400);
    }

    if (!context?.userId) {
      return apiError('User context is required', 400);
    }

    // Log incoming transaction
    logger.info('ERP Gateway: Executing transaction', { userId: context.userId, tenantId: context.tenantId }, { type });

    // Execute through ERPExecutionEngine - SINGLE ENTRY POINT
    const result = await ERPExecutionEngine.execute({
      id: payload.id || undefined,
      type,
      payload,
      context: {
        userId: context.userId,
        tenantId: context.tenantId || 'default',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    if (!result.success) {
      logger.error('ERP Gateway: Transaction failed', new Error('Transaction failed'), { userId: context.userId, tenantId: context.tenantId }, { type, error: result.errors });
      return apiError(
        result.errors?.[0] || 'Transaction execution failed',
        400,
        { details: result.errors }
      );
    }

    // Verify persistence
    const persistenceCheck = await verifyPersistence(type, result.data);
    
    if (!persistenceCheck.success) {
      logger.error('ERP Gateway: Persistence verification failed', new Error('Persistence verification failed'), { userId: context.userId, tenantId: context.tenantId }, { type, error: persistenceCheck.error });
      return apiError(
        'Transaction executed but persistence verification failed',
        500,
        { details: persistenceCheck.error }
      );
    }

    logger.info('ERP Gateway: Transaction completed successfully', { userId: context.userId, tenantId: context.tenantId }, { type, entityId: result.data?.id });

    return apiSuccess({
      result: result.data,
      state: result.state,
      journalEntries: result.journalEntries,
      persistence: persistenceCheck,
    });

  } catch (error: any) {
    logger.error('ERP Gateway: Unexpected error', error);
    return apiError(error.message || 'Internal server error', 500);
  }
}

/**
 * Verify that the transaction was actually persisted to the database
 */
async function verifyPersistence(type: string, data: any): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data?.id) {
      return { success: false, error: 'No entity ID returned from execution' };
    }

    const entityId = data.id;
    let entity = null;

    // Map transaction types to Prisma models
    switch (type) {
      case 'SALES_ORDER':
        entity = await (prisma as any).salesOrder.findUnique({ where: { id: entityId } });
        break;
      case 'SALES_INVOICE':
        entity = await (prisma as any).salesInvoice.findUnique({ where: { id: entityId } });
        break;
      case 'SALES_RETURN':
        entity = await (prisma as any).salesReturn.findUnique({ where: { id: entityId } });
        break;
      case 'PURCHASE_ORDER':
        entity = await (prisma as any).purchaseOrder.findUnique({ where: { id: entityId } });
        break;
      case 'PURCHASE_INVOICE':
        entity = await (prisma as any).purchaseInvoice.findUnique({ where: { id: entityId } });
        break;
      case 'PURCHASE_RETURN':
        entity = await (prisma as any).purchaseReturn.findUnique({ where: { id: entityId } });
        break;
      case 'PAYMENT':
        entity = await (prisma as any).payment.findUnique({ where: { id: entityId } });
        break;
      case 'STOCK_TRANSFER':
        entity = await (prisma as any).stockTransfer.findUnique({ where: { id: entityId } });
        break;
      case 'STOCK_ADJUSTMENT':
        entity = await (prisma as any).stockAdjustment.findUnique({ where: { id: entityId } });
        break;
      case 'PRODUCTION_ORDER':
        entity = await (prisma as any).productionOrder.findUnique({ where: { id: entityId } });
        break;
      default:
        return { success: true }; // Skip verification for unknown types
    }

    if (!entity) {
      return { success: false, error: `Entity ${entityId} not found in database after execution` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: `Persistence check error: ${error.message}` };
  }
}
