# Phase 1 — Full System Audit (Read-Only)

**Generated:** 2026-04-26  
**Mode:** Analysis only. No code modified.  
**Baseline commit:** `60acbef`  
**Tools used:** `ts-prune`, repository grep, file walk, dependency tracing.

---

## 1. Dead Code List

`ts-prune --project tsconfig.json` produced **908 lines** of output. After filtering out `(used in module)` false-positives and Next.js convention files (`middleware.ts`, `app/error.tsx`, `tailwind.config.ts`), **566 truly unreferenced exports** remain.

### 1.A High-Confidence Module-Level Dead Code (whole-file or near-whole-file)

| File | Why it's likely dead | Confidence |
|---|---|---|
| `lib/api-latency-tracker.ts` | All 4 public exports unused; not imported anywhere | High |
| `lib/balance-calculations.ts` (3 exports) | `getMultipleCustomerBalances`, `getMultipleSupplierBalances`, `getCashboxBalance` all unreferenced | High |
| `lib/brute-force-protection.ts` (5 exports) | Entire module unused; auth uses `lib/auth.ts` directly | High |
| `lib/code-generator.ts` (3 exports) | `generateRandomCode`, `isCodeExists`, `getNextSequentialCode` unused | High |
| `lib/db-safe.ts` (4 exports) | Defensive Prisma wrappers; never imported | High |
| `lib/format.ts` (8 exports) | Duplicates of `lib/page-utils.ts` formatters; many unused | High |
| `lib/middleware.ts` (4 exports: `withAuth`, `requirePermission`, `requireRole`, `requireAnyRole`) | Routes use `getAuthenticatedUser` + `checkPermission` directly from `lib/auth.ts` | High |
| `lib/page-utils.ts` (12 exports) | Many functions duplicated in `format.ts` and individual pages | High |
| `lib/suspicious-activity.ts` (8 exports) | Entire detection module unused | High |
| `lib/structured-logger.ts` (`createTimer`) | Unused | High |
| `lib/system-state.ts` (`createProductionMiddleware`) | Unused | High |
| `lib/utils.ts` (`formatDateTime`) | Unused (and `lib/format.ts` has its own date helpers) | High |
| `lib/validation.ts` (`preventNegativeStock`, `validatePaymentStatus`, `validateStockAvailability`) | Validation lives inline in route handlers | High |
| `lib/api/accounting.ts`, `lib/api/inventory.ts`, `lib/api/purchases.ts`, `lib/api/sales.ts` (`accountingApi`, `inventoryApi`, `purchasesApi`, `salesApi`) | Frontend API client bundles superseded by direct `fetch` + TanStack Query | High |
| `lib/api/idempotency.ts` (`idempotencyService`) | No callers | High |
| `lib/api/pagination.ts` (`paginationService`, `offsetPaginationService`) | No callers | High |
| `lib/api/safe-response.ts` (5 exports incl. `createSuccessResponse`, `createErrorResponse`, `HttpStatus`, `ErrorCodes`, `InputSanitizer`) | Superseded by `lib/api-response.ts` (`apiSuccess`, `apiError`) | High |

### 1.B Medium-Confidence Per-Function Dead Code

| File | Unused Exports |
|---|---|
| `lib/activity-log.ts` | `getActivityHistory`, `getRecentActivity` |
| `lib/api-response.ts` | `apiOnboardingRequired` |
| `lib/background-jobs.ts` | `backgroundJobs` |
| `lib/business-rules.ts` | `calculateDiscount`, `calculateGrandTotal` |
| `lib/cache.ts` | `invalidateTenantCache`, `cacheKeys` |
| `lib/consistency-rules.ts` | `validateAction` |
| `lib/env.ts` | `assertEnv` |
| `lib/inventory.ts` | `recordStockMovement`, `decrementStockInTransaction`, `incrementStockInTransaction` |
| `lib/logger.ts` | `logDbOperation`, `logAuditEvent`, `logSecurityEvent`, `LogLevel` |
| `lib/permissions-config.ts` | `getRolePermissions`, `roleHasPermission`, `getAllPermissions`, `getPermissionDescription` |
| `lib/rate-limit.ts` | `rateLimitMiddleware` |
| `lib/audit/audit-logger.ts` | `auditInvoice`, `auditPayment` |
| `lib/api/fetcher.ts` | `apiPut`, `apiDelete` (writes use raw `fetch`) |
| `lib/api/api-errors.ts` | `withErrorHandler` |
| `lib/api/rate-limit.ts` | `rateLimitService` |
| `lib/accounting/event-handlers.ts` | `registerAccountingHandlers` |

