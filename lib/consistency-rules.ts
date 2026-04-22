/**
 * ERP Consistency Rules Engine
 * 
 * Global validation rules to ensure ERP system integrity:
 * 1. No module can update stock directly
 * 2. No module can post journal entry without event
 * 3. All financial actions must pass workflow engine
 * 4. No state transition without validation
 * 5. Every action must be auditable
 */

import { prisma } from '@/lib/db';
import { workflowEngine, validateEntityTransition } from './workflow-engine';

// ==================== RULE DEFINITIONS ====================

export enum ConsistencyRule {
  STOCK_UPDATE_VIA_WORKFLOW = 'STOCK_UPDATE_VIA_WORKFLOW',
  JOURNAL_ENTRY_VIA_EVENT = 'JOURNAL_ENTRY_VIA_EVENT',
  FINANCIAL_VIA_WORKFLOW = 'FINANCIAL_VIA_WORKFLOW',
  STATE_TRANSITION_VALIDATED = 'STATE_TRANSITION_VALIDATED',
  ACTION_AUDITABLE = 'ACTION_AUDITABLE',
  CREDIT_LIMIT_CHECK = 'CREDIT_LIMIT_CHECK',
  DOUBLE_ENTRY_BALANCED = 'DOUBLE_ENTRY_BALANCED',
  INVENTORY_COSTING_APPLIED = 'INVENTORY_COSTING_APPLIED',
}

export interface RuleViolation {
  rule: ConsistencyRule;
  message: string;
  severity: 'error' | 'warning';
  context?: any;
}

export interface RuleCheckResult {
  passed: boolean;
  violations: RuleViolation[];
}

// ==================== CONSISTENCY RULES ENGINE CLASS ====================

class ConsistencyRulesEngine {
  private enabledRules: Set<ConsistencyRule> = new Set([
    ConsistencyRule.STOCK_UPDATE_VIA_WORKFLOW,
    ConsistencyRule.JOURNAL_ENTRY_VIA_EVENT,
    ConsistencyRule.FINANCIAL_VIA_WORKFLOW,
    ConsistencyRule.STATE_TRANSITION_VALIDATED,
    ConsistencyRule.ACTION_AUDITABLE,
    ConsistencyRule.CREDIT_LIMIT_CHECK,
    ConsistencyRule.DOUBLE_ENTRY_BALANCED,
    ConsistencyRule.INVENTORY_COSTING_APPLIED,
  ]);

  /**
   * Enable a specific rule
   */
  enableRule(rule: ConsistencyRule): void {
    this.enabledRules.add(rule);
  }

  /**
   * Disable a specific rule
   */
  disableRule(rule: ConsistencyRule): void {
    this.enabledRules.delete(rule);
  }

  /**
   * Check if a rule is enabled
   */
  isRuleEnabled(rule: ConsistencyRule): boolean {
    return this.enabledRules.has(rule);
  }

  /**
   * Validate all rules before an action
   */
  async validateBeforeAction(action: string, context: any): Promise<RuleCheckResult> {
    const violations: RuleViolation[] = [];

    // Rule-specific checks based on action
    switch (action) {
      case 'stock_update':
        violations.push(...await this.checkStockUpdateRules(context));
        break;
      case 'journal_entry_post':
        violations.push(...await this.checkJournalEntryRules(context));
        break;
      case 'state_transition':
        violations.push(...await this.checkStateTransitionRules(context));
        break;
      case 'financial_transaction':
        violations.push(...await this.checkFinancialTransactionRules(context));
        break;
    }

    return {
      passed: violations.filter(v => v.severity === 'error').length === 0,
      violations,
    };
  }

  /**
   * Check stock update rules
   * Rule: No module can update stock directly - must use workflow engine
   */
  private async checkStockUpdateRules(context: any): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    if (!this.isRuleEnabled(ConsistencyRule.STOCK_UPDATE_VIA_WORKFLOW)) {
      return violations;
    }

    // Check if stock update is via workflow engine
    if (!context.viaWorkflowEngine) {
      violations.push({
        rule: ConsistencyRule.STOCK_UPDATE_VIA_WORKFLOW,
        message: 'Stock updates must be performed through the workflow engine',
        severity: 'error',
        context,
      });
    }

    // Check if costing engine is applied
    if (!context.costingApplied && this.isRuleEnabled(ConsistencyRule.INVENTORY_COSTING_APPLIED)) {
      violations.push({
        rule: ConsistencyRule.INVENTORY_COSTING_APPLIED,
        message: 'Inventory costing engine must be applied for stock movements',
        severity: 'error',
        context,
      });
    }

