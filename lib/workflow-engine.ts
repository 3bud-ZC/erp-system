/**
 * ERP Workflow Orchestration Engine
 * 
 * Centralized module that:
 * - Handles all state transitions
 * - Triggers domain events
 * - Enforces business rules
 * - Prevents invalid transitions
 * - Logs every transition
 */

import { prisma } from '@/lib/db';
import { 
  getWorkflow, 
  validateTransition, 
  WorkflowDefinition, 
  TransitionValidation 
} from './workflow-state-machines';

// ==================== EVENT TYPES ====================

export enum DomainEventType {
  // Sales Events
  QuotationCreated = 'QuotationCreated',
  QuotationSent = 'QuotationSent',
  QuotationAccepted = 'QuotationAccepted',
  QuotationRejected = 'QuotationRejected',
  QuotationConverted = 'QuotationConverted',
  
  SalesOrderCreated = 'SalesOrderCreated',
  SalesOrderConfirmed = 'SalesOrderConfirmed',
  SalesOrderCancelled = 'SalesOrderCancelled',
  
  InvoiceCreated = 'InvoiceCreated',
  InvoiceSent = 'InvoiceSent',
  InvoicePaid = 'InvoicePaid',
  InvoiceCancelled = 'InvoiceCancelled',
  
  SalesReturnCreated = 'SalesReturnCreated',
  SalesReturnApproved = 'SalesReturnApproved',
  SalesReturnRejected = 'SalesReturnRejected',
  
  PaymentReceived = 'PaymentReceived',
  PaymentRefunded = 'PaymentRefunded',
  
  // Purchase Events
  PurchaseRequisitionCreated = 'PurchaseRequisitionCreated',
  PurchaseRequisitionApproved = 'PurchaseRequisitionApproved',
  PurchaseRequisitionRejected = 'PurchaseRequisitionRejected',
  
  PurchaseOrderCreated = 'PurchaseOrderCreated',
  PurchaseOrderConfirmed = 'PurchaseOrderConfirmed',
  PurchaseOrderCancelled = 'PurchaseOrderCancelled',
  
  PurchaseReceiptCreated = 'PurchaseReceiptCreated',
  PurchaseReceiptCompleted = 'PurchaseReceiptCompleted',
  
  PurchaseInvoiceCreated = 'PurchaseInvoiceCreated',
  PurchaseInvoicePaid = 'PurchaseInvoicePaid',
  
  PurchaseReturnCreated = 'PurchaseReturnCreated',
  PurchaseReturnApproved = 'PurchaseReturnApproved',
  
  PaymentMade = 'PaymentMade',
  
  // Inventory Events
  StockReserved = 'StockReserved',
  StockReleased = 'StockReleased',
  StockConsumed = 'StockConsumed',
  StockTransferred = 'StockTransferred',
  StockAdjusted = 'StockAdjusted',
  StockCounted = 'StockCounted',
  
  // Production Events
  ProductionOrderCreated = 'ProductionOrderCreated',
  ProductionOrderScheduled = 'ProductionOrderScheduled',
  ProductionOrderStarted = 'ProductionOrderStarted',
  ProductionOrderCompleted = 'ProductionOrderCompleted',
  ProductionOrderCancelled = 'ProductionOrderCancelled',
}

// ==================== DOMAIN EVENT ====================

export interface DomainEvent {
  id: string;
  type: DomainEventType;
  entityType: string;
  entityId: string;
  data: any;
  timestamp: Date;
  userId?: string;
  tenantId?: string;
  correlationId?: string;
}

// ==================== TRANSITION REQUEST ====================

export interface TransitionRequest {
  workflowName: string;
  entityType: string;
  entityId: string;
  from: string;
  to: string;
  userId?: string;
  data?: any;
  skipValidation?: boolean;
}

// ==================== TRANSITION RESULT ====================

export interface TransitionResult {
  success: boolean;
  from: string;
  to: string;
  validation?: TransitionValidation;
  event?: DomainEvent;
  error?: string;
  warnings?: string[];
}

// ==================== EVENT HANDLERS ====================

export interface EventHandler {
  eventType: DomainEventType;
  handler: (event: DomainEvent) => Promise<void>;
}

// ==================== WORKFLOW ENGINE CLASS ====================

class WorkflowEngine {
  private eventHandlers: Map<DomainEventType, EventHandler[]> = new Map();
  private transitionLog: DomainEvent[] = [];

  /**
   * Register an event handler
   */
  registerHandler(handler: EventHandler): void {
    if (!this.eventHandlers.has(handler.eventType)) {
      this.eventHandlers.set(handler.eventType, []);
    }
    this.eventHandlers.get(handler.eventType)!.push(handler);
  }