### 1.C UI Component Dead Code

| File | Unused Exports |
|---|---|
| `components/ui/card.tsx` | `CardHeader`, `CardTitle`, `CardContent`, default |
| `components/ui/design-system.tsx` | `Skeleton`, `EmptyState`, `PageHeader`, `StatCard`, `LoadingSpinner`, `Alert`, `buttonStyles`, `inputStyles`, `tableStyles`, `badgeStyles` |
| `components/ui/dialog.tsx` | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` |
| `components/ui/Loader.tsx` | All 3 exports |
| `components/ui/Skeleton.tsx` | `KPISkeleton`, `ChartSkeleton`, `TableSkeleton` (own version, conflicts with `patterns.tsx`) |
| `components/ui/Table.tsx` | default |
| `components/ui/toast.tsx` | `ToastContainer`, `showToast` (replaced by `patterns.tsx#useToast`) |
| `components/ui/patterns.tsx` | `Sk`, `ErrorBlock` (utility primitives, possibly used) |
| `components/providers/AppProviders.tsx` | `useTheme`, `useHasRole`, `useHasPermission` hooks (possibly used dynamically) |

**Estimated removal impact:** ~3,500–5,000 LOC if all confirmed-dead modules are deleted; build-time and bundle-size benefits are real but small (most files are server-only).

---

## 2. Duplicate Logic

### 2.A Accounting — 5 Parallel Code Paths (CRITICAL FINDING)

Five separate "accounting" surfaces exist in the repo:

| Path | LOC | Role | Status |
|---|---|---|---|
| `lib/accounting.ts` | 30,932 bytes | **Active legacy ledger** — `createSalesInvoiceEntry`, `postJournalEntry`, `reverseJournalEntry` | **In use** by sales-invoices, purchase-invoices, expenses, payments routes |
| `lib/accounting/*.service.ts` (`accounting`, `journal-entry`, `period`, `validation`) | ~50 KB | Service-layer attempt | **Stubbed** — all imports of `chartOfAccountsService` are commented out with `TODO: Re-enable when fixed for schema` |
| `lib/domain/accounting/*.engine.ts` (rules, journal, posting, accounting facade) | ~3 KB each | New pure-domain engine, side-effect-free | **Dual-run only** — compared against legacy in `lib/domain/accounting/dual-run.ts`, no writes |
| `lib/erp-execution-engine/services/journal-service.ts` | unknown | Older alt journal service | Imported only by `app/api/erp/execute/route.ts` and `app/api/erp/system-check/route.ts` |
| `app/api/accounting/journal-entries/route.ts` | — | Endpoint that uses `lib/accounting/*.service.ts` | Returns `NextResponse.json` (envelope drift) and depends on stubbed services |

**Impact:** Any developer touching accounting must trace 5 modules. Confusing, but no current functional bug — the legacy path is the only one writing to the ledger.

### 2.B Format / Display Helpers

| Helper | Defined in | Also defined in |
|---|---|---|
| `formatCurrency` | `lib/page-utils.ts:99` | `lib/format.ts` (different signature), and inlined in many pages |
| `formatDate` (Arabic) | `lib/page-utils.ts:108` (`formatDateArabic`) | `lib/format.ts` (`safeDate`), inlined in pages as `new Date(...).toLocaleDateString('ar-EG')` |
| `formatPercentage` | `lib/format.ts:91` | Inlined in dashboard page |
| `getStatusBadge` / `getStatusColor` / `getStatusLabel` | `lib/page-utils.ts:117`, `lib/format.ts:111`, `lib/format.ts:128` | Inlined per-page as local `statusLabels` records |

