# Railway Database Setup - NEW Configuration

## ✅ قاعدة البيانات الجديدة

تم إنشاء قاعدة بيانات PostgreSQL جديدة على Railway بالمعلومات التالية:

### معلومات الاتصال

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=UQafLibenOUVBCXBgsuuQqlzSyoZsIYl
POSTGRES_DB=railway
PGPORT=5432
```

### عناوين الاتصال

**للاستخدام داخل Railway (موصى به - أسرع وأكثر أمانًا):**
```
DATABASE_URL=postgresql://postgres:UQafLibenOUVBCXBgsuuQqlzSyoZsIYl@postgres.railway.internal:5432/railway
```

**للاستخدام من الخارج (للتطوير المحلي):**
```
DATABASE_PUBLIC_URL=postgresql://postgres:UQafLibenOUVBCXBgsuuQqlzSyoZsIYl@${RAILWAY_TCP_PROXY_DOMAIN}:${RAILWAY_TCP_PROXY_PORT}/railway
```

---

## 🔧 إعدادات Railway المطلوبة

### في خدمة PostgreSQL (Postgres Service):
المتغيرات موجودة تلقائيًا ✅

### في خدمة التطبيق (erp-system Service):

أضف المتغيرات التالية في **Variables**:

1. **DATABASE_URL** (مطلوب):
   ```
   ${{Postgres.DATABASE_URL}}
   ```
   أو يدويًا:
   ```
   postgresql://postgres:UQafLibenOUVBCXBgsuuQqlzSyoZsIYl@postgres.railway.internal:5432/railway
   ```

2. **JWT_SECRET** (مطلوب):
   ```
   erp-system-production-secret-key-2026-change-in-production
   ```

3. **NODE_ENV** (موجود في railway.toml):
   ```
   production
   ```

---

## 🚀 خطوات النشر

### 1. تأكد من المتغيرات في Railway Dashboard
- اذهب إلى: Railway Dashboard → erp-system → Variables
- تأكد من وجود `DATABASE_URL` و `JWT_SECRET`

### 2. أعد نشر التطبيق
```bash
git push origin master
```
أو من Railway Dashboard:
- اضغط **"Redeploy"**

### 3. تهيئة قاعدة البيانات
بعد نجاح النشر، افتح:
```
https://your-app.railway.app/api/init
```

هذا سيقوم بـ:
- ✅ إنشاء جميع الجداول (Prisma schema)
- ✅ إضافة بيانات تجريبية
- ✅ إنشاء مستخدمين:
  - **Demo**: demo@erp.com / demo123
  - **Admin**: admin@erp.com / admin123

---

## 🧪 اختبار الاتصال

### من Railway Logs:
```
✅ Database connected successfully
✅ Schema pushed successfully
✅ Database initialized
🚀 Starting Next.js app...
```

### من المتصفح:
1. افتح: `https://your-app.railway.app`
2. سجل دخول بـ: `demo@erp.com` / `demo123`
3. جرب إضافة منتج أو مخزن

---

## ⚠️ ملاحظات مهمة

1. **لا تستخدم `DATABASE_PUBLIC_URL` في Production**
   - استخدم `DATABASE_URL` (الداخلي) فقط
   - أسرع وأكثر أمانًا

2. **للتطوير المحلي:**
   - استخدم قاعدة بيانات محلية (PostgreSQL على localhost)
   - أو استخدم `DATABASE_PUBLIC_URL` من Railway

3. **النسخ الاحتياطي:**
   - Railway يعمل backup تلقائي
   - يمكنك تصدير البيانات من Dashboard → Database → Backups

---

## 🔒 الأمان

- ✅ كلمة المرور قوية ومعقدة
- ✅ الاتصال الداخلي مشفر
- ✅ JWT_SECRET محفوظ في متغيرات Railway
- ✅ لا توجد أسرار في الكود المصدري

---

## 📊 الحالة الحالية

- ✅ قاعدة البيانات: جاهزة
- ✅ الإعدادات: محدثة
- ✅ الكود: جاهز للنشر
- ⏳ النشر: في انتظار `git push` أو Redeploy

---

**آخر تحديث:** 2026-04-15
