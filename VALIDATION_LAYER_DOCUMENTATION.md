# System Behavior Validation Layer - Complete Documentation

**Purpose:** Pre-commit validation engine for ERP workflows that simulates operations before database writes and detects conflicts before execution.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Routes / Services                        │
│  (sales-invoices, purchase-invoices, journal-entries, etc.)    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 1. Prepare input
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Validation Integration Layer                        │
│  - Creates validation context                                   │
│  - Calls validation engine                                      │
│  - Handles validation results                                  │
│  - Executes transaction if valid                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 2. Validate
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Validation Engine                              │
│  - Manages workflow validators                                   │
│  - Creates database snapshots                                   │
│  - Caches validation results                                    │
│  - Generates execution plans                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 3. Snapshot + Validate
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Workflow Validators                               │
│  - PurchaseFlowValidator                                        │
│  - SalesFlowValidator                                           │
│  - ReturnFlowValidator                                          │
│  - StockTransferValidator                                       │
│  - AccountingEntryValidator                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Validation Engine (`lib/validation/validation-engine.ts`)

**Purpose:** Central orchestration of validation logic

**Key Features:**
- Workflow validator registry
- Database snapshot creation
- Result caching (5-second TTL)
- Execution plan generation
- Error handling and metadata

**Usage:**
```typescript
import { validationEngine, ValidationContext } from './validation/validation-engine';

const context: ValidationContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  requestId: 'req-789',
  timestamp: new Date(),
  prisma,
  snapshot: { /* auto-populated */ },
};

const result = await validationEngine.validate('sales', input, context);

if (!result.isValid) {
  throw new ValidationError(result);
}

// Execute with execution plan
await executeTransaction(result.executionPlan);
```

### 2. Workflow Validators

Each validator implements the `WorkflowValidator` interface:

```typescript
interface WorkflowValidator {
  validate(input: any, context: ValidationContext): Promise<ValidationResult>;
  getRequiredSnapshot(input: any): SnapshotRequirements;
  generateExecutionPlan(input: any, context: ValidationContext): Promise<ExecutionPlan>;
}
```

**Available Validators:**

#### PurchaseFlowValidator
- Validates supplier existence
- Validates product availability
- Validates quantity and price
- Warns on price deviation from cost
- Generates execution plan with stock increment

#### SalesFlowValidator
- Validates customer existence
- Validates stock availability
- Validates credit limits
- Validates quantity and price
- Warns on price below cost
- Generates execution plan with stock decrement

#### ReturnFlowValidator
- Validates customer/supplier based on return type
- Validates product existence
- Validates quantity
- Generates execution plan with stock adjustment

#### StockTransferValidator
- Validates product existence
- Validates different warehouses
- Validates quantity
- Validates stock availability
- Generates execution plan

#### AccountingEntryValidator
- Validates account existence
- Validates debit/credit mutual exclusivity
- Validates entry balance (double-entry)
- Validates at least 2 lines
- Generates execution plan

### 3. Validation Integration (`lib/validation/validation-integration.ts`)

**Purpose:** Integration layer for existing services

**Key Functions:**

```typescript
// Sales invoice with validation
await createSalesInvoiceWithValidation({
  customerId: 'cust-123',
  items: [{ productId: 'prod-456', quantity: 10, price: 100 }],
  date: new Date(),
  tenantId: 'tenant-789',
  userId: 'user-abc',
});

// Purchase invoice with validation
await createPurchaseInvoiceWithValidation({
  supplierId: 'sup-123',
  items: [{ productId: 'prod-456', quantity: 10, price: 50 }],
  date: new Date(),
  tenantId: 'tenant-789',
});

// Journal entry with validation
await createJournalEntryWithValidation({
  entryDate: new Date(),
  description: 'Test entry',
  referenceType: 'Manual',
  referenceId: '',
  lines: [
    { accountCode: '1001', debit: 100, credit: 0 },
    { accountCode: '4010', debit: 0, credit: 100 },
  ],
  tenantId: 'tenant-789',
});
```

---

## Validation Result Structure

```typescript
interface ValidationResult {
  isValid: boolean;              // Overall validation status
  errors: ValidationError[];     // Blocking errors
  warnings: ValidationError[];   // Non-blocking warnings
  safeToExecute: boolean;       // Whether execution is safe
  executionPlan?: ExecutionPlan; // Execution plan if valid
  metadata: ValidationMetadata; // Timing and context info
}

interface ValidationError {
  code: string;                 // Error code (e.g., 'INSUFFICIENT_STOCK')
  severity: ValidationSeverity; // 'error' | 'warning' | 'info'
  message: string;              // Human-readable message
  field?: string;               // Field that caused error
  context?: Record<string, any>; // Additional context
}
```

