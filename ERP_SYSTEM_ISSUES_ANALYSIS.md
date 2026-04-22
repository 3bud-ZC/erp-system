# ERP System Issues Analysis Report
## تحليل شامل لمشاكل النظام

**تاريخ التقرير:** 21 أبريل 2026  
**الحالة:** تحتاج إصلاح عاجل

---

# 🔴 المشكلة الأولى: صلاحيات المستخدم (Permissions)

## الوصف
المستخدم `admin@erp.com` لا يملك الصلاحيات اللازمة لإجراء العمليات الأساسية.

## الأخطاء الظاهرة
```
"ليس لديك صلاحية للقيام بهذا الإجراء"
```

## الصلاحيات المطلوبة للعمليات الأساسية

### المخزون (Inventory)
| العملية | الصلاحية المطلوبة | الملف |
|---------|-------------------|-------|
| إضافة منتج | `create_product` | `/api/products/route.ts` |
| تعديل منتج | `update_product` | `/api/products/route.ts` |
| حذف منتج | `delete_product` | `/api/products/route.ts` |
| إضافة مادة خام | `create_product` | `/api/raw-materials` (uses same API) |
| إضافة مخزن | `create_warehouse` | `/api/warehouses/route.ts` |
| تعديل مخزن | `update_warehouse` | `/api/warehouses/route.ts` |
| حذف مخزن | `delete_warehouse` | `/api/warehouses/route.ts` |

### المبيعات (Sales)
| العملية | الصلاحية المطلوبة | الملف |
|---------|-------------------|-------|
| إضافة عميل | `create_customer` | `/api/customers/route.ts` |
| تعديل عميل | `update_customer` | `/api/customers/route.ts` |
| حذف عميل | `delete_customer` | `/api/customers/route.ts` |
| إضافة مورد | `create_supplier` | `/api/suppliers/route.ts` |
| إنشاء فاتورة بيع | `create_sales_invoice` | `/api/sales-invoices/route.ts` |
| إنشاء أمر بيع | `create_sales_order` | `/api/sales-orders/route.ts` |

### المشتريات (Purchases)
| العملية | الصلاحية المطلوبة | الملف |
|---------|-------------------|-------|
| إنشاء أمر شراء | `create_purchase_order` | `/api/purchase-orders/route.ts` |
| إنشاء فاتورة شراء | `create_purchase_invoice` | `/api/purchase-invoices/route.ts` |

### المحاسبة (Accounting)
| العملية | الصلاحية المطلوبة | الملف |
|---------|-------------------|-------|
| إنشاء قيد يومية | `create_journal_entry` | `/api/journal-entries/route.ts` |
| إضافة حساب | `create_account` | `/api/accounts/route.ts` |

## الحل المقترح

### الخيار 1: إضافة جميع الصلاحيات للـ Admin (مستحسن للتطوير)
```typescript
// في seed-auth.ts أو migration script
// إضافة صلاحية 'super_admin' أو 'all_permissions' للمستخدم admin
```

### الخيار 2: إنشاء Middleware يتجاوز الصلاحيات في بيئة التطوير
```typescript
// middleware/checkPermission.ts
export function checkPermission(user: any, permission: string): boolean {
  // في بيئة التطوير: السماح للـ Admin بكل شيء
  if (user.email === 'admin@erp.com' || user.roles.includes('admin')) {
    return true;
  }
  return user.permissions.includes(permission);
}
```

---

# 🔴 المشكلة الثانية: Tenant ID مفقود

## الوصف
جميع النماذج في Prisma require `tenantId` ولكن API routes لا ترسله.

## الأخطاء الظاهرة
```
Invalid `prisma.product.create()` invocation:
Argument 'tenant' is missing.
```

## النماذج المتأثرة (58+ ملف)

### تم إصلاحه جزئياً:
- ✅ `/api/products/route.ts` - تم إضافة tenantId
- ✅ `/api/warehouses/route.ts` - تم إضافة tenantId  
- ✅ `/api/customers/route.ts` - تم إضافة tenantId

### يحتاج إصلاح (55 ملف آخر):
```
/api/accounts/route.ts
/api/bom/route.ts
/api/companies/route.ts
/api/expenses/route.ts
/api/item-groups/route.ts
/api/suppliers/route.ts
/api/units/route.ts
/api/batches/route.ts
/api/journal-entries/route.ts
/api/production-orders/route.ts
/api/purchase-orders/route.ts
/api/purchase-invoices/route.ts
/api/sales-orders/route.ts
/api/sales-invoices/route.ts
/api/sales-returns/route.ts
/api/stock-adjustments/route.ts
/api/stock-transfers/route.ts
/api/quotations/route.ts
... وأكثر
```

## الحل المطلوب

### 1. تحديث كل API Route لإضافة tenantId
```typescript
// في كل POST و PUT و DELETE
if (!user.tenantId) {
  return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
}

// عند الإنشاء
await prisma.entity.create({
  data: {
    ...body,
    tenantId: user.tenantId,  // ← إضافة هذا
  },
});
```