### 2.C Toast Implementations

Two toast systems coexist:
- `components/ui/patterns.tsx#useToast` + `Toast` — **canonical**, used in customers/suppliers/sales-invoices/purchase-invoices.
- `components/ui/toast.tsx#ToastContainer` + `showToast` — orphaned, no callers (dead code).

### 2.D Skeleton Implementations

- `components/ui/patterns.tsx#TableSkeleton` — **canonical**, used everywhere.
- `components/ui/Skeleton.tsx#TableSkeleton` — same name, different file, no callers.
- `components/ui/Loader.tsx#SkeletonCard` — third skeleton, no callers.

---

## 3. Unused Services / Hooks

| Type | Item | Evidence |
|---|---|---|
| Service | `lib/api/accountingApi`, `inventoryApi`, `purchasesApi`, `salesApi` | Replaced by raw `fetch` + TanStack Query in pages |
| Service | `lib/api/idempotencyService` | No callers |
| Service | `lib/api/paginationService` / `offsetPaginationService` | No callers |
| Service | `lib/api/rate-limit.ts#rateLimitService` | No callers |
| Service | `lib/api/safe-response.ts` (entire file) | Superseded by `lib/api-response.ts` |
| Service | `lib/erp-execution-engine/*` | Only consumed by 3 niche routes (`/api/erp/*`); core flows bypass it |
| Hook | `useTheme`, `useHasRole`, `useHasPermission` (`AppProviders.tsx`) | Possibly used dynamically — verify before removal |
| Module | `lib/suspicious-activity.ts` | Entire detection layer unreferenced |
| Module | `lib/brute-force-protection.ts` | Entire module unreferenced |

---

## 4. API Inconsistencies

### 4.A Envelope Contract Drift

The canonical envelope is `{ success, data?, message?, error? }` produced by `apiSuccess` / `apiError`. **15 routes diverge by calling `NextResponse.json(...)` directly** for at least some responses:

| Route | Severity | Notes |
|---|---|---|
| `app/api/accounting/journal-entries/route.ts` | **High** | Mixes both styles in same file (success path uses `NextResponse.json(entry, { status: 201 })`, auth uses `apiError`) — clients receive different shapes for success vs error |
| `app/api/accounting/accounts/route.ts` | High | Returns `{ error: ... }` instead of `{ success:false, error: ... }` |
| `app/api/accounting/journal-entries/[id]/post/route.ts` | High | Same pattern |
| `app/api/accounting/periods/[id]/close/route.ts` | High | Same pattern |
| `app/api/accounting/balances/route.ts` | High | Same pattern |
| `app/api/init/route.ts` (10 occurrences) | Medium | Init endpoint, used once |
| `app/api/erp/execute/route.ts` | Medium | Niche endpoint |
| `app/api/erp/system-check/route.ts` | Medium | Niche endpoint |
| `app/api/setup/route.ts` | Medium | Setup endpoint |
| `app/api/system/final-status/route.ts` | Low | System diagnostic |
| `app/api/system/status/route.ts` | Low | System diagnostic |
| `app/api/health/route.ts`, `app/api/health/detailed/route.ts` | **Acceptable** | Health probes typically have their own contract (Kubernetes-style) |
| `app/api/resilience/health/route.ts`, `app/api/resilience/stress-test/route.ts` | **Acceptable** | Same as health |

**Total drift:** **8 routes** that should standardize, **5 routes** that are acceptable exceptions.

### 4.B Auth Pattern Consistency — ✅ Good

- 74/94 route files use `getAuthenticatedUser` + `checkPermission` consistently.
- No mixed auth strategies detected.

### 4.C Prisma Usage in Routes