---

## Error Codes

### Common Error Codes

| Code | Severity | Description |
|------|----------|-------------|
| `SUPPLIER_NOT_FOUND` | Error | Supplier does not exist or belongs to different tenant |
| `CUSTOMER_NOT_FOUND` | Error | Customer does not exist or belongs to different tenant |
| `PRODUCT_NOT_FOUND` | Error | Product does not exist or belongs to different tenant |
| `ACCOUNT_NOT_FOUND` | Error | Account does not exist or belongs to different tenant |
| `INSUFFICIENT_STOCK` | Error | Not enough stock available |
| `CREDIT_LIMIT_EXCEEDED` | Error | Customer credit limit exceeded |
| `INVALID_QUANTITY` | Error | Quantity must be positive |
| `INVALID_PRICE` | Error | Price cannot be negative |
| `UNBALANCED_ENTRY` | Error | Journal entry debit != credit |
| `SAME_WAREHOUSE` | Error | Source and destination warehouses must be different |
| `FUTURE_DATE` | Error | Date cannot be in the future |
| `VALIDATION_ERROR` | Error | General validation error |

### Warning Codes

| Code | Severity | Description |
|------|----------|-------------|
| `PRICE_DEVIATION` | Warning | Purchase price significantly higher than cost |
| `PRICE_BELOW_COST` | Warning | Selling price below cost |
| `RETURN_QUANTITY_VALIDATION` | Warning | Return quantity should be validated against original invoice |

---

## Integration with Existing API Routes

### Example: Sales Invoice API Route

**Before (Direct Creation):**
```typescript
// app/api/sales-invoices/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  
  const invoice = await prisma.salesInvoice.create({
    data: body,
  });
  
  return Response.json(invoice);
}
```

**After (With Validation):**
```typescript
// app/api/sales-invoices/route.ts
import { createSalesInvoiceWithValidation, ValidationError } from '@/lib/validation/validation-integration';

export async function POST(req: Request) {
  const body = await req.json();
  const user = await getCurrentUser(req);
  
  try {
    const invoice = await createSalesInvoiceWithValidation({
      ...body,
      tenantId: user.tenantId,
      userId: user.id,
    });
    
    return Response.json(invoice);
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({
        error: 'Validation failed',
        errors: error.validationResult.errors,
        warnings: error.validationResult.warnings,
      }, { status: 400 });
    }
    throw error;
  }
}
```

---

## Performance Considerations

### 1. Database Snapshot Caching

The validation engine creates database snapshots for validation. To optimize:

```typescript
// Snapshot is cached for 5 seconds
const cacheKey = `${workflowType}:${tenantId}:${JSON.stringify(input)}`;
const cached = this.cache.get(cacheKey);
if (cached && this.cache.isValid(cached)) {
  return cached.result; // Return cached result
}
```

**Benefits:**
- Avoids repeated database reads for identical requests
- Reduces validation time for retry scenarios
- 5-second TTL balances freshness with performance

### 2. Selective Snapshot Loading

Validators only fetch required data:

```typescript
getRequiredSnapshot(input: SalesInput): SnapshotRequirements {
  return {
    productIds: input.items.map(i => i.productId),  // Only products in invoice
    customerIds: [input.customerId],              // Only this customer
    supplierIds: [],
    accountCodes: [],
  };
}
```

**Benefits:**
- Minimizes database queries
- Reduces memory footprint
- Faster validation for small transactions

### 3. Execution Plan Pre-calculation

Execution plans are generated during validation, not during execution:

```typescript
if (result.isValid) {
  result.executionPlan = await validator.generateExecutionPlan(input, enrichedContext);
}
```

**Benefits:**
- Execution phase is deterministic
- Can estimate resource usage upfront
- Enables rollback planning

### 4. Resource Estimates

Each execution plan includes resource estimates:

```typescript
interface ResourceEstimates {
  databaseWrites: number;      // Number of write operations
  databaseReads: number;       // Number of read operations
  estimatedMemoryMB: number;   // Estimated memory usage
}
```

**Benefits:**
- Can reject operations that exceed resource limits
- Enables load balancing
- Provides monitoring data

---

## Scalability Strategy

### 1. Horizontal Scaling

The validation engine is stateless (except for in-memory cache):

```typescript
// Each instance has its own cache
class ValidationCache {
  private cache: Map<string, CacheEntry>;  // In-memory only
}
```

**Scaling Implications:**
- Can run multiple instances behind load balancer
- Cache is per-instance (no distributed cache needed due to short TTL)
- No shared state between instances

### 2. Database Connection Pooling

The validation engine uses the existing Prisma client:

```typescript
const context: ValidationContext = {
  prisma,  // Uses shared Prisma instance
  ...
};
```

