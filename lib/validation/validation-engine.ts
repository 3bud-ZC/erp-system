/**
 * System Behavior Validation Layer
 * Pre-commit validation engine for ERP workflows
 * Detects conflicts before database writes
 */

import { Prisma, PrismaClient } from '@prisma/client';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

export interface ValidationError {
  code: string;
  severity: ValidationSeverity;
  message: string;
  field?: string;
  context?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  safeToExecute: boolean;
  executionPlan?: ExecutionPlan;
  metadata: ValidationMetadata;
}

export interface ValidationMetadata {
  validatedAt: Date;
  validationDurationMs: number;
  workflowType: string;
  tenantId: string;
  userId?: string;
}

export interface ExecutionPlan {
  operations: PlannedOperation[];
  estimatedDurationMs?: number;
  resourceEstimates?: ResourceEstimates;
}

export interface PlannedOperation {
  type: 'create' | 'update' | 'delete' | 'transaction';
  model: string;
  data: Record<string, any>;
  dependencies?: string[];
  rollbackOperation?: PlannedOperation;
}

export interface ResourceEstimates {
  databaseWrites: number;
  databaseReads: number;
  estimatedMemoryMB: number;
}

// ============================================================================
// VALIDATION CONTEXT
// ============================================================================

export interface ValidationContext {
  tenantId: string;
  userId?: string;
  requestId?: string;
  timestamp: Date;
  prisma: PrismaClient;
  snapshot: DatabaseSnapshot;
}

export interface DatabaseSnapshot {
  products: Map<string, ProductSnapshot>;
  customers: Map<string, CustomerSnapshot>;
  suppliers: Map<string, SupplierSnapshot>;
  accounts: Map<string, AccountSnapshot>;
  stock: Map<string, StockSnapshot>;
}

export interface ProductSnapshot {
  id: string;
  code: string;
  stock: number;
  version: number;
  cost: number;
  price: number;
  warehouseId?: string;
}

export interface CustomerSnapshot {
  id: string;
  code: string;
  creditLimit: number;
  currentBalance: number;
}

export interface SupplierSnapshot {
  id: string;
  code: string;
  creditLimit: number;
  currentBalance: number;
}

export interface AccountSnapshot {
  code: string;
  balance: number;
  type: string;
}

export interface StockSnapshot {
  productId: string;
  warehouseId: string;
  quantity: number;
}

// ============================================================================
// VALIDATION ENGINE CORE
// ============================================================================

export class ValidationEngine {
  private validators: Map<string, WorkflowValidator>;
  private cache: ValidationCache;

  constructor() {
    this.validators = new Map();
    this.cache = new ValidationCache();
    this.registerDefaultValidators();
  }

  private registerDefaultValidators(): void {
    this.registerValidator('purchase', new PurchaseFlowValidator());
    this.registerValidator('sales', new SalesFlowValidator());
    this.registerValidator('return', new ReturnFlowValidator());
    this.registerValidator('stock_transfer', new StockTransferValidator());
    this.registerValidator('accounting_entry', new AccountingEntryValidator());
  }

  public registerValidator(workflowType: string, validator: WorkflowValidator): void {
    this.validators.set(workflowType, validator);
  }

