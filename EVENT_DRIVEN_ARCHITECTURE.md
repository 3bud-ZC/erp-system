# Event-Driven ERP Architecture - Complete Documentation

**Purpose:** Production-grade event-driven system for ERP with strict ordering, idempotency, and failure recovery.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          API Routes / Services                           │
│  (sales-invoices, purchase-invoices, payments, journal-entries)       │
└──────────────────────────┬────────────────────────────────────────────┘
                           │
                           │ 1. Request with input
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Validation Engine (Pre-Commit)                       │
│  - Validates business rules                                          │
│  - Creates database snapshot                                        │
│  - Generates execution plan                                        │
│  - Returns validation result                                       │
└──────────────────────────┬────────────────────────────────────────────┘
                           │
                           │ 2. Validation passed
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Event Orchestrator                                  │
│  - Coordinates validation + execution + events                       │
│  - Ensures transactional consistency                                 │
└──────────────────────────┬────────────────────────────────────────────┘
                           │
                           │ 3. Begin Prisma transaction
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Prisma Transaction                                │
│  - Execute business operation (create invoice, etc.)                 │
│  - Persist events to outbox table (same transaction)                  │
│  - Commit transaction                                               │
└──────────────────────────┬────────────────────────────────────────────┘
                           │
                           │ 4. Transaction committed
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Event Bus                                          │
│  - Tenant-specific queues (strict ordering)                         │
│  - Publish events to handlers                                       │
└──────────────────────┬──────────────────────────────────────────────────┘
                           │
                           │ 5. Event published
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Event Handlers                                      │
│  - PurchaseCreatedHandler: update inventory, create accounting entry  │
│  - SalesInvoiceCreatedHandler: update inventory, create accounting    │
│  - StockUpdatedHandler: update valuation, check low stock alerts      │
│  - PaymentReceivedHandler: allocate payment, update balances         │
│  - JournalEntryPostedHandler: update account balances                │
└──────────────────────┬──────────────────────────────────────────────────┘
                           │
                           │ 6. Handler execution
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Side Effects (via existing services)                   │
│  - inventory-transactions.ts (stock updates)                         │
│  - accounting.ts (journal entries)                                   │
│  - notification service (emails, alerts)                              │
└─────────────────────────────────────────────────────────────────────────┘
                           │
                           │ 7. Success or Failure
                           ▼
                  ┌────────────────┴────────────────┐
                  │                                 │
                  ▼                                 ▼
           Event Success                      Event Failure
                  │                                 │
                  │                                 │
                  ▼                                 ▼
      Mark event as processed               Schedule retry with
      in outbox table                        exponential backoff
                                          │
                                          ▼
                                   Retry Mechanism
                                   - Exponential backoff
                                   - Max 5 retries
                                   - Non-retryable errors fail immediately