  /**
   * Execute state transition with full validation and event triggering
   */
  async transition(request: TransitionRequest): Promise<TransitionResult> {
    const { workflowName, entityType, entityId, from, to, userId, data, skipValidation } = request;

    // Get workflow definition
    const workflow = getWorkflow(workflowName);
    if (!workflow) {
      return {
        success: false,
        from,
        to,
        error: `Workflow not found: ${workflowName}`,
      };
    }

    // Validate transition
    const validation = skipValidation 
      ? { allowed: true } 
      : validateTransition(workflow, from, to);

    if (!validation.allowed) {
      return {
        success: false,
        from,
        to,
        validation,
        error: validation.reason,
      };
    }

    // Execute state transition
    try {
      // Call onExit handler for current state
      const fromState = workflow.states[from];
      if (fromState.onExit) {
        await fromState.onExit({ ...data, entityType, entityId, userId });
      }

      // Update entity state in database
      await this.updateEntityState(entityType, entityId, to);

      // Call onEnter handler for new state
      const toState = workflow.states[to];
      if (toState.onEnter) {
        await toState.onEnter({ ...data, entityType, entityId, userId });
      }

      // Create and emit domain event
      const event = await this.createAndEmitEvent(
        workflowName,
        entityType,
        entityId,
        from,
        to,
        data,
        userId
      );

      // Log transition
      await this.logTransition(request, event);

      return {
        success: true,
        from,
        to,
        event,
      };
    } catch (error) {
      return {
        success: false,
        from,
        to,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update entity state in database
   */
  private async updateEntityState(entityType: string, entityId: string, newState: string): Promise<void> {
    const stateFieldMap: Record<string, string> = {
      Quotation: 'status',
      SalesOrder: 'status',
      SalesInvoice: 'status',
      SalesReturn: 'status',
      PurchaseRequisition: 'status',
      PurchaseOrder: 'status',
      PurchaseInvoice: 'status',
      PurchaseReturn: 'status',
      StockAdjustment: 'status',
      StockTransfer: 'status',
      ProductionOrder: 'status',
    };

    const stateField = stateFieldMap[entityType];
    if (!stateField) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    const modelName = entityType.toLowerCase();
    
    // Use Prisma to update entity state
    // @ts-ignore - Dynamic model access
    await prisma[modelName].update({
      where: { id: entityId },
      data: { [stateField]: newState },
    });
  }

  /**
   * Create and emit domain event
   */
  private async createAndEmitEvent(
    workflowName: string,
    entityType: string,
    entityId: string,
    from: string,
    to: string,
    data: any,
    userId?: string
  ): Promise<DomainEvent> {
    // Determine event type based on workflow and transition
    const eventType = this.determineEventType(workflowName, from, to);

    const event: DomainEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      entityType,
      entityId,
      data: {
        from,
        to,
        ...data,
      },
      timestamp: new Date(),
      userId,
    };

    // Store event in database
    await prisma.workflowEvent.create({
      data: {
        eventType: eventType.toString(),
        entityType,
        entityId,
        eventData: JSON.stringify(event.data),
        timestamp: event.timestamp,
        userId,
      },
    });

    // Trigger event handlers
    await this.emitEvent(event);

    return event;
  }

  /**
   * Determine event type based on workflow and transition
   */
  private determineEventType(workflowName: string, from: string, to: string): DomainEventType {
    const transitionKey = `${workflowName}:${from}:${to}`;
    
    const eventTypeMap: Record<string, DomainEventType> = {
      // Sales workflow
      'SalesWorkflow:draft:sent': DomainEventType.QuotationSent,
      'SalesWorkflow:sent:accepted': DomainEventType.QuotationAccepted,
      'SalesWorkflow:sent:rejected': DomainEventType.QuotationRejected,
      'SalesWorkflow:accepted:converted': DomainEventType.QuotationConverted,
      'SalesWorkflow:converted:invoiced': DomainEventType.InvoiceCreated,
      'SalesWorkflow:invoiced:paid': DomainEventType.InvoicePaid,
      
      // Purchase workflow
      'PurchaseWorkflow:draft:approved': DomainEventType.PurchaseRequisitionApproved,
      'PurchaseWorkflow:approved:ordered': DomainEventType.PurchaseOrderCreated,
      'PurchaseWorkflow:ordered:received': DomainEventType.PurchaseReceiptCompleted,
      'PurchaseWorkflow:received:invoiced': DomainEventType.PurchaseInvoiceCreated,
      'PurchaseWorkflow:invoiced:paid': DomainEventType.PurchaseInvoicePaid,
      
      // Inventory workflow
      'InventoryWorkflow:available:reserved': DomainEventType.StockReserved,
      'InventoryWorkflow:reserved:consumed': DomainEventType.StockConsumed,
      'InventoryWorkflow:reserved:released': DomainEventType.StockReleased,
      'InventoryWorkflow:available:transferred': DomainEventType.StockTransferred,
      'InventoryWorkflow:available:adjusted': DomainEventType.StockAdjusted,
      'InventoryWorkflow:available:counted': DomainEventType.StockCounted,
      
      // Production workflow
      'ProductionWorkflow:planned:scheduled': DomainEventType.ProductionOrderScheduled,
      'ProductionWorkflow:scheduled:in_progress': DomainEventType.ProductionOrderStarted,
      'ProductionWorkflow:in_progress:completed': DomainEventType.ProductionOrderCompleted,
    };

    return eventTypeMap[transitionKey] || DomainEventType.QuotationCreated; // Default
  }

  /**
   * Emit event to registered handlers
   */
  private async emitEvent(event: DomainEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        await handler.handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    }
  }

  /**
   * Log transition to audit trail
   */
  private async logTransition(request: TransitionRequest, event: DomainEvent): Promise<void> {
    await prisma.workflowTransitionLog.create({
      data: {
        workflowName: request.workflowName,
        entityType: request.entityType,
        entityId: request.entityId,
        fromState: request.from,
        toState: request.to,
        eventId: event.id,
        userId: request.userId,
        timestamp: new Date(),
        requestData: JSON.stringify(request.data),
      },
    });
  }

  /**
   * Get transition history for an entity
   */
  async getTransitionHistory(entityType: string, entityId: string): Promise<any[]> {
    const logs = await prisma.workflowTransitionLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { timestamp: 'desc' },
    });