  /**
   * Validate a workflow before execution
   */
  public async validate(
    workflowType: string,
    input: any,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Check cache for recent validations
      const cacheKey = this.getCacheKey(workflowType, input, context.tenantId);
      const cached = this.cache.get(cacheKey);
      if (cached && this.cache.isValid(cached)) {
        return cached.result;
      }

      // Get validator for workflow type
      const validator = this.validators.get(workflowType);
      if (!validator) {
        throw new Error(`No validator registered for workflow type: ${workflowType}`);
      }

      // Create database snapshot
      const snapshot = await this.createSnapshot(context, validator.getRequiredSnapshot(input));

      // Update context with snapshot
      const enrichedContext = { ...context, snapshot };

      // Run validation
      const result = await validator.validate(input, enrichedContext);

      // Add metadata
      result.metadata = {
        validatedAt: new Date(),
        validationDurationMs: Date.now() - startTime,
        workflowType,
        tenantId: context.tenantId,
        userId: context.userId,
      };

      // Generate execution plan if validation passes
      if (result.isValid) {
        result.executionPlan = await validator.generateExecutionPlan(input, enrichedContext);
      }

      // Cache result
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        ttl: 5000, // 5 seconds
      });

      return result;
    } catch (error) {
      return {
        isValid: false,
        safeToExecute: false,
        errors: [
          {
            code: 'VALIDATION_ERROR',
            severity: ValidationSeverity.ERROR,
            message: error instanceof Error ? error.message : 'Unknown validation error',
          },
        ],
        warnings: [],
        metadata: {
          validatedAt: new Date(),
          validationDurationMs: Date.now() - startTime,
          workflowType,
          tenantId: context.tenantId,
        },
      };
    }
  }

  /**
   * Create database snapshot for validation
   */
  private async createSnapshot(
    context: ValidationContext,
    requirements: SnapshotRequirements
  ): Promise<DatabaseSnapshot> {
    const snapshot: DatabaseSnapshot = {
      products: new Map(),
      customers: new Map(),
      suppliers: new Map(),
      accounts: new Map(),
      stock: new Map(),
    };

    // Fetch products
    if (requirements.productIds.length > 0) {
      const products = await context.prisma.product.findMany({
        where: {
          id: { in: requirements.productIds },
        },
        select: {
          id: true,
          code: true,
          stock: true,
          cost: true,
          price: true,
          warehouseId: true,
        },
      });

      for (const product of products) {
        snapshot.products.set(product.id, {
          ...product,
          version: 0, // Version field not in current schema yet
        } as ProductSnapshot);
      }
    }

    // Fetch customers
    if (requirements.customerIds.length > 0) {
      const customers = await context.prisma.customer.findMany({
        where: {
          id: { in: requirements.customerIds },
        },
        select: {
          id: true,
          code: true,
        },
      });

      // Calculate current balance for each customer
      for (const customer of customers) {
        const balance = await this.calculateCustomerBalance(context.prisma, customer.id);
        snapshot.customers.set(customer.id, {
          ...customer,
          creditLimit: 0, // creditLimit field not in current schema yet
          currentBalance: balance,
        } as CustomerSnapshot);
      }
    }

    // Fetch suppliers
    if (requirements.supplierIds.length > 0) {
      const suppliers = await context.prisma.supplier.findMany({
        where: {
          id: { in: requirements.supplierIds },
        },
        select: {
          id: true,
          code: true,
        },
      });

      for (const supplier of suppliers) {
        const balance = await this.calculateSupplierBalance(context.prisma, supplier.id);
        snapshot.suppliers.set(supplier.id, {
          ...supplier,
          creditLimit: 0, // creditLimit field not in current schema yet
          currentBalance: balance,
        } as SupplierSnapshot);
      }
    }

    // Fetch accounts
    if (requirements.accountCodes.length > 0) {
      const accounts = await context.prisma.account.findMany({
        where: {
          code: { in: requirements.accountCodes },
        },
        select: {
          code: true,
          balance: true,
          type: true,
        },
      });

      for (const account of accounts) {
        snapshot.accounts.set(account.code, {
          code: account.code,
          balance: Number(account.balance), // Convert Decimal to number
          type: account.type,
        } as AccountSnapshot);
      }
    }

    return snapshot;
  }

  private async calculateCustomerBalance(
    prisma: PrismaClient,
    customerId: string
  ): Promise<number> {
    const result = await prisma.salesInvoice.aggregate({
      where: {
        customerId,
        status: { notIn: ['paid', 'cancelled'] },
      },
      _sum: {
        total: true,
        paidAmount: true,
      },
    });

    const total = result._sum?.total || 0;
    const paid = result._sum?.paidAmount || 0;
    return total - paid;
  }

  private async calculateSupplierBalance(
    prisma: PrismaClient,
    supplierId: string
  ): Promise<number> {
    const result = await prisma.purchaseInvoice.aggregate({
      where: {
        supplierId,
        status: { notIn: ['paid', 'cancelled'] },
      },
      _sum: {
        total: true,
        paidAmount: true,
      },
    });

    const total = result._sum.total || 0;
    const paid = result._sum.paidAmount || 0;
    return total - paid;
  }

  private getCacheKey(workflowType: string, input: any, tenantId: string | undefined): string {
    return `${workflowType}:${tenantId || 'default'}:${JSON.stringify(input)}`;
  }
}