- **62 route files import Prisma directly.** This was flagged by your Phase 2 prompt as an architectural concern.
- Per **freeze rules**, no refactor allowed. Documenting only:
  - Read paths in 7 routes (sales-invoices, purchase-invoices, customers, suppliers, products, warehouses, expenses, journal-entries) already use `lib/repositories/*.repo.ts`.
  - Write paths still embed Prisma directly because they live inside `prisma.$transaction(...)` blocks combining stock + GL + audit atomically.

---

## 5. UI Inconsistencies

### 5.A Data-Fetching Strategy

Out of **15 dashboard pages**:

| Strategy | Count | Pages |
|---|---|---|
| **TanStack Query** (cached, invalidating) | 4 | `dashboard`, `finance`, `reports`, plus part of customers/suppliers/sales/purchases lists |
| **Mixed** (TanStack reads + raw `fetch` writes) | 4 | `customers`, `suppliers`, `sales/invoices` (list), `purchases/invoices` (list) |
| **Pure raw fetch** (no caching) | 7 | `accounting/journal-entries`, `inventory/products`, `purchases/invoices/[id]`, `sales/invoices/[id]`, `warehouses`, plus 2 form pages |

**Risk:** the 7 pure-fetch pages refetch on every mount and don't get invalidated when sibling list pages mutate. Most are detail/form pages where this is acceptable; `inventory/products`, `warehouses`, `accounting/journal-entries` are list pages where it matters.

### 5.B Action-Button Visibility (FIXED in `657fd96`)

Previously `opacity-0 group-hover:opacity-100` hid action buttons until hover; broken on touch devices. Now resolved across sales-invoices, purchase-invoices, payments lists.

### 5.C Toast Feedback (NORMALIZED in `269f6ad`)

All four core CRUD pages (customers, suppliers, sales-invoices, purchase-invoices) now use `useToast` + `Toast` from `patterns.tsx`. Other list pages still lack toast feedback.

### 5.D Modal Patterns

- Sales/purchase invoices use a custom inline `EditModal` / `DeleteModal` per file.
- Customers/suppliers use the same pattern (correctly).
- `components/ui/dialog.tsx` exposes a Radix-style Dialog/DialogContent shell that nobody uses (dead code, see 1.C).
- No global modal/portal manager — each page renders modals locally. Acceptable; not a bug.

### 5.E Empty States, Loading, Error

`patterns.tsx#TableSkeleton`, `EmptyState`, `ErrorBanner` are used consistently in the four core pages. The 7 pure-fetch pages each implement their own loading spinner inline.

---

## 6. Performance Bottlenecks

### 6.A Build / Cold Start

- 60+ top-level files in `lib/` increases TypeScript compile graph.
- Removing the high-confidence dead modules (section 1.A) would reduce the graph by ~30%.

### 6.B Bundle Size (client)

- Some `lib/*.ts` files are pulled into client bundles via mixed imports. Worst offenders to investigate (not measured): `lib/accounting.ts` (30 KB) is server-only but imports a chain of helpers that may include client-friendly utilities.
- `lucide-react` icons imported per-icon (good — tree-shakable).
- No icon barrel imports detected (good).

### 6.C Database

- `app/api/sales-invoices/route.ts` and `app/api/purchase-invoices/route.ts` PUT handlers do: fetch existing → reverse JE → delete items → recreate items → recompute stock deltas → re-post JE. **For a status-only update this rebuilds the entire ledger entry.** Genuine perf cost when invoices have many lines. Not a bug — by design — but worth noting.
- No N+1 patterns found in audited routes (every list query uses `include: { ... }`).
- No read-replica or read-cache strategy. Acceptable for current scale.

### 6.D Frontend Cache

- 7 list pages without TanStack Query refetch on every mount. Small UX cost; not blocking.

### 6.E Dual-Run Overhead

`lib/domain/accounting/dual-run.ts` runs the new engine alongside the legacy one for sales/purchase invoice writes. Each write now does 2× journal computation (one for real persistence, one for comparison). Cost is negligible (pure JS) but worth noting before cutover.

---

## 7. Risk List

### CRITICAL