```

---

## Core Components

### 1. Domain Events (`lib/events/domain-events.ts`)

**Purpose:** Type-safe event definitions for all ERP actions

**Event Types:**
- `PurchaseCreated` - New purchase order/invoice created
- `PurchasePosted` - Purchase accounting entry posted
- `PurchaseCancelled` - Purchase cancelled
- `SalesInvoiceCreated` - New sales invoice created
- `SalesInvoicePosted` - Sales accounting entry posted
- `SalesInvoicePaid` - Payment received for invoice
- `SalesInvoiceCancelled` - Invoice cancelled
- `StockUpdated` - Inventory quantity changed
- `StockTransferCreated` - Stock transfer initiated
- `StockTransferCompleted` - Stock transfer completed
- `StockAdjustmentCreated` - Manual stock adjustment
- `PaymentReceived` - Payment received
- `PaymentAllocated` - Payment allocated to invoice
- `PaymentReconciled` - Payment reconciled with bank
- `JournalEntryCreated` - Journal entry created
- `JournalEntryPosted` - Journal entry posted (immutable)
- `JournalEntryReversed` - Journal entry reversed
- `CustomerCreated` - New customer created
- `SupplierCreated` - New supplier created

**Event Structure:**
```typescript
interface DomainEvent {
  id: string;              // Unique event ID
  eventType: string;       // Event type name
  tenantId: string;        // Tenant for multi-tenant isolation
  aggregateId: string;     // ID of the aggregate (e.g., invoiceId)
  aggregateType: string;   // Type of aggregate (e.g., SalesInvoice)
  version: number;         // Event version for schema evolution
  data: any;              // Event payload
  metadata: EventMetadata; // Contextual metadata
  occurredAt: Date;        // When the event occurred
}
```

**Key Features:**
- Type-safe event data interfaces
- Event factory for creating events
- Type guards for event type checking
- Metadata for correlation and causation tracking

### 2. Event Bus (`lib/events/event-bus.ts`)

**Purpose:** In-memory pub/sub with tenant-specific queues for strict ordering

**Key Features:**
- **Tenant-specific queues:** Each tenant has its own event queue
- **Strict ordering:** Events are processed sequentially per tenant
- **Pub/sub pattern:** Multiple handlers can subscribe to same event type
- **Lock-based processing:** Prevents concurrent processing of same tenant queue
- **Batch publishing:** Multiple events can be published atomically

**Tenant Ordering Mechanism:**
```typescript
// Events are queued per tenant
tenantQueues: Map<string, DomainEvent[]>

// Processing lock per tenant ensures strict ordering
processingLocks: Map<string, boolean>

// Events from same tenant are processed sequentially
await processTenantQueue(tenantId);
```

**Usage:**
```typescript
// Subscribe to events
eventBus.subscribe('SalesInvoiceCreated', handler);

// Publish single event
await eventBus.publish(event);

// Publish batch (maintains order within tenant)
await eventBus.publishBatch([event1, event2]);
```

### 3. Event Persistence (`lib/events/event-persistence.ts`)

**Purpose:** Outbox pattern for reliable event delivery

**Key Features:**
- **Transactional persistence:** Events are persisted within the same transaction as business operation
- **Status tracking:** PENDING → PROCESSED → FAILED
- **Retry count:** Tracks number of retry attempts
- **Error logging:** Stores last error for debugging
- **Idempotency check:** Prevents duplicate event processing
- **Duplicate detection:** Prevents duplicate events within time window

**Outbox Pattern:**
```typescript
// Within Prisma transaction
await prisma.$transaction(async (tx) => {
  // 1. Execute business operation
  const invoice = await tx.salesInvoice.create({...});
  
  // 2. Persist event to outbox (same transaction)
  await eventPersistence.persistEvent(event);
  
  // 3. Transaction commits atomically
});
```

**Idempotency:**
```typescript
// Check if event was already processed
const isProcessed = await eventPersistence.isEventProcessed(eventId);
if (isProcessed) {
  return; // Skip processing
}

// Check for duplicate events
const hasDuplicate = await eventPersistence.hasDuplicateEvent(
  aggregateId,
  eventType,
  occurredAt,
  5000 // 5 second window
);
```

### 4. Event Handlers (`lib/events/event-handlers.ts`)

**Purpose:** Domain-specific handlers for ERP events

**Available Handlers:**

#### PurchaseCreatedHandler
- Updates inventory (increments stock)
- Creates accounting entry (debit inventory, credit accounts payable)
- Notifies supplier

#### SalesInvoiceCreatedHandler
- Updates inventory (decrements stock)
- Creates accounting entry (debit accounts receivable, credit sales revenue)
- Updates customer balance

#### StockUpdatedHandler
- Updates inventory valuation
- Checks low stock alerts
- Updates cost layers (FIFO/LIFO)

#### PaymentReceivedHandler
- Allocates payment to invoices
- Creates accounting entry (debit cash/bank, credit receivable/payable)
- Updates customer/supplier balance

#### JournalEntryPostedHandler
- Updates account balances
- Updates balance history
- Checks accounting period status

**Integration with Existing Services:**
```typescript
// Uses existing inventory-transactions module
const { incrementStockWithTransaction } = await import('../inventory-transactions');