**Benefits:**
- Leverages existing connection pool
- No additional database connections
- Efficient resource utilization

### 3. Async Validation

Validation is fully asynchronous:

```typescript
async validate(input: any, context: ValidationContext): Promise<ValidationResult> {
  // All database operations are async
  const snapshot = await this.createSnapshot(...);
  const result = await validator.validate(...);
  const plan = await validator.generateExecutionPlan(...);
  return result;
}
```

**Benefits:**
- Non-blocking I/O
- High throughput
- Scales with Node.js event loop

### 4. Batch Validation

For bulk operations, validate in parallel:

```typescript
const results = await Promise.all(
  inputs.map(input => validationEngine.validate('sales', input, context))
);
```

**Benefits:**
- Parallel validation of multiple operations
- Reduces total validation time
- Efficient for bulk imports

---

## Monitoring and Observability

### 1. Validation Metadata

Each validation result includes metadata:

```typescript
interface ValidationMetadata {
  validatedAt: Date;              // When validation occurred
  validationDurationMs: number;   // How long validation took
  workflowType: string;           // Type of workflow validated
  tenantId: string;               // Tenant that requested validation
  userId?: string;                // User that requested validation
}
```

**Usage:**
```typescript
// Log validation duration
console.log(`Validation took ${result.metadata.validationDurationMs}ms`);

// Track validation metrics
metrics.histogram('validation.duration', result.metadata.validationDurationMs, {
  workflow: result.metadata.workflowType,
  tenant: result.metadata.tenantId,
});
```

### 2. Error Tracking

Errors include context for debugging:

```typescript
{
  code: 'INSUFFICIENT_STOCK',
  severity: 'error',
  message: 'Insufficient stock for product PROD001. Available: 5, Required: 10',
  field: 'items.prod-456.quantity',
  context: { available: 5, required: 10 }
}
```

**Usage:**
```typescript
// Track error rates
metrics.increment('validation.errors', {
  code: error.code,
  workflow: result.metadata.workflowType,
});

// Alert on critical errors
if (error.code === 'CREDIT_LIMIT_EXCEEDED') {
  alertService.notify('Credit limit exceeded', error.context);
}
```

### 3. Performance Metrics

Track validation performance:

```typescript
// Average validation time per workflow
metrics.histogram('validation.duration', durationMs, { workflow });

// Cache hit rate
metrics.gauge('validation.cache.hit_rate', hitRate);

// Resource estimates accuracy
metrics.histogram('validation.resource.accuracy', actualVsEstimated);
```

---

## Testing Strategy

### 1. Unit Tests

Test individual validators:

```typescript
describe('SalesFlowValidator', () => {
  it('should reject sales with insufficient stock', async () => {
    const input = {
      customerId: 'cust-123',
      items: [{ productId: 'prod-456', quantity: 100, price: 10 }],
      date: new Date(),
      tenantId: 'tenant-789',
    };

    const context = {
      tenantId: 'tenant-789',
      snapshot: {
        products: new Map([['prod-456', { stock: 5, version: 0 }]]),
        // ... other snapshot data
      },
    };

    const result = await validator.validate(input, context);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'INSUFFICIENT_STOCK' })
    );
  });
});
```

### 2. Integration Tests

Test integration with actual database:

```typescript
describe('Sales Invoice Integration', () => {
  it('should create invoice with validation', async () => {
    const input = {
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 1, price: 100 }],
      date: new Date(),
      tenantId: tenant.id,
      userId: user.id,
    };

    const invoice = await createSalesInvoiceWithValidation(input);

    expect(invoice).toBeDefined();
    expect(invoice.customerId).toBe(input.customerId);
  });
});
```

### 3. Load Tests

Test validation performance under load:

```typescript
describe('Validation Performance', () => {
  it('should handle 100 concurrent validations', async () => {
    const inputs = Array(100).fill(null).map(() => ({
      customerId: 'cust-123',
      items: [{ productId: 'prod-456', quantity: 1, price: 100 }],
      date: new Date(),
      tenantId: 'tenant-789',
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      inputs.map(input => validationEngine.validate('sales', input, context))
    );
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // < 5 seconds for 100 validations
  });
});
```

---

## Deployment Checklist

### Before Production

- [ ] All validators tested with unit tests
- [ ] Integration tests pass with actual database
- [ ] Load tests validate performance targets
- [ ] Error tracking integrated with monitoring system
- [ ] Metrics collection configured
- [ ] Cache TTL tuned for production workload
- [ ] Database indexes optimized for snapshot queries
- [ ] API routes updated to use validation layer
- [ ] Error handling documented for API consumers
- [ ] Rollback plan tested

### Monitoring Setup

