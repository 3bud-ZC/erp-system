/**
 * Validation Layer Integration
 * Shows how to integrate the validation engine with existing services
 */

import { prisma } from '../db';
import { validationEngine, ValidationContext, ValidationResult } from './validation-engine';

// ============================================================================
// INTEGRATION WITH SALES INVOICE CREATION
// ============================================================================

/**
 * Create sales invoice with validation
 * This replaces direct creation in API routes
 */
export async function createSalesInvoiceWithValidation(
  input: {
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    date: Date;
    tenantId: string;
    userId?: string;
  }
) {
  // Step 1: Create validation context
  const context: ValidationContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    requestId: generateRequestId(),
    timestamp: new Date(),
    prisma,
    snapshot: {
      products: new Map(),
      customers: new Map(),
      suppliers: new Map(),
      accounts: new Map(),
      stock: new Map(),
    },
  };

  // Step 2: Validate before execution
  const validationResult = await validationEngine.validate('sales', input, context);

  // Step 3: Handle validation result
  if (!validationResult.isValid) {
    throw new ValidationError(validationResult);
  }

  // Step 4: Log warnings if any
  if (validationResult.warnings.length > 0) {
    console.warn('Validation warnings:', validationResult.warnings);
  }

  // Step 5: Execute within transaction using execution plan
  return await prisma.$transaction(async (tx) => {
    const result = await executeSalesInvoice(tx, input, validationResult.executionPlan!);
    return result;
  });
}

async function executeSalesInvoice(
  tx: any,
  input: any,
  plan: any
) {
  // Create sales invoice
  const invoice = await tx.salesInvoice.create({
    data: {
      customerId: input.customerId,
      date: input.date,
      tenantId: input.tenantId,
      total: input.items.reduce((sum: number, i: any) => sum + i.quantity * i.price, 0),
    },
  });

  // Create invoice items
  for (const item of input.items) {
    await tx.salesInvoiceItem.create({
      data: {
        salesInvoiceId: invoice.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price,
      },
    });
  }

  // Update stock (using atomicDecrementStock from inventory-transactions)
  const { atomicDecrementStock } = await import('../inventory-transactions');
  await atomicDecrementStock(
    tx,
    input.items,
    invoice.id,
    'sale',
    input.tenantId
  );

  return invoice;
}

// ============================================================================
// INTEGRATION WITH PURCHASE INVOICE CREATION
// ============================================================================

export async function createPurchaseInvoiceWithValidation(
  input: {
    supplierId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    date: Date;
    tenantId: string;
    userId?: string;
  }
) {
  const context: ValidationContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    requestId: generateRequestId(),
    timestamp: new Date(),
    prisma,
    snapshot: {
      products: new Map(),
      customers: new Map(),
      suppliers: new Map(),
      accounts: new Map(),
      stock: new Map(),
    },
  };

  const validationResult = await validationEngine.validate('purchase', input, context);

  if (!validationResult.isValid) {
    throw new ValidationError(validationResult);
  }

  return await prisma.$transaction(async (tx) => {
    const invoice = await (tx as any).purchaseInvoice.create({
      data: {
        supplierId: input.supplierId,
        date: input.date,
        total: input.items.reduce((sum: number, i: any) => sum + i.quantity * i.price, 0),
      },
    });

    for (const item of input.items) {
      await tx.purchaseInvoiceItem.create({
        data: {
          purchaseInvoiceId: invoice.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        },
      });
    }

    // Increment stock
    const { incrementStockWithTransaction } = await import('../inventory-transactions');
    await incrementStockWithTransaction(
      tx,
      input.items,
      invoice.id,
      'purchase',
      input.tenantId
    );

    return invoice;
  });
}

// ============================================================================
// INTEGRATION WITH JOURNAL ENTRY CREATION
// ============================================================================

export async function createJournalEntryWithValidation(
  input: {
    entryDate: Date;
    description: string;
    referenceType?: string;
    referenceId?: string;
    lines: Array<{
      accountCode: string;
      debit: number;
      credit: number;
      description?: string;
    }>;
    tenantId: string;
    userId?: string;
  }
) {
  const context: ValidationContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    requestId: generateRequestId(),
    timestamp: new Date(),
    prisma,
    snapshot: {
      products: new Map(),
      customers: new Map(),
      suppliers: new Map(),
      accounts: new Map(),
      stock: new Map(),
    },
  };

  // Ensure referenceType and referenceId are provided for validation
  const validationInput = {
    ...input,
    referenceType: input.referenceType || 'Manual',
    referenceId: input.referenceId || '',
  };

  const validationResult = await validationEngine.validate('accounting_entry', validationInput, context);

  if (!validationResult.isValid) {
    throw new ValidationError(validationResult);
  }

  return await prisma.$transaction(async (tx) => {
    const { createJournalEntry } = await import('../accounting');
    const entry = await createJournalEntry(validationInput);
    return entry;
  });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class ValidationError extends Error {
  public validationResult: ValidationResult;

  constructor(validationResult: ValidationResult) {
    const errorMessages = validationResult.errors
      .map(e => `[${e.code}] ${e.message}`)
      .join('; ');
    super(`Validation failed: ${errorMessages}`);
    this.name = 'ValidationError';
    this.validationResult = validationResult;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// API ROUTE MIDDLEWARE
// ============================================================================

/**
 * Middleware to add validation context to requests
 */
export function withValidationContext(handler: Function) {
  return async (req: any, res: any) => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    // Attach validation context to request
    req.validationContext = {
      tenantId,
      userId,
      requestId: generateRequestId(),
      timestamp: new Date(),
      prisma,
      snapshot: {
        products: new Map(),
        customers: new Map(),
        suppliers: new Map(),
        accounts: new Map(),
        stock: new Map(),
      },
    };

    return handler(req, res);
  };
}
