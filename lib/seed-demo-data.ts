/**
 * Demo data seeder — runs once per tenant after onboarding.
 * All codes are suffixed with a tenant-unique token to avoid global unique conflicts.
 */
import { prisma } from './db';

interface SeedResult {
  warehouses: number;
  customers: number;
  suppliers: number;
  products: number;
  salesInvoices: number;
  purchaseInvoices: number;
}

export async function seedDemoData(tenantId: string): Promise<SeedResult> {
  // Short unique suffix so codes never clash across tenants
  const s = Date.now().toString(36).toUpperCase().slice(-6);

  // ── 1. WAREHOUSES ──────────────────────────────────────────────────────────
  const [wh1, wh2] = await Promise.all([
    prisma.warehouse.create({
      data: {
        code: `WH-MAIN-${s}`,
        nameAr: 'المستودع الرئيسي',
        nameEn: 'Main Warehouse',
        address: 'الرياض، المملكة العربية السعودية',
        tenantId,
      },
    }),
    prisma.warehouse.create({
      data: {
        code: `WH-SEC-${s}`,
        nameAr: 'المستودع الثانوي',
        nameEn: 'Secondary Warehouse',
        address: 'جدة، المملكة العربية السعودية',
        tenantId,
      },
    }),
  ]);

  // ── 2. CUSTOMERS ───────────────────────────────────────────────────────────
  const customerData = [
    { code: `CUS-001-${s}`, nameAr: 'شركة الأفق للتجارة',      nameEn: 'Horizon Trading Co.',     phone: '0501234567', email: 'info@horizon.sa',     creditLimit: 50000 },
    { code: `CUS-002-${s}`, nameAr: 'مؤسسة النجوم',            nameEn: 'Al-Nujoom Est.',           phone: '0551234567', email: 'orders@nujoom.sa',    creditLimit: 30000 },
    { code: `CUS-003-${s}`, nameAr: 'شركة الريادة التقنية',    nameEn: 'Riyadah Tech Co.',         phone: '0561234567', email: 'sales@riyadah.sa',    creditLimit: 75000 },
    { code: `CUS-004-${s}`, nameAr: 'مجموعة الخليج للأعمال',  nameEn: 'Gulf Business Group',      phone: '0521234567', email: 'gulfbiz@email.sa',    creditLimit: 100000 },
    { code: `CUS-005-${s}`, nameAr: 'شركة المدار التجارية',   nameEn: 'Al-Madar Commerce',        phone: '0531234567', email: 'info@almadar.sa',     creditLimit: 45000 },
    { code: `CUS-006-${s}`, nameAr: 'مؤسسة الإبداع',          nameEn: 'Ibda Est.',                phone: '0541234567', email: 'contact@ibda.sa',     creditLimit: 25000 },
    { code: `CUS-007-${s}`, nameAr: 'شركة رواد الصناعة',      nameEn: 'Industry Leaders Co.',     phone: '0581234567', email: 'info@rowad.sa',       creditLimit: 60000 },
  ];

  const customers = await Promise.all(
    customerData.map(c => prisma.customer.create({ data: { ...c, tenantId } }))
  );

  // ── 3. SUPPLIERS ───────────────────────────────────────────────────────────
  const supplierData = [
    { code: `SUP-001-${s}`, nameAr: 'شركة المصادر الدولية',  nameEn: 'Global Sources Co.',       phone: '0112345678', email: 'supply@globalsrc.sa', creditLimit: 200000 },
    { code: `SUP-002-${s}`, nameAr: 'مورد الجزيرة',          nameEn: 'Al-Jazeera Supplier',      phone: '0122345678', email: 'orders@jazeerasup.sa', creditLimit: 150000 },
    { code: `SUP-003-${s}`, nameAr: 'شركة الوفاء للتوريد',   nameEn: 'Al-Wafa Supply Co.',       phone: '0132345678', email: 'info@wafa-supply.sa', creditLimit: 100000 },
    { code: `SUP-004-${s}`, nameAr: 'مؤسسة التوريد السريع',  nameEn: 'Fast Supply Est.',         phone: '0142345678', email: 'fast@supply.sa',      creditLimit: 80000 },
  ];

  const suppliers = await Promise.all(
    supplierData.map(s_ => prisma.supplier.create({ data: { ...s_, tenantId } }))
  );

  // ── 4. PRODUCTS ────────────────────────────────────────────────────────────
  const productData = [
    { code: `PRD-001-${s}`, nameAr: 'حاسوب محمول Dell Latitude',  nameEn: 'Dell Latitude Laptop',    type: 'finished_product', unit: 'قطعة',  price: 3500, cost: 2800, stock: 25, minStock: 5,  warehouseId: wh1.id },
    { code: `PRD-002-${s}`, nameAr: 'طابعة HP LaserJet',           nameEn: 'HP LaserJet Printer',     type: 'finished_product', unit: 'قطعة',  price: 1200, cost: 900,  stock: 15, minStock: 3,  warehouseId: wh1.id },
    { code: `PRD-003-${s}`, nameAr: 'شاشة Samsung 27 بوصة',        nameEn: 'Samsung 27" Monitor',     type: 'finished_product', unit: 'قطعة',  price: 1800, cost: 1400, stock: 20, minStock: 4,  warehouseId: wh1.id },
    { code: `PRD-004-${s}`, nameAr: 'لوحة مفاتيح لاسلكية',         nameEn: 'Wireless Keyboard',       type: 'finished_product', unit: 'قطعة',  price: 250,  cost: 180,  stock: 50, minStock: 10, warehouseId: wh1.id },
    { code: `PRD-005-${s}`, nameAr: 'ماوس لاسلكي',                  nameEn: 'Wireless Mouse',          type: 'finished_product', unit: 'قطعة',  price: 150,  cost: 100,  stock: 60, minStock: 10, warehouseId: wh1.id },
    { code: `PRD-006-${s}`, nameAr: 'كرسي مكتبي مريح',             nameEn: 'Ergonomic Office Chair',  type: 'finished_product', unit: 'قطعة',  price: 850,  cost: 600,  stock: 30, minStock: 5,  warehouseId: wh2.id },
    { code: `PRD-007-${s}`, nameAr: 'مكتب خشبي بجوارير',           nameEn: 'Wooden Desk with Drawers',type: 'finished_product', unit: 'قطعة',  price: 1500, cost: 1100, stock: 12, minStock: 2,  warehouseId: wh2.id },
    { code: `PRD-008-${s}`, nameAr: 'خزانة ملفات معدنية',          nameEn: 'Metal Filing Cabinet',    type: 'finished_product', unit: 'قطعة',  price: 600,  cost: 420,  stock: 18, minStock: 3,  warehouseId: wh2.id },
    { code: `PRD-009-${s}`, nameAr: 'ورق طباعة A4 - رزمة',         nameEn: 'A4 Printing Paper Pack',  type: 'raw_material',     unit: 'رزمة', price: 45,   cost: 30,   stock: 200,minStock: 50, warehouseId: wh1.id },
    { code: `PRD-010-${s}`, nameAr: 'حبر طابعة أسود',               nameEn: 'Black Printer Ink',       type: 'raw_material',     unit: 'علبة', price: 85,   cost: 60,   stock: 80, minStock: 20, warehouseId: wh1.id },
    { code: `PRD-011-${s}`, nameAr: 'فلاشة USB 64GB',               nameEn: 'USB Flash Drive 64GB',    type: 'finished_product', unit: 'قطعة',  price: 75,   cost: 50,   stock: 100,minStock: 20, warehouseId: wh1.id },
    { code: `PRD-012-${s}`, nameAr: 'كابل HDMI 2 متر',              nameEn: 'HDMI Cable 2m',           type: 'finished_product', unit: 'قطعة',  price: 35,   cost: 20,   stock: 150,minStock: 30, warehouseId: wh1.id },
  ];

  const products = await Promise.all(
    productData.map(p => prisma.product.create({ data: { ...p, tenantId } }))
  );

  // ── 5. SALES INVOICES ──────────────────────────────────────────────────────
  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);

  const salesInvoicesRaw = [
    {
      invoiceNumber: `INV-S-001-${s}`,
      customerId: customers[0].id,
      date: daysAgo(3),
      status: 'paid',
      paymentStatus: 'paid',
      notes: 'دفع كامل',
      items: [
        { productId: products[0].id, quantity: 3, price: products[0].price },
        { productId: products[3].id, quantity: 5, price: products[3].price },
        { productId: products[4].id, quantity: 5, price: products[4].price },
      ],
    },
    {
      invoiceNumber: `INV-S-002-${s}`,
      customerId: customers[2].id,
      date: daysAgo(7),
      status: 'paid',
      paymentStatus: 'paid',
      notes: 'طلب دوري',
      items: [
        { productId: products[1].id, quantity: 2, price: products[1].price },
        { productId: products[2].id, quantity: 2, price: products[2].price },
        { productId: products[11].id, quantity: 10, price: products[11].price },
      ],
    },
    {
      invoiceNumber: `INV-S-003-${s}`,
      customerId: customers[3].id,
      date: daysAgo(14),
      status: 'paid',
      paymentStatus: 'paid',
      notes: 'فاتورة شركة الخليج',
      items: [
        { productId: products[5].id, quantity: 10, price: products[5].price },
        { productId: products[6].id, quantity: 5,  price: products[6].price },
        { productId: products[7].id, quantity: 5,  price: products[7].price },
      ],
    },
    {
      invoiceNumber: `INV-S-004-${s}`,
      customerId: customers[1].id,
      date: daysAgo(1),
      status: 'pending',
      paymentStatus: 'credit',
      notes: 'قيد المراجعة',
      items: [
        { productId: products[10].id, quantity: 20, price: products[10].price },
        { productId: products[8].id,  quantity: 50, price: products[8].price },
      ],
    },
    {
      invoiceNumber: `INV-S-005-${s}`,
      customerId: customers[4].id,
      date: daysAgo(21),
      status: 'paid',
      paymentStatus: 'paid',
      notes: 'طلب شهري',
      items: [
        { productId: products[0].id, quantity: 2, price: products[0].price },
        { productId: products[2].id, quantity: 3, price: products[2].price },
        { productId: products[9].id, quantity: 10, price: products[9].price },
      ],
    },
  ];

  const salesInvoices = await Promise.all(
    salesInvoicesRaw.map(async (inv) => {
      const itemTotals = inv.items.map(i => ({ ...i, total: i.quantity * i.price }));
      const subTotal = itemTotals.reduce((sum, i) => sum + i.total, 0);
      const taxAmt = Math.round(subTotal * 0.15 * 100) / 100;
      const grandTotal = subTotal + taxAmt;

      const invoice = await prisma.salesInvoice.create({
        data: {
          invoiceNumber: inv.invoiceNumber,
          customerId: inv.customerId,
          date: inv.date,
          tenantId,
          status: inv.status,
          paymentStatus: inv.paymentStatus,
          paidAmount: inv.paymentStatus === 'paid' ? grandTotal : 0,
          notes: inv.notes,
          total: subTotal,
          tax: taxAmt,
          grandTotal,
          items: {
            create: itemTotals.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
              total: i.total,
            })),
          },
        },
      });
      return invoice;
    })
  );

  // ── 6. PURCHASE INVOICES ───────────────────────────────────────────────────
  const purchaseInvoicesRaw = [
    {
      invoiceNumber: `INV-P-001-${s}`,
      supplierId: suppliers[0].id,
      date: daysAgo(10),
      status: 'paid',
      paymentStatus: 'paid',
      notes: 'مشتريات دورية',
      items: [
        { productId: products[0].id, quantity: 10, price: products[0].cost },
        { productId: products[1].id, quantity: 5,  price: products[1].cost },
      ],
    },
    {
      invoiceNumber: `INV-P-002-${s}`,
      supplierId: suppliers[1].id,
      date: daysAgo(18),
      status: 'paid',
      paymentStatus: 'paid',
      notes: 'توريد أثاث',
      items: [
        { productId: products[5].id, quantity: 15, price: products[5].cost },
        { productId: products[6].id, quantity: 8,  price: products[6].cost },
        { productId: products[7].id, quantity: 10, price: products[7].cost },
      ],
    },
    {
      invoiceNumber: `INV-P-003-${s}`,
      supplierId: suppliers[2].id,
      date: daysAgo(2),
      status: 'pending',
      paymentStatus: 'credit',
      notes: 'قيد الاستلام',
      items: [
        { productId: products[8].id,  quantity: 100, price: products[8].cost },
        { productId: products[9].id,  quantity: 50,  price: products[9].cost },
        { productId: products[10].id, quantity: 60,  price: products[10].cost },
      ],
    },
  ];

  const purchaseInvoices = await Promise.all(
    purchaseInvoicesRaw.map(async (inv) => {
      const itemTotals = inv.items.map(i => ({ ...i, total: i.quantity * i.price }));
      const total = itemTotals.reduce((sum, i) => sum + i.total, 0);

      const invoice = await prisma.purchaseInvoice.create({
        data: {
          invoiceNumber: inv.invoiceNumber,
          supplierId: inv.supplierId,
          date: inv.date,
          tenantId,
          status: inv.status,
          paymentStatus: inv.paymentStatus,
          paidAmount: inv.paymentStatus === 'paid' ? total : 0,
          notes: inv.notes,
          total,
          items: {
            create: itemTotals.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
              total: i.total,
            })),
          },
        },
      });
      return invoice;
    })
  );

  return {
    warehouses: 2,
    customers: customers.length,
    suppliers: suppliers.length,
    products: products.length,
    salesInvoices: salesInvoices.length,
    purchaseInvoices: purchaseInvoices.length,
  };
}