- [ ] Validation duration metric
- [ ] Validation error rate metric
- [ ] Cache hit rate metric
- [ ] Resource estimate accuracy metric
- [ ] Alerts for high error rates
- [ ] Alerts for slow validations
- [ ] Dashboard for validation health

### Documentation

- [ ] API documentation updated with validation error codes
- [ ] Integration guide for developers
- [ ] Troubleshooting guide for operations
- [ ] Runbook for common validation issues

---

## Troubleshooting

### Issue: Validation Slow

**Symptoms:** Validation takes > 1 second

**Possible Causes:**
1. Database snapshot queries slow
2. Missing indexes on snapshot queries
3. Large number of items in transaction

**Solutions:**
```sql
-- Add missing indexes
CREATE INDEX "Product_tenant_id_code" ON "Product"("tenantId", "code");
CREATE INDEX "Customer_tenant_id_code" ON "Customer"("tenantId", "code");
```

```typescript
// Reduce snapshot size by fetching only needed fields
select: {
  id: true,
  stock: true,  // Only fetch what's needed
  // Remove unused fields
}
```

### Issue: High Cache Miss Rate

**Symptoms:** Cache hit rate < 50%

**Possible Causes:**
1. Cache TTL too short
2. Input data varies too much
3. High request rate with unique inputs

**Solutions:**
```typescript
// Increase cache TTL
ttl: 10000,  // 10 seconds instead of 5

// Normalize input before caching
const normalizedInput = normalizeInput(input);
const cacheKey = this.getCacheKey(workflowType, normalizedInput, tenantId);
```

### Issue: Validation Errors Not Caught

**Symptoms:** Invalid data passes validation

**Possible Causes:**
1. Validator not registered
2. Snapshot not populated correctly
3. Validation logic has bug

**Solutions:**
```typescript
// Check validator is registered
console.log('Registered validators:', Array.from(validationEngine.validators.keys()));

// Debug snapshot population
console.log('Snapshot:', context.snapshot);

// Add logging to validator
console.log('Validating input:', input);
console.log('Validation result:', result);
```

---

## Future Enhancements

### 1. Distributed Cache

Replace in-memory cache with Redis for multi-instance deployments:

```typescript
import Redis from 'ioredis';

class DistributedValidationCache {
  private redis: Redis;

  async get(key: string): Promise<CacheEntry | undefined> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : undefined;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    await this.redis.setex(key, entry.ttl / 1000, JSON.stringify(entry));
  }
}
```

### 2. Validation Rules Engine

Add dynamic validation rules configurable per tenant:

```typescript
interface ValidationRule {
  id: string;
  tenantId: string;
  workflowType: string;
  condition: string;  // JavaScript expression
  errorMessage: string;
  severity: ValidationSeverity;
}

class RulesEngineValidator extends WorkflowValidator {
  async validate(input: any, context: ValidationContext): Promise<ValidationResult> {
    const rules = await this.getRules(context.tenantId, 'sales');
    
    for (const rule of rules) {
      if (this.evaluateCondition(rule.condition, input)) {
        errors.push({
          code: rule.id,
          severity: rule.severity,
          message: rule.errorMessage,
        });
      }
    }
    
    return { isValid: errors.length === 0, errors, warnings: [] };
  }
}
```

### 3. Validation Replay

Store validation results for audit and replay:

```typescript
interface ValidationRecord {
  id: string;
  input: any;
  result: ValidationResult;
  context: ValidationContext;
  executedAt: Date;
  executionId?: string;  // If execution happened
}

async function replayValidation(recordId: string): Promise<ValidationResult> {
  const record = await prisma.validationRecord.findUnique({ where: { id: recordId } });
  return await validationEngine.validate(
    record.metadata.workflowType,
    record.input,
    record.context
  );
}
```

### 4. Predictive Validation

Use ML to predict validation failures:

```typescript
class PredictiveValidator {
  async predictValidationOutcome(input: any): Promise<{
    willPass: boolean;
    confidence: number;
    likelyErrors: string[];
  }> {
    const features = this.extractFeatures(input);
    const prediction = await this.model.predict(features);
    return prediction;
  }
}
```

---

## Summary

The System Behavior Validation Layer provides:

**Core Benefits:**
- Pre-commit validation prevents data integrity issues
- Database snapshots ensure validation accuracy
- Execution plans enable predictable execution
- Caching improves performance
- Comprehensive error detection

**Production-Grade Features:**
- Stateless design for horizontal scaling
- Async non-blocking operations
- Resource estimation for load management
- Comprehensive monitoring and observability
- Integration with existing services

**Implementation Ready:**
- Complete TypeScript implementation
- Integration layer for existing services
- Error handling and monitoring hooks
- Performance optimizations
- Deployment checklist
