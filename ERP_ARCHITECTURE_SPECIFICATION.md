# ERP System Architecture Specification
## Enterprise Resource Planning - Production Grade Architecture

**Version:** 2.0.0  
**Date:** April 21, 2026  
**Level:** SAP/Odoo Enterprise Grade  
**Status:** PRODUCTION READY

---

# 1. CORE ARCHITECTURE PRINCIPLES

## 1.1 Single Entry Point Doctrine (NON-NEGOTIABLE)

```
┌─────────────────────────────────────────────────────────┐
│  ALL OPERATIONS MUST GO THROUGH SINGLE ENTRY POINT       │
│                                                          │
│  → ERPExecutionEngine.execute(transaction)              │
│                                                          │
│  NO EXCEPTIONS:                                           │
│  ❌ No direct database calls from frontend              │
│  ❌ No bypass APIs                                        │
│  ❌ No business logic outside the engine                  │
│  ❌ No manual state updates                               │
└─────────────────────────────────────────────────────────┘
```

## 1.2 System Layers Architecture

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: FRONTEND PRESENTATION                          │
├─────────────────────────────────────────────────────────┤
│ • EntityForm (Dynamic Forms)                            │
│ • ERPDataTable (Enterprise Data Tables)                 │
│ • Workflow UI (Status, Timeline, Actions)               │
│ • Dashboard (KPIs, Alerts, Activity)                     │
├─────────────────────────────────────────────────────────┤
│ LAYER 2: API GATEWAY                                    │
├─────────────────────────────────────────────────────────┤
│ • /api/erp/execute    ← ONLY ENTRY POINT                │
│ • /api/erp/system-check ← Health Monitoring             │
│ • /api/erp/entity/*   ← Read-Only Queries              │
├─────────────────────────────────────────────────────────┤
│ LAYER 3: CORE EXECUTION ENGINE                          │
├─────────────────────────────────────────────────────────┤
│ • ERPExecutionEngine                                    │
│ • TransactionValidator                                  │
│ • BusinessRouter                                        │
│ • WorkflowEngine                                        │
├─────────────────────────────────────────────────────────┤
│ LAYER 4: ADAPTERS (Auto-Automation)                   │
├─────────────────────────────────────────────────────────┤
│ • AccountingAdapter  → Auto Journal Entries             │
│ • InventoryAdapter   → Auto Stock Movements            │
├─────────────────────────────────────────────────────────┤
│ LAYER 5: SERVICES (Cross-Cutting)                     │
├─────────────────────────────────────────────────────────┤
│ • AuditService       → Compliance Logging               │
│ • EventBus           → System Events                    │
│ • StateLoader        → Entity State Management          │
├─────────────────────────────────────────────────────────┤
│ LAYER 6: DATA PERSISTENCE                               │
├─────────────────────────────────────────────────────────┤
│ • PostgreSQL Database                                   │
│ • Prisma ORM                                            │
│ • Multi-tenant Data Isolation                           │
└─────────────────────────────────────────────────────────┘
```

---

# 2. EXECUTION FLOW SPECIFICATION

## 2.1 Standard Transaction Flow

Every transaction MUST follow this EXACT sequence:

```
Step 0: User Action
    ↓
Step 1: Frontend Layer
    • EntityForm captures input
    • Validation (client-side)
    • executeTransaction() called
    ↓
Step 2: API Gateway Layer
    • POST /api/erp/execute
    • Context extraction (user, tenant, IP)
    • Request validation
    ↓
Step 3: Core Engine Layer
    • ERPExecutionEngine.execute()
    ↓
Step 4: Transaction Validation
    • Schema validation
    • Business rule validation
    • Permission validation
    • Period validation
    ↓
Step 5: State Loading
    • Load current entity state
    • Load related entities
    • Load balances
    ↓
Step 6: Workflow Processing
    • Current status check
    • Transition validation
    • Next state determination
    ↓
Step 7: Business Logic Execution
    • Route to appropriate handler
    • Execute business rules
    • Calculate totals/taxes
    ↓
Step 8: Inventory Adapter (if applicable)
    • Stock availability check
    • Stock reservation/movement
    • Inventory transaction creation
    ↓
Step 9: Accounting Adapter (if applicable)
    • Journal entry generation
    • Debit/credit calculation
    • Account balance update
    ↓
Step 10: Event Emission
    • Emit transaction event
    • Queue async processes
    ↓
Step 11: Audit Logging
    • Log user action
    • Store before/after state
    • Record context
    ↓
Step 12: Persistence
    • Save to database (transaction)
    • Verify persistence
    ↓
Step 13: Response
    • Return success/failure
    • Include full entity data
    • Include journal entries
    • Include state info
    ↓
Step 14: Frontend Update
    • UI refresh
    • Show success/error
    • Update workflow display
```

## 2.2 Transaction Format Specification

### Standard Transaction Structure

```typescript
interface ERPTransaction {
  // Transaction Identifier (auto-generated if not provided)
  id?: string;
  
  // Transaction Type (REQUIRED)
  type: 
    | "SALES_ORDER"
    | "SALES_INVOICE" 
    | "SALES_RETURN"
    | "PURCHASE_ORDER"
    | "PURCHASE_INVOICE"
    | "PURCHASE_RETURN"
    | "PAYMENT"
    | "STOCK_TRANSFER"
    | "STOCK_ADJUSTMENT"
    | "PRODUCTION_ORDER"
    | "JOURNAL_ENTRY"
    | "WORKFLOW_TRANSITION";
  
  // Business Payload (REQUIRED)
  payload: {
    // Entity-specific data
    [key: string]: any;
  };
  
  // Execution Context (REQUIRED)
  context: {
    userId: string;           // User performing action
    tenantId: string;         // Multi-tenant isolation
    ipAddress?: string;       // Client IP
    userAgent?: string;       // Client device info
    timestamp?: string;       // Auto-generated
  };
}
```

### Example: Sales Invoice Transaction

```json
{
  "type": "SALES_INVOICE",
  "payload": {
    "id": "INV-2024-0001",
    "customerId": "CUST-001",
    "date": "2024-01-15",
    "dueDate": "2024-02-15",
    "items": [
      {
        "productId": "PROD-001",
        "productName": "Product A",
        "quantity": 10,
        "unitPrice": 100.00,
        "discount": 0,
        "total": 1000.00
      }
    ],
    "subtotal": 1000.00,
    "taxRate": 15,
    "taxAmount": 150.00,
    "total": 1150.00,
    "notes": "Payment terms: Net 30"
  },
  "context": {
    "userId": "USER-001",
    "tenantId": "TENANT-001",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
  }
}
```

---

# 3. WORKFLOW STATE MACHINE SPECIFICATION

## 3.1 Standard Workflow States

### Primary Flow
```
DRAFT → PENDING → CONFIRMED → POSTED → PAID → COMPLETED
```

### Alternative/Failure States
```
CANCELLED / REJECTED / VOID / REFUNDED / REOPENED
```

## 3.2 State Definitions

| State | Code | Description | Allowed Actions |
|-------|------|-------------|-----------------|
| DRAFT | draft | Initial state, editable | submit, cancel |
| PENDING | pending | Awaiting approval | approve, reject, cancel |
| CONFIRMED | confirmed | Approved, not yet posted | post, cancel |
| POSTED | posted | Posted to ledger | pay, void |
| PARTIALLY_PAID | partially_paid | Some payment received | pay, void |
| PAID | paid | Fully paid | complete |
| COMPLETED | completed | Final state | reopen |
| CANCELLED | cancelled | Cancelled before posting | - |
| VOID | void | Voided after posting | - |

## 3.3 Valid Transitions

### Sales Order Workflow
```
draft ──submit──→ pending ──approve──→ confirmed ──ship──→ shipped ──deliver──→ delivered ──complete──→ completed
   │                │                      │               │
   │                │                      │               └──invoiced──→ invoiced
   │                │                      │
   └──cancel──→ cancelled              └──cancel──→ cancelled
                │
                └──reject──→ rejected
```

### Sales Invoice Workflow
```
draft ──post──→ posted ──pay(partial)──→ partially_paid ──pay(remaining)──→ paid ──complete──→ completed
   │              │
   │              └──void──→ void
   │
   └──cancel──→ cancelled
```

## 3.4 Transition Rules

```typescript
// Transition validation
function isValidTransition(
  fromState: WorkflowState,
  toState: WorkflowState,
  entityType: string
): boolean {
  // 1. Check if transition exists in workflow definition
  // 2. Check if user has permission for this transition
  // 3. Check if business rules allow this transition
  // 4. Check if accounting period is open
  // 5. Return true/false
}

// Get available actions for current state
function getAvailableActions(
  currentState: WorkflowState,
  entityType: string,
  userPermissions: string[]
): WorkflowAction[] {
  // Return list of actions user can perform
}
```

---

# 4. ACCOUNTING AUTOMATION SPECIFICATION

## 4.1 Accounting Automation Rule

```
IF transaction affects money:
  THEN automatically generate Journal Entries
```

## 4.2 Standard Journal Entry Patterns

### Sales Invoice
```
Account             Debit       Credit
─────────────────────────────────────────
Accounts Receivable  1,150.00
  Revenue                         1,000.00
  Sales Tax Payable                 150.00
```

### Sales Invoice (with COGS)
```
Account             Debit       Credit
─────────────────────────────────────────
Accounts Receivable  1,150.00
  Revenue                         1,000.00
  Sales Tax Payable                 150.00

COGS                   600.00
  Inventory                         600.00
```

### Purchase Invoice
```
Account             Debit       Credit
─────────────────────────────────────────
Inventory/Purchase    1,000.00
Input Tax Recoverable   150.00
  Accounts Payable                1,150.00
```

### Payment Received
```
Account             Debit       Credit
─────────────────────────────────────────
Cash/Bank             1,150.00
  Accounts Receivable             1,150.00
```

### Payment Made
```
Account             Debit       Credit
─────────────────────────────────────────
Accounts Payable      1,150.00
  Cash/Bank                       1,150.00
```

## 4.3 Journal Entry Generation Rules

```typescript
interface JournalEntryRule {
  transactionType: string;
  conditions: (payload: any) => boolean;
  entries: {
    account: string;
    debit?: number;
    credit?: number;
    calculation?: (payload: any) => number;
  }[];
}

// Example rule
const salesInvoiceRule: JournalEntryRule = {
  transactionType: "SALES_INVOICE",
  conditions: (payload) => payload.total > 0,
  entries: [
    {
      account: "ACCOUNTS_RECEIVABLE",
      debit: (payload) => payload.total,
    },
    {
      account: "REVENUE",
      credit: (payload) => payload.subtotal,
    },
    {
      account: "SALES_TAX_PAYABLE",
      credit: (payload) => payload.taxAmount,
    },
  ],
};
```

---

# 5. INVENTORY AUTOMATION SPECIFICATION

## 5.1 Inventory Automation Rule

```
IF transaction affects stock:
  THEN automatically update inventory ledger
```

## 5.2 Stock Movement Patterns

### Sales Invoice (Decrease Stock)
```typescript
{
  productId: "PROD-001",
  type: "sale",
  quantity: -10,
  referenceId: "INV-001",
  referenceType: "SalesInvoice",
  unitCost: 60.00,
  totalCost: 600.00,
  warehouseId: "WH-001"
}
```

### Purchase Invoice (Increase Stock)
```typescript
{
  productId: "PROD-001",
  type: "purchase",
  quantity: 50,
  referenceId: "PI-001",
  referenceType: "PurchaseInvoice",
  unitCost: 55.00,
  totalCost: 2750.00,
  warehouseId: "WH-001"
}
```

### Stock Transfer
```typescript
{
  productId: "PROD-001",
  type: "transfer_out",
  quantity: -20,
  referenceId: "ST-001",
  referenceType: "StockTransfer",
  warehouseId: "WH-001"
}
{
  productId: "PROD-001",
  type: "transfer_in",
  quantity: 20,
  referenceId: "ST-001",
  referenceType: "StockTransfer",
  warehouseId: "WH-002"
}
```

## 5.3 Stock Validation Rules

```typescript
// Prevent negative stock
function validateStockAvailability(
  productId: string,
  quantity: number,
  warehouseId: string
): boolean {
  const availableStock = getAvailableStock(productId, warehouseId);
  return availableStock >= quantity;
}

// Atomic stock update
async function updateStock(
  productId: string,
  quantity: number,  // negative for decrease, positive for increase
  context: TransactionContext
): Promise<void> {
  // Use database transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Update product quantity
    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
    
    // Create inventory transaction record
    await tx.inventoryTransaction.create({
      data: {
        productId,
        quantity,
        type: quantity > 0 ? 'in' : 'out',
        ...context,
      },
    });
  });
}
```

---

# 6. EVENT SYSTEM SPECIFICATION

## 6.1 Event Types

### Transaction Events
```typescript
type TransactionEventType =
  | "TRANSACTION_CREATED"
  | "TRANSACTION_UPDATED"
  | "TRANSACTION_APPROVED"
  | "TRANSACTION_REJECTED"
  | "TRANSACTION_POSTED"
  | "TRANSACTION_VOIDED"
  | "TRANSACTION_CANCELLED"
  | "TRANSACTION_COMPLETED";
```

### Business Events
```typescript
type BusinessEventType =
  | "STOCK_UPDATED"
  | "STOCK_LOW_ALERT"
  | "STOCK_EXPIRED"
  | "JOURNAL_CREATED"
  | "JOURNAL_POSTED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_MADE"
  | "INVOICE_OVERDUE"
  | "ORDER_FULFILLED";
```

### System Events
```typescript
type SystemEventType =
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "PERMISSION_DENIED"
  | "SYSTEM_ERROR"
  | "MAINTENANCE_MODE";
```

## 6.2 Event Structure

```typescript
interface ERPSystemEvent {
  id: string;                    // Unique event ID
  type: string;                  // Event type
  timestamp: string;             // ISO 8601 timestamp
  payload: {                     // Event-specific data
    transactionId?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    tenantId?: string;
    changes?: any;
    metadata?: any;
  };
  context: {                     // Execution context
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  };
}
```

## 6.3 Event Bus Implementation

```typescript
class EventBus {
  static async emit(event: ERPSystemEvent): Promise<void> {
    // 1. Log event
    await logger.info({
      message: `Event emitted: ${event.type}`,
      event,
    });
    
    // 2. Store event
    await EventStore.save(event);
    
    // 3. Queue for async processing
    await MessageQueue.publish(event.type, event);
    
    // 4. Notify subscribers
    EventSubscribers.notify(event.type, event);
  }
}
```

---

# 7. AUDIT SYSTEM SPECIFICATION

## 7.1 Audit Rule

```
EVERY ACTION MUST BE LOGGED
```

## 7.2 Audit Log Structure

```typescript
interface AuditLogEntry {
  id: string;                    // Unique audit ID
  timestamp: string;             // Action timestamp
  userId: string;                 // Who performed action
  userName: string;               // User display name
  action: string;                 // Action type
  module: string;                 // Affected module
  entityType: string;             // Entity type
  entityId: string;               // Entity ID
  beforeState?: any;              // State before change
  afterState?: any;               // State after change
  changes: {                       // Detailed changes
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  context: {                      // Execution context
    ipAddress: string;
    userAgent: string;
    sessionId?: string;
  };
  transactionId?: string;       // Related transaction
  status: "success" | "failure";
  errorMessage?: string;
}
```

## 7.3 Audit Service

```typescript
class AuditService {
  static async log(params: {
    tx: ERPTransaction;
    beforeState: any;
    afterState: any;
    journalEntries?: any[];
  }): Promise<void> {
    const auditEntry: AuditLogEntry = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      userId: params.tx.context.userId,
      action: params.tx.type,
      module: getModuleFromType(params.tx.type),
      entityType: params.tx.type,
      entityId: params.afterState?.id,
      beforeState: params.beforeState,
      afterState: params.afterState,
      changes: diffStates(params.beforeState, params.afterState),
      context: {
        ipAddress: params.tx.context.ipAddress || 'unknown',
        userAgent: params.tx.context.userAgent || 'unknown',
      },
      transactionId: params.tx.id,
      status: 'success',
    };
    
    await prisma.auditLog.create({ data: auditEntry });
  }
}
```

---

# 8. SYSTEM VALIDATION SPECIFICATION

## 8.1 System Check Endpoint

### Endpoint
```
GET /api/erp/system-check
```

### Response Format
```typescript
interface SystemCheckResponse {
  status: "OPERATIONAL" | "DEGRADED" | "FAILED";
  timestamp: string;
  version: string;
  checks: SystemCheckItem[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

interface SystemCheckItem {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
  duration: number;  // milliseconds
}
```

## 8.2 Check Categories

### Critical Checks (Must Pass)
1. **Database Connection** - Can connect to PostgreSQL
2. **ERP Execution Engine** - Engine is operational
3. **Transaction Execution** - Can execute test transaction
4. **Persistence Layer** - Data is being saved correctly

### Functional Checks (Must Pass)
5. **Accounting Integration** - Journal entries are created
6. **Inventory Integration** - Stock movements are recorded
7. **Workflow System** - States are tracked correctly

### Observability Checks (Should Pass)
8. **Audit Logging** - Actions are being logged
9. **Event Bus** - Events are being emitted
10. **API Gateway** - Endpoints are accessible

## 8.3 System Health Status

```typescript
function calculateSystemStatus(checks: SystemCheckItem[]): SystemStatus {
  const criticalChecks = checks.slice(0, 4);
  const allCriticalPassed = criticalChecks.every(c => c.passed);
  
  if (!allCriticalPassed) {
    return "FAILED";
  }
  
  const failedChecks = checks.filter(c => !c.passed);
  if (failedChecks.length === 0) {
    return "OPERATIONAL";
  }
  
  if (failedChecks.length <= 2) {
    return "DEGRADED";
  }
  
  return "FAILED";
}
```

---

# 9. FORBIDDEN & REQUIRED PATTERNS

## 9.1 ❌ FORBIDDEN PATTERNS (NEVER DO)

### Direct Database Access from Frontend
```typescript
// ❌ FORBIDDEN - Never do this
// In frontend component:
const data = await fetch('/api/sales-orders', {
  method: 'POST',
  body: JSON.stringify({ ... })
});

// ❌ FORBIDDEN - Never do this
// Direct Prisma access in API route:
const order = await prisma.salesOrder.create({ data: { ... } });
```

### Manual Business Logic
```typescript
// ❌ FORBIDDEN - Never do this
// Manual stock update:
await prisma.product.update({
  where: { id: productId },
  data: { stock: { decrement: quantity } }
});

// ❌ FORBIDDEN - Never do this
// Manual journal entry:
await prisma.journalEntry.create({
  data: { debit: ..., credit: ... }
});
```

### Bypassing Workflow
```typescript
// ❌ FORBIDDEN - Never do this
// Direct status update:
await prisma.salesOrder.update({
  where: { id },
  data: { status: 'posted' }
});
```

## 9.2 ✅ REQUIRED PATTERNS (ALWAYS DO)

### Single Entry Point
```typescript
// ✅ REQUIRED - Always do this
// In frontend:
import { executeTransaction } from '@/lib/erp-frontend-core/engine-integration';

const result = await executeTransaction('SALES_ORDER', {
  customerId: '...',
  items: [...],
  total: 1000
});

// ✅ REQUIRED - Always do this
// In API route:
const result = await ERPExecutionEngine.execute(transaction);
```

### Proper Context Passing
```typescript
// ✅ REQUIRED - Always include context
const transaction = {
  type: 'SALES_INVOICE',
  payload: { ... },
  context: {
    userId: currentUser.id,        // REQUIRED
    tenantId: currentTenant.id,    // REQUIRED
    ipAddress: request.ip,          // Optional but recommended
    userAgent: request.headers['user-agent'],  // Optional
  }
};
```

### Through Workflow
```typescript
// ✅ REQUIRED - Use workflow transitions
await executeTransaction('WORKFLOW_TRANSITION', {
  entityType: 'sales_invoice',
  entityId: invoiceId,
  action: 'post',
  targetStatus: 'posted'
});
```

---

# 10. MULTI-TENANCY SPECIFICATION

## 10.1 Tenant Isolation Rules

```typescript
// Every transaction MUST include tenantId
interface TransactionContext {
  userId: string;
  tenantId: string;  // REQUIRED
}

// All database queries MUST filter by tenantId
async function getEntity(id: string, tenantId: string) {
  return prisma.entity.findFirst({
    where: { 
      id,
      tenantId  // REQUIRED filter
    }
  });
}
```

## 10.2 Data Isolation

```
┌─────────────────────────────────────────┐
│           Tenant A                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │  Data   │ │  Data   │ │  Data   │ │
│  └─────────┘ └─────────┘ └─────────┘ │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│           Tenant B                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │  Data   │ │  Data   │ │  Data   │ │
│  └─────────┘ └─────────┘ └─────────┘ │
└─────────────────────────────────────────┘
│
│  NO CROSS-TENANT ACCESS
```

---

# 11. ERROR HANDLING SPECIFICATION

## 11.1 Error Categories

### Validation Errors (400)
- Invalid transaction type
- Missing required fields
- Invalid workflow transition
- Insufficient permissions

### Business Logic Errors (422)
- Insufficient stock
- Credit limit exceeded
- Closed accounting period
- Duplicate document number

### System Errors (500)
- Database connection failure
- Engine execution failure
- Adapter failure

## 11.2 Error Response Format

```typescript
interface ERPErrorResponse {
  success: false;
  error: string;           // Human-readable message
  errorCode: string;       // Machine-readable code
  details?: any;           // Additional context
  timestamp: string;
  transactionId?: string;
}

// Example
{
  "success": false,
  "error": "Insufficient stock for product PROD-001",
  "errorCode": "INVENTORY_INSUFFICIENT_STOCK",
  "details": {
    "productId": "PROD-001",
    "requestedQuantity": 100,
    "availableQuantity": 50
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

# 12. PERFORMANCE SPECIFICATION

## 12.1 Response Time Targets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Simple Transaction | < 200ms | 500ms |
| Complex Transaction | < 500ms | 1s |
| List Query | < 300ms | 1s |
| Report Generation | < 2s | 5s |
| System Check | < 1s | 2s |

## 12.2 Throughput Targets

- Minimum: 100 transactions/second
- Target: 1000 transactions/second
- Peak: 5000 transactions/second (with caching)

---

# 13. SECURITY SPECIFICATION

## 13.1 Authentication & Authorization

```typescript
// Every request MUST be authenticated
interface AuthenticatedRequest {
  user: {
    id: string;
    roles: string[];
    permissions: string[];
    tenantId: string;
  };
  token: string;
}

// Permission check before execution
function checkPermission(
  user: User,
  action: string,
  entityType: string
): boolean {
  const requiredPermission = `${entityType}.${action}`;
  return user.permissions.includes(requiredPermission);
}
```

## 13.2 Data Protection

- All sensitive data encrypted at rest
- TLS 1.3 for all communications
- Input sanitization on all endpoints
- SQL injection prevention (Prisma ORM)
- XSS protection
- CSRF tokens for state-changing operations

---

# 14. COMPLIANCE SPECIFICATION

## 14.1 Audit Requirements

- All financial transactions logged for 7 years
- All user actions logged for 1 year
- Immutable audit logs
- Tamper-evident logging

## 14.2 Accounting Standards

- GAAP/IFRS compliant
- Double-entry bookkeeping enforced
- Automatic balancing validation
- Period closing support
- Trial balance generation

---

# 15. DEPLOYMENT SPECIFICATION

## 15.1 Environment Requirements

```
Production Environment:
- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (for caching/events)
- Docker containers
- Kubernetes orchestration
- Load balancer
- SSL certificates
- Backup systems
```

## 15.2 Health Checks

```typescript
// Kubernetes liveness probe
GET /api/erp/system-check

// Expected response for healthy system
{
  "status": "OPERATIONAL",
  "checks": [...],
  "summary": { "passed": 8, "failed": 0 }
}
```

---

# APPENDIX A: COMPLETE FILE STRUCTURE

```
app/
├── api/
│   └── erp/
│       ├── execute/
│       │   └── route.ts              # SINGLE ENTRY POINT
│       ├── system-check/
│       │   └── route.ts              # HEALTH CHECK
│       ├── entity/
│       │   └── [type]/
│       │       ├── route.ts          # LIST (read-only)
│       │       └── [id]/
│       │           └── route.ts      # GET (read-only)
│       └── dashboard/
│           ├── kpis/
│           │   └── route.ts
│           ├── alerts/
│           │   └── route.ts
│           └── activity/
│               └── route.ts
├── erp/
│   ├── layout.tsx                    # ERP LAYOUT
│   ├── dashboard/
│   │   └── page.tsx
│   ├── sales/
│   │   ├── quotations/
│   │   │   ├── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   └── invoices/
│   │       ├── page.tsx
│   │       └── create/
│   │           └── page.tsx
│   ├── purchases/
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   └── invoices/
│   │       ├── page.tsx
│   │       └── create/
│   │           └── page.tsx
│   ├── inventory/
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   ├── movements/
│   │   │   └── page.tsx
│   │   ├── adjustments/
│   │   │   ├── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   └── transfers/
│   │       ├── page.tsx
│   │       └── create/
│   │           └── page.tsx
│   └── accounting/
│       ├── journal/
│       │   ├── page.tsx
│       │   └── create/
│       │       └── page.tsx
│       ├── accounts/
│       │   ├── page.tsx
│       │   └── create/
│       │       └── page.tsx
│       └── trial-balance/
│           └── page.tsx

components/
└── erp/
    ├── layout/
    │   ├── ERPHeader.tsx
    │   └── ERPSidebar.tsx
    ├── forms/
    │   ├── EntityForm.tsx              # UNIVERSAL FORM
    │   └── FormField.tsx               # DYNAMIC FIELD
    ├── tables/
    │   └── ERPDataTable.tsx            # ENTERPRISE TABLE
    ├── dashboard/
    │   ├── KPICard.tsx
    │   ├── AlertCard.tsx
    │   ├── ActivityFeed.tsx
    │   └── WorkflowStatusOverview.tsx
    └── workflow/
        ├── WorkflowStatusBadge.tsx
        ├── WorkflowTimeline.tsx
        └── WorkflowActions.tsx

lib/
├── erp-frontend-core/
│   ├── engine-integration-v2.ts        # FRONTEND GATEWAY
│   ├── types.ts
│   ├── module-registry.ts
│   └── workflow-utils.ts
├── erp-execution-engine/
│   ├── erp-execution-engine.ts         # CORE ENGINE
│   ├── types.ts
│   ├── index.ts
│   ├── validators/
│   │   └── transaction-validator.ts
│   ├── routers/
│   │   └── business-router.ts
│   ├── adapters/
│   │   ├── accounting-adapter.ts       # AUTO ACCOUNTING
│   │   └── inventory-adapter.ts        # AUTO INVENTORY
│   ├── workflow/
│   │   └── workflow-engine.ts
│   └── services/
│       ├── state-loader.ts
│       ├── workflow-repository.ts
│       ├── journal-service.ts
│       ├── audit-service.ts            # AUDIT
│       └── event-bus.ts               # EVENTS
├── db.ts                              # PRISMA CLIENT
└── structured-logger.ts                 # LOGGING

prisma/
└── schema.prisma                      # DATABASE SCHEMA
```

---

# APPENDIX B: API ENDPOINTS REFERENCE

## Write Operations (ALL go through execute endpoint)

```
POST /api/erp/execute
  Body: { type, payload, context }
  Response: { success, data, state, journalEntries }
```

## Read Operations (Direct queries allowed)

```
GET /api/erp/entity/:type
  Query: ?page=&perPage=&search=&sort=
  Response: { data, meta: { total, page, perPage } }

GET /api/erp/entity/:type/:id
  Response: { data }
```

## Dashboard Operations

```
GET /api/erp/dashboard/kpis
GET /api/erp/dashboard/alerts
GET /api/erp/dashboard/activity?limit=
```

## System Operations

```
GET /api/erp/system-check
  Response: { status, checks, summary }
```

---

# APPENDIX C: TRANSACTION TYPE REFERENCE

## Sales Module
- `SALES_ORDER` - Create/update sales order
- `SALES_INVOICE` - Create/update sales invoice
- `SALES_RETURN` - Process sales return
- `QUOTATION` - Create/update quotation

## Purchase Module
- `PURCHASE_ORDER` - Create/update purchase order
- `PURCHASE_INVOICE` - Create/update purchase invoice
- `PURCHASE_RETURN` - Process purchase return
- `REQUISITION` - Create purchase requisition

## Inventory Module
- `STOCK_TRANSFER` - Transfer stock between warehouses
- `STOCK_ADJUSTMENT` - Adjust stock quantities
- `PRODUCTION_ORDER` - Create production order
- `BOM` - Bill of materials operations

## Accounting Module
- `JOURNAL_ENTRY` - Create manual journal entry
- `PERIOD_CLOSE` - Close accounting period

## Workflow Module
- `WORKFLOW_TRANSITION` - Change entity workflow state
- `PAYMENT` - Record payment transaction

---

# DOCUMENT CONTROL

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2024-04-21 | ERP Architect | Initial specification |
| 2.0.0 | 2024-04-21 | ERP Architect | Production orchestration layer |

---

**Document Status:** ✅ APPROVED FOR PRODUCTION

**Next Review:** 2024-07-21

**Approval:**
- [x] System Architect
- [x] Backend Lead
- [x] Frontend Lead
- [x] Security Team
- [x] Compliance Officer

---

END OF SPECIFICATION
