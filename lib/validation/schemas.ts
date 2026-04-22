/**
 * ZOD VALIDATION SCHEMAS
 * Strict input validation for all API requests
 */

import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const idSchema = z.string().cuid({ message: 'Invalid ID format' });

export const tenantIdSchema = z.string().min(1, { message: 'Tenant ID is required' });

export const dateSchema = z.coerce.date({ message: 'Invalid date format' });

export const positiveNumberSchema = z.number().positive({ message: 'Must be a positive number' });

export const nonNegativeNumberSchema = z.number().min(0, { message: 'Cannot be negative' });

// ============================================================================
// INVOICE ITEM SCHEMA
// ============================================================================

export const invoiceItemSchema = z.object({
  productId: idSchema,
  quantity: z.number().positive({ message: 'Quantity must be greater than 0' }),
  price: z.number().nonnegative({ message: 'Price cannot be negative' }),
  unitCost: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
}).strict();

// ============================================================================
// SALES INVOICE SCHEMAS
// ============================================================================

export const createSalesInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, { message: 'Invoice number is required' }),
  date: dateSchema,
  customerId: idSchema,
  dueDate: dateSchema.optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['pending', 'posted', 'cancelled']).optional(),
  items: z.array(invoiceItemSchema)
    .min(1, { message: 'At least one item is required' })
    .max(100, { message: 'Maximum 100 items allowed' }),
}).strict();

export const updateSalesInvoiceSchema = createSalesInvoiceSchema.partial().extend({
  id: idSchema,
});

// ============================================================================
// PURCHASE INVOICE SCHEMAS
// ============================================================================

export const createPurchaseInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, { message: 'Invoice number is required' }),
  date: dateSchema,
  supplierId: idSchema,
  dueDate: dateSchema.optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['pending', 'posted', 'cancelled']).optional(),
  items: z.array(invoiceItemSchema)
    .min(1, { message: 'At least one item is required' })
    .max(100, { message: 'Maximum 100 items allowed' }),
}).strict();

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const createPaymentSchema = z.object({
  amount: z.number().positive({ message: 'Payment amount must be positive' }),
  date: dateSchema,
  method: z.enum(['cash', 'bank_transfer', 'check', 'card']),
  reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  customerId: idSchema.optional(),
  supplierId: idSchema.optional(),
  invoiceId: idSchema.optional(),
}).strict().refine(
  (data) => data.customerId || data.supplierId,
  { message: 'Either customerId or supplierId is required' }
);

// ============================================================================
// JOURNAL ENTRY SCHEMAS
// ============================================================================

export const journalEntryLineSchema = z.object({
  accountCode: z.string().min(1, { message: 'Account code is required' }),
  debit: z.number().min(0, { message: 'Debit cannot be negative' }),
  credit: z.number().min(0, { message: 'Credit cannot be negative' }),
  description: z.string().max(500).optional(),
}).strict().refine(
  (data) => (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0),
  { message: 'Each line must have either debit OR credit, not both' }
);

export const createJournalEntrySchema = z.object({
  entryDate: dateSchema,
  description: z.string().min(1).max(500),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().optional(),
  lines: z.array(journalEntryLineSchema)
    .min(2, { message: 'Journal entry must have at least 2 lines' })
    .max(50, { message: 'Maximum 50 lines allowed' }),
}).strict().refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debits must equal total credits (double-entry violation)' }
);

// ============================================================================
// PRODUCT SCHEMAS
// ============================================================================

export const createProductSchema = z.object({
  code: z.string().min(1).max(50),
  nameAr: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  type: z.enum(['finished_product', 'raw_material', 'service']),
  unitId: idSchema,
  groupId: idSchema.optional(),
  cost: z.number().nonnegative().default(0),
  price: z.number().nonnegative().default(0),
  stock: z.number().nonnegative().default(0),
  minStock: z.number().nonnegative().default(0),
  description: z.string().max(1000).optional(),
}).strict();

// ============================================================================
// CUSTOMER/SUPPLIER SCHEMAS
// ============================================================================

export const createCustomerSchema = z.object({
  code: z.string().min(1).max(50),
  nameAr: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  taxNumber: z.string().max(50).optional(),
  creditLimit: z.number().nonnegative().default(0),
  isActive: z.boolean().default(true),
}).strict();

export const createSupplierSchema = createCustomerSchema;

// ============================================================================
// IDEMPOTENCY KEY SCHEMA
// ============================================================================

export const idempotencyKeySchema = z.string()
  .min(8, { message: 'Idempotency key must be at least 8 characters' })
  .max(128, { message: 'Idempotency key too long' })
  .regex(/^[a-zA-Z0-9-_]+$/, { message: 'Idempotency key contains invalid characters' });

// ============================================================================
// QUERY PARAMS SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
});

export const dateRangeSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (data) => !data.fromDate || !data.toDate || data.fromDate <= data.toDate,
  { message: 'fromDate must be before or equal to toDate' }
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;
export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
