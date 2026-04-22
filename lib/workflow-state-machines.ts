/**
 * ERP Workflow State Machines
 * 
 * Defines state transitions and validation rules for all core ERP modules
 */

// ==================== WORKFLOW DEFINITIONS ====================

export interface WorkflowState {
  value: string;
  label: string;
  canTransitionTo: string[];
  onEnter?: (context: any) => Promise<void>;
  onExit?: (context: any) => Promise<void>;
}

export interface WorkflowDefinition {
  name: string;
  initial: string;
  states: Record<string, WorkflowState>;
  transitions: Record<string, string[]>;
}

// ==================== SALES WORKFLOW ====================

/**
 * Sales Workflow State Machine
 * Flow: Quotation → Sales Order → Invoice → Payment → Closed
 */
export const salesWorkflow: WorkflowDefinition = {
  name: 'SalesWorkflow',
  initial: 'draft',
  states: {
    draft: {
      value: 'draft',
      label: 'Draft',
      canTransitionTo: ['sent', 'cancelled'],
      onEnter: async (context) => {
        // Initialize quotation with default values
      },
    },
    sent: {
      value: 'sent',
      label: 'Sent',
      canTransitionTo: ['accepted', 'rejected', 'cancelled'],
      onEnter: async (context) => {
        // Send quotation to customer
      },
    },
    accepted: {
      value: 'accepted',
      label: 'Accepted',
      canTransitionTo: ['converted'],
      onEnter: async (context) => {
        // Generate journal entry: DR Unbilled AR, CR Deferred Revenue
        // Reserve stock (NOT deduct yet)
      },
    },
    rejected: {
      value: 'rejected',
      label: 'Rejected',
      canTransitionTo: [],
    },
    converted: {
      value: 'converted',
      label: 'Converted to Sales Order',
      canTransitionTo: ['invoiced', 'cancelled'],
      onEnter: async (context) => {
        // Create sales order from quotation
        // Reverse quotation journal entry if exists
      },
    },
    invoiced: {
      value: 'invoiced',
      label: 'Invoiced',
      canTransitionTo: ['partially_paid', 'paid', 'cancelled'],
      onEnter: async (context) => {
        // Reverse sales order journal entry (DR Unbilled AR, CR Deferred Revenue)
        // Create invoice journal entry (DR AR, CR Revenue, CR Tax)
        // Deduct stock (now actual consumption)
        // Update inventory transactions
      },
    },
    partially_paid: {
      value: 'partially_paid',
      label: 'Partially Paid',
      canTransitionTo: ['paid'],
    },
    paid: {
      value: 'paid',
      label: 'Paid',
      canTransitionTo: ['closed'],
      onEnter: async (context) => {
        // Payment journal entry: DR Cash/Bank, CR AR
        // Update invoice payment status
      },
    },
    cancelled: {
      value: 'cancelled',
      label: 'Cancelled',
      canTransitionTo: [],
      onEnter: async (context) => {
        // Reverse all journal entries
        // Restore reserved stock
      },
    },
    closed: {
      value: 'closed',
      label: 'Closed',
      canTransitionTo: [],
    },
  },
  transitions: {
    draft: ['sent', 'cancelled'],
    sent: ['accepted', 'rejected', 'cancelled'],
    accepted: ['converted'],
    rejected: [],
    converted: ['invoiced', 'cancelled'],
    invoiced: ['partially_paid', 'paid', 'cancelled'],
    partially_paid: ['paid'],
    paid: ['closed'],
    cancelled: [],
    closed: [],
  },
};

// ==================== PURCHASE WORKFLOW ====================

/**
 * Purchase Workflow State Machine
 * Flow: Purchase Requisition → Purchase Order → Receipt → Invoice → Payment → Closed
 */
