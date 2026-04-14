# Railway PostgreSQL - الإعداد النهائي

## ✅ استخدام Railway PostgreSQL حصريًا

---

## 🔧 الخطوات المطلوبة الآن:

### 1. تحديث Variables في Railway

**أ. احذف المتغيرات القديمة (إذا وجدت):**
- ❌ احذف أي `DATABASE_URL` يشير إلى Neon (aws.neon.tech)

**ب. أضف المتغيرات الجديدة:**

```
Key: DATABASE_URL
Value: postgresql://postgres:KPCNiHqMupbAVMKVKBxsxkYqvndlPNYw@gondola.proxy.rlwy.net:53243/railway
```

```
Key: JWT_SECRET  
Value: erp-system-production-secret-key-2026-change-in-production
```

```
Key: NODE_ENV
Value: production
```

```
Key: NEXTAUTH_SECRET
Value: 91e69c722acb1ddf08a50b766a4cd0ff688a083e3d8c2ec671e87d83dc5f93f76acfdc316a31c87926b1d8c9f88571bd8bdfb466860c6e3f476b480b2cbef14e
```

```
Key: NEXT_PUBLIC_API_URL
Value: (اتركه فارغاً الآن، سنملأه بعد إنشاء الرابط)
```

```
Key: NEXTAUTH_URL
Value: (اتركه فارغاً الآن، سنملأه بعد إنشاء الرابط)
```

---

### 2. Redeploy

**في Railway Dashboard:**
1. اذهب إلى مشروع `erp-system`
2. اضغط على القائمة (ثلاث نقاط) → **"Redeploy"**
3. انتظر **5 دقائق**

---

### 3. الحصول على الرابط

بعد نجاح Deploy:
1. ستجد رابط الموقع في أعلى الصفحة
2. سيبدو مثل: `https://erp-system-production.up.railway.app`

---

### 4. تحديث NEXT_PUBLIC_API_URL و NEXTAUTH_URL

**عدل المتغيرات:**

```
Key: NEXT_PUBLIC_API_URL
Value: https://erp-system-production.up.railway.app/api
```

```
Key: NEXTAUTH_URL
Value: https://erp-system-production.up.railway.app
```

**ثم اضغط "Redeploy" مرة أخرى**

---

## ✅ التحقق من النجاح

### فحص Logs:
يجب أن ترى:
```
✓ Database connected to Railway PostgreSQL
✓ Schema pushed successfully
✓ Demo user created
✓ Build completed
✓ Server started
```

### فحص الموقع:
1. افتح الرابط
2. يجب أن ترى:
   - "جاري تسجيل الدخول..."
   - ثم "جاري إعداد النظام..."
   - ثم الداشبورد تعمل!

---

## 🔧 إذا واجهت مشكلة:

### المشكلة: Database connection failed
**الحل:** تأكد من صحة DATABASE_URL

### المشكلة: 401 Unauthorized
**الحل:** افتح `/setup` يدوياً:
```
https://your-app.up.railway.app/setup
```

### المشكلة: خطأ 500
**الحل:** افتح Logs في Railway وابحث عن الخطأ

---

## 🎉 بعد النجاح:

ستكون جميع البيانات في **Railway PostgreSQL** فقط - لا Neon!