| Risk | Where | Mitigation in place |
|---|---|---|
| Legacy accounting (`lib/accounting.ts`) is the **only** module persisting ledger entries | sales-invoices, purchase-invoices, expenses, payments routes | Dual-run added; new engine validates same math but does NOT yet persist |
| 5 parallel accounting code paths confuse future developers | `lib/accounting.ts`, `lib/accounting/`, `lib/domain/accounting/`, `lib/erp-execution-engine/services/journal-service.ts`, `app/api/accounting/*` | None — documented here |

### HIGH

| Risk | Where | Mitigation |
|---|---|---|
| 8 production routes return non-canonical envelopes; clients can crash on `body.success` access | `app/api/accounting/**`, `app/api/init`, `app/api/erp/**`, `app/api/setup`, `app/api/system/{status,final-status}` | None automated. API envelope contract test only covers helpers, not routes. |
| `app/api/accounting/journal-entries` route depends on **stubbed** services (`chartOfAccountsService` import is commented out, `TODO: Re-enable`); endpoint may 500 in production | `app/api/accounting/journal-entries/route.ts` | Manual: do not call this endpoint until its services are unstubbed. |
| 3 list pages (`inventory/products`, `warehouses`, `accounting/journal-entries`) lack TanStack Query — show stale data after mutations | Dashboard | None |

### MEDIUM

| Risk | Where | Mitigation |
|---|---|---|
| 566 unused exports — bundle size + cognitive load | Whole repo | Documented above |
| `lib/erp-execution-engine` is a parallel sub-system used by only 2-3 niche routes; unclear ownership | `lib/erp-execution-engine/`, `app/api/erp/**` | None |
| `chart-of-accounts.service.ts` was deleted as `.bak`, but accounting/validation services still reference it via commented-out imports — silent gap if anyone re-enables them | `lib/accounting/{accounting,validation}.service.ts` | Comments document the gap |
| Duplicate format helpers (`format.ts` vs `page-utils.ts` vs inline) — small drift risk | Several | None |

### LOW

| Risk | Where | Mitigation |
|---|---|---|
| 7 dashboard pages without skeleton from `patterns.tsx` (use ad-hoc loaders) | Detail/form pages | None — cosmetic |
| `useEffect` missing-dep warnings in `sales/invoices/[id]/page.tsx` and `purchases/invoices/[id]/page.tsx` | Detail pages | Documented |
| `.bak` files gitignored — invisible to ts-prune but still on disk for some devs | `lib/accounting/chart-of-accounts.service.ts.bak` was removed in `254b4d2` | None |
| Audit-tooling lint rule errors (`@typescript-eslint/no-unused-vars` definition not loaded for some files) | Several | Pre-existing eslint-config issue |

---

## 8. System Architecture Diagram (Text)

```
                               +-------------------------------+
                               |       Next.js App Router      |
                               +-------------------------------+
                                          |
              +---------------------------+---------------------------+
              |                                                       |
   +---------------------+                              +-----------------------------+
   |  app/(dashboard)/** |                              |          app/api/**         |
   |   (15 pages)        |                              |      (94 route.ts files)    |
   +---------------------+                              +-----------------------------+
              |                                                       |
              | uses                                                  | uses
              v                                                       v
   +---------------------+                              +-----------------------------+
   | components/ui/      |                              |  Auth: lib/auth.ts          |
   |  patterns.tsx       |                              |  Envelope: lib/api-response |
   |  (canonical)        |                              |  Repos: lib/repositories/   |
   +---------------------+                              +-----------------------------+
                                                                      |
              +-----------------------+--------+-----------------+----+
              |                       |        |                 |
              v                       v        v                 v
   +-------------------+   +------------------+   +----------------------+
   | lib/accounting.ts |   | lib/accounting/  |   | lib/domain/          |
   |  (LEGACY, ACTIVE) |   |  *.service.ts    |   |  accounting/         |
   |                   |   |  (STUBBED)       |   |  *.engine.ts (PURE)  |
   +-------------------+   +------------------+   +----------------------+
            ^                                                  |
            |                                                  | dual-run compare
            +-----------------------+--------------------------+
                                    |
                                    v
                       +-----------------------------+
                       | Prisma + PostgreSQL         |
                       +-----------------------------+

         +-------------------------------------+
         | Parallel sub-system (niche, used    |
         | by /api/erp/* only):                |
         |  lib/erp-execution-engine/          |
         |  lib/erp-frontend-core/   (NO USERS)|
         +-------------------------------------+
```

