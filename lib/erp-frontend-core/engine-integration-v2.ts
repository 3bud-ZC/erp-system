/**
 * ERP Frontend Engine Integration Layer v2
 * SINGLE ENTRY POINT - ALL actions must go through this file
 * NO DIRECT API CALLS ALLOWED
 */

import { logger } from '@/lib/structured-logger';

// ==================== SINGLE GATEWAY API ====================

const ERP_GATEWAY_URL = '/api/erp/execute';

/**
 * Universal transaction creator - SINGLE ENTRY POINT
 * ALL UI actions MUST go through this function
 */
export async function executeTransaction(
  type: string,
  payload: any,
  context?: { userId?: string; tenantId?: string }
): Promise<TransactionResponse> {
  try {
    logger.info('Frontend: Executing transaction via ERP Gateway', undefined, { type, userId: context?.userId });

    const response = await fetch(ERP_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        payload,
        context: {
          userId: context?.userId || 'anonymous',
          tenantId: context?.tenantId || 'default',
        },
      }),
    });

    const result = await response.json();

    if (!result.success) {
      logger.error('Frontend: Transaction failed', new Error(result.error || 'Transaction failed'), undefined, { type });

      return {
        success: false,
        error: result.error || 'Transaction execution failed',
        details: result.details,
      };
    }

    logger.info('Frontend: Transaction succeeded', undefined, { type, entityId: result.data?.id });

    return {
      success: true,
      data: result.data,
      state: result.state,
      journalEntries: result.journalEntries,
      persistence: result.persistence,
    };
  } catch (error: any) {
    logger.error('Frontend: Transaction error', error, undefined, { type });

    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

// ==================== CONVENIENCE FUNCTIONS (ALL use executeTransaction) ====================

export async function createTransaction(request: {
  type: string;
  payload: any;
  context?: { userId?: string; tenantId?: string };
}): Promise<TransactionResponse> {
  return executeTransaction(request.type, request.payload, request.context);
}

export async function approveTransaction(
  entityType: string,
  entityId: string,
  context?: { userId?: string; tenantId?: string }
): Promise<TransactionResponse> {
  return executeTransaction(
    'WORKFLOW_TRANSITION',
    {
      entityType,
      entityId,
      action: 'approve',
      targetStatus: 'confirmed',
    },
    context
  );
}

export async function postTransaction(
  entityType: string,
  entityId: string,
  context?: { userId?: string; tenantId?: string }
): Promise<TransactionResponse> {
  return executeTransaction(
    'WORKFLOW_TRANSITION',
    {
      entityType,
      entityId,
      action: 'post',
      targetStatus: 'posted',
    },
    context
  );
}

export async function cancelTransaction(
  entityType: string,
  entityId: string,
  reason?: string,
  context?: { userId?: string; tenantId?: string }
): Promise<TransactionResponse> {
  return executeTransaction(
    'WORKFLOW_TRANSITION',
    {
      entityType,
      entityId,
      action: 'cancel',
      targetStatus: 'cancelled',
      reason,
    },
    context
  );
}

export async function updateWorkflowState(request: {
  entityType: string;
  entityId: string;
  targetStatus: string;
  notes?: string;
  context?: { userId?: string; tenantId?: string };
}): Promise<TransactionResponse> {
  return executeTransaction(
    'WORKFLOW_TRANSITION',
    {
      entityType: request.entityType,
      entityId: request.entityId,
      action: 'transition',
      targetStatus: request.targetStatus,
      notes: request.notes,
    },
    request.context
  );
}

// ==================== DATA FETCHING (Read-only operations) ====================

export async function fetchBusinessState(
  entityType: string,
  entityId: string
): Promise<any> {
  const response = await fetch(`/api/erp/entity/${entityType}/${entityId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch entity state: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

export async function fetchEntityList(
  entityType: string,
  filters?: any,
  pagination?: { page: number; perPage: number }
): Promise<{ data: any[]; total: number }> {
  const queryParams = new URLSearchParams();

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
  }

  if (pagination) {
    queryParams.append('page', String(pagination.page));
    queryParams.append('perPage', String(pagination.perPage));
  }

  const response = await fetch(
    `/api/erp/entity/${entityType}?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch entity list: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    data: result.data,
    total: result.meta?.total || result.data.length,
  };
}

// ==================== DASHBOARD DATA ====================

export async function fetchDashboardKPIs(): Promise<any[]> {
  const response = await fetch('/api/erp/dashboard/kpis', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await response.json();
  return result.data || [];
}

export async function fetchDashboardAlerts(): Promise<any[]> {
  const response = await fetch('/api/erp/dashboard/alerts', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await response.json();
  return result.data || [];
}

export async function fetchActivityFeed(limit?: number): Promise<any[]> {
  const queryParams = limit ? `?limit=${limit}` : '';

  const response = await fetch(`/api/erp/dashboard/activity${queryParams}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await response.json();
  return result.data || [];
}

// ==================== SYSTEM CHECK ====================

export async function performSystemCheck(): Promise<any> {
  const response = await fetch('/api/erp/system-check', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return response.json();
}

// ==================== TYPES ====================

export interface TransactionResponse {
  success: boolean;
  data?: any;
  state?: any;
  journalEntries?: any[];
  error?: string;
  details?: any;
  persistence?: {
    success: boolean;
    error?: string;
  };
}

// ==================== DEPRECATED FUNCTIONS WARNING ====================

/**
 * @deprecated Use executeTransaction() instead
 * Direct API calls are NOT allowed - all operations must go through ERPExecutionEngine
 */
export async function executeBusinessAction(request: any): Promise<TransactionResponse> {
  console.warn('executeBusinessAction is deprecated. Use executeTransaction instead.');
  return executeTransaction(request.action, request.payload);
}

/**
 * @deprecated Use executeTransaction() with proper type
 */
export async function convertOrderToInvoice(orderId: string, orderType: string): Promise<TransactionResponse> {
  console.warn('convertOrderToInvoice is deprecated. Use executeTransaction instead.');
  return executeTransaction(
    orderType === 'SALES_ORDER' ? 'SALES_INVOICE' : 'PURCHASE_INVOICE',
    { sourceOrderId: orderId, conversion: true }
  );
}
