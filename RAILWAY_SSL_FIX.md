# إصلاح مشكلة SSL في Railway PostgreSQL

## ❌ المشكلة:
```
could not accept SSL connection: unsupported protocol
could not accept SSL connection: no application protocol
```

---

## ✅ الحل:

### 1. تعديل DATABASE_URL في Railway:

في Railway Dashboard → **erp-system** → **Variables**:

**بدلاً من:**
```
DATABASE_URL=${{Postgres-0ppC.DATABASE_URL}}
```

**استخدم:**
```
DATABASE_URL=${{Postgres-0ppC.DATABASE_PRIVATE_URL}}?sslmode=require
```

**أو يدويًا:**
```
DATABASE_URL=postgresql://postgres:password@postgres-0ppc.railway.internal:5432/railway?sslmode=require
```

---

### 2. Redeploy:

1. احفظ المتغيرات
2. اضغط **"Redeploy"**
3. انتظر 2-3 دقائق

---

## 📋 ملاحظات:

- ✅ `sslmode=require` يجبر Prisma على استخدام SSL صحيح
- ✅ `DATABASE_PRIVATE_URL` أسرع من `DATABASE_URL` (internal network)
- ✅ Railway PostgreSQL يحتاج SSL mode محدد

---

## 🎯 البديل (إذا لم ينجح):

استخدم `sslmode=disable` للتطوير فقط:
```
DATABASE_URL=postgresql://postgres:password@postgres-0ppc.railway.internal:5432/railway?sslmode=disable
```

**⚠️ تحذير:** `sslmode=disable` غير آمن للإنتاج!