// ============================================================================
// VALIDATION CACHE
// ============================================================================

interface CacheEntry {
  result: ValidationResult;
  timestamp: number;
  ttl: number;
}

class ValidationCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  public get(key: string): CacheEntry | undefined {
    return this.cache.get(key);
  }

  public set(key: string, entry: CacheEntry): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, entry);
  }

  public isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  public clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// WORKFLOW VALIDATOR INTERFACE
// ============================================================================

export interface SnapshotRequirements {
  productIds: string[];
  customerIds: string[];
  supplierIds: string[];
  accountCodes: string[];
}

export abstract class WorkflowValidator {
  abstract validate(input: any, context: ValidationContext): Promise<ValidationResult>;
  abstract getRequiredSnapshot(input: any): SnapshotRequirements;
  abstract generateExecutionPlan(input: any, context: ValidationContext): Promise<ExecutionPlan>;
}

// ============================================================================
// PURCHASE FLOW VALIDATOR
// ============================================================================

interface PurchaseInput {
  supplierId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  date: Date;
  tenantId: string;
}

export class PurchaseFlowValidator extends WorkflowValidator {
  async validate(input: PurchaseInput, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate supplier exists
    const supplier = context.snapshot.suppliers.get(input.supplierId);
    if (!supplier) {
      errors.push({
        code: 'SUPPLIER_NOT_FOUND',
        severity: ValidationSeverity.ERROR,
        message: `Supplier ${input.supplierId} not found or does not belong to tenant`,
        field: 'supplierId',
      });
    }

    // Validate items
    for (const item of input.items) {
      const product = context.snapshot.products.get(item.productId);
      if (!product) {
        errors.push({
          code: 'PRODUCT_NOT_FOUND',
          severity: ValidationSeverity.ERROR,
          message: `Product ${item.productId} not found or does not belong to tenant`,
          field: `items.${item.productId}`,
        });
        continue;
      }

      // Validate quantity
      if (item.quantity <= 0) {
        errors.push({
          code: 'INVALID_QUANTITY',
          severity: ValidationSeverity.ERROR,
          message: `Quantity must be positive for product ${product.code}`,
          field: `items.${item.productId}.quantity`,
        });
      }

      // Validate price
      if (item.price < 0) {
        errors.push({
          code: 'INVALID_PRICE',
          severity: ValidationSeverity.ERROR,
          message: `Price cannot be negative for product ${product.code}`,
          field: `items.${item.productId}.price`,
        });
      }

      // Warn if price deviates significantly from cost
      if (product.cost > 0 && (item.price / product.cost) > 2) {
        warnings.push({
          code: 'PRICE_DEVIATION',
          severity: ValidationSeverity.WARNING,
          message: `Purchase price (${item.price}) is significantly higher than cost (${product.cost}) for product ${product.code}`,
          field: `items.${item.productId}.price`,
          context: { purchasePrice: item.price, cost: product.cost },
        });
      }
    }

    // Validate date
    if (input.date > new Date()) {
      errors.push({
        code: 'FUTURE_DATE',
        severity: ValidationSeverity.ERROR,
        message: 'Purchase date cannot be in the future',
        field: 'date',
      });
    }

    return {
      isValid: errors.length === 0,
      safeToExecute: errors.length === 0,
      errors,
      warnings,
      metadata: {} as ValidationMetadata, // Will be set by engine
    };
  }

  getRequiredSnapshot(input: PurchaseInput): SnapshotRequirements {
    return {
      productIds: input.items.map(i => i.productId),
      customerIds: [],
      supplierIds: [input.supplierId],
      accountCodes: [],
    };
  }