// Uses existing accounting module
const { createJournalEntry } = await import('../accounting');
```

### 5. Retry Mechanism (`lib/events/retry-mechanism.ts`)

**Purpose:** Exponential backoff retry strategy for failed events

**Key Features:**
- **Exponential backoff:** Delay increases with each retry (1s, 2s, 4s, 8s, 16s, max 60s)
- **Max retries:** Configurable (default: 5)
- **Retryable errors:** Only retry specific error types (network, 5xx, transient validation)
- **Non-retryable errors:** Fail immediately (validation errors, 4xx, etc.)
- **Background processing:** Runs in background, doesn't block main flow

**Retry Configuration:**
```typescript
interface RetryConfig {
  maxRetries: 5;
  initialDelayMs: 1000;
  maxDelayMs: 60000;
  backoffMultiplier: 2;
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'EAI_AGAIN',
    '5xx',
    'ValidationError', // Transient validation errors
  ];
}
```

**Retry Logic:**
```typescript
// Calculate delay with exponential backoff
delay = initialDelay * (backoffMultiplier ^ retryCount)
delay = min(delay, maxDelay)

// Check if error is retryable
if (isRetryable(error) && retryCount < maxRetries) {
  scheduleRetry(eventId, error);
} else {
  markFailed(eventId, error);
}
```

### 6. Event Integration (`lib/events/event-integration.ts`)

**Purpose:** Integrates validation engine with event-driven architecture

**Key Features:**
- **Validation-first:** Validates before execution
- **Transactional consistency:** Events persisted within same transaction
- **Post-commit publishing:** Events published only after transaction commits
- **Automatic retry:** Failed event publishing triggers retry mechanism
- **Background processing:** Background jobs process pending/failed events

**Execution Flow:**
```typescript
// 1. Validate input
const validationResult = await validationEngine.validate('sales', input, context);

// 2. Execute within transaction
await prisma.$transaction(async (tx) => {
  const result = await operation(input);
  
  // 3. Persist events (same transaction)
  for (const event of events) {
    await eventPersistence.persistEvent(event);
  }
  
  return result;
});

// 4. Publish events after commit
for (const event of events) {
  try {
    await eventBus.publish(event);
  } catch (error) {
    await retryMechanism.scheduleRetry(event.id, error);
  }
}
```

---

## Event Flow Lifecycle

### Complete Lifecycle Example: Sales Invoice Creation

```
1. API Request
   POST /api/sales-invoices
   Body: { customerId, items, date }

2. Validation Engine
   - Create validation context
   - Fetch database snapshot (products, customer)
   - Validate business rules:
     * Customer exists?
     * Stock available?
     * Credit limit not exceeded?
     * Prices valid?
   - Return validation result

3. Event Orchestrator
   - Check validation passed
   - Begin Prisma transaction

4. Transaction Execution
   - Create sales invoice
   - Create sales invoice items
   - Update product stock (atomicDecrementStock)
   - Persist SalesInvoiceCreated event to outbox
   - Persist StockUpdated event to outbox
   - Commit transaction

5. Event Bus
   - Publish SalesInvoiceCreated to tenant queue
   - Publish StockUpdated to tenant queue
   - Process tenant queue sequentially

6. Event Handlers
   - SalesInvoiceCreatedHandler:
     * Update customer balance
     * Create accounting entry
     * Notify customer
   - StockUpdatedHandler:
     * Update inventory valuation
     * Check low stock alerts
     * Update cost layers

7. Side Effects
   - Inventory updated via inventory-transactions.ts
   - Accounting entry created via accounting.ts
   - Notifications sent