export const purchaseWorkflow: WorkflowDefinition = {
  name: 'PurchaseWorkflow',
  initial: 'draft',
  states: {
    draft: {
      value: 'draft',
      label: 'Draft',
      canTransitionTo: ['approved', 'rejected', 'cancelled'],
      onEnter: async (context) => {
        // Initialize purchase requisition
      },
    },
    approved: {
      value: 'approved',
      label: 'Approved',
      canTransitionTo: ['ordered'],
      onEnter: async (context) => {
        // Approve requisition
      },
    },
    rejected: {
      value: 'rejected',
      label: 'Rejected',
      canTransitionTo: [],
    },
    ordered: {
      value: 'ordered',
      label: 'Purchase Order Created',
      canTransitionTo: ['partially_received', 'received', 'cancelled'],
      onEnter: async (context) => {
        // Generate journal entry: DR Unbilled Inventory, CR Accrued Payables
        // Reserve expected stock inflow
      },
    },
    partially_received: {
      value: 'partially_received',
      label: 'Partially Received',
      canTransitionTo: ['received'],
      onEnter: async (context) => {
        // Partial goods receipt
        // Partial stock increment
        // Partial journal entry adjustment
      },
    },
    received: {
      value: 'received',
      label: 'Fully Received',
      canTransitionTo: ['invoiced', 'cancelled'],
      onEnter: async (context) => {
        // Full goods receipt
        // Full stock increment
        // Create inventory transactions
      },
    },
    invoiced: {
      value: 'invoiced',
      label: 'Invoiced',
      canTransitionTo: ['partially_paid', 'paid', 'cancelled'],
      onEnter: async (context) => {
        // Reverse PO journal entry (DR Unbilled Inventory, CR Accrued Payables)
        // Create invoice journal entry (DR Inventory, CR AP, CR Tax)
        // Update supplier balance
      },
    },
    partially_paid: {
      value: 'partially_paid',
      label: 'Partially Paid',
      canTransitionTo: ['paid'],
    },
    paid: {
      value: 'paid',
      label: 'Paid',
      canTransitionTo: ['closed'],
      onEnter: async (context) => {
        // Payment journal entry: DR AP, CR Cash/Bank
        // Update invoice payment status
      },
    },
    cancelled: {
      value: 'cancelled',
      label: 'Cancelled',
      canTransitionTo: [],
      onEnter: async (context) => {
        // Reverse all journal entries
        // Cancel reserved stock inflow
      },
    },
    closed: {
      value: 'closed',
      label: 'Closed',
      canTransitionTo: [],
    },
  },
  transitions: {
    draft: ['approved', 'rejected', 'cancelled'],
    approved: ['ordered'],
    rejected: [],
    ordered: ['partially_received', 'received', 'cancelled'],
    partially_received: ['received'],
    received: ['invoiced', 'cancelled'],
    invoiced: ['partially_paid', 'paid', 'cancelled'],
    partially_paid: ['paid'],
    paid: ['closed'],
    cancelled: [],
    closed: [],
  },
};

// ==================== INVENTORY WORKFLOW ====================

/**
 * Inventory Workflow State Machine
 */
