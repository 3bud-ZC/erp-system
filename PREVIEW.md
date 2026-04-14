# 🔍 دليل معاينة النظام

## الفحص الشامل قبل النشر

### 1. تشغيل المعاينة محلياً

```bash
# تثبيت Dependencies
npm install

# تشغيل Prisma generate
npx prisma generate

# تشغيل التطبيق
npm run dev
```

### 2. فتح صفحة المعاينة

افتح المتصفح على:
```
http://localhost:3000/preview
```

### 3. خطوات المراجعة

| الخطوة | الرابط | الحالة المطلوبة |
|--------|--------|-----------------|
| ✅ فحص قاعدة البيانات | `/api/health/detailed` | Database: true, all tables: true |
| ✅ تهيئة الجداول | `/api/init` | `{"success": true}` |
| ✅ اختبار تسجيل الدخول | `/login` | يعمل بدون أخطاء |
| ✅ اختبار لوحة التحكم | `/dashboard` | يعرض البيانات بدون أخطاء |
| ✅ اختبار API المنتجات | `/api/products` | يعيد قائمة المنتجات |
| ✅ اختبار API المخازن | `/api/warehouses` | يعيد قائمة المخازن |

### 4. حل المشاكل الشائعة

#### المشكلة: `Table does not exist` (P2021)
```
الحل: افتح /api/init أو /preview واضغط "تهيئة قاعدة البيانات"
```

#### المشكلة: `Database connection failed`
```
الحل: تأكد من:
1. متغير DATABASE_URL مضبوط في Railway
2. خدمة PostgreSQL تعمل
3. الاتصال بالإنترنت متاح
```

#### المشكلة: `Dashboard not loading`
```
الحل: صفحة الداشبورد الآن تعمل حتى بدون جداول (تعيد صفر)
```

### 5. معلومات المستخدم التجريبي

```
Email: demo@erp-system.com
Password: demo12345
```

### 6. روابط مهمة على Railway

| الرابط | الوصف |
|--------|-------|
| `https://erp-system-production-d4e2.up.railway.app/preview` | صفحة المعاينة |
| `https://erp-system-production-d4e2.up.railway.app/api/health` | API الصحة |
| `https://erp-system-production-d4e2.up.railway.app/api/init` | تهيئة الداتابيس |

---

## ✅ قائمة التحقق قبل النشر

- [ ] صفحة `/preview` تعرض "النظام يعمل بكفاءة"
- [ ] `/api/init` يعيد `success: true`
- [ ] تسجيل الدخول يعمل
- [ ] الداشبورد تعرض البيانات
- [ ] إضافة منتج جديد يعمل
- [ ] إضافة فاتورة بيع يعمل

---

**تاريخ آخر تحديث:** $(date)
