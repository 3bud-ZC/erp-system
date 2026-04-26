<div align="center">

# 🏢 ERP System

**A production-ready, multi-tenant Enterprise Resource Planning platform**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)
[![Tests](https://img.shields.io/badge/Tests-135%20passing-success?style=flat-square)]()
[![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square)]()

[Features](#-features) · [Quick Start](#-quick-start) · [API](#-api-reference) · [Deploy](#-deployment) · [Demo](#-live-demo)

</div>

---

## 🎯 Overview

A fully integrated ERP system covering inventory, sales, purchasing, manufacturing,
and double-entry accounting — built with modern web technologies and production-grade
safety guards. Bilingual UI (Arabic RTL + English).

### Highlights

- 🧾 **Real double-entry accounting** with trial balance, income statement, balance sheet, and journal entry posting
- 📊 **Live KPI dashboard** with 6-month trend charts and recent activity tables
- 🖥️ **Client demo page** (`/demo`) — view-only board safe to present to stakeholders
- 🛡️ **Production-safe by default** — 5 layered guards prevent any test/seed/reset script from touching the live DB
- 🏢 **Multi-tenant** with strict row-level isolation
- ✅ **135 unit tests + Playwright E2E + GitHub Actions CI**

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18.0
- PostgreSQL ≥ 13 (local or hosted: Railway / Neon / Supabase / RDS)

### Local setup (5 minutes)

```bash
# 1. Clone & install
git clone https://github.com/3bud-ZC/erp-system.git
cd erp-system
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, NEXTAUTH_SECRET (each 32+ chars)

# 3. Initialize the database (your local DB only — never run this against prod)
npx prisma generate
npx prisma migrate deploy

# 4. (Optional) Bootstrap the default admin user
ALLOW_SEED=true npx tsx prisma/seed-auth.ts

# 5. Start dev server
npm run dev
```

Open **<http://localhost:3000>** and sign in with `admin@erp.com` / `admin`.

> ⚠️ **Rotate the default credentials before deploying anywhere public.**

---

## ✨ Features

### 💰 Accounting

- Double-entry journal entries with automatic GL posting
- 18-account default chart of accounts (multi-tenant)
- Real-time trial balance, income statement, balance sheet
- Period locking + accounting period management
- Validated entries (account existence, balance check, period lock)

### 📦 Inventory

- Multi-warehouse stock tracking with audit trail
- Negative-stock prevention at DB level
- Inventory valuation (FIFO + average cost)
- Stock transfers, adjustments, stocktakes

### 🛒 Sales & Purchasing

- Quotations → sales orders → invoices → returns
- Purchase requisitions → orders → goods receipts → invoices
- Three-way matching (PO + GRN + invoice)
- Customer / supplier ledgers + aging reports

### 🏭 Manufacturing

- Bill of Materials (BOM) with raw-material explosion
- Production orders with WIP cost tracking
- Multi-line production with capacity planning

### 📊 Dashboard & Reports

- Real-time KPIs: revenue, expenses, net profit, profit margin
- 6-month sales/purchases trend chart
- Inventory composition pie chart
- Profit & loss, balance sheet, cash flow, aging reports

---

## 🖥️ Live Demo

Authenticated `/demo` route — a clean, **view-only** display board for client
presentations. No edit / create / delete actions are exposed.

```
┌──────────────────────────────────────────────────┐
│  ERP System — Client Demo Dashboard              │
│  View-only financial and operational overview    │
├──────────────────────────────────────────────────┤
│  [Revenue]  [Expenses]  [Net Profit]  [Stock]    │
│  ────  6-mo trend (line chart)  ────  Pie chart  │
│  Latest activities  │  Latest journal entries    │
└──────────────────────────────────────────────────┘
```

Visit `/demo` after signing in.

---

## 📡 API Reference

All endpoints return a standardized envelope:

```jsonc
{ "success": true, "data": <payload>, "message": "..." }     // 2xx
{ "success": false, "code": 400, "message": "..." }          // errors
```

### Authentication

| Method | Endpoint                | Description                      |
|--------|-------------------------|----------------------------------|
| POST   | `/api/auth/login`       | Email/password login → JWT cookie |
| POST   | `/api/auth/logout`      | Invalidate session               |
| POST   | `/api/onboarding/init`  | Create tenant + bootstrap demo data |

### Accounting

| Method | Endpoint                                       | Description                              |
|--------|------------------------------------------------|------------------------------------------|
| GET    | `/api/accounting/trial-balance`                | Aggregated debit/credit per account      |
| GET    | `/api/accounting/income-statement`             | Revenue, expenses, net profit            |
| GET    | `/api/accounting/balance-sheet`                | Assets, liabilities, equity (with NI)    |
| GET    | `/api/accounting/journal-entries`              | List journal entries                     |
| POST   | `/api/accounting/journal-entries`              | Create draft entry (validated)           |
| POST   | `/api/accounting/journal-entries/:id/post`     | Post a draft entry                       |
| GET    | `/api/accounting/balances`                     | Account balances                         |
| GET    | `/api/accounting/cash-flow`                    | Cash flow statement                      |
| GET    | `/api/accounting/aging-report`                 | A/R + A/P aging                          |
| CRUD   | `/api/accounting/periods`                      | Manage accounting periods                |

### Sales · Purchases · Inventory

| Method | Endpoint                       | Description                        |
|--------|--------------------------------|------------------------------------|
| CRUD   | `/api/sales-invoices`          | Sales invoices (auto GL posting)   |
| CRUD   | `/api/purchase-invoices`       | Purchase invoices (auto GL posting)|
| CRUD   | `/api/customers`               | Customers                          |
| CRUD   | `/api/suppliers`               | Suppliers                          |
| CRUD   | `/api/products`                | Products                           |
| CRUD   | `/api/warehouses`              | Warehouses                         |
| GET    | `/api/inventory/...`           | Stock movements / valuation        |

### Reports & Health

| Method | Endpoint                              | Description           |
|--------|---------------------------------------|-----------------------|
| GET    | `/api/dashboard`                      | KPIs + recent activity|
| GET    | `/api/reports/profit-loss`            | P&L report            |
| GET    | `/api/reports/balance-sheet`          | Balance sheet         |
| GET    | `/api/reports/aging`                  | Aging report          |
| GET    | `/api/health`                         | Liveness probe        |
| GET    | `/api/health/detailed`                | Full readiness        |

#### Example — Trial Balance

```bash
curl -b cookie.txt "http://localhost:3000/api/accounting/trial-balance?asOfDate=2026-04-30"
```

```jsonc
{
  "success": true,
  "data": [
    { "account": "Cash", "accountCode": "1100", "debit": 8050, "credit": 0 },
    { "account": "Sales Revenue", "accountCode": "4100", "debit": 0, "credit": 22652 }
  ],
  "message": "Trial balance fetched (3 accounts, balanced=true)"
}
```

---

## 🚀 Deployment

The repository is **safe to deploy directly from GitHub** to Vercel, Railway,
Render, or Netlify. Build commands never mutate the database.

### Vercel + Railway (recommended)

1. Provision PostgreSQL on [Railway](https://railway.app) → copy the connection string.
2. From your local machine, apply the schema once:
   ```bash
   DATABASE_URL=<railway-url> npx prisma migrate deploy
   ```
3. Push the repo to GitHub and import it in [Vercel](https://vercel.com).
4. Set the following environment variables in the Vercel dashboard:

   | Variable                  | Value                                       |
   |---------------------------|---------------------------------------------|
   | `DATABASE_URL`            | Railway connection string                   |
   | `JWT_SECRET`              | 32+ char random string                      |
   | `NEXTAUTH_SECRET`         | 32+ char random string                      |
   | `NEXTAUTH_URL`            | `https://<your-app>.vercel.app`             |
   | `NODE_ENV`                | `production`                                |
   | `ALLOW_SEED`              | `false`                                     |
   | `E2E_BYPASS_RATE_LIMIT`   | `0`                                         |
   | `E2E_ALLOW_AUTH_RESET`    | `0`                                         |
   | `E2E_ALLOW_PRODUCTION_DB` | `0`                                         |

> Generate strong secrets:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

### Other targets

| Target  | Manifest         | Notes                                            |
|---------|------------------|--------------------------------------------------|
| Render  | `render.yaml`    | Secrets are `sync: false` — fill in dashboard    |
| Railway | `railway.json` + `nixpacks.toml` | Same env vars as Vercel                  |
| Netlify | `netlify.toml`   | Build is non-destructive                         |
| Docker  | `Dockerfile.prod`| Standalone Next.js output                        |

### First-time deploy checklist

The build pipeline does **not** run migrations or seeds. Run these once
manually after the first successful deploy:

```bash
DATABASE_URL=<prod-url> npx prisma migrate deploy
```

| Operation                 | Steady-state?                          |
|---------------------------|----------------------------------------|
| `npm ci` + `prisma generate` + `next build` | ✅ Every deploy        |
| `prisma migrate deploy`   | 🛠️ Operator-managed (one-off)         |
| `npm run seed`            | 🛡️ Blocked unless `ALLOW_SEED=true`   |
| `npm run db:reset`        | 🛡️ Blocked unless `ALLOW_SEED=true`   |
| Demo user injection       | 🛡️ Blocked unless `RAILWAY_RUN_INIT=true` |

---

## 🛡️ Production Safety

The repository enforces strict environment isolation through five independent
guards. **No test, seed, or reset script can touch the live database without
explicit, loud opt-in.**

| Guard | File | Default | Override |
|-------|------|---------|----------|
| Destructive seed | `prisma/seed.ts` | ❌ blocked | `NODE_ENV=development` or `ALLOW_SEED=true` |
| Database wipe | `prisma/seed-clean.ts` | ❌ blocked | same |
| DB reset | `scripts/reset-database.ts` | ❌ blocked | same |
| Admin auth-reset | `e2e/scripts/reset-admin-password.ts` | ❌ blocked | `E2E_ALLOW_AUTH_RESET=1` |
| E2E DB host check | `e2e/scripts/assert-isolated-db.ts` | refuses non-local hosts | `E2E_ALLOW_PRODUCTION_DB=1` |

Every guard throws **before** opening any database connection, and refuses by
default. Production environments must keep all override flags off.

### Environment separation

| Environment | Database                              | What runs here                                    |
|-------------|---------------------------------------|---------------------------------------------------|
| Production  | Hosted PostgreSQL                     | Next.js application only                          |
| CI          | Ephemeral PostgreSQL service container | type-check · unit tests · build · Playwright    |
| Local E2E   | Operator-provided isolated PostgreSQL | Playwright against `npm run dev`                  |

---

## 🏗️ Architecture

### Tech stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Frontend       | Next.js 14 (App Router) · React 18 · TypeScript |
| Styling        | Tailwind CSS · Lucide icons · Recharts      |
| Backend        | Next.js API routes                          |
| Database       | PostgreSQL · Prisma ORM 5                   |
| Auth           | JWT (HS256) · bcrypt                        |
| Testing        | Vitest (unit) · Playwright (E2E)            |
| CI             | GitHub Actions                              |

### Project layout

```
erp-system/
├── app/
│   ├── (dashboard)/         # Protected routes (sidebar + topbar)
│   │   ├── dashboard/       # Main KPI dashboard
│   │   ├── accounting/      # Journal entries
│   │   ├── sales/           # Sales invoices
│   │   ├── purchases/       # Purchase invoices
│   │   ├── inventory/       # Products & stock
│   │   ├── customers/       # Customer management
│   │   ├── suppliers/       # Supplier management
│   │   ├── warehouses/      # Warehouse management
│   │   └── reports/         # Financial reports
│   ├── api/                 # 95+ API routes
│   ├── demo/                # View-only client demo board
│   ├── login/               # Authentication
│   ├── onboarding/          # Tenant setup
│   └── setup/               # System initialization
│
├── components/              # Reusable UI components
│   ├── layout/              # Sidebar / Topbar / Workspace
│   ├── ui/                  # Buttons, dialogs, tables, cards
│   └── providers/           # React Query / auth providers
│
├── lib/                     # Business logic & utilities
│   ├── accounting/          # Journal, periods, validation
│   ├── domain/              # Pure domain models (rules engine)
│   ├── reporting/           # Trial balance / P&L / BS
│   ├── inventory/           # Stock movements
│   └── auth.ts              # Authentication & RBAC
│
├── prisma/
│   ├── schema.prisma        # 50+ models, multi-tenant
│   ├── seed-auth.ts         # Upsert-only admin bootstrap (safe)
│   └── seed.ts              # Demo seed (guarded)
│
├── e2e/                     # Playwright tests
│   ├── auth/                # Login spec
│   ├── customers/           # Customer CRUD
│   ├── inventory/           # Product CRUD
│   ├── sales/               # Invoice creation
│   ├── accounting/          # Journal entries
│   └── scripts/             # Setup helpers (with guards)
│
├── tests/                   # Vitest unit & contract tests
│   └── domain/              # 135 tests covering accounting,
│                            # rules engine, API contracts
│
└── scripts/                 # Operator tools (all guarded)
```

---

## 🧪 Development

### Available scripts

| Command                   | Purpose                                       |
|---------------------------|-----------------------------------------------|
| `npm run dev`             | Start the dev server                          |
| `npm run build`           | Production build                              |
| `npm start`               | Run the production build                      |
| `npm run lint`            | ESLint                                        |
| `npm run type-check`      | TypeScript validation (`tsc --noEmit`)        |
| `npm test`                | Vitest unit tests                             |
| `npm run e2e`             | Playwright end-to-end tests (isolated DB)     |
| `npm run db:studio`       | Open Prisma Studio                            |

### CI pipeline (`.github/workflows/ci.yml`)

Runs on every push & PR to `master`/`main`:

```
checkout → setup-node → npm ci → prisma generate → migrate (CI DB only) →
seed-auth (upsert) → type-check → test → build → playwright
```

The CI job uses an ephemeral PostgreSQL service container — it can never reach
the production database.

---

## 🔐 Authentication & RBAC

- JWT auth (HS256) with httpOnly cookies
- Role-based permissions (admin / manager / accountant / inventory_manager / sales_rep / purchase_officer)
- Per-permission gating on every API route via `checkPermission(user, code)`
- Multi-tenant isolation enforced at the data layer (`tenantId` scoping)

Default seeded credentials (rotate before deployment!):

| Role  | Email             | Password |
|-------|-------------------|----------|
| Admin | `admin@erp.com`   | `admin`  |

---

## 📚 Environment Variables

See [`.env.example`](./.env.example) for the full list. Required:

| Variable          | Notes                                       |
|-------------------|---------------------------------------------|
| `DATABASE_URL`    | PostgreSQL connection string                |
| `JWT_SECRET`      | 32+ character random string                 |
| `NEXTAUTH_SECRET` | 32+ character random string                 |
| `NEXTAUTH_URL`    | Public URL of the app                       |
| `NODE_ENV`        | `development` or `production`               |

Production safety flags (must stay `false` / `0` in production):

| Variable                  | Production value |
|---------------------------|------------------|
| `ALLOW_SEED`              | `false`          |
| `E2E_BYPASS_RATE_LIMIT`   | `0`              |
| `E2E_ALLOW_AUTH_RESET`    | `0`              |
| `E2E_ALLOW_PRODUCTION_DB` | `0`              |

---

## 📄 License

Proprietary — © 2026 3bud-ZC. All rights reserved.

---

<div align="center">

**Built with ❤️ for production**

[Report an issue](https://github.com/3bud-ZC/erp-system/issues) ·
[View source](https://github.com/3bud-ZC/erp-system)

</div>