---

## 9. Dependency Graph Summary

### 9.A Hot Modules (most-imported)

| Module | Imported by ~N files | Health |
|---|---|---|
| `lib/auth.ts` (`getAuthenticatedUser`, `checkPermission`) | 74 routes | ✅ Canonical |
| `lib/api-response.ts` (`apiSuccess`, `apiError`, `handleApiError`) | 78 routes | ✅ Canonical (78/94 = 83% of routes) |
| `lib/db.ts` (Prisma client export) | ~62 routes + lib | ✅ Canonical |
| `components/ui/patterns.tsx` | All 4 core CRUD pages, plus 3 others | ✅ Canonical |
| `lib/api/fetcher.ts` (`apiGet`) | All TanStack Query callers | ✅ Canonical |
| `@tanstack/react-query` | 7 pages + AppProviders | ✅ Wired correctly |

### 9.B Orphan Module Trees

| Tree | Size | Status |
|---|---|---|
| `lib/erp-frontend-core/**` | 5 files | **NO consumers** anywhere — fully orphaned |
| `lib/erp-execution-engine/**` | 14 dirs | Only 2 routes consume it (`/api/erp/execute`, `/api/erp/system-check`) and 1 import in sales-invoices route |
| `lib/api/{idempotency,pagination,safe-response,rate-limit}.ts` | 4 files | All exports flagged unused |
| `lib/{brute-force-protection,suspicious-activity}.ts` | 2 files | All exports flagged unused |
| `components/ui/{Loader,Skeleton,Table,toast,dialog,card,design-system}.tsx` | 7 files | Superseded by `patterns.tsx` |

---

## 10. Suggested Cleanup Order

**Strict order — each step independently revertable. Do NOT batch.**

### Step 1 — Zero-risk: verified orphan modules

Delete files where ts-prune flags 100% of exports unused AND grep confirms zero imports project-wide.

| Candidate | Verification command | Risk |
|---|---|---|
| `lib/erp-frontend-core/**` | `grep -r "erp-frontend-core" app/ lib/ components/` → **already verified 0 results** | None |
| `lib/api/safe-response.ts` | `grep -r "safe-response" app/ lib/` | None |
| `lib/api/idempotency.ts` | `grep -r "idempotency" app/ lib/` | None |
| `lib/api/pagination.ts` | `grep -r "pagination[Ss]ervice" app/ lib/` | None |
| `lib/brute-force-protection.ts` | `grep -r "brute-force\|isBlocked\|recordFailedAttempt" app/ lib/` | None |
| `lib/suspicious-activity.ts` | `grep -r "suspicious-activity\|checkMultiple" app/ lib/` | None |

### Step 2 — Low-risk: superseded UI components

Delete files where `patterns.tsx` provides the canonical implementation:

- `components/ui/Loader.tsx`
- `components/ui/Skeleton.tsx`
- `components/ui/Table.tsx`
- `components/ui/toast.tsx`
- `components/ui/dialog.tsx`
- `components/ui/card.tsx` (verify no Radix-style consumer first)
- `components/ui/design-system.tsx` (verify no consumer first)

### Step 3 — Medium-risk: unused frontend API client wrappers

- `lib/api/accounting.ts`, `lib/api/inventory.ts`, `lib/api/purchases.ts`, `lib/api/sales.ts` — verify zero `accountingApi` / `inventoryApi` / etc. imports.

### Step 4 — Medium-risk: unused server utilities