    return violations;
  }

  /**
   * Check journal entry rules
   * Rule: No module can post journal entry without event
   */
  private async checkJournalEntryRules(context: any): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    if (!this.isRuleEnabled(ConsistencyRule.JOURNAL_ENTRY_VIA_EVENT)) {
      return violations;
    }

    // Check if journal entry is triggered by event
    if (!context.triggeredByEvent) {
      violations.push({
        rule: ConsistencyRule.JOURNAL_ENTRY_VIA_EVENT,
        message: 'Journal entries must be triggered by domain events',
        severity: 'error',
        context,
      });
    }

    // Check double-entry balance
    if (this.isRuleEnabled(ConsistencyRule.DOUBLE_ENTRY_BALANCED)) {
      const totalDebit = context.lines?.reduce((sum: number, l: any) => sum + (l.debit || 0), 0) || 0;
      const totalCredit = context.lines?.reduce((sum: number, l: any) => sum + (l.credit || 0), 0) || 0;

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        violations.push({
          rule: ConsistencyRule.DOUBLE_ENTRY_BALANCED,
          message: `Journal entry is not balanced: Debits ${totalDebit} != Credits ${totalCredit}`,
          severity: 'error',
          context: { totalDebit, totalCredit },
        });
      }
    }

    return violations;
  }

  /**
   * Check state transition rules
   * Rule: No state transition without validation
   */
  private async checkStateTransitionRules(context: any): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    if (!this.isRuleEnabled(ConsistencyRule.STATE_TRANSITION_VALIDATED)) {
      return violations;
    }

    // Validate transition using workflow engine
    const validation = validateEntityTransition(
      context.entityType,
      context.from,
      context.to
    );

    if (!validation.allowed) {
      violations.push({
        rule: ConsistencyRule.STATE_TRANSITION_VALIDATED,
        message: validation.reason || 'Invalid state transition',
        severity: 'error',
        context: { from: context.from, to: context.to },
      });
    }

    return violations;
  }

  /**
   * Check financial transaction rules
   * Rule: All financial actions must pass workflow engine
   */
  private async checkFinancialTransactionRules(context: any): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    if (!this.isRuleEnabled(ConsistencyRule.FINANCIAL_VIA_WORKFLOW)) {
      return violations;
    }

    // Check if financial action is via workflow engine
    if (!context.viaWorkflowEngine) {
      violations.push({
        rule: ConsistencyRule.FINANCIAL_VIA_WORKFLOW,
        message: 'Financial transactions must be performed through the workflow engine',
        severity: 'error',
        context,
      });
    }

    // Check credit limit for customer transactions
    if (context.customerId && this.isRuleEnabled(ConsistencyRule.CREDIT_LIMIT_CHECK)) {
      const creditCheck = await this.checkCreditLimit(context.customerId, context.amount);
      if (!creditCheck.passed) {
        violations.push({
          rule: ConsistencyRule.CREDIT_LIMIT_CHECK,
          message: creditCheck.message || 'Credit limit exceeded',
          severity: 'error',
          context: { customerId: context.customerId, amount: context.amount },
        });
      }
    }

    return violations;
  }

  /**
   * Check credit limit
   */
  private async checkCreditLimit(customerId: string, amount: number): Promise<{ passed: boolean; message?: string }> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return { passed: false, message: 'Customer not found' };
    }

    // Get outstanding AR balance
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        customerId,
        status: { not: 'cancelled' },
      },
    });

    const outstandingBalance = invoices.reduce(
      (sum, inv) => sum + ((inv.grandTotal || inv.total || 0) - (inv.paidAmount || 0)),
      0
    );

    const availableCredit = customer.creditLimit - outstandingBalance;

    if (amount > availableCredit) {
      return {
        passed: false,
        message: `Credit limit exceeded. Available: ${availableCredit}, Requested: ${amount}`,
      };
    }

    return { passed: true };
  }

  /**
   * Check audit trail for an action
   * Rule: Every action must be auditable
   */
  async checkAuditTrail(entityType: string, entityId: string): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    if (!this.isRuleEnabled(ConsistencyRule.ACTION_AUDITABLE)) {
      return violations;
    }

    // Check if audit log exists for the entity
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      take: 1,
    });

    if (auditLogs.length === 0) {
      violations.push({
        rule: ConsistencyRule.ACTION_AUDITABLE,
        message: `No audit trail found for ${entityType}:${entityId}`,
        severity: 'warning',
        context: { entityType, entityId },
      });
    }

    return violations;
  }

  /**
   * Run consistency check on the entire system
   */
  async runSystemConsistencyCheck(): Promise<{
    passed: boolean;
    violations: RuleViolation[];
    summary: any;
  }> {
    const allViolations: RuleViolation[] = [];

    // Check 1: Stock consistency
    const stockViolations = await this.checkStockConsistency();
    allViolations.push(...stockViolations);

    // Check 2: Journal entry balance
    const journalViolations = await this.checkJournalEntryConsistency();
    allViolations.push(...journalViolations);

    // Check 3: Invoice-payment reconciliation
    const reconciliationViolations = await this.checkReconciliationConsistency();
    allViolations.push(...reconciliationViolations);

    return {
      passed: allViolations.filter(v => v.severity === 'error').length === 0,
      violations: allViolations,
      summary: {
        totalViolations: allViolations.length,
        errorCount: allViolations.filter(v => v.severity === 'error').length,
        warningCount: allViolations.filter(v => v.severity === 'warning').length,
      },
    };
  }

  /**
   * Check stock consistency
   */
  private async checkStockConsistency(): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    // Check if product stock matches inventory transactions
    const products = await prisma.product.findMany();

    for (const product of products) {
      const transactions = await prisma.inventoryTransaction.findMany({
        where: { productId: product.id },
      });

      const calculatedStock = transactions.reduce((sum, t) => sum + t.quantity, 0);

      if (Math.abs(product.stock - calculatedStock) > 0.01) {
        violations.push({
          rule: ConsistencyRule.STOCK_UPDATE_VIA_WORKFLOW,
          message: `Stock inconsistency for product ${product.code}: System=${product.stock}, Calculated=${calculatedStock}`,
          severity: 'error',
          context: { productId: product.id, systemStock: product.stock, calculatedStock },
        });
      }
    }

    return violations;
  }

  /**
   * Check journal entry consistency
   */
  private async checkJournalEntryConsistency(): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    // Check if all posted journal entries are balanced
    const journalEntries = await prisma.journalEntry.findMany({
      where: { isPosted: true },
      include: { lines: true },
    });

    for (const entry of journalEntries) {
      const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
      const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        violations.push({
          rule: ConsistencyRule.DOUBLE_ENTRY_BALANCED,
          message: `Unbalanced journal entry ${entry.entryNumber}: Debits=${totalDebit}, Credits=${totalCredit}`,
          severity: 'error',
          context: { entryNumber: entry.entryNumber, totalDebit, totalCredit },
        });
      }
    }

    return violations;
  }

  /**
   * Check reconciliation consistency
   */
  private async checkReconciliationConsistency(): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    // Check if payment allocations match invoice payments
    const allocations = await prisma.paymentAllocation.findMany();

    for (const allocation of allocations) {
      // Verify payment exists
      const payment = await prisma.payment.findUnique({
        where: { id: allocation.paymentId },
      });

      if (!payment) {
        violations.push({
          rule: ConsistencyRule.FINANCIAL_VIA_WORKFLOW,
          message: `Payment allocation references non-existent payment: ${allocation.paymentId}`,
          severity: 'error',
          context: { allocationId: allocation.id },
        });
      }

      // Verify invoice exists
      if (allocation.invoiceType === 'SalesInvoice') {
        const invoice = await prisma.salesInvoice.findUnique({
          where: { id: allocation.invoiceId },
        });

        if (!invoice) {
          violations.push({
            rule: ConsistencyRule.FINANCIAL_VIA_WORKFLOW,
            message: `Payment allocation references non-existent sales invoice: ${allocation.invoiceId}`,
            severity: 'error',
            context: { allocationId: allocation.id },
          });
        }
      }
    }

    return violations;
  }
}

// ==================== EXPORT SINGLETON ====================

export const consistencyRulesEngine = new ConsistencyRulesEngine();

// ==================== HELPER FUNCTIONS ====================

/**
 * Validate action before execution
 */
export async function validateAction(action: string, context: any): Promise<RuleCheckResult> {
  return consistencyRulesEngine.validateBeforeAction(action, context);
}

/**
 * Run full system consistency check
 */
export async function runSystemConsistencyCheck(): Promise<{
  passed: boolean;
  violations: RuleViolation[];
  summary: any;
}> {
  return consistencyRulesEngine.runSystemConsistencyCheck();
}

/**
 * Enable a consistency rule
 */
export function enableRule(rule: ConsistencyRule): void {
  consistencyRulesEngine.enableRule(rule);
}

/**
 * Disable a consistency rule
 */
export function disableRule(rule: ConsistencyRule): void {
  consistencyRulesEngine.disableRule(rule);
}