  async generateExecutionPlan(input: PurchaseInput, context: ValidationContext): Promise<ExecutionPlan> {
    const operations: PlannedOperation[] = [];

    // Create purchase invoice
    operations.push({
      type: 'create',
      model: 'PurchaseInvoice',
      data: {
        supplierId: input.supplierId,
        date: input.date,
        tenantId: input.tenantId,
        total: input.items.reduce((sum, i) => sum + i.quantity * i.price, 0),
      },
    });

    // Create purchase invoice items
    for (const item of input.items) {
      operations.push({
        type: 'create',
        model: 'PurchaseInvoiceItem',
        data: {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        },
        dependencies: ['PurchaseInvoice.create'],
      });
    }

    // Update product stock
    for (const item of input.items) {
      const product = context.snapshot.products.get(item.productId);
      operations.push({
        type: 'update',
        model: 'Product',
        data: {
          id: item.productId,
          stock: product!.stock + item.quantity,
          version: product!.version + 1,
        },
        dependencies: ['PurchaseInvoiceItem.create'],
        rollbackOperation: {
          type: 'update',
          model: 'Product',
          data: {
            id: item.productId,
            stock: product!.stock,
            version: product!.version,
          },
        },
      });
    }

    return {
      operations,
      resourceEstimates: {
        databaseWrites: 1 + input.items.length * 2,
        databaseReads: 1 + input.items.length,
        estimatedMemoryMB: 10,
      },
    };
  }
}

// ============================================================================
// SALES FLOW VALIDATOR
// ============================================================================

interface SalesInput {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  date: Date;
  tenantId: string;
}

export class SalesFlowValidator extends WorkflowValidator {
  async validate(input: SalesInput, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate customer exists
    const customer = context.snapshot.customers.get(input.customerId);
    if (!customer) {
      errors.push({
        code: 'CUSTOMER_NOT_FOUND',
        severity: ValidationSeverity.ERROR,
        message: `Customer ${input.customerId} not found or does not belong to tenant`,
        field: 'customerId',
      });
    }

    // Validate items and stock availability
    for (const item of input.items) {
      const product = context.snapshot.products.get(item.productId);
      if (!product) {
        errors.push({
          code: 'PRODUCT_NOT_FOUND',
          severity: ValidationSeverity.ERROR,
          message: `Product ${item.productId} not found or does not belong to tenant`,
          field: `items.${item.productId}`,
        });
        continue;
      }

      // Validate quantity
      if (item.quantity <= 0) {
        errors.push({
          code: 'INVALID_QUANTITY',
          severity: ValidationSeverity.ERROR,
          message: `Quantity must be positive for product ${product.code}`,
          field: `items.${item.productId}.quantity`,
        });
      }

      // Validate stock availability
      if (product.stock < item.quantity) {
        errors.push({
          code: 'INSUFFICIENT_STOCK',
          severity: ValidationSeverity.ERROR,
          message: `Insufficient stock for product ${product.code}. Available: ${product.stock}, Required: ${item.quantity}`,
          field: `items.${item.productId}.quantity`,
          context: { available: product.stock, required: item.quantity },
        });
      }

      // Validate price
      if (item.price < 0) {
        errors.push({
          code: 'INVALID_PRICE',
          severity: ValidationSeverity.ERROR,
          message: `Price cannot be negative for product ${product.code}`,
          field: `items.${item.productId}.price`,
        });
      }

      // Warn if price is below cost
      if (product.cost > 0 && item.price < product.cost) {
        warnings.push({
          code: 'PRICE_BELOW_COST',
          severity: ValidationSeverity.WARNING,
          message: `Selling price (${item.price}) is below cost (${product.cost}) for product ${product.code}`,
          field: `items.${item.productId}.price`,
          context: { sellingPrice: item.price, cost: product.cost },
        });
      }
    }

    // Validate credit limit
    if (customer) {
      const invoiceTotal = input.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
      const projectedBalance = customer.currentBalance + invoiceTotal;

      if (projectedBalance > customer.creditLimit) {
        errors.push({
          code: 'CREDIT_LIMIT_EXCEEDED',
          severity: ValidationSeverity.ERROR,
          message: `Customer credit limit exceeded. Current balance: ${customer.currentBalance}, Invoice total: ${invoiceTotal}, Credit limit: ${customer.creditLimit}`,
          field: 'customerId',
          context: {
            currentBalance: customer.currentBalance,
            invoiceTotal,
            creditLimit: customer.creditLimit,
            projectedBalance,
          },
        });
      }
    }

    // Validate date
    if (input.date > new Date()) {
      errors.push({
        code: 'FUTURE_DATE',
        severity: ValidationSeverity.ERROR,
        message: 'Sales date cannot be in the future',
        field: 'date',
      });
    }

    return {
      isValid: errors.length === 0,
      safeToExecute: errors.length === 0,
      errors,
      warnings,
      metadata: {} as ValidationMetadata,
    };
  }

