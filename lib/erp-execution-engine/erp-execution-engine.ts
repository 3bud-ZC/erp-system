/**
 * ERP Execution Engine
 * Centralized execution layer for all business operations
 * 
 * RULES:
 * - No API should directly update DB
 * - All business logic MUST go through ERPExecutionEngine
 * - All accounting MUST be automatic
 * - All stock changes MUST go through InventoryAdapter
 * - All state changes MUST go through WorkflowEngine
 * - All actions MUST be audited
 */

import { ERPTransaction, ERPTransactionResult } from './types';
import { TransactionValidator } from './validators/transaction-validator';
import { StateLoader } from './services/state-loader';
import { WorkflowEngine } from './workflow/workflow-engine';
import { BusinessRouter } from './routers/business-router';
import { InventoryAdapter } from './adapters/inventory-adapter';
import { AccountingAdapter } from './adapters/accounting-adapter';
import { AuditService } from './services/audit-service';
import { EventBus } from './services/event-bus';
import { logger } from '@/lib/structured-logger';

export class ERPExecutionEngine {
  static async execute(tx: ERPTransaction): Promise<ERPTransactionResult> {
    try {
      // Step 1: Validate transaction
      await logger.info(`Starting transaction validation: ${tx.type}`);
      await TransactionValidator.validate(tx);

      // Step 2: Load current state
      await logger.info(`Loading state for: ${tx.type}`);
      const beforeState = await StateLoader.load(tx);

      // Step 3: Execute workflow transition
      await logger.info(`Executing workflow transition: ${tx.type}`);
      const workflowResult = await WorkflowEngine.transition(tx, beforeState);

      // Step 4: Route to business logic
      await logger.info(`Routing to business logic: ${tx.type}`);
      const businessResult = await BusinessRouter.route(tx, workflowResult);

      // Step 5: Sync inventory
      await logger.info(`Syncing inventory: ${tx.type}`);
      await InventoryAdapter.sync(tx, businessResult);

      // Step 6: Generate and post journal entries
      await logger.info(`Posting to ledger: ${tx.type}`);
      const journalEntries = await AccountingAdapter.post(tx, businessResult);

      // Step 7: Emit event
      await logger.info(`Emitting event: ${tx.type}`);
      await EventBus.emit({
        type: `${tx.type}.EXECUTED`,
        payload: businessResult,
      });

      // Step 8: Audit log
      await logger.info(`Creating audit log: ${tx.type}`);
      await AuditService.log({
        tx,
        beforeState,
        afterState: businessResult,
        journalEntries,
      });

      await logger.info(`Transaction executed successfully: ${tx.type}`, undefined, { transactionId: tx.id });

      return {
        success: true,
        data: businessResult,
        state: workflowResult,
        journalEntries,
      };
    } catch (error: any) {
      await logger.error(`Transaction execution failed: ${tx.type}`, error, undefined, { transactionId: tx.id });

      return {
        success: false,
        data: null,
        state: null,
        errors: [error.message],
      };
    }
  }
}

// Re-export all types and classes for easy access
export * from './types';
export { TransactionValidator } from './validators/transaction-validator';
export { BusinessRouter } from './routers/business-router';
export { InventoryAdapter } from './adapters/inventory-adapter';
export { AccountingAdapter } from './adapters/accounting-adapter';
export { WorkflowEngine } from './workflow/workflow-engine';
export { AuditService } from './services/audit-service';
export { EventBus } from './services/event-bus';
