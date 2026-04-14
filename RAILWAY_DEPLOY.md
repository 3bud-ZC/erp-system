# دليل النشر على Railway

## الخطوة 1: إعداد قاعدة البيانات على Railway

### أ. إنشاء PostgreSQL Database
1. افتح Railway Dashboard: https://railway.app/dashboard
2. اختر مشروعك (أو أنشئ مشروع جديد)
3. اضغط "New" → "Database" → "Add PostgreSQL"
4. انتظر حتى تصبح Database "Ready"
5. اضغط على الـ Database → تبويب "Connect"
6. انسخ "Postgres Connection URL" (ستبدو مثل: `postgresql://postgres:password@host:5432/railway`)

## الخطوة 2: ربط GitHub Repository

### أ. إضافة المشروع
1. في Railway Dashboard، اضغط "New" → "GitHub Repo"
2. اختر `3bud-ZC/erp-system`
3. اضغط "Add"

### ب. إعداد Environment Variables
1. اذهب إلى المشروع → "Variables"
2. أضف المتغيرات التالية:

```
DATABASE_URL=postgresql://postgres:password@host:5432/railway  (من الخطوة 1)
JWT_SECRET=erp-system-production-secret-key-2026-change-in-production
NODE_ENV=production
NEXTAUTH_SECRET=91e69c722acb1ddf08a50b766a4cd0ff688a083e3d8c2ec671e87d83dc5f93f76acfdc316a31c87926b1d8c9f88571bd8bdfb466860c6e3f476b480b2cbef14e
NEXTAUTH_URL=https://your-app-name.up.railway.app
NEXT_PUBLIC_API_URL=https://your-app-name.up.railway.app/api
```

## الخطوة 3: إعداد Build Commands

### أ. تعديل Build Settings
1. اذهب إلى المشروع → "Settings"
2. في "Build Command":
   ```
   npm ci && npx prisma generate && npx prisma db push && node scripts/deploy-demo.js && npm run build
   ```
3. في "Start Command":
   ```
   npm start
   ```
4. اضغط "Save"

## الخطوة 4: النشر

### أ. Deploy التلقائي
- Railway سينشر تلقائياً عند كل push إلى GitHub

### ب. Deploy يدوي
1. اذهب إلى المشروع
2. اضغط على القائمة (ثلاث نقاط) → "Deploy"

## الخطوة 5: التحقق بعد النشر

### أ. فحص Logs
1. اذهب إلى "Deploys"
2. اضغط على أحدث Deploy
3. راقب Logs للتأكد من:
   - ✅ "Database connected"
   - ✅ "Demo user created successfully"
   - ✅ "Build successful"

### ب. اختبار الموقع
1. افتح URL الموقع (مثلاً: `https://erp-system-production.up.railway.app`)
2. يجب أن ترى "جاري تسجيل الدخول..."
3. ثم "جاري إعداد النظام..."
4. ثم الداشبورد تعمل!

## استكشاف الأخطاء

### مشكلة: Database connection failed
**الحل**: تأكد من صحة DATABASE_URL في Variables

### مشكلة: Demo user not created
**الحل**: افتح `/setup` يدوياً في المتصفح

### مشكلة: 401 Unauthorized
**الحل**: تأكد من تطابق JWT_SECRET في .env و Railway Variables

## الدعم

إذا واجهت مشكلة، افتح الموقع مع `/setup`:
```
https://your-app-name.up.railway.app/setup
```

هذه الصفحة ستنشئ Demo User تلقائياً.