  getRequiredSnapshot(input: SalesInput): SnapshotRequirements {
    return {
      productIds: input.items.map(i => i.productId),
      customerIds: [input.customerId],
      supplierIds: [],
      accountCodes: [],
    };
  }

  async generateExecutionPlan(input: SalesInput, context: ValidationContext): Promise<ExecutionPlan> {
    const operations: PlannedOperation[] = [];

    // Create sales invoice
    operations.push({
      type: 'create',
      model: 'SalesInvoice',
      data: {
        customerId: input.customerId,
        date: input.date,
        tenantId: input.tenantId,
        total: input.items.reduce((sum, i) => sum + i.quantity * i.price, 0),
      },
    });

    // Create sales invoice items
    for (const item of input.items) {
      operations.push({
        type: 'create',
        model: 'SalesInvoiceItem',
        data: {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        },
        dependencies: ['SalesInvoice.create'],
      });
    }

    // Update product stock with optimistic locking
    for (const item of input.items) {
      const product = context.snapshot.products.get(item.productId);
      operations.push({
        type: 'update',
        model: 'Product',
        data: {
          id: item.productId,
          stock: product!.stock - item.quantity,
          version: product!.version + 1,
        },
        dependencies: ['SalesInvoiceItem.create'],
        rollbackOperation: {
          type: 'update',
          model: 'Product',
          data: {
            id: item.productId,
            stock: product!.stock,
            version: product!.version,
          },
        },
      });
    }

    return {
      operations,
      resourceEstimates: {
        databaseWrites: 1 + input.items.length * 2,
        databaseReads: 1 + input.items.length,
        estimatedMemoryMB: 10,
      },
    };
  }
}

// ============================================================================
// RETURN FLOW VALIDATOR
// ============================================================================

interface ReturnInput {
  customerId?: string;
  supplierId?: string;
  type: 'sales' | 'purchase';
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  invoiceId?: string;
  date: Date;
  tenantId: string;
}

