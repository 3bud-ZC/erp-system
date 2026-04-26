# 🏢 نظام ERP متكامل | Enterprise ERP System

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748?style=flat-square&logo=prisma)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)
![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square)

**🎯 نظام ERP احترافي - جاهز للإنتاج**

**Production-Ready Enterprise Resource Planning System**

نظام متكامل لإدارة المخزون والمبيعات والمشتريات والتصنيع والمحاسبة

Integrated system for inventory, sales, purchases, manufacturing, and accounting management

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Documentation](#-documentation)

</div>

---

## 🎯 نظرة عامة | Overview

نظام ERP متكامل مبني بأحدث التقنيات لإدارة جميع عمليات المؤسسة من المخزون والمبيعات والمشتريات والتصنيع والحسابات.

A fully integrated ERP system built with modern technologies to manage all enterprise operations including inventory, sales, purchases, manufacturing, and accounting.

### ✨ المميزات الرئيسية | Key Features

| الموديول | الوصف | Module |
|----------|-------|--------|
| 📊 **Dashboard** | مؤشرات الأداء والتقارير | KPIs & Reports |
| 📦 **المخزون** | إدارة المنتجات والمخزون | Inventory Management |
| 🛒 **المبيعات** | فواتير وأوامر وعملاء | Sales & Customers |
| 🏭 **المشتريات** | فواتير وأوامر وموردين | Purchases & Suppliers |
| 🔧 **التصنيع** | أوامر إنتاج وقوائم مواد | Manufacturing & BOM |
| 💰 **المحاسبة** | قيود يومية وتقارير | Accounting & Reports |

---

## 🚀 البدء السريع | Quick Start

### 📋 المتطلبات | Prerequisites
- Node.js >= 18.0
- npm >= 8.0
- PostgreSQL (للإنتاج | for production)

### 💻 التثبيت المحلي | Local Installation

```bash
# 1) Clone & install
git clone https://github.com/3bud-ZC/erp-system.git
cd erp-system
npm install

# 2) Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, NEXTAUTH_SECRET (32+ chars each)

# 3) Generate Prisma client
npx prisma generate

# 4) Apply schema to YOUR OWN database (dev only — never against production)
npx prisma migrate deploy

# 5) (Optional) Seed demo data on a fresh dev DB
ALLOW_SEED=true npx tsx prisma/seed-auth.ts   # creates admin@erp.com / admin

# 6) Start dev server
npm run dev
```

> 🛡️ **Production safety**: `prisma/seed.ts`, `prisma/seed-clean.ts`, and
> `scripts/reset-database.ts` refuse to run unless `NODE_ENV=development` or
> `ALLOW_SEED=true`. This protects the live DB from accidental wipes.

افتح [http://localhost:3000](http://localhost:3000) في المتصفح

Open [http://localhost:3000](http://localhost:3000) in your browser

### 🔑 Demo Credentials | بيانات الدخول التجريبية

After running the seed (`npm run seed` or via the onboarding flow), you can log in with the default admin user:

| Field        | Value                |
|--------------|----------------------|
| 📧 Email     | `admin@erp.com`      |
| 🔒 Password  | `admin`              |
| 🌐 Login URL | `/login`             |
| 🖥️ Demo View | `/demo` (view-only)  |
| 📊 Dashboard | `/dashboard`         |

> ⚠️ Change these credentials immediately for any production deployment.

The demo seeder (triggered automatically on first onboarding) creates:
- 7 customers, 4 suppliers, 12 products
- 10 sales invoices, 3 purchase invoices
- 18 chart-of-accounts entries
- 10 sample journal entries (9 posted, 1 draft)

---

## 🖥️ Demo Page (`/demo`)

A self-contained, **view-only** display board for client presentations.
Authentication required (same login). No edit, create, or delete actions are
exposed — the page can be safely shown to non-technical stakeholders.

What it renders:
- 📊 KPI cards: Total Revenue, Total Expenses, Net Profit, Inventory Value
- 📈 Charts: 6-month sales / purchases trend (line), inventory mix (pie)
- 🧾 Tables: latest activities + latest journal entries
- 🔄 Manual refresh button (read-only requery; no write actions)

Open at: `http://<your-host>/demo`

```
┌─────────────────────────────────────────────┐
│  ERP System — Client Demo Dashboard         │
│  View-only financial and operational view   │
├─────────────────────────────────────────────┤
│  [Revenue]  [Expenses]  [Net Profit]  ...   │
│  ──────  Trend chart  ──────  Pie chart     │
│  Latest activities │ Latest journal entries │
└─────────────────────────────────────────────┘
```

---

## 🚀 Deployment

### Option A — Vercel (frontend) + Railway (PostgreSQL)

This is the recommended pairing. Vercel hosts the Next.js app; Railway hosts
the database. Both have free starter tiers.

**1. Provision PostgreSQL on Railway**
- Sign in at [railway.app](https://railway.app) → New Project → Add PostgreSQL
- Copy the connection string from the database service's *Connect* tab
  (format: `postgresql://user:pass@host:port/dbname`)

**2. Apply the schema once (from your local machine)**
```bash
# From this repo, with the Railway URL in .env
DATABASE_URL=<railway-url> npx prisma migrate deploy
```

**3. Deploy the app to Vercel**
```bash
# Push to GitHub, then on https://vercel.com:
#   - Import the GitHub repo
#   - Framework preset: Next.js (auto-detected)
#   - Build command: npm run build (uses package.json)
#   - Output: .next (default)
```

**4. Configure Vercel environment variables** (Settings → Environment Variables)
| Variable           | Value                                        |
|--------------------|----------------------------------------------|
| `DATABASE_URL`     | Railway connection string                    |
| `JWT_SECRET`       | 32+ char random string                       |
| `NEXTAUTH_SECRET`  | 32+ char random string                       |
| `NEXTAUTH_URL`     | `https://<your-app>.vercel.app`              |
| `NODE_ENV`         | `production`                                 |
| `ALLOW_SEED`       | `false` (must stay false on production!)     |
| `E2E_BYPASS_RATE_LIMIT` | `0` (must stay 0 on production!)        |

Vercel will redeploy on every push to the connected branch. The seed/reset
scripts are blocked at runtime by the production safety guards.

### Option B — Railway (full-stack: app + DB on same provider)

```bash
# 1. Push to GitHub, then on https://railway.app:
#    New Project → Deploy from GitHub repo
# 2. Add a PostgreSQL service to the same project
# 3. Set environment variables (same list as Option A)
# 4. Build/start commands are read from railway.json (committed)
```

`railway.json` and `nixpacks.toml` already exist in the repo — no extra
configuration needed.

---

## 📋 Core Features

### ✅ Inventory Management
- Real-time stock tracking with movement audit trail
- Automatic stock validation before operations
- Prevents negative stock at database level
- Multi-location inventory (foundation ready)

### ✅ Sales Operations
- Sales order and invoice creation
- Automatic stock deduction upon sale
- Customer relationship tracking
- Real-time sales analytics

### ✅ Purchase Management
- Purchase order and invoice creation
- Automatic stock increase upon purchase
- Supplier management and tracking
- Purchase analytics and reporting

### ✅ Manufacturing System
- Bill of Materials (BOM) definition
- Production order creation with BOM explosion
- Raw material validation and deduction
- Work-in-Progress (WIP) cost tracking
- Finished goods automatic creation

### ✅ Accounting Integration
- Double-entry bookkeeping (all entries balance)
- Automatic GL posting on all transactions
- 18-account chart of accounts
- Profit & Loss statement (real-time)
- Balance Sheet (point-in-time)
- Cash Flow analysis

### ✅ Quality Features
- Full form validation
- Comprehensive error handling
- Loading states on all async operations
- Arabic localization with RTL support
- Responsive design (mobile-friendly)

---

## 🏗️ البنية التقنية | Architecture

### 🛠️ التقنيات | Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Styling** | TailwindCSS, Lucide Icons |
| **Backend** | Next.js API Routes |
| **Database** | PostgreSQL, Prisma ORM |
| **Auth** | JWT, bcryptjs |
| **Language** | Arabic (RTL)

### 🏗️ Clean Architecture (Production-Ready)

**Component Structure (14 files, 3 folders)**
```
/components
├── /layout (3 files)          # Layout components ONLY
│   ├── Sidebar.tsx            # Single navigation sidebar
│   ├── Topbar.tsx             # Search + notifications
│   └── Workspace.tsx          # Layout wrapper
│
├── /ui (10 files)             # Design system ONLY
│   ├── patterns.tsx           # Unified UI patterns
│   ├── dialog.tsx             # Modal system
│   ├── card.tsx               # Card component
│   ├── button.tsx             # Button component
│   ├── Table.tsx              # Table component
│   └── ... (5 more)
│
└── /providers (1 file)        # Context providers
    └── AppProviders.tsx
```

**Page Structure (20 pages)**
```
/app
├── /(dashboard)               # Protected routes
│   ├── dashboard/             # Main dashboard
│   ├── sales/                 # Sales invoices
│   ├── purchases/             # Purchase invoices
│   ├── inventory/             # Products & stock
│   ├── accounting/            # Journal entries
│   ├── finance/               # Financial management
│   ├── reports/               # Reporting
│   ├── customers/             # Customer management
│   ├── suppliers/             # Supplier management
│   └── warehouses/            # Warehouse management
│
├── /login                     # Authentication
├── /onboarding                # Company setup
├── /setup                     # System initialization
└── /preview                   # Health check
```

**API Structure (50+ endpoints)**
```
/app/api
├── products/                  # CRUD for products
├── customers/                 # Customer management
├── suppliers/                 # Supplier management
├── warehouses/                # Warehouse management
├── sales-invoices/            # Sales with auto GL posting
├── purchase-invoices/         # Purchases with auto GL posting
├── expenses/                  # Expenses with auto GL posting
├── accounting/                # Journal entries + financial statements
├── reports/                   # Financial reports
└── dashboard/                 # Dashboard KPIs
```

---

## 📡 API Overview | نظرة عامة على الـ APIs

All APIs return a standardized envelope:
```json
{ "success": true, "data": <payload>, "message": "..." }
```
Errors:
```json
{ "success": false, "code": 400, "message": "...", "details": { ... } }
```

### 🔐 Authentication
| Method | Endpoint                   | Description                     |
|--------|----------------------------|---------------------------------|
| POST   | `/api/auth/login`          | Email/password login → cookie   |
| POST   | `/api/auth/register`       | New user signup                 |
| POST   | `/api/auth/logout`         | Invalidate session              |
| POST   | `/api/onboarding/init`     | Create tenant + seed demo data  |

### 📊 Dashboard
| Method | Endpoint          | Description                                   |
|--------|-------------------|-----------------------------------------------|
| GET    | `/api/dashboard`  | KPIs, trends, recent activities + JE entries  |

### 🛒 Sales / Purchases / Inventory
| Method | Endpoint                       | Description           |
|--------|--------------------------------|-----------------------|
| CRUD   | `/api/sales-invoices`          | Sales invoices + GL   |
| CRUD   | `/api/purchase-invoices`       | Purchase invoices + GL|
| CRUD   | `/api/customers`               | Customers             |
| CRUD   | `/api/suppliers`               | Suppliers             |
| CRUD   | `/api/products`                | Products              |
| CRUD   | `/api/warehouses`              | Warehouses            |
| GET    | `/api/inventory/...`           | Stock movements/value |

### 💰 Accounting
| Method | Endpoint                                       | Description                                |
|--------|------------------------------------------------|--------------------------------------------|
| GET    | `/api/accounting/trial-balance`                | Aggregated debit/credit per account        |
| GET    | `/api/accounting/income-statement`             | Revenue, expenses, net profit              |
| GET    | `/api/accounting/balance-sheet`                | Assets, liabilities, equity                |
| GET    | `/api/accounting/journal-entries`              | List journal entries                       |
| POST   | `/api/accounting/journal-entries`              | Create draft entry (validated)             |
| POST   | `/api/accounting/journal-entries/:id/post`     | Post a draft entry                         |
| GET    | `/api/accounting/balances`                     | Account balances                           |
| GET    | `/api/accounting/cash-flow`                    | Cash flow statement                        |
| GET    | `/api/accounting/aging-report`                 | A/R + A/P aging                            |
| CRUD   | `/api/accounting/periods`                      | Manage accounting periods                  |
| CRUD   | `/api/accounting-periods`                      | Manage accounting periods (legacy alias)   |

### 📈 Reports
| Method | Endpoint                              | Description                  |
|--------|---------------------------------------|------------------------------|
| GET    | `/api/reports/profit-loss`            | Detailed P&L report          |
| GET    | `/api/reports/balance-sheet`          | Detailed balance sheet       |
| GET    | `/api/reports/aging`                  | Aging report                 |
| GET    | `/api/reports/customer-statement`     | Per-customer statement       |
| GET    | `/api/reports/supplier-statement`     | Per-supplier statement       |

### 🩺 Health
| Method | Endpoint               | Description           |
|--------|------------------------|-----------------------|
| GET    | `/api/health`          | Liveness probe        |
| GET    | `/api/health/detailed` | Full readiness probe  |

#### Example — Trial Balance
```bash
curl -b cookie.txt "http://localhost:3000/api/accounting/trial-balance?asOfDate=2026-04-30"
```
```json
{
  "success": true,
  "data": [
    { "account": "النقدية", "accountCode": "1100", "debit": 8050, "credit": 0 },
    { "account": "البنك",   "accountCode": "1110", "debit": 100000, "credit": 48500 },
    { "account": "إيرادات المبيعات", "accountCode": "4100", "debit": 0, "credit": 22652 }
  ],
  "message": "Trial balance fetched (3 accounts, balanced=true)"
}
```

---

## 🖼️ Screenshots | لقطات الشاشة

> Place screenshots inside `docs/screenshots/` and reference them here.

| View             | Path                                  | Description                      |
|------------------|---------------------------------------|----------------------------------|
| 🔐 Login         | `docs/screenshots/login.png`          | Login screen                     |
| 📊 Dashboard     | `docs/screenshots/dashboard.png`      | Main KPI dashboard               |
| 🖥️ Demo Board    | `docs/screenshots/demo.png`           | `/demo` view-only client board   |
| 💰 Accounting    | `docs/screenshots/accounting.png`     | Journal entries module           |
| 🛒 Sales         | `docs/screenshots/sales.png`          | Sales invoices                   |
| 📦 Inventory     | `docs/screenshots/inventory.png`      | Products & stock                 |
| 📈 Reports       | `docs/screenshots/reports.png`        | Financial reports                |

To regenerate screenshots:
```bash
npm run dev
# then visit each route in a browser at 1440×900 and capture
```

**Business Logic Layer**
```
/lib
├── accounting/                # Accounting services
│   ├── accounting.service.ts  # GL posting engine
│   └── journal-entry.service.ts
├── api/                       # API clients
│   ├── client.ts              # Base API client
│   └── accounting.ts          # Accounting API
├── store/                     # State management
│   └── auth.ts                # Auth store (Zustand)
└── ... (38 utility files)
```

**Database Layer**
```
/prisma
├── schema.prisma              # Database schema (14 models)
├── seed.ts                    # Database seeding
└── migrations/                # Migration history
```

---

## 📊 Database Schema

### 14 Data Models
1. **Product** - Inventory items
2. **Supplier** - Vendor information
3. **Customer** - Customer data
4. **StockMovement** ⭐ - Audit trail
5. **WorkInProgress** ⭐ - Manufacturing costs
6. **InventoryValuation** ⭐ - Product costing
7. **SalesInvoice** - Sales transactions
8. **SalesInvoiceItem** - Sales line items
9. **SalesOrder** - Sales orders
10. **PurchaseInvoice** - Purchase transactions
11. **PurchaseInvoiceItem** - Purchase line items
12. **ProductionOrder** ⭐ - Manufacturing orders
13. **BOMItem** ⭐ - Bill of Materials
14. **Expense** - Expense tracking

See `prisma/schema.prisma` for the complete relational schema.

---

## 🔌 واجهات برمجية | API Endpoints

### REST API متكامل | Complete REST API

جميع الـ APIs تستخدم صيغة موحدة للاستجابة:

All APIs use standardized response format:

```typescript
// Success Response
{
  success: true,
  data: {...},
  message: "Operation successful"
}

// Error Response
{
  success: false,
  message: "Error description",
  code: 400
}
```

| Endpoint | Methods | الوصف | Description |
|----------|---------|--------|-------------|
| `/api/products` | GET/POST/PUT/DELETE | إدارة المنتجات | Product management |
| `/api/customers` | GET/POST/PUT/DELETE | إدارة العملاء | Customer management |
| `/api/suppliers` | GET/POST/PUT/DELETE | إدارة الموردين | Supplier management |
| `/api/warehouses` | GET/POST/PUT/DELETE | إدارة المخازن | Warehouse management |
| `/api/sales-invoices` | GET/POST/PUT/DELETE | فواتير البيع + قيود محاسبية | Sales with auto GL |
| `/api/purchase-invoices` | GET/POST/PUT/DELETE | فواتير الشراء + قيود محاسبية | Purchases with auto GL |
| `/api/sales-orders` | GET/POST/PUT/DELETE | أوامر البيع | Sales orders |
| `/api/purchase-orders` | GET/POST/PUT/DELETE | أوامر الشراء | Purchase orders |
| `/api/expenses` | GET/POST/PUT/DELETE | المصروفات + قيود محاسبية | Expenses with auto GL |
| `/api/production-orders` | GET/POST/PUT/DELETE | أوامر الإنتاج + BOM | Manufacturing with BOM |
| `/api/bom` | GET/POST/PUT/DELETE | قوائم المواد | Bill of Materials |
| `/api/journal-entries` | GET/POST/PUT/DELETE | القيود اليومية | Journal entries |
| `/api/reports` | GET | التقارير المالية | Financial reports |
| `/api/dashboard` | GET | لوحة التحكم | Dashboard KPIs |

---

## ⚙️ Business Logic

### Automatic Stock Management
```
When Purchase Invoice Created:
  1. Save invoice
  2. Increment product stock
  3. Record stock movement
  4. Auto-post GL: DR Inventory / CR Accounts Payable

When Sales Invoice Created:
  1. Validate stock available
  2. If yes: Save invoice, decrement stock, record movement
  3. Auto-post GL: DR AR / CR Revenue + DR COGS / CR Inventory
  4. If no: Show error, prevent operation
```

### Manufacturing Workflow
```
1. Define BOM (e.g., Product A = 2x Material B + 3x Material C)
2. Create Production Order (Produce 10 units of A)
3. System calculates: Need 20x B + 30x C
4. Validate stock available
5. If yes: Decrement B&C, create WIP record
6. On completion: Add A to inventory, post GL entries
7. If no: Show error with details
```

---

## 📈 Reports (Real-time from GL)

All reports are calculated from actual transactions:
- **Profit & Loss** - Revenue, COGS, expenses, net income
- **Balance Sheet** - Assets, liabilities, equity (must balance)
- **Cash Flow** - Operating, investing, financing activities
- **Inventory Valuation** - Product costs and totals

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
# Set DATABASE_URL in dashboard
```

### Traditional Server
```bash
npm run build
npm start
# Use PM2 for process management
```

### PostgreSQL Upgrade
```bash
# Update .env: DATABASE_URL="postgresql://..."
npx prisma migrate deploy
```

---

## 📚 Documentation

- **[prisma/schema.prisma](./prisma/schema.prisma)** - Database schema
- **[prisma/README.md](./prisma/README.md)** - Database seeding guide

---

## 🔒 Security

- **JWT Authentication** - Token-based auth
- **RBAC Authorization** - Role-based permissions
- **Input Validation** - Type-safe endpoints
- **Atomic Transactions** - Database consistency
- **Type Safety** - Full TypeScript coverage

---

## 🛠️ Development Commands

```bash
npm run dev       # Development server
npm run build     # Production build
npm start         # Production server
npm run seed      # Clean database
npx prisma studio # Database UI
```

---

## 🤝 المساهمة | Contributing

نرحب بجميع المساهمات! | We welcome all contributions!

```bash
# 1. Fork the repository
# 2. Create your feature branch
git checkout -b feature/AmazingFeature

# 3. Commit your changes
git commit -m 'Add some AmazingFeature'

# 4. Push to the branch
git push origin feature/AmazingFeature

# 5. Open a Pull Request
```

---

## 📞 الدعم | Support

- 📧 Email: support@erp-system.com
- 🐛 Issues: [GitHub Issues](https://github.com/3bud-ZC/erp-system/issues)
- 📖 Docs: [Documentation](#-documentation)

---

## 📄 الترخيص | License

MIT License - مفتوح المصدر ومجاني للاستخدام

MIT License - Open source and free to use

---

<div align="center">

**صُنع بإتقان | Crafted with precision**

</div>

---

<div align="center">

Made with ❤️ by [3bud-ZC](https://github.com/3bud-ZC)

</div>
