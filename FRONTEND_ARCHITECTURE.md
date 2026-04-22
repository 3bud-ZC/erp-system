# ERP Frontend Architecture

**Tech Stack:**
- Next.js 14+ (App Router)
- TypeScript
- TailwindCSS
- React Query (TanStack Query)
- Zustand (global state)
- React Hook Form
- Zod (validation)
- Recharts (charts)

---

## Folder Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── layout.tsx
├── (dashboard)/
│   ├── layout.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── accounting/
│   │   ├── chart-of-accounts/
│   │   │   └── page.tsx
│   │   ├── journal-entries/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── trial-balance/
│   │   │   └── page.tsx
│   │   ├── balance-sheet/
│   │   │   └── page.tsx
│   │   └── profit-loss/
│   │       └── page.tsx
│   ├── inventory/
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── stock-movements/
│   │   │   └── page.tsx
│   │   ├── stock-adjustments/
│   │   │   ├── page.tsx
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   └── low-stock/
│   │       └── page.tsx
│   ├── sales/
│   │   ├── invoices/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   └── payments/
│   │       └── page.tsx
│   ├── purchases/
│   │   ├── invoices/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   └── suppliers/
│   │       ├── page.tsx
│   │       └── [id]/
│   │           └── page.tsx
│   ├── customers/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── reports/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   └── page.tsx (redirect to dashboard)
├── api/
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts
│   └── webhooks/
│       └── events/
│           └── route.ts
├── layout.tsx (root layout)
├── page.tsx (root page)
├── globals.css
└── error.tsx

components/
├── layout/
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── Workspace.tsx
│   ├── MobileNav.tsx
│   └── TenantSwitcher.tsx
├── ui/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Table.tsx
│   ├── Card.tsx
│   ├── Dialog.tsx
│   ├── Form.tsx
│   ├── Badge.tsx
│   ├── Skeleton.tsx
│   ├── Loading.tsx
│   ├── EmptyState.tsx
│   └── ErrorBoundary.tsx
├── accounting/
│   ├── JournalEntryForm.tsx
│   ├── TrialBalanceTable.tsx
│   ├── BalanceSheetView.tsx
│   └── ProfitLossView.tsx
├── inventory/
│   ├── ProductCard.tsx
│   ├── StockMovementTable.tsx
│   ├── StockAdjustmentForm.tsx
│   └── LowStockAlert.tsx
├── sales/
│   ├── InvoiceForm.tsx
│   ├── InvoiceTable.tsx
│   ├── PaymentForm.tsx
│   └── InvoiceDetail.tsx
├── purchases/
│   ├── PurchaseInvoiceForm.tsx
│   ├── SupplierForm.tsx
│   └── PurchaseTable.tsx
├── dashboard/
│   ├── KPICard.tsx
│   ├── RevenueChart.tsx
│   ├── StockChart.tsx
│   └── ActivityFeed.tsx
├── shared/
│   ├── SearchBar.tsx
│   ├── NotificationBell.tsx
│   ├── UserMenu.tsx
│   ├── Breadcrumbs.tsx
│   ├── DateRangePicker.tsx
│   └── ExportButton.tsx
└── charts/
    ├── LineChart.tsx
    ├── BarChart.tsx
    ├── PieChart.tsx
    └── AreaChart.tsx

lib/
├── api/
│   ├── client.ts (fetch wrapper)
│   ├── accounting.ts
│   ├── inventory.ts
│   ├── sales.ts
│   ├── purchases.ts
│   ├── customers.ts
│   ├── suppliers.ts
│   ├── reports.ts
│   └── auth.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useTenant.ts
│   ├── usePermissions.ts
│   ├── useDebounce.ts
│   └── useLocalStorage.ts
├── store/
│   ├── auth.ts
│   ├── tenant.ts
│   ├── ui.ts
│   └── notifications.ts
├── utils/
│   ├── format.ts
│   ├── validation.ts
│   ├── constants.ts
│   └── helpers.ts
├── types/
│   ├── accounting.ts
│   ├── inventory.ts
│   ├── sales.ts
│   ├── purchases.ts
│   └── common.ts
└── config/
    ├── permissions.ts
    └── routes.ts

styles/
└── globals.css

public/
└── icons/

middleware.ts
next.config.js
tailwind.config.ts
tsconfig.json
```

---

## Architecture Principles

1. **Modular Design**: Each ERP module (Accounting, Inventory, Sales, Purchases) is self-contained
2. **Multi-Tenant UI**: Tenant context isolated at layout level
3. **Role-Based Rendering**: Components check permissions before rendering
4. **API Layer**: Centralized API client with error handling and retry logic
5. **State Management**: Zustand for global state, React Query for server state
6. **Type Safety**: Full TypeScript coverage with shared types
7. **Performance**: Lazy loading, code splitting, optimistic updates
