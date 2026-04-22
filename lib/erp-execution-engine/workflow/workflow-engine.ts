/**
 * Workflow Engine
 * Manages state transitions for all business entities
 */

import { ERPTransaction, ERPTransactionType } from '../types';
import { WorkflowRepository } from '../services/workflow-repository';

// State machine definitions
const stateMachines: { [key: string]: { [key: string]: string[] } } = {
  SALES_ORDER: {
    draft: ['pending', 'cancelled'],
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'invoiced', 'cancelled'],
    shipped: ['delivered', 'invoiced'],
    delivered: ['completed'],
    invoiced: ['completed'],
    completed: [],
    cancelled: [],
  },
  SALES_INVOICE: {
    draft: ['posted', 'cancelled'],
    posted: ['partially_paid', 'paid', 'void'],
    partially_paid: ['paid', 'void'],
    paid: ['completed'],
    completed: [],
    cancelled: [],
    void: [],
  },
  PURCHASE_ORDER: {
    draft: ['pending', 'cancelled'],
    pending: ['confirmed', 'cancelled'],
    confirmed: ['partially_received', 'received', 'cancelled'],
    partially_received: ['received', 'cancelled'],
    received: ['invoiced', 'completed'],
    invoiced: ['completed'],
    completed: [],
    cancelled: [],
  },
  PURCHASE_INVOICE: {
    draft: ['posted', 'cancelled'],
    posted: ['partially_paid', 'paid', 'void'],
    partially_paid: ['paid', 'void'],
    paid: ['completed'],
    completed: [],
    cancelled: [],
    void: [],
  },
  PAYMENT: {
    pending: ['posted', 'cancelled'],
    posted: ['cleared', 'bounced'],
    cleared: ['completed'],
    bounced: ['pending', 'cancelled'],
    completed: [],
    cancelled: [],
  },
  PRODUCTION_ORDER: {
    planned: ['released', 'cancelled'],
    released: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'partially_completed', 'cancelled'],
    partially_completed: ['completed', 'cancelled'],
    completed: ['closed'],
    closed: [],
    cancelled: [],
  },
  STOCK_TRANSFER: {
    pending: ['in_transit', 'cancelled'],
    in_transit: ['received', 'cancelled'],
    received: ['completed'],
    completed: [],
    cancelled: [],
  },
};

export class WorkflowEngine {
  static async transition(tx: ERPTransaction, state: any): Promise<any> {
    const { type, payload } = tx;
    
    // Get current status
    const currentStatus = state?.status || 'draft';
    
    // Get target status from payload or determine based on business rules
    const targetStatus = payload.status || this.getDefaultNextStatus(type, currentStatus);
    
    // Validate transition
    const validTransitions = stateMachines[type]?.[currentStatus] || [];
    
    if (!validTransitions.includes(targetStatus)) {
      throw new Error(
        `Invalid state transition for ${type}: ${currentStatus} -> ${targetStatus}. ` +
        `Valid transitions: ${validTransitions.join(', ')}`
      );
    }
    
    // Update workflow state
    const updatedState = await WorkflowRepository.update({
      entityId: state?.id || payload.id,
      status: targetStatus,
    });
    
    return {
      ...state,
      status: targetStatus,
      previousStatus: currentStatus,
      transitionTimestamp: new Date(),
    };
  }
  
  static getNextStatus(type: ERPTransactionType, currentStatus: string): string | null {
    const transitions = stateMachines[type]?.[currentStatus];
    return transitions?.[0] || null;
  }
  
  private static getDefaultNextStatus(type: ERPTransactionType, currentStatus: string): string {
    const next = this.getNextStatus(type, currentStatus);
    return next || currentStatus;
  }
  
  static isValidTransition(type: ERPTransactionType, from: string, to: string): boolean {
    const validTransitions = stateMachines[type]?.[from] || [];
    return validTransitions.includes(to);
  }
  
  static getAvailableTransitions(type: ERPTransactionType, currentStatus: string): string[] {
    return stateMachines[type]?.[currentStatus] || [];
  }
}