8. Success Path
   - Mark events as PROCESSED in outbox
   - Return result to API

9. Failure Path
   - If handler fails:
     * Mark event as FAILED in outbox
     * Increment retry count
     * Schedule retry with exponential backoff
   - Background job reprocesses failed events
```

---

## Failure Handling Strategy

### 1. Validation Failures

**When:** Pre-commit validation fails

**Handling:**
```typescript
const validationResult = await validationEngine.validate('sales', input, context);

if (!validationResult.isValid) {
  throw new ValidationError(validationResult);
  // No events created
  // No transaction started
  // Returns error to client with details
}
```

**Recovery:** Client fixes input and retries

### 2. Transaction Failures

**When:** Prisma transaction fails (constraint violation, deadlock, etc.)

**Handling:**
```typescript
try {
  await prisma.$transaction(async (tx) => {
    // Business operation
    // Event persistence
  });
} catch (error) {
  // Transaction rolled back
  // Events not persisted
  // No side effects
  throw error; // Return to client
}
```

**Recovery:** Client fixes data and retries

### 3. Event Publishing Failures

**When:** Event bus publish fails (event bus down, handler error)

**Handling:**
```typescript
for (const event of events) {
  try {
    await eventBus.publish(event);
  } catch (error) {
    // Transaction already committed
    // Event persisted in outbox
    // Schedule retry
    await retryMechanism.scheduleRetry(event.id, error);
  }
}
```

**Recovery:** Retry mechanism handles automatically

### 4. Handler Execution Failures

**When:** Event handler throws error

**Handling:**
```typescript
private async executeHandler(handler: EventHandler, event: DomainEvent): Promise<void> {
  try {
    await handler.handle(event);
  } catch (error) {
    console.error(`Handler error for event ${event.eventType}:`, error);
    // Error logged but doesn't stop other handlers
    // Event remains in outbox as PENDING
    // Background job will retry
  }
}
```

**Recovery:** Background job reprocesses pending events

### 5. Retry Exhaustion

**When:** Event fails after max retries

**Handling:**
```typescript
if (event.retryCount >= maxRetries) {
  await eventPersistence.markFailed(eventId, error);
  // Event marked as FAILED permanently
  // Alert sent to operations team
  // Manual intervention required
}
```

**Recovery:** Manual intervention by operations team

### 6. Non-Retryable Errors

**When:** Error is not retryable (validation error, 4xx, etc.)

**Handling:**
```typescript
if (!isRetryable(error)) {
  await eventPersistence.markFailed(eventId, error);
  // Immediate failure
  // No retries
}
```

**Recovery:** Manual intervention or fix data

---

## Idempotency Strategy

### 1. Event-Level Idempotency

**Check if event already processed:**
```typescript
const isProcessed = await eventPersistence.isEventProcessed(eventId);
if (isProcessed) {
  return; // Skip processing
}
```

### 2. Duplicate Detection

**Prevent duplicate events within time window:**
```typescript
const hasDuplicate = await eventPersistence.hasDuplicateEvent(
  aggregateId,
  eventType,
  occurredAt,
  5000 // 5 second window
);

