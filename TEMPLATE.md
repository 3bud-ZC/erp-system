# 🎨 **قالب موحد لجميع صفحات النظام**

## **المعايير الموحدة:**

### **1. التحسينات التقنية الإلزامية:**
```typescript
✅ Timeout: 30s لكل API call
✅ Cache control: no-store
✅ Array safety: Array.isArray() checks
✅ Error handling: رسائل واضحة بالعربي
✅ Loading state: spinner محسّن
✅ Form validation: التحقق من البيانات
```

### **2. Auto-Generation (حسب نوع الصفحة):**
```typescript
// فواتير البيع
INV-YYYYMMDD-XXX

// أوامر البيع
SO-YYYYMMDD-XXX

// فواتير الشراء
PINV-YYYYMMDD-XXX

// أوامر الشراء
PO-YYYYMMDD-XXX

// أوامر الإنتاج
PROD-YYYYMMDD-XXX

// المصروفات
EXP-YYYYMMDD-XXX
```

### **3. Auto-Fill:**
```typescript
✅ السعر من بيانات المنتج
✅ حساب الإجمالي تلقائياً
✅ حساب الضريبة تلقائياً (إن وجدت)
✅ حساب الخصم تلقائياً (إن وجد)
```

### **4. الإحصائيات الموحدة:**
```typescript
✅ إجمالي العدد
✅ حالات مختلفة (حسب نوع الصفحة)
✅ إجمالي القيمة
✅ بطاقات ملونة واضحة
```

### **5. الثيم الموحد:**
```typescript
// Colors
- Primary: blue-600
- Success: green-600
- Warning: yellow-600
- Danger: red-600
- Info: purple-600

// Status Colors
- pending: yellow
- confirmed: blue
- completed: green
- cancelled: red
- shipped: purple
- delivered: green

// Spacing
- p-6 للصفحات
- space-y-6 بين الأقسام
- gap-4 للـ grid

// Borders
- rounded-lg للكروت
- border border-gray-200

// Shadows
- shadow-sm للكروت
```

### **6. الواجهة الموحدة:**
```typescript
✅ Header: العنوان + الوصف + أزرار (تحديث + إضافة)
✅ Stats Cards: 4-5 بطاقات إحصائية
✅ Search: بحث واضح
✅ Table: جدول منظم
✅ Modal: نموذج كبير (max-w-4xl)
✅ Loading: spinner محسّن
```

### **7. الأيقونات الموحدة:**
```typescript
- Plus: إضافة
- Edit: تعديل
- Trash2: حذف
- RefreshCw: تحديث
- Search: بحث
- Clock: قيد الانتظار
- CheckCircle2: مكتمل/مؤكد
- AlertCircle: تحذير/ملغي
- Package: منتج/شحن
- User: عميل/مورد
- Calendar: تاريخ
- DollarSign: مبلغ
```

---

## **الصفحات المطلوب تحسينها:**

### **المبيعات:**
- [x] أوامر البيع ✅
- [ ] فواتير البيع
- [ ] العملاء

### **المشتريات:**
- [ ] أوامر الشراء
- [ ] فواتير الشراء
- [ ] الموردين
- [ ] المصروفات

### **المخزون:**
- [x] المنتجات ✅
- [ ] المواد الخام
- [x] المخازن ✅

### **التصنيع:**
- [x] أوامر الإنتاج ✅
- [x] عمليات الإنتاج ✅
- [ ] دراسة التكاليف

---

## **الأولويات:**

1. **عالية:** فواتير البيع، فواتير الشراء، المواد الخام
2. **متوسطة:** العملاء، الموردين، المصروفات
3. **منخفضة:** دراسة التكاليف، التقارير