export class ReturnFlowValidator extends WorkflowValidator {
  async validate(input: ReturnInput, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate return type
    if (input.type === 'sales' && !input.customerId) {
      errors.push({
        code: 'MISSING_CUSTOMER',
        severity: ValidationSeverity.ERROR,
        message: 'Customer ID is required for sales returns',
        field: 'customerId',
      });
    }

    if (input.type === 'purchase' && !input.supplierId) {
      errors.push({
        code: 'MISSING_SUPPLIER',
        severity: ValidationSeverity.ERROR,
        message: 'Supplier ID is required for purchase returns',
        field: 'supplierId',
      });
    }

    // Validate items
    for (const item of input.items) {
      const product = context.snapshot.products.get(item.productId);
      if (!product) {
        errors.push({
          code: 'PRODUCT_NOT_FOUND',
          severity: ValidationSeverity.ERROR,
          message: `Product ${item.productId} not found`,
          field: `items.${item.productId}`,
        });
        continue;
      }

      // Validate quantity
      if (item.quantity <= 0) {
        errors.push({
          code: 'INVALID_QUANTITY',
          severity: ValidationSeverity.ERROR,
          message: `Quantity must be positive for product ${product.code}`,
          field: `items.${item.productId}.quantity`,
        });
      }

      // For sales returns, validate that quantity doesn't exceed original sale
      // This would require fetching the original invoice
      if (input.type === 'sales' && input.invoiceId) {
        warnings.push({
          code: 'RETURN_QUANTITY_VALIDATION',
          severity: ValidationSeverity.WARNING,
          message: 'Return quantity should be validated against original invoice',
          field: `items.${item.productId}.quantity`,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      safeToExecute: errors.length === 0,
      errors,
      warnings,
      metadata: {} as ValidationMetadata,
    };
  }

  getRequiredSnapshot(input: ReturnInput): SnapshotRequirements {
    return {
      productIds: input.items.map(i => i.productId),
      customerIds: input.customerId ? [input.customerId] : [],
      supplierIds: input.supplierId ? [input.supplierId] : [],
      accountCodes: [],
    };
  }

  async generateExecutionPlan(input: ReturnInput, context: ValidationContext): Promise<ExecutionPlan> {
    const operations: PlannedOperation[] = [];

    const model = input.type === 'sales' ? 'SalesReturn' : 'PurchaseReturn';

    operations.push({
      type: 'create',
      model,
      data: {
        customerId: input.customerId,
        supplierId: input.supplierId,
        date: input.date,
        tenantId: input.tenantId,
        total: input.items.reduce((sum, i) => sum + i.quantity, 0), // Simplified
      },
    });

    // Update product stock
    for (const item of input.items) {
      const product = context.snapshot.products.get(item.productId);
      const quantityDelta = input.type === 'sales' ? item.quantity : -item.quantity;

      operations.push({
        type: 'update',
        model: 'Product',
        data: {
          id: item.productId,
          stock: product!.stock + quantityDelta,
          version: product!.version + 1,
        },
        dependencies: [`${model}.create`],
        rollbackOperation: {
          type: 'update',
          model: 'Product',
          data: {
            id: item.productId,
            stock: product!.stock,
            version: product!.version,
          },
        },
      });
    }

    return {
      operations,
      resourceEstimates: {
        databaseWrites: 1 + input.items.length * 2,
        databaseReads: 1 + input.items.length,
        estimatedMemoryMB: 10,
      },
    };
  }
}

// ============================================================================
// STOCK TRANSFER VALIDATOR
// ============================================================================

interface StockTransferInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  date: Date;
  tenantId: string;
}

export class StockTransferValidator extends WorkflowValidator {
  async validate(input: StockTransferInput, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate product exists
    const product = context.snapshot.products.get(input.productId);
    if (!product) {
      errors.push({
        code: 'PRODUCT_NOT_FOUND',
        severity: ValidationSeverity.ERROR,
        message: `Product ${input.productId} not found`,
        field: 'productId',
      });
    }

    // Validate different warehouses
    if (input.fromWarehouseId === input.toWarehouseId) {
      errors.push({
        code: 'SAME_WAREHOUSE',
        severity: ValidationSeverity.ERROR,
        message: 'Source and destination warehouses must be different',
        field: 'toWarehouseId',
      });
    }

    // Validate quantity
    if (input.quantity <= 0) {
      errors.push({
        code: 'INVALID_QUANTITY',
        severity: ValidationSeverity.ERROR,
        message: 'Quantity must be positive',
        field: 'quantity',
      });
    }

    // Note: Stock validation would require warehouse-specific stock tracking
    // Current schema only has product-level stock
    if (product && product.stock < input.quantity) {
      errors.push({
        code: 'INSUFFICIENT_STOCK',
        severity: ValidationSeverity.ERROR,
        message: `Insufficient stock for product ${product.code}. Available: ${product.stock}, Required: ${input.quantity}`,
        field: 'quantity',
        context: { available: product.stock, required: input.quantity },
      });
    }

    return {
      isValid: errors.length === 0,
      safeToExecute: errors.length === 0,
      errors,
      warnings,
      metadata: {} as ValidationMetadata,
    };
  }

  getRequiredSnapshot(input: StockTransferInput): SnapshotRequirements {
    return {
      productIds: [input.productId],
      customerIds: [],
      supplierIds: [],
      accountCodes: [],
    };
  }

  async generateExecutionPlan(input: StockTransferInput, context: ValidationContext): Promise<ExecutionPlan> {
    const operations: PlannedOperation[] = [];

    operations.push({
      type: 'create',
      model: 'StockTransfer',
      data: {
        productId: input.productId,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        quantity: input.quantity,
        date: input.date,
        tenantId: input.tenantId,
      },
    });

    // Note: In current schema, stock is product-level, not warehouse-level
    // This would need to be updated for true warehouse-specific stock tracking

    return {
      operations,
      resourceEstimates: {
        databaseWrites: 1,
        databaseReads: 1,
        estimatedMemoryMB: 5,
      },
    };
  }
}

// ============================================================================
// ACCOUNTING ENTRY VALIDATOR
// ============================================================================

interface AccountingEntryInput {
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
}

export class AccountingEntryValidator extends WorkflowValidator {
  async validate(input: AccountingEntryInput, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate at least 2 lines
    if (input.lines.length < 2) {
      errors.push({
        code: 'INSUFFICIENT_LINES',
        severity: ValidationSeverity.ERROR,
        message: 'Journal entry must have at least 2 lines',
        field: 'lines',
      });
    }

    // Validate accounts exist
    for (const line of input.lines) {
      const account = context.snapshot.accounts.get(line.accountCode);
      if (!account) {
        errors.push({
          code: 'ACCOUNT_NOT_FOUND',
          severity: ValidationSeverity.ERROR,
          message: `Account ${line.accountCode} not found or does not belong to tenant`,
          field: `lines.${line.accountCode}`,
        });
        continue;
      }

      // Validate debit/credit mutual exclusivity
      if (line.debit > 0 && line.credit > 0) {
        errors.push({
          code: 'BOTH_DEBIT_CREDIT',
          severity: ValidationSeverity.ERROR,
          message: `Line cannot have both debit and credit for account ${line.accountCode}`,
          field: `lines.${line.accountCode}`,
        });
      }

      if (line.debit <= 0 && line.credit <= 0) {
        errors.push({
          code: 'NO_DEBIT_OR_CREDIT',
          severity: ValidationSeverity.ERROR,
          message: `Line must have either debit or credit for account ${line.accountCode}`,
          field: `lines.${line.accountCode}`,
        });
      }

      // Validate non-negative amounts
      if (line.debit < 0 || line.credit < 0) {
        errors.push({
          code: 'NEGATIVE_AMOUNT',
          severity: ValidationSeverity.ERROR,
          message: `Amounts cannot be negative for account ${line.accountCode}`,
          field: `lines.${line.accountCode}`,
        });
      }
    }

    // Validate balance
    const totalDebit = input.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = input.lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      errors.push({
        code: 'UNBALANCED_ENTRY',
        severity: ValidationSeverity.ERROR,
        message: `Journal entry does not balance. Debit: ${totalDebit}, Credit: ${totalCredit}`,
        field: 'lines',
        context: { totalDebit, totalCredit, difference: totalDebit - totalCredit },
      });
    }

    // Validate date
    if (input.entryDate > new Date()) {
      errors.push({
        code: 'FUTURE_DATE',
        severity: ValidationSeverity.ERROR,
        message: 'Entry date cannot be in the future',
        field: 'entryDate',
      });
    }

    return {
      isValid: errors.length === 0,
      safeToExecute: errors.length === 0,
      errors,
      warnings,
      metadata: {} as ValidationMetadata,
    };
  }

  getRequiredSnapshot(input: AccountingEntryInput): SnapshotRequirements {
    return {
      productIds: [],
      customerIds: [],
      supplierIds: [],
      accountCodes: input.lines.map(l => l.accountCode),
    };
  }

  async generateExecutionPlan(input: AccountingEntryInput, context: ValidationContext): Promise<ExecutionPlan> {
    const operations: PlannedOperation[] = [];

    // Create journal entry
    operations.push({
      type: 'create',
      model: 'JournalEntry',
      data: {
        entryDate: input.entryDate,
        description: input.description,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        totalDebit: input.lines.reduce((sum, l) => sum + l.debit, 0),
        totalCredit: input.lines.reduce((sum, l) => sum + l.credit, 0),
        isPosted: false,
        tenantId: input.tenantId,
      },
    });

    // Create journal entry lines
    for (const line of input.lines) {
      operations.push({
        type: 'create',
        model: 'JournalEntryLine',
        data: {
          accountCode: line.accountCode,
          debit: line.debit,
          credit: line.credit,
          description: line.description,
          tenantId: input.tenantId,
        },
        dependencies: ['JournalEntry.create'],
      });
    }

    return {
      operations,
      resourceEstimates: {
        databaseWrites: 1 + input.lines.length,
        databaseReads: input.lines.length,
        estimatedMemoryMB: 5,
      },
    };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const validationEngine = new ValidationEngine();
