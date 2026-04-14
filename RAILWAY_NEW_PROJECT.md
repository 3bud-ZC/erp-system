# إنشاء مشروع Railway جديد (الطريقة الصحيحة)

## الخطوة 1: إنشاء مشروع جديد

### 1.1 إنشاء Empty Project
```
Railway Dashboard → "+ New" → "Empty Project"
Name: erp-system-prod
Create
```

## الخطوة 2: إضافة الخدمات

### 2.1 إضافة PostgreSQL
```
في المشروع الجديد:
"+ New" → "Database" → "Add PostgreSQL"
انتظر حتى تصبح "Ready" (النقطة الخضراء)
```

### 2.2 إضافة GitHub Repository
```
"+ New" → "GitHub Repo"
اختر: 3bud-ZC/erp-system
Add
```

## الخطوة 3: إعداد المتغيرات (Variables)

### 3.1 المتغيرات التي تُضاف تلقائياً:
- ✅ `DATABASE_URL` (من PostgreSQL)

### 3.2 المتغيرات التي يجب إضافتها يدوياً:

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
Value: (اتركه فارغاً الآن)
```

```
Key: NEXTAUTH_URL
Value: (اتركه فارغاً الآن)
```

## الخطوة 4: إعداد Build Commands

### 4.1 الذهاب إلى Settings
```
اضغط على خدمة GitHub (erp-system)
Settings
```

### 4.2 Build Command
```
npm ci && npx prisma generate && npx prisma db push --accept-data-loss && node scripts/deploy-demo.js && npm run build
```

### 4.3 Start Command
```
npm start
```

### 4.4 حفظ الإعدادات
```
اضغط "Save"
```

## الخطوة 5: Deploy

### 5.1 سيبدأ Deploy تلقائياً
```
انتظر 5 دقائق
راقب Logs في تبويب "Deploys"
```

### 5.2 ما يجب أن تراه في Logs:
```
✓ Database connected
✓ Schema pushed successfully
✓ Demo user created successfully
✓ Build completed
✓ Server started
```

## الخطوة 6: الحصول على الرابط وتحديث المتغيرات

### 6.1 نسخ الرابط
```
في أعلى الصفحة، ستجد رابط مثل:
https://erp-system-prod-production.up.railway.app
```

### 6.2 تحديث Variables
```
عدل NEXT_PUBLIC_API_URL:
https://erp-system-prod-production.up.railway.app/api

عدل NEXTAUTH_URL:
https://erp-system-prod-production.up.railway.app
```

### 6.3 Redeploy
```
Deploys → القائمة (ثلاث نقاط) → Redeploy
```

## الخطوة 7: تشغيل الإعداد

### 7.1 فتح صفحة الإعداد
```
https://erp-system-prod-production.up.railway.app/api/init
```

يجب أن ترى:
```json
{
  "success": true,
  "message": "Database initialized successfully",
  "data": {
    "demoUser": {
      "email": "demo@erp-system.com",
      "password": "demo12345"
    }
  }
}
```

### 7.2 اختبار الموقع
```
https://erp-system-prod-production.up.railway.app/dashboard
```

يجب أن يعمل 100%!

## حذف المشاريع القديمة

بعد التأكد من نجاح المشروع الجديد:
```
حذف shimmering-contentment
حذف brilliant-flexibility
```

## ✅ النتيجة

- ✅ مشروع واحد: erp-system-prod
- ✅ داخله: PostgreSQL + GitHub Repo
- ✅ كل شيء مرتبط ويعمل
- ✅ البيانات تعمل 100%