    return logs;
  }

  /**
   * Get current state of an entity
   */
  async getCurrentState(entityType: string, entityId: string): Promise<string | null> {
    const stateFieldMap: Record<string, string> = {
      Quotation: 'status',
      SalesOrder: 'status',
      SalesInvoice: 'status',
      SalesReturn: 'status',
      PurchaseRequisition: 'status',
      PurchaseOrder: 'status',
      PurchaseInvoice: 'status',
      PurchaseReturn: 'status',
      StockAdjustment: 'status',
      StockTransfer: 'status',
      ProductionOrder: 'status',
    };

    const stateField = stateFieldMap[entityType];
    if (!stateField) {
      return null;
    }

    const modelName = entityType.toLowerCase();
    
    // @ts-ignore - Dynamic model access
    const entity = await prisma[modelName].findUnique({
      where: { id: entityId },
      select: { [stateField]: true },
    });

    return entity ? entity[stateField] : null;
  }

  /**
   * Check if transition is valid
   */
  canTransition(workflowName: string, from: string, to: string): TransitionValidation {
    const workflow = getWorkflow(workflowName);
    if (!workflow) {
      return { allowed: false, reason: `Workflow not found: ${workflowName}` };
    }
    return validateTransition(workflow, from, to);
  }

  /**
   * Get available transitions from current state
   */
  getAvailableTransitions(workflowName: string, currentState: string): string[] {
    const workflow = getWorkflow(workflowName);
    if (!workflow) {
      return [];
    }
    const state = workflow.states[currentState];
    return state ? state.canTransitionTo : [];
  }
}

// ==================== EXPORT SINGLETON ====================

export const workflowEngine = new WorkflowEngine();

// ==================== HELPER FUNCTIONS ====================

/**
 * Helper function to transition entity with automatic state detection
 */
export async function transitionEntity(
  entityType: string,
  entityId: string,
  to: string,
  userId?: string,
  data?: any
): Promise<TransitionResult> {
  const workflowName = `${entityType}Workflow`;
  const currentState = await workflowEngine.getCurrentState(entityType, entityId);
  
  if (!currentState) {
    return {
      success: false,
      from: '',
      to,
      error: `Entity not found or has no state: ${entityType}/${entityId}`,
    };
  }

  return workflowEngine.transition({
    workflowName,
    entityType,
    entityId,
    from: currentState,
    to,
    userId,
    data,
  });
}

/**
 * Helper function to validate transition without executing
 */
export function validateEntityTransition(
  entityType: string,
  from: string,
  to: string
): TransitionValidation {
  const workflowName = `${entityType}Workflow`;
  return workflowEngine.canTransition(workflowName, from, to);
}
