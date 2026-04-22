/**
 * ERP Engine Integration Layer
 * Frontend service layer that connects UI to ERPExecutionEngine
 */

import { WorkflowStatus } from './types';
import { logger } from '@/lib/structured-logger';

// ==================== TRANSACTION SERVICE ====================

export interface TransactionRequest {
  type: string;
  payload: any;
}

export interface TransactionResponse {
  success: boolean;
  data?: any;
  error?: string;
  state?: any;
  journalEntries?: any[];
}

export async function createTransaction(
  request: TransactionRequest
): Promise<TransactionResponse> {
  try {
    logger.info('Creating transaction', undefined, { type: request.type });

    const response = await fetch('/api/erp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Transaction failed');
    }

    return {
      success: true,
      data: result.data,
      state: result.state,
      journalEntries: result.journalEntries,
    };
  } catch (error: any) {
    logger.error('Transaction creation failed', error, undefined, { type: request.type });

    return {
      success: false,
      error: error.message,
    };
  }
}

// ==================== WORKFLOW SERVICE ====================

export interface WorkflowUpdateRequest {
  entityType: string;
  entityId: string;
  targetStatus: WorkflowStatus;
  notes?: string;
}

export async function approveTransaction(
  entityType: string,
  entityId: string
): Promise<TransactionResponse> {
  return updateWorkflowState({
    entityType,
    entityId,
    targetStatus: 'confirmed',
    notes: 'Approved by user',
  });
}

export async function postTransaction(
  entityType: string,
  entityId: string
): Promise<TransactionResponse> {
  return updateWorkflowState({
    entityType,
    entityId,
    targetStatus: 'posted',
    notes: 'Posted to ledger',
  });
}

export async function cancelTransaction(
  entityType: string,
  entityId: string,
  reason: string
): Promise<TransactionResponse> {
  return updateWorkflowState({
    entityType,
    entityId,
    targetStatus: 'cancelled',
    notes: reason,
  });
}

export async function updateWorkflowState(
  request: WorkflowUpdateRequest
): Promise<TransactionResponse> {
  try {
    logger.info('Updating workflow state', undefined, {
      entityType: request.entityType,
      entityId: request.entityId,
      targetStatus: request.targetStatus,
    });

    const response = await fetch('/api/erp/workflow/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Workflow update failed');
    }

    return {
      success: true,
      data: result.data,
      state: result.data?.workflow,
    };
  } catch (error: any) {
    logger.error('Workflow update failed', error);

    return {
      success: false,
      error: error.message,
    };
  }
}

// ==================== BUSINESS STATE SERVICE ====================

export async function fetchBusinessState(
  entityType: string,
  entityId: string
): Promise<any> {
  try {
    const response = await fetch(`/api/erp/entity/${entityType}/${entityId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch state');
    }

    return result.data;
  } catch (error: any) {
    logger.error('Failed to fetch business state', error, undefined, { entityType, entityId });

    throw error;
  }
}

export async function fetchEntityList(
  entityType: string,
  filters?: any,
  pagination?: { page: number; perPage: number }
): Promise<{ data: any[]; total: number }> {
  try {
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

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch list');
    }

    return {
      data: result.data,
      total: result.meta?.total || result.data.length,
    };
  } catch (error: any) {
    logger.error('Failed to fetch entity list', error, undefined, { entityType });

    throw error;
  }
}

// ==================== ACTION SERVICE ====================

export interface BusinessActionRequest {
  action: string;
  entityType: string;
  entityId: string;
  payload?: any;
}

export async function executeBusinessAction(
  request: BusinessActionRequest
): Promise<TransactionResponse> {
  try {
    logger.info('Executing business action', undefined, {
      action: request.action,
      entityType: request.entityType,
      entityId: request.entityId,
    });

    const response = await fetch('/api/erp/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Action failed');
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    logger.error('Business action failed', error, undefined, { action: request.action });

    return {
      success: false,
      error: error.message,
    };
  }
}

// ==================== CONVERSION SERVICE ====================

export async function convertOrderToInvoice(
  orderId: string,
  orderType: 'SALES_ORDER' | 'PURCHASE_ORDER'
): Promise<TransactionResponse> {
  return createTransaction({
    type: orderType === 'SALES_ORDER' ? 'SALES_INVOICE' : 'PURCHASE_INVOICE',
    payload: {
      sourceOrderId: orderId,
      conversion: true,
    },
  });
}

export async function convertQuotationToOrder(
  quotationId: string
): Promise<TransactionResponse> {
  return createTransaction({
    type: 'SALES_ORDER',
    payload: {
      sourceQuotationId: quotationId,
      conversion: true,
    },
  });
}

// ==================== DASHBOARD SERVICE ====================

export async function fetchDashboardKPIs(): Promise<any[]> {
  try {
    const response = await fetch('/api/erp/dashboard/kpis', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch KPIs');
    }

    return result.data;
  } catch (error: any) {
    logger.error('Failed to fetch dashboard KPIs', error);

    return [];
  }
}

export async function fetchDashboardAlerts(): Promise<any[]> {
  try {
    const response = await fetch('/api/erp/dashboard/alerts', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch alerts');
    }

    return result.data;
  } catch (error: any) {
    logger.error('Failed to fetch dashboard alerts', error);

    return [];
  }
}

export async function fetchActivityFeed(limit?: number): Promise<any[]> {
  try {
    const queryParams = limit ? `?limit=${limit}` : '';
    
    const response = await fetch(`/api/erp/dashboard/activity${queryParams}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch activity');
    }

    return result.data;
  } catch (error: any) {
    logger.error('Failed to fetch activity feed', error);

    return [];
  }
}

// ==================== REPORT SERVICE ====================

export async function fetchReport(
  reportId: string,
  parameters?: any
): Promise<any> {
  try {
    const queryParams = new URLSearchParams();
    
    if (parameters) {
      Object.entries(parameters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(
      `/api/erp/reports/${reportId}?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch report');
    }

    return result.data;
  } catch (error: any) {
    logger.error('Failed to fetch report', error, undefined, { reportId });

    throw error;
  }
}

// ==================== HELPER FUNCTIONS ====================

export function handleTransactionError(error: any): string {
  if (error?.message) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred';
}

export function isSuccessful(response: TransactionResponse): boolean {
  return response.success === true;
}