export const inventoryWorkflow: WorkflowDefinition = {
  name: 'InventoryWorkflow',
  initial: 'available',
  states: {
    available: {
      value: 'available',
      label: 'Available',
      canTransitionTo: ['reserved', 'transferred', 'adjusted', 'counted'],
    },
    reserved: {
      value: 'reserved',
      label: 'Reserved',
      canTransitionTo: ['consumed', 'released'],
      onEnter: async (context) => {
        // Reserve stock for sales order
        // Update reservation record
      },
    },
    consumed: {
      value: 'consumed',
      label: 'Consumed',
      canTransitionTo: [],
      onEnter: async (context) => {
        // Stock consumed (sales, production)
        // Create inventory transaction
        // Update COGS if applicable
      },
    },
    released: {
      value: 'released',
      label: 'Released',
      canTransitionTo: ['available'],
      onEnter: async (context) => {
        // Release reservation back to available
      },
    },
    transferred: {
      value: 'transferred',
      label: 'Transferred',
      canTransitionTo: ['available'],
      onEnter: async (context) => {
        // Stock transfer between warehouses
        // Create transfer transaction
        // Update warehouse balances
      },
    },
    adjusted: {
      value: 'adjusted',
      label: 'Adjusted',
      canTransitionTo: ['available'],
      onEnter: async (context) => {
        // Stock adjustment (increase/decrease)
        // Create adjustment transaction
        // Journal entry for adjustment
      },
    },
    counted: {
      value: 'counted',
      label: 'Counted',
      canTransitionTo: ['available', 'adjusted'],
      onEnter: async (context) => {
        // Stocktake result
        // Calculate variance
        // Auto-adjust if enabled
      },
    },
  },
  transitions: {
    available: ['reserved', 'transferred', 'adjusted', 'counted'],
    reserved: ['consumed', 'released'],
    consumed: [],
    released: ['available'],
    transferred: ['available'],
    adjusted: ['available'],
    counted: ['available', 'adjusted'],
  },
};

// ==================== PRODUCTION WORKFLOW ====================

/**
 * Production Workflow State Machine
 */
export const productionWorkflow: WorkflowDefinition = {
  name: 'ProductionWorkflow',
  initial: 'planned',
  states: {
    planned: {
      value: 'planned',
      label: 'Planned',
      canTransitionTo: ['scheduled', 'cancelled'],
      onEnter: async (context) => {
        // Create production order
        // Calculate material requirements
      },
    },
    scheduled: {
      value: 'scheduled',
      label: 'Scheduled',
      canTransitionTo: ['in_progress', 'cancelled'],
      onEnter: async (context) => {
        // Schedule production
        // Reserve production capacity
        // Reserve raw materials
      },
    },
    in_progress: {
      value: 'in_progress',
      label: 'In Progress',
      canTransitionTo: ['completed', 'cancelled'],
      onEnter: async (context) => {
        // Start production
        // Consume raw materials (journal entry)
        // Create WIP inventory
      },
    },
    completed: {
      value: 'completed',
      label: 'Completed',
      canTransitionTo: ['closed'],
      onEnter: async (context) => {
        // Production completed
        // Consume WIP
        // Create finished goods inventory
        // Journal entry: DR Finished Goods, CR WIP
      },
    },
    cancelled: {
      value: 'cancelled',
      label: 'Cancelled',
      canTransitionTo: [],
      onEnter: async (context) => {
        // Reverse material reservations
        // Release production capacity
      },
    },
    closed: {
      value: 'closed',
      label: 'Closed',
      canTransitionTo: [],
    },
  },
  transitions: {
    planned: ['scheduled', 'cancelled'],
    scheduled: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: ['closed'],
    cancelled: [],
    closed: [],
  },
};

// ==================== STATE TRANSITION VALIDATION ====================

export interface TransitionValidation {
  allowed: boolean;
  reason?: string;
  requiresValidation?: string[];
}

export function validateTransition(
  workflow: WorkflowDefinition,
  from: string,
  to: string
): TransitionValidation {
  const fromState = workflow.states[from];
  
  if (!fromState) {
    return { allowed: false, reason: `Invalid from state: ${from}` };
  }
  
  if (!fromState.canTransitionTo.includes(to)) {
    return { 
      allowed: false, 
      reason: `Cannot transition from ${from} to ${to}. Allowed transitions: ${fromState.canTransitionTo.join(', ')}` 
    };
  }
  
  return { allowed: true };
}

// ==================== WORKFLOW EXPORTS ====================

export const workflowDefinitions = {
  SalesWorkflow: salesWorkflow,
  PurchaseWorkflow: purchaseWorkflow,
  InventoryWorkflow: inventoryWorkflow,
  ProductionWorkflow: productionWorkflow,
};

export function getWorkflow(name: string): WorkflowDefinition | undefined {
  return workflowDefinitions[name as keyof typeof workflowDefinitions];
}
