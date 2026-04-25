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
# استنساخ المشروع | Clone the repository
git clone https://github.com/3bud-ZC/erp-system.git
cd erp-system

# تثبيت المكتبات | Install dependencies
npm install

# إعداد قاعدة البيانات | Setup database
npx prisma generate
npx prisma migrate deploy
npx prisma db seed

# تشغيل السيرفر | Start development server
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000) في المتصفح

Open [http://localhost:3000](http://localhost:3000) in your browser

### 🌐 النشر على Render | Deploy to Render

```bash
# 1. Push to GitHub
git push origin master

# 2. Connect to Render
# - Go to https://dashboard.render.com
# - Create new Web Service
# - Connect GitHub repository

# 3. Environment Variables
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-app.onrender.com
NODE_ENV=production

# 4. Build & Start Commands
Build: npm ci && npx prisma generate && npx prisma migrate deploy && npx prisma db seed && npm run build
Start: npm start
```

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
├── accounting/                # Journal entries
├── reports/                   # Financial reports
└── dashboard/                 # Dashboard KPIs
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
