/**
 * ERP Execution Engine - Main Entry Point
 * 
 * This module provides a centralized execution layer for all ERP business operations.
 * 
 * Usage:
 * ```typescript
 * import { ERPExecutionEngine, ERPTransaction } from '@/lib/erp-execution-engine';
 * 
 * const transaction: ERPTransaction = {
 *   type: 'SALES_INVOICE',
 *   payload: { ... },
 *   context: { userId: '...', tenantId: '...' }
 * };
 * 
 * const result = await ERPExecutionEngine.execute(transaction);
 * ```
 */

export { ERPExecutionEngine } from './erp-execution-engine';
export type {
  ERPTransaction,
  ERPTransactionType,
  ERPTransactionResult,
  BeforeState,
} from './types';

// Export validators
export { TransactionValidator } from './validators/transaction-validator';

// Export routers
export { BusinessRouter } from './routers/business-router';

// Export adapters
export { InventoryAdapter } from './adapters/inventory-adapter';
export { AccountingAdapter } from './adapters/accounting-adapter';

// Export workflow
export { WorkflowEngine } from './workflow/workflow-engine';

// Export services
export { AuditService } from './services/audit-service';
export { EventBus } from './services/event-bus';
export { StateLoader } from './services/state-loader';
export { WorkflowRepository } from './services/workflow-repository';
export { JournalService } from './services/journal-service';
