# Railway PostgreSQL Setup Guide

## الاستخدام الحصري لـ Railway PostgreSQL

### ✅ الخطوات المطلوبة:

## 1. إعداد قاعدة البيانات (تم ✅)

**Postgres معلومات الاتصال:**
```
Host: gondola.proxy.rlwy.net
Port: 53243
Database: railway
User: postgres
Password: KPCNiHqMupbAVMKVKBxsxkYqvndlPNYw
```

**URL كامل:**
```
postgresql://postgres:KPCNiHqMupbAVMKVKBxsxkYqvndlPNYw@gondola.proxy.rlwy.net:53243/railway
```

## 2. إعداد ERP-SYSTEM Project

### أ. تعديل DATABASE_URL
**في Railway Dashboard → erp-system → Variables:**

**احذف القديم:**
- ❌ `DATABASE_URL` (القديم - Neon)

**أضف الجديد:**
```
Key: DATABASE_URL
Value: postgresql://postgres:KPCNiHqMupbAVMKVKBxsxkYqvndlPNYw@gondola.proxy.rlwy.net:53243/railway
```

### ب. تعديل NEXT_PUBLIC_API_URL
```
Key: NEXT_PUBLIC_API_URL
Value: ${{RAILWAY_STATIC_URL}}/api
# أو انتظر حتى يُنشأ الرابط ثم عدله
```

### ج. تعديل NEXTAUTH_URL
```
Key: NEXTAUTH_URL
Value: ${{RAILWAY_STATIC_URL}}
# أو انتظر حتى يُنشأ الرابط ثم عدله
```

## 3. Deploy مرة أخرى

بعد تحديث Variables:
1. اذهب إلى Deploys
2. اضغط على القائمة (3 نقاط) → "Redeploy"
3. انتظر 3-5 دقائق

## 4. التحقق من النجاح

### أ. فحص Logs:
يجب أن ترى:
```
✓ Database connected successfully
✓ Pushed schema to Railway PostgreSQL
✓ Demo user created
✓ Build completed
```

### ب. اختبار الموقع:
1. افتح الرابط (مثلاً: `https://erp-system-production.up.railway.app`)
2. يجب أن تعمل الداشبورد 100%

## 🔧 استكشاف الأخطاء

### مشكلة: Database connection failed
**الحل:** تأكد من صحة DATABASE_URL في Variables

### مشكلة: جداول غير موجودة
**الحل:** تأكد أن `prisma db push` يعمل في Build Command

### مشكلة: 401 Unauthorized
**الحل:** افتح `/setup` يدوياً:
```
https://your-app.up.railway.app/setup
```

## 🎉 النتيجة المتوقعة

بعد النجاح:
- ✅ قاعدة بيانات Railway PostgreSQL تعمل
- ✅ Demo User موجود في Railway DB
- ✅ جميع البيانات في Railway (لا Neon)
- ✅ الموقع يعمل 100% بدون أخطاء
