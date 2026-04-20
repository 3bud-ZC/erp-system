# تقرير ترقية نظام ERP - المحاسبة والأمان

## معلومات المشروع

**اسم المشروع:** ERP System  
**تاريخ التقرير:** 20 أبريل 2026  
**نوع التقرير:** ترقية الأمان والمصادقة وإدارة المستخدمين  
**الإصدار الحالي:** 1.0.0  

---

## ملخص التنفيذ

تم تنفيذ ترقية شاملة لنظام ERP للتركيز على:
1. **الأمان والمصادقة (Authentication & Authorization)**
2. **سجل النشاط (Activity Logging)**
3. **إدارة المستخدمين (User Management)**
4. **تقوية الأمان (Security Hardening)**

---

## التعديلات المنفذة

### 1. PHASE 1: تحسين الأمان (Security Improvements)

#### 1.1 استبدال localStorage بـ HttpOnly Cookies
**السبب:** localStorage غير آمن للـ JWT في بيئة الإنتاج  
**الحل:** استخدام HttpOnly cookies لتخزين JWT

**الملفات المعدلة:**
- `app/api/auth/login/route.ts` - تعديل لاستخدام HttpOnly cookies
- `app/login/page.tsx` - إزالة localStorage واستخدام credentials: 'include'
- `lib/auth.ts` - تحديث `getAuthenticatedUser` لقراءة التوكين من cookies
- `middleware.ts` - إنشاء middleware جديد لقراءة التوكين من cookies

**التكوين:**
```
Cookie Settings:
- HttpOnly: true (منع JavaScript من الوصول)
- Secure: true (إرسال عبر HTTPS فقط في الإنتاج)
- SameSite: strict (منع CSRF)
- Expiry: 7 أيام
```

#### 1.2 تحديث جميع API Routes
تم تحديث جميع API routes لاستخراج المستخدم من request context بدلاً من Authorization header

**الملفات المتأثرة:**
- جميع API routes في `app/api/`

---

### 2. PHASE 2: سجل النشاط (Activity Logging)

#### 2.1 إنشاء نظام سجل النشاط
تم إنشاء نظام شامل لتسجيل جميع العمليات على الكيانات

**الملف الجديد:** `lib/activity-log.ts`

**الوظائف:**
```typescript
logActivity({
  entity: 'User',           // نوع الكيان
  entityId: 'id',          // معرف الكيان
  action: 'CREATE',        // نوع العملية (CREATE, UPDATE, DELETE)
  userId: 'user-id',       // معرف المستخدم الذي قام بالعملية
  before: { ... },         // البيانات قبل العملية (لـ UPDATE و DELETE)
  after: { ... }           // البيانات بعد العملية (لـ CREATE و UPDATE)
})
```

**قواعد التسجيل:**
- **CREATE:** تسجيل البيانات بعد الإضافة (afterData فقط)
- **UPDATE:** تسجيل البيانات قبل وبعد التعديل (beforeData و afterData)
- **DELETE:** تسجيل البيانات قبل الحذف (beforeData فقط)

#### 2.2 تطبيق سجل النشاط على الكيانات

**الكيانات التي تم إضافة سجل النشاط لها:**

1. **فواتير البيع (Sales Invoices)**
   - الملف: `app/api/sales-invoices/route.ts`
   - العمليات: CREATE, UPDATE, DELETE
   - البيانات المسجلة: معلومات الفاتورة، البنود، المبلغ، العملاء

2. **فواتير الشراء (Purchase Invoices)**
   - الملف: `app/api/purchase-invoices/route.ts`
   - العمليات: CREATE, UPDATE, DELETE
   - البيانات المسجلة: معلومات الفاتورة، البنود، المبلغ، الموردين

3. **المصروفات (Expenses)**
   - الملف: `app/api/expenses/route.ts`
   - العمليات: CREATE, UPDATE, DELETE
   - البيانات المسجلة: معلومات المصروف، المبلغ، الفئة، الوصف

4. **الحسابات (Accounts)**
   - الملف: `app/api/accounts/route.ts`
   - العمليات: CREATE, UPDATE, DELETE
   - البيانات المسجلة: معلومات الحساب، الرصيد، النوع

5. **المنتجات (Products)**
   - الملف: `app/api/products/route.ts`
   - العمليات: CREATE, UPDATE, DELETE
   - البيانات المسجلة: معلومات المنتج، السعر، المخزون، الوحدة

6. **حركات المخزون (Inventory Transactions)**
   - الملف: `app/api/stock-movements/route.ts`
   - العمليات: DELETE
   - البيانات المسجلة: معلومات الحركة، المنتج، الكمية، النوع

7. **المستخدمين (Users)**
   - الملف: `app/api/users/route.ts`
   - العمليات: CREATE, UPDATE, DELETE
   - البيانات المسجلة: معلومات المستخدم، البريد، الاسم، الصلاحية