if (hasDuplicate) {
  throw new Error('Duplicate event detected');
}
```

### 3. Aggregate-Level Idempotency

**Use aggregateId + eventType for deduplication:**
```typescript
// Events are unique per aggregate + type
@@unique([aggregateId, eventType, occurredAt])
```

---

## Strict Ordering Per Tenant

### Mechanism

**Tenant-Specific Queues:**
```typescript
tenantQueues: Map<string, DomainEvent[]>
// Key: tenantId
// Value: Array of events for that tenant
```

**Processing Lock:**
```typescript
processingLocks: Map<string, boolean>
// Key: tenantId
// Value: true if processing, false if idle
```

**Sequential Processing:**
```typescript
async processTenantQueue(tenantId: string): Promise<void> {
  // Acquire lock
  if (processingLocks.get(tenantId)) {
    return; // Already processing
  }
  processingLocks.set(tenantId, true);

  try {
    const queue = tenantQueues.get(tenantId);
    
    // Process events in order (FIFO)
    while (queue.length > 0) {
      const event = queue.shift()!;
      await dispatchEvent(event);
    }
  } finally {
    // Release lock
    processingLocks.set(tenantId, false);
  }
}
```

**Guarantees:**
- Events from same tenant processed sequentially
- No concurrent processing of same tenant's events
- Maintains causal ordering within tenant
- Different tenants can process concurrently

---

## Consistency with Prisma Transactions

### Transactional Event Persistence

**Events persisted within same transaction:**
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Business operation
  const invoice = await tx.salesInvoice.create({...});
  
  // 2. Event persistence (same transaction)
  await eventPersistence.persistEvent(event);
  
  // 3. Both commit atomically or rollback together
});
```

**Benefits:**
- Events exist only if business operation succeeds
- Events are lost if transaction rolls back (as expected)
- No orphaned events
- No partial state

### Post-Commit Publishing

**Events published after transaction commits:**
```typescript
const result = await prisma.$transaction(async (tx) => {
  // ... operation and event persistence
  return operationResult;
});

// Transaction committed successfully
// Now publish events
for (const event of events) {
  await eventBus.publish(event);
}
```

**Benefits:**
- Transaction not blocked by event publishing
- Event publishing failures don't roll back transaction
- Outbox provides recovery mechanism

---

## Integration with Existing Systems

### 1. Validation Engine Integration

**Validation before execution:**
```typescript
const { result, events } = await eventOrchestrator.executeWithValidation(
  'sales',
  input,
  async (validatedInput) => {
    // Business operation with validated input
    return await createSalesInvoice(validatedInput);
  },
  validationContext
);
```

**Benefits:**
- Pre-commit validation prevents invalid data
- Validation errors prevent event creation
- Clean separation of concerns

### 2. Inventory System Integration

**Event handlers use existing inventory functions:**
```typescript
const { incrementStockWithTransaction } = await import('../inventory-transactions');

await incrementStockWithTransaction(
  tx,
  items,
  referenceId,
  'purchase',
  tenantId
);
```

**Benefits:**
- Reuses existing inventory logic
- Maintains transaction safety
- No code duplication

### 3. Accounting System Integration

**Event handlers use existing accounting functions:**
```typescript
const { createJournalEntry } = await import('../accounting');

await createJournalEntry({
  entryDate: data.date,
  description: `Purchase ${data.purchaseNumber}`,
  referenceType: 'Purchase',
  referenceId: data.purchaseId,
  lines: [...],
});
```

**Benefits:**
- Reuses existing accounting logic
- Maintains double-entry integrity
- No code duplication

---

## Background Processing

### Pending Event Processor

**Job runs every minute:**
```typescript
export async function processPendingEventsJob() {
  const tenants = await getAllTenants();
  
  for (const tenant of tenants) {
    const processed = await eventOrchestrator.processPendingEvents(tenant.id);
    console.log(`Processed ${processed} pending events for tenant ${tenant.id}`);
  }
}
```

### Failed Event Retrier

**Job runs every 5 minutes:**
```typescript
export async function reprocessFailedEventsJob() {
  const tenants = await getAllTenants();
  
  for (const tenant of tenants) {
    const processed = await eventOrchestrator.reprocessFailedEvents(tenant.id);
    console.log(`Reprocessed ${processed} failed events for tenant ${tenant.id}`);
  }
}
```

---

## Monitoring and Observability

### Metrics to Track

1. **Event Publishing Rate**
   - Events per second per tenant
   - Events per second total

2. **Event Processing Latency**
   - Time from event creation to processing
   - P50, P95, P99 latencies

3. **Retry Rate**
   - Percentage of events that required retry
   - Retry count distribution