### 2. إنشاء Middleware موحد
```typescript
// lib/api-middleware.ts
export function withTenant(handler: Function) {
  return async (req: Request) => {
    const user = await getAuthenticatedUser(req);
    if (!user?.tenantId) {
      return apiError('Tenant required', 400);
    }
    return handler(req, user);
  };
}
```

---

# 🔴 المشكلة الثالثة: Prisma Client غير مُحدّث

## الوصف
التغييرات في API routes لم تُطبق على السيرفر المُشغل.

## الأسباب
1. السيرفر يعمل على build قديم
2. لا يوجد `npm run build` تم تنفيذه بعد التعديلات
3. Prisma Client يحتاج إعادة توليد

## الحل
```bash
# 1. إيقاف السيرفر
# 2. إعادة توليد Prisma
npx prisma generate

# 3. بناء المشروع
npm run build

# 4. تشغيل السيرفر
npm start
```

---

# 📋 قائمة الملفات التي تحتاج إصلاح Tenant (55 ملف)

## المخزون والمنتجات
- [ ] `/api/accounts/route.ts`
- [ ] `/api/batches/route.ts`
- [ ] `/api/bom/route.ts`
- [ ] `/api/companies/route.ts`
- [ ] `/api/expenses/route.ts`
- [ ] `/api/fixed-assets/route.ts`
- [ ] `/api/goods-receipts/route.ts`
- [ ] `/api/item-groups/route.ts`
- [ ] `/api/stock-adjustments/route.ts`
- [ ] `/api/stock-transfers/route.ts`
- [ ] `/api/stocktakes/route.ts`
- [ ] `/api/suppliers/route.ts`
- [ ] `/api/units/route.ts`

## المبيعات
- [ ] `/api/customers/route.ts` (يحتاج تحديث PUT أيضاً)
- [ ] `/api/quotations/route.ts`
- [ ] `/api/sales-invoices/route.ts`
- [ ] `/api/sales-orders/route.ts`
- [ ] `/api/sales-returns/route.ts`

## المشتريات
- [ ] `/api/purchase-invoices/route.ts`
- [ ] `/api/purchase-orders/route.ts`
- [ ] `/api/purchase-requisitions/route.ts`
- [ ] `/api/purchase-returns/route.ts`

## المحاسبة
- [ ] `/api/accounting-periods/route.ts`
- [ ] `/api/accounts/route.ts`
- [ ] `/api/accruals/route.ts`
- [ ] `/api/journal-entries/route.ts`
- [ ] `/api/accounting/budgets/route.ts`
- [ ] `/api/accounting/cost-engine/route.ts`

## الإنتاج
- [ ] `/api/production-lines/route.ts`
- [ ] `/api/production-orders/route.ts`
- [ ] `/api/production-lines/assignments/route.ts`

## التقارير والإعدادات
- [ ] `/api/tenants/route.ts`
- [ ] `/api/reports/*`

---

# 🛠️ خطة العمل للإصلاح

## المرحلة 1: إصلاح عاجل (30 دقيقة)
1. ✅ إصلاح `/api/products` - تم
2. ✅ إصلاح `/api/warehouses` - تم
3. ✅ إصلاح `/api/customers` - تم
4. 🔄 إعادة بناء المشروع
5. 🔄 إعادة تشغيل السيرفر

## المرحلة 2: إصلاح شامل (2-3 ساعات)
1. إنشاء Middleware موحد للـ tenant
2. تحديث جميع API routes (55 ملف)
3. إضافة صلاحيات Admin للمستخدم
4. اختبار جميع العمليات

## المرحلة 3: تحسينات (1 ساعة)
1. إضافة سكريبت للـ seed يضيف الصلاحيات
2. إضافة middleware للـ permissions
3. تحسين رسائل الأخطاء

---

# 📊 ملخص المشاكل

| المشكلة | عدد الملفات المتأثرة | الأولوية |
|---------|---------------------|----------|
| Tenant ID مفقود | 55 ملف | 🔴 عالية |
| صلاحيات مفقودة | 58 ملف | 🔴 عالية |
| Prisma Client قديم | 1 (build) | 🟡 متوسطة |

**الإجمالي:** 113+ ملف يحتاج تعديل

---

# ✅ الملفات التي تم إصلاحها حالياً

| الملف | الحالة |
|-------|--------|
| `/api/products/route.ts` | ✅ تم إصلاح tenantId |
| `/api/warehouses/route.ts` | ✅ تم إصلاح tenantId |
| `/api/customers/route.ts` | ✅ تم إصلاح tenantId |

---

# 🚀 الخطوة التالية المقترحة

**يجب إعادة بناء المشروع الآن:**
```bash
# 1. إيقاف السيرفر
# 2. نفذ في terminal:
npx prisma generate
npm run build
npm start
```

**أو استخدم Dev Mode (أسرع للتطوير):**
```bash
npm run dev
```

---

**ملاحظة:** جميع التعديلات تمت على الملفات، لكن السيرفر يعمل على Build قديم. يجب إعادة البناء.
