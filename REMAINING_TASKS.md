# 📋 **المهام المتبقية - 15 صفحة**

## ✅ **تم إنجازه (3/18):**
1. ✅ المواد الخام
2. ✅ فواتير البيع  
3. ✅ (جاري العمل...)

---

## 🔄 **المتبقي (15 صفحة):**

### **المرحلة 1: أولوية عالية جداً (3 صفحات)**

#### **Task 3: فواتير الشراء**
- **الملف:** `app/dashboard/purchases/invoices/page.tsx`
- **التحسينات المطلوبة:**
  ```typescript
  ✅ Auto-generate: PINV-YYYYMMDD-XXX
  ✅ Timeout: 30s
  ✅ Cache control: no-store
  ✅ Array safety checks
  ✅ حالات الدفع: pending, paid, partial, unpaid, cancelled
  ✅ Auto-fill السعر
  ✅ حساب الإجمالي تلقائياً
  ```

#### **Task 4: المصروفات**
- **الملف:** `app/dashboard/purchases/expenses/page.tsx`
- **التحسينات المطلوبة:**
  ```typescript
  ✅ Auto-generate: EXP-YYYYMMDD-XXX
  ✅ Timeout: 30s
  ✅ Cache control: no-store
  ✅ Array safety checks
  ✅ حالات: pending, approved, paid, rejected
  ```

#### **Task 5: أوامر الشراء**
- **الملف:** `app/dashboard/purchases/orders/page.tsx`
- **التحسينات المطلوبة:**
  ```typescript
  ✅ Auto-generate: PO-YYYYMMDD-XXX
  ✅ Timeout: 30s
  ✅ Cache control: no-store
  ✅ Array safety checks
  ✅ حالات: pending, confirmed, received, cancelled
  ✅ Auto-fill السعر
  ✅ حساب الإجمالي تلقائياً
  ```

---

### **المرحلة 2: أولوية عالية (2 صفحات)**

#### **Task 6: العملاء**
- **الملف:** `app/dashboard/sales/customers/page.tsx`
- **التحسينات المطلوبة:**
  ```typescript
  ✅ Auto-generate code: CUST-XXX
  ✅ Timeout: 30s
  ✅ Cache control: no-store
  ✅ Array safety checks
  ✅ CRUD كامل
  ```

#### **Task 7: الموردين**
- **الملف:** `app/dashboard/purchases/suppliers/page.tsx`
- **التحسينات المطلوبة:**
  ```typescript
  ✅ Auto-generate code: SUPP-XXX
  ✅ Timeout: 30s
  ✅ Cache control: no-store
  ✅ Array safety checks
  ✅ CRUD كامل
  ```

---

### **المرحلة 3: أولوية متوسطة (3 صفحات)**

#### **Task 8: دراسة التكاليف**
- **الملف:** `app/dashboard/manufacturing/cost-study/page.tsx`
- **التحسينات المطلوبة:**
  ```typescript
  ✅ Timeout: 30s
  ✅ Cache control: no-store
  ✅ Array safety checks
  ✅ تحسين عرض البيانات
  ```

#### **Task 9: Dashboard الرئيسي**
- **الملف:** `app/dashboard/page.tsx`
- **التحسينات المطلوبة:**
  ```typescript
  ✅ Timeout: 30s (زيادة من 10s)
  ✅ Cache control: no-store
  ✅ Array safety checks
  ✅ تحسين الإحصائيات
  ```

#### **Task 10: صفحة المخزون الرئيسية**
- **الملف:** `app/dashboard/inventory/page.tsx`
- **التحسينات المطلوبة:**
  ```typescript
  ✅ Timeout: 30s
  ✅ Cache control: no-store
  ✅ Array safety checks
  ```

---

### **المرحلة 4: أولوية منخفضة (7 صفحات)**

#### **Task 11-17: الصفحات الفرعية والتقارير**
- `app/dashboard/sales/page.tsx` - صفحة المبيعات الرئيسية
- `app/dashboard/sales/reports/page.tsx` - تقارير المبيعات
- `app/dashboard/purchases/page.tsx` - صفحة المشتريات الرئيسية
- `app/dashboard/purchases/reports/page.tsx` - تقارير المشتريات
- `app/dashboard/manufacturing/page.tsx` - صفحة التصنيع الرئيسية

**التحسينات الموحدة:**
```typescript
✅ Timeout: 30s
✅ Cache control: no-store
✅ Array safety checks
✅ Loading states محسّنة
```

---

## 🎯 **كيفية التطبيق:**

### **الخطوات لكل صفحة:**

1. **نسخ Template من صفحة مشابهة:**
   ```bash
   # مثال: فواتير الشراء
   Copy-Item "sales/invoices/page.tsx" -Destination "purchases/invoices/page-new.tsx"
   ```

2. **تعديل الأكواد:**
   - تغيير `INV` إلى `PINV`
   - تغيير `sales-invoices` إلى `purchase-invoices`
   - تغيير العناوين والنصوص
   - تحديث الحالات حسب نوع الصفحة

3. **استبدال الملف:**
   ```bash
   Remove-Item "page.tsx" -Force
   Rename-Item "page-new.tsx" -NewName "page.tsx"
   ```

4. **Commit:**
   ```bash
   git add -A
   git commit -m "feat: Task X/18 - [Page Name] complete"
   git push origin master
   ```

---

## 📊 **Progress Tracker:**

| Task | الصفحة | الحالة | التاريخ |
|------|--------|--------|---------|
| 1/18 | المواد الخام | ✅ | 15 أبريل 5:15م |
| 2/18 | فواتير البيع | ✅ | 15 أبريل 5:20م |
| 3/18 | فواتير الشراء | ⏳ | - |
| 4/18 | المصروفات | ⏳ | - |
| 5/18 | أوامر الشراء | ⏳ | - |
| 6/18 | العملاء | ⏳ | - |
| 7/18 | الموردين | ⏳ | - |
| 8/18 | دراسة التكاليف | ⏳ | - |
| 9/18 | Dashboard | ⏳ | - |
| 10/18 | صفحة المخزون | ⏳ | - |
| 11-18/18 | الصفحات الفرعية | ⏳ | - |

---

## 🔧 **Utility Functions المتاحة:**

استخدم `lib/page-utils.ts` للوظائف الجاهزة:

```typescript
import {
  generateDocumentNumber,
  fetchWithTimeout,
  ensureArray,
  calculateGrandTotal,
  formatCurrency,
  getStatusBadge,
  showSuccess,
  showError,
} from '@/lib/page-utils';

// مثال:
const invoiceNumber = generateDocumentNumber('PINV');
// Result: PINV-20260415-123
```

---

## ⚡ **Quick Reference:**

### **Document Prefixes:**
- فواتير البيع: `INV`
- أوامر البيع: `SO`
- فواتير الشراء: `PINV`
- أوامر الشراء: `PO`
- أوامر الإنتاج: `PROD`
- المصروفات: `EXP`
- العملاء: `CUST`
- الموردين: `SUPP`

### **Status Types:**

**فواتير:**
- pending, paid, partial, unpaid, cancelled

**أوامر:**
- pending, confirmed, shipped, delivered, cancelled

**مصروفات:**
- pending, approved, paid, rejected

**إنتاج:**
- pending, in_progress, completed, cancelled

---

**آخر تحديث:** 15 أبريل 2026 - 5:25 مساءً