4. **Failure Rate**
   - Percentage of events that failed permanently
   - Failure by error type

5. **Queue Depth**
   - Number of pending events per tenant
   - Number of failed events per tenant

6. **Handler Execution Time**
   - Time per handler per event type
   - Slow handlers identification

### Alerting

**Alert on:**
- High failure rate (>5%)
- Queue depth >1000
- Handler execution time >10s
- Non-retryable errors
- Retry exhaustion

---

## Deployment Considerations

### 1. Prisma Schema Changes

**Add OutboxEvent model:**
```prisma
model OutboxEvent {
  id            String   @id @default(cuid())
  eventType     String
  tenantId      String
  aggregateId   String
  aggregateType String
  version       Int
  data          Json
  metadata      Json
  status        String   @default("pending")
  occurredAt    DateTime
  processedAt   DateTime?
  retryCount    Int      @default(0)
  lastError     String?
  errorMessage  String?
  correlationId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([tenantId, status])
  @@index([eventType, status])
  @@index([aggregateId, eventType])
  @@index([occurredAt])
  @@index([processedAt])
}
```

### 2. Background Jobs

**Implement with cron-like scheduler:**
```typescript
// Using node-cron or similar
import cron from 'node-cron';

// Process pending events every minute
cron('* * * * *', async () => {
  await processPendingEventsJob();
});

// Reprocess failed events every 5 minutes
cron('*/5 * * * *', async () => {
  await reprocessFailedEventsJob();
});
```

### 3. Horizontal Scaling

**Event bus is stateless (except in-memory queues):**
- For production, replace in-memory queues with Redis
- Use Redis streams for tenant-specific queues
- Use Redis locks for processing locks

**Example with Redis:**
```typescript
import Redis from 'ioredis';

class RedisEventBus {
  private redis: Redis;

  async publish(event: DomainEvent): Promise<void> {
    // Add to Redis stream for tenant
    await this.redis.xadd(
      `events:${event.tenantId}`,
      '*',
      'event', JSON.stringify(event)
    );
  }

  async processTenantQueue(tenantId: string): Promise<void> {
    // Read from Redis stream
    const events = await this.redis.xread(
      'COUNT', 10,
      'BLOCK', 1000,
      'STREAMS', `events:${tenantId}`, '0'
    );
    
    // Process events
    for (const event of events) {
      await this.dispatchEvent(event);
    }
  }
}
```

### 4. Database Indexes

**Ensure indexes for outbox queries:**
```sql
CREATE INDEX "OutboxEvent_tenant_status" ON "OutboxEvent"("tenantId", "status");
CREATE INDEX "OutboxEvent_type_status" ON "OutboxEvent"("eventType", "status");
CREATE INDEX "OutboxEvent_aggregate_type" ON "OutboxEvent"("aggregateId", "eventType");
CREATE INDEX "OutboxEvent_occurred" ON "OutboxEvent"("occurredAt");
CREATE INDEX "OutboxEvent_processed" ON "OutboxEvent"("processedAt");
```

---

## Summary

The Event-Driven ERP Architecture provides:

**Core Benefits:**
- Strict ordering per tenant (no concurrent event processing for same tenant)
- Idempotency (no duplicate event processing)
- No duplicate events (duplicate detection within time window)
- Consistency with Prisma transactions (outbox pattern)
- Automatic retry with exponential backoff
- Failure recovery (background jobs)
- Integration with validation engine (pre-commit validation)
- Integration with existing services (inventory, accounting)

**Production-Grade Features:**
- Transactional event persistence
- Post-commit event publishing
- Tenant-specific event queues
- Background processing
- Comprehensive monitoring
- Horizontal scaling support (with Redis)

**Implementation Ready:**
- Complete TypeScript implementation
- Integration layer with validation engine
- Event handlers for all major ERP actions
- Retry mechanism with exponential backoff
- Architecture documentation
- Deployment checklist