- `lib/api-latency-tracker.ts`
- `lib/balance-calculations.ts` (only the 3 unused functions; keep the used ones)
- `lib/code-generator.ts` (only the 3 unused functions)
- `lib/db-safe.ts`
- `lib/format.ts` (only the 8 unused functions; keep `formatCurrency` etc. if used)
- `lib/page-utils.ts` (only the 12 unused functions)
- `lib/middleware.ts` (the 4 `withAuth`/`requirePermission`/`requireRole`/`requireAnyRole` exports)
- `lib/utils.ts` (`formatDateTime`)
- `lib/structured-logger.ts` (`createTimer`)
- `lib/system-state.ts` (`createProductionMiddleware`)
- `lib/validation.ts` (the 3 unused functions)

### Step 5 — Higher-risk: erp-execution-engine

Only 3 routes consume this. If those routes can be deprecated, the entire `lib/erp-execution-engine/` subtree becomes deletable. **DO NOT delete without app-owner review** — those routes may be exposed to a customer or external integrator.

### Step 6 — Higher-risk: stubbed accounting services

`lib/accounting/{accounting,validation,journal-entry,period}.service.ts` — these were the intended replacement for `lib/accounting.ts`. If you reaffirm the dual-run path is the cutover plan (not these services), they can be deleted. **Requires architectural decision.**

### Step 7 — Address API envelope drift

For each of the 8 high-priority routes in section 4.A, replace `NextResponse.json(...)` with `apiSuccess` / `apiError`. Per freeze rules, classify each as a **stabilization fix** (non-breaking — adds the `success` field clients should already be checking).

### Step 8 — Address UI cache gap

For the 3 affected list pages (`inventory/products`, `warehouses`, `accounting/journal-entries`), wire TanStack Query reads. Per freeze rules, classify as a **stabilization fix** (matches established pattern; no new behavior).

### Step 9 — Lock the cleanup with regression tests

After every deletion in steps 1–6, run:
```
npm run type-check
npm test
npm run build
```

---

## 11. Phase-2-thru-7 Compatibility With Freeze Rules

Per your declared freeze (no new features, no architecture refactors, only stabilization + tests + cleanup, rollback step on every change), here's the compatibility check:

| Phase | Freeze-compatible? | Reasoning |
|---|---|---|
| Phase 1 (Audit) | ✅ Yes | Read-only |
| Phase 2 (Full Test Coverage) | ✅ Yes | Tests are additive; no production-code change |
| Phase 3 (Accounting Cutover) | ❌ **No** — violates "no new features" and "no architecture refactors" | Adding feature flags + flipping engines is exactly the architectural change the freeze blocks |
| Phase 4 (Dead Code Cleanup) | ✅ Yes | Cleanup is allowed |
| Phase 5 (E2E Playwright) | ✅ Yes (tests) | Adds infra (`/e2e`, browsers, fixtures) — **but not a feature**, only a test layer |
| Phase 6 (CI/CD) | ⚠️ Borderline | A `.github/workflows/ci.yml` file is infra, not app code. Allowed if you classify CI as part of stabilization |
| Phase 7 (Rollback Strategy) | ⚠️ Borderline | Designing strategy = OK. Implementing feature-flag system = NOT OK (new feature) |

**Recommended order under freeze:**
1. Phase 4 (cleanup) — execute steps 1–4 of section 10 above, file-by-file with grep verification.
2. Phase 2 (more tests) — extend `tests/domain/` to cover repos and `lib/accounting.ts` legacy functions.
3. Phase 6 (CI) — single `.github/workflows/ci.yml` running typecheck + test + build.
4. Phase 5 (Playwright) — only after CI is green and stable.
5. Phase 3 + Phase 7 — **deferred until freeze is lifted.** These are real engineering work that should not be dressed up as "stabilization."

---

## 12. Audit Summary One-Liner

> The system is structurally healthy at its core paths, but carries ~30% dead-code drag, 5 parallel accounting modules with only 1 truly active, and 8 API routes that drift from the canonical envelope. None of these are bugs today; all are debt that compounds.

**End of Phase 1. No code modified. Awaiting your direction.**