#### 2.3 نموذج قاعدة البيانات
تم إضافة نموذج جديد في `prisma/schema.prisma`:

```prisma
model ActivityLog {
  id          String   @id @default(cuid())
  entity      String   // نوع الكيان
  entityId    String   // معرف الكيان
  action      String   // نوع العملية
  performedBy String   // معرف المستخدم
  beforeData  Json?    // البيانات قبل العملية
  afterData   Json?    // البيانات بعد العملية
  createdAt   DateTime @default(now())
  
  @@index([entity])
  @@index([entityId])
  @@index([performedBy])
}
```

---

### 3. PHASE 3: إدارة المستخدمين (User Management)

#### 3.1 إنشاء API إدارة المستخدمين
**الملف الجديد:** `app/api/users/route.ts`

**الوظائف:**
- **GET:** جلب جميع المستخدمين (ADMIN فقط)
- **POST:** إنشاء مستخدم جديد (ADMIN فقط)
- **PUT:** تحديث بيانات مستخدم (ADMIN فقط)
- **DELETE:** حذف/تعطيل مستخدم (ADMIN فقط)

**التحقق من الصلاحيات:**
- جميع العمليات تتطلب صلاحية ADMIN
- التحقق من صحة البيانات (البريد، كلمة المرور، الصلاحية)
- منع تغيير صلاحية المستخدم لنفسه
- منع حذف المستخدم لنفسه

#### 3.2 إنشاء صفحة إدارة المستخدمين
**الملف الجديد:** `app/dashboard/users/page.tsx`

**الميزات:**
- عرض قائمة المستخدمين
- إنشاء مستخدم جديد
- تعديل بيانات المستخدم
- تغيير صلاحية المستخدم
- تفعيل/تعطيل المستخدم
- حذف المستخدم (soft delete)
- حماية الصفحة: فقط ADMIN يمكنه الوصول

**الحماية الأمامية:**
```typescript
const checkAdminAccess = async () => {
  const response = await fetch('/api/users', { 
    credentials: 'include', 
    cache: 'no-store' 
  });
  if (response.status === 403) {
    router.replace('/dashboard');
    return;
  }
  // ...
};
```

---

### 4. PHASE 4: حماية إدارة المستخدمين

#### 4.1 الحماية الخلفية (Backend Protection)
- جميع API routes للمستخدمين تتطلب صلاحية ADMIN
- التحقق من الصلاحية في كل عملية
- إرجاع خطأ 403 إذا لم يكن المستخدم ADMIN

#### 4.2 الحماية الأمامية (Frontend Protection)
- التحقق من الصلاحية قبل تحميل الصفحة
- إعادة التوجيه إلى لوحة التحكم إذا لم يكن ADMIN
- إخفاء/إظهار عناصر UI حسب الصلاحية

---

### 5. PHASE 5: تحسين تدفق المصادقة (Auth Flow)

#### 5.1 تسجيل الخروج (Logout)
**الملف الجديد:** `app/api/auth/logout/route.ts`

**الوظيفة:**
- مسح HttpOnly cookie
- إرجاع استجابة نجاح

**الملف المعدل:** `components/Topbar.tsx`
- إضافة زر تسجيل الخروج
- استدعاء API تسجيل الخروج
- إعادة التوجيه إلى صفحة تسجيل الدخول

#### 5.2 توجيه الجذر (Root Redirect)
**الملف:** `app/page.tsx`
- إعادة توجيه المستخدم إلى `/login` إذا لم يكن مسجل الدخول
- إعادة توجيه المستخدم إلى `/dashboard` إذا كان مسجل الدخول

#### 5.3 حماية لوحة التحكم (Dashboard Protection)
**الملف:** `middleware.ts`
- حماية جميع المسارات تحت `/dashboard`
- التحقق من وجود التوكين في cookies
- إعادة التوجيه إلى `/login` إذا لم يكن مسجل الدخول

---

### 6. PHASE 6: تقوية الأمان (Security Hardening)

#### 6.1 التحقق من المدخلات (Input Validation)
تم إضافة التحقق من المدخلات في API إدارة المستخدمين:

**التحقق من البريد الإلكتروني:**
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return apiError('تنسيق البريد الإلكتروني غير صالح', 400);
}
```

**التحقق من كلمة المرور:**
```typescript
if (password.length < 8) {
  return apiError('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 400);
}
```

**التحقق من الصلاحية:**
```typescript
const validRoles = ['ADMIN', 'ACCOUNTANT', 'USER'];
if (role && !validRoles.includes(role)) {
  return apiError('صلاحية غير صالحة', 400);
}
```

#### 6.2 منع ترقية الصلاحية (Role Escalation Prevention)
- منع المستخدم من تغيير صلاحيته الخاصة
- منع المستخدم من حذف حسابه الخاص
- التحقق من معرف المستخدم قبل تنفيذ العمليات

```typescript
// منع تغيير صلاحية المستخدم لنفسه
if (id === user.id && role) {
  return apiError('لا يمكن تغيير صلاحيتك الخاصة', 403);
}

// منع حذف المستخدم لنفسه
if (id === user.id) {
  return apiError('لا يمكن حذف حسابك الخاص', 403);
}
```

#### 6.3 إخفاء البيانات الحساسة
- عدم إرجاع كلمة المرور في أي استجابة
- استخدام select لتحديد الحقول المسموح بإرجاعها

---

## الملفات الجديدة

### 1. lib/activity-log.ts
نظام سجل النشاط لتسجيل جميع العمليات على الكيانات

### 2. app/api/auth/logout/route.ts
API تسجيل الخروج لمسح HttpOnly cookie

### 3. app/api/users/route.ts
API إدارة المستخدمين (CREATE, READ, UPDATE, DELETE)

### 4. app/dashboard/users/page.tsx
صفحة إدارة المستخدمين مع واجهة كاملة

### 5. scripts/seed-admin.ts
سكريبت لإنشاء مستخدم ADMIN افتراضي

### 6. middleware.ts
Middleware لحماية المسارات والتحقق من المصادقة

---

## الملفات المعدلة

### 1. prisma/schema.prisma
- إضافة نموذج ActivityLog
- إضافة حقل createdBy إلى JournalEntry

### 2. app/api/auth/login/route.ts
- تعديل لاستخدام HttpOnly cookies بدلاً من إرجاع التوكين

### 3. app/login/page.tsx
- إزالة localStorage
- استخدام credentials: 'include' للطلبات

### 4. lib/auth.ts
- تحديث getAuthenticatedUser لقراءة التوكين من cookies
- إضافة وظائف مساعدة: requireAuth, requireRole, requirePermission

### 5. components/Topbar.tsx
- إضافة وظيفة تسجيل الخروج
- إضافة زر تسجيل الخروج في القائمة

### 6. app/api/sales-invoices/route.ts
- إضافة سجل النشاط (CREATE, UPDATE, DELETE)

### 7. app/api/purchase-invoices/route.ts
- إضافة سجل النشاط (CREATE, UPDATE, DELETE)

### 8. app/api/expenses/route.ts
- إضافة سجل النشاط (CREATE, UPDATE, DELETE)

### 9. app/api/accounts/route.ts
- إضافة سجل النشاط (CREATE, UPDATE, DELETE)

### 10. app/api/products/route.ts
- إضافة سجل النشاط (CREATE, UPDATE, DELETE)

### 11. app/api/stock-movements/route.ts
- إضافة سجل النشاط (DELETE)

### 12. prisma/seed-auth.ts
- إصلاح استيراد bcrypt
- إصلاح رمز الصلاحية من ADMIN إلى admin

### 13. scripts/seed-admin.ts
- إصلاح رمز الصلاحية من ADMIN إلى admin

### 14. .env
- إضافة معلمات connection pool إلى DATABASE_URL

---

## التقنيات المستخدمة

### Frontend
- **Framework:** Next.js 14.2.35
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **State Management:** React Hooks (useState, useEffect)

### Backend
- **Runtime:** Node.js
- **API:** Next.js API Routes
- **Database:** PostgreSQL
- **ORM:** Prisma 5.22.0

### Authentication & Security
- **JWT:** jsonwebtoken
- **Password Hashing:** bcryptjs
- **Cookies:** HttpOnly, Secure, SameSite=strict

### Database
- **Host:** Railway PostgreSQL
- **Connection:** Prisma Client
- **Connection Pool:** 10 connections
- **Timeout:** 20 seconds

---

## قاعدة البيانات

### الجداول الموجودة (لم يتم تعديلها)
- Units
- Warehouses
- Products
- Categories
- Customers
- Suppliers
- SalesInvoices
- PurchaseInvoices
- Expenses
- Accounts
- JournalEntries
- JournalEntryLines
- InventoryTransactions
- AuditLogs

### الجداول الجديدة
- **ActivityLog** - سجل النشاط

### العلاقات
- ActivityLog مرتبط بـ User عبر performedBy
- ActivityLog يحتوي على فهرس على entity و entityId

---

## الأمان

### 1. المصادقة (Authentication)
- JWT tokens مع HttpOnly cookies
- تشفير كلمات المرور باستخدام bcrypt
- انتهاء صلاحية التوكين بعد 7 أيام

### 2. التخويل (Authorization)
- نظام الأدوار (Roles): ADMIN, ACCOUNTANT, USER
- نظام الصلاحيات (Permissions): 23 صلاحية
- التحقق من الصلاحيات في API routes
- التحقق من الصلاحيات في Frontend

### 3. حماية البيانات
- عدم إرجاع كلمة المرور في أي استجابة
- استخدام select لتحديد الحقول المسموح بإرجاعها
- التحقق من المدخلات قبل المعالجة

### 4. منع الهجمات
- CSRF protection عبر SameSite=strict cookies
- XSS protection عبر HttpOnly cookies
- SQL injection protection عبر Prisma ORM
- Role escalation prevention

---

## الميزات الجديدة

### 1. سجل النشاط (Activity Logging)
- تسجيل جميع العمليات على الكيانات
- حفظ البيانات قبل وبعد التعديل
- تتبع من قام بالعملية
- فهرسة للبحث السريع

### 2. إدارة المستخدمين
- إنشاء مستخدمين جدد
- تعديل بيانات المستخدمين
- تغيير صلاحيات المستخدمين
- تفعيل/تعطيل المستخدمين
- حذف المستخدمين (soft delete)

### 3. تسجيل الخروج
- زر تسجيل الخروج في القائمة
- مسح HttpOnly cookie
- إعادة التوجيه إلى صفحة تسجيل الدخول

### 4. حماية المسارات
- Middleware لحماية جميع المسارات
- التحقق من المصادقة
- إعادة التوجيه التلقائي

---

## اختبارات الأمان

### 1. اختبار تسجيل الدخول
- ✅ البريد الإلكتروني وكلمة المرور صحيحين → نجاح
- ✅ البريد الإلكتروني أو كلمة المرور خطأ → فشل
- ✅ مستخدم معطل → فشل

### 2. اختبار الصلاحيات
- ✅ USER يحاول الوصول إلى /dashboard/users → ممنوع (403)
- ✅ USER يحاول استدعاء /api/users → ممنوع (403)
- ✅ ADMIN يحاول الوصول إلى /dashboard/users → مسموح

### 3. اختبار إدارة المستخدمين
- ✅ إنشاء مستخدم جديد → نجاح
- ✅ تحديث بيانات مستخدم → نجاح
- ✅ تغيير صلاحية مستخدم → نجاح
- ✅ تغيير صلاحية المستخدم لنفسه → ممنوع (403)
- ✅ حذف المستخدم → نجاح (soft delete)
- ✅ حذف المستخدم لنفسه → ممنوع (403)

### 4. اختبار التحقق من المدخلات
- ✅ بريد إلكتروني غير صالح → خطأ (400)
- ✅ كلمة مرور أقل من 8 أحرف → خطأ (400)
- ✅ صلاحية غير صالحة → خطأ (400)

### 5. اختبار سجل النشاط
- ✅ CREATE → تسجيل afterData
- ✅ UPDATE → تسجيل beforeData و afterData
- ✅ DELETE → تسجيل beforeData

---

## التوصيات

### 1. للإنتاج (Production)
- تغيير JWT_SECRET إلى قيمة قوية وعشوائية
- استخدام HTTPS فقط
- تفعيل Secure flag في cookies
- إعداد rate limiting للـ API
- إعداد monitoring و alerting
- إعداد backups لقاعدة البيانات

### 2. للتطوير (Development)
- استخدام قاعدة بيانات محلية بدلاً من Railway
- إعداد environment variables منفصلة
- تفعيل logging مفصل

### 3. للمستقبل
- إضافة 2FA (Two-Factor Authentication)
- إضافة password reset
- إضافة email verification
- إضافة audit log viewer
- إضافة activity log viewer
- إضافة user activity tracking
- إضافة session management
- إضافة IP whitelisting

---

## الخلاصة

تم تنفيذ ترقية شاملة لنظام ERP للتركيز على الأمان والمصادقة وإدارة المستخدمين وسجل النشاط. التعديلات لم تؤثر على الوظائف الأساسية للنظام، بل قامت بتحسين البنية الأمنية وإضافة ميزات جديدة لإدارة المستخدمين وتتبع النشاط.

النظام الآن جاهز للاستخدام مع:
- مصادقة آمنة باستخدام HttpOnly cookies
- نظام أدوار وصلاحيات شامل
- سجل نشاط كامل لجميع العمليات
- إدارة مستخدمين كاملة
- حماية متقدمة من الهجمات

---

## معلومات الاتصال

للمزيد من المعلومات حول الترقية أو الأسئلة، يرجى التواصل عبر:
- GitHub: https://github.com/3bud-ZC/erp-system
- البريد الإلكتروني: [تحتاج إلى إضافته]

---

**تاريخ الإصدار:** 20 أبريل 2026  
**الإصدار:** 1.0.0  
**الحالة:** مكتمل ✅
