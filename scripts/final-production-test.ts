/**
 * FINAL PRODUCTION TEST
 * 
 * Real factory workflow simulation for single-user ERP system
 */

import { prisma } from '../lib/db';
import { createSalesInvoiceAtomic } from '../lib/erp-execution-engine/services/atomic-transaction-service';
import { createPurchaseInvoiceAtomic } from '../lib/erp-execution-engine/services/atomic-transaction-service';

const TENANT_ID = 'factory-001';
const USER_ID = 'factory-user';

// Simple realistic data
const CUSTOMERS = [
  { code: 'CUST001', nameAr: 'شركة النور', nameEn: 'Al-Noor Co.' },
  { code: 'CUST002', nameAr: 'مؤسسة الأمل', nameEn: 'Al-Amal Est.' },
  { code: 'CUST003', nameAr: 'متجر الفجر', nameEn: 'Al-Fajr Store' },
  { code: 'CUST004', nameAr: 'شركة البناء', nameEn: 'Construction Co.' },
  { code: 'CUST005', nameAr: 'مكتب الهندسة', nameEn: 'Engineering Office' },
];

const SUPPLIERS = [
  { code: 'SUPP001', nameAr: 'مصنع الجودة', nameEn: 'Quality Factory' },
  { code: 'SUPP002', nameAr: 'شركة الاستيراد', nameEn: 'Import Co.' },
  { code: 'SUPP003', nameAr: 'مورد المواد', nameEn: 'Materials Supplier' },
  { code: 'SUPP004', nameAr: 'مصنع الإلكترونيات', nameEn: 'Electronics Factory' },
  { code: 'SUPP005', nameAr: 'وكيل الماركات', nameEn: 'Brands Agent' },
];

const PRODUCTS = [
  { code: 'PROD001', nameAr: 'لابتوب HP', nameEn: 'HP Laptop', price: 3500, cost: 2800, stock: 20 },
  { code: 'PROD002', nameAr: 'طابعة Canon', nameEn: 'Canon Printer', price: 450, cost: 320, stock: 30 },
  { code: 'PROD003', nameAr: 'شاشة Samsung', nameEn: 'Samsung Monitor', price: 800, cost: 600, stock: 25 },
  { code: 'PROD004', nameAr: 'كرسي مكتب', nameEn: 'Office Chair', price: 650, cost: 450, stock: 40 },
  { code: 'PROD005', nameAr: 'مكتب خشبي', nameEn: 'Wooden Desk', price: 1200, cost: 850, stock: 15 },
  { code: 'PROD006', nameAr: 'هاتف iPhone', nameEn: 'iPhone', price: 4200, cost: 3500, stock: 10 },
  { code: 'PROD007', nameAr: 'سماعات Bose', nameEn: 'Bose Headphones', price: 280, cost: 200, stock: 50 },
  { code: 'PROD008', nameAr: 'ماوس لاسلكي', nameEn: 'Wireless Mouse', price: 45, cost: 28, stock: 100 },
  { code: 'PROD009', nameAr: 'لوحة مفاتيح', nameEn: 'Keyboard', price: 120, cost: 80, stock: 60 },
  { code: 'PROD010', nameAr: 'كاميرا Canon', nameEn: 'Canon Camera', price: 2800, cost: 2200, stock: 12 },
];

let stats = {
  customersCreated: 0,
  suppliersCreated: 0,
  productsCreated: 0,
  salesInvoices: 0,
  purchaseInvoices: 0,
  errors: [] as string[],
};

async function cleanupExistingData() {
  console.log('🧹 Cleaning existing test data...\n');
  
  try {
    await prisma.journalEntryLine.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.inventoryTransaction.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.salesInvoiceItem.deleteMany({ where: { salesInvoice: { tenantId: TENANT_ID } } });
    await prisma.salesInvoice.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.purchaseInvoiceItem.deleteMany({ where: { purchaseInvoice: { tenantId: TENANT_ID } } });
    await prisma.purchaseInvoice.deleteMany({ where: { tenantId: TENANT_ID } });
    console.log('✅ Cleanup complete\n');
  } catch (error: any) {
    console.log(`⚠️  Cleanup warning: ${error.message}\n`);
  }
}

async function setupTenant() {
  console.log('🏭 Setting up factory tenant...\n');
  
  let tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        id: TENANT_ID,
        tenantCode: 'FACTORY001',
        name: 'Factory ERP System',
        nameAr: 'نظام تخطيط موارد المصنع',
        email: 'factory@erp.local',
        status: 'active',
        subscriptionPlan: 'enterprise',
      },
    });
  }
  
  const { seedChartOfAccounts } = await import('../lib/accounting');
  await seedChartOfAccounts(TENANT_ID);
  console.log('✅ Tenant ready\n');
}

async function createMasterData() {
  console.log('📋 Creating master data...\n');
  
  // Customers
  for (const customer of CUSTOMERS) {
    try {
      await prisma.customer.upsert({
        where: { code: customer.code },
        update: {},
        create: {
          code: customer.code,
          nameAr: customer.nameAr,
          nameEn: customer.nameEn,
          phone: '+966 XX XXX XXXX',
          email: `${customer.code.toLowerCase()}@customer.local`,
          creditLimit: 50000,
          tenantId: TENANT_ID,
        },
      });
      stats.customersCreated++;
    } catch (error: any) {
      stats.errors.push(`Customer ${customer.code}: ${error.message}`);
    }
  }
  
  // Suppliers
  for (const supplier of SUPPLIERS) {
    try {
      await prisma.supplier.upsert({
        where: { code: supplier.code },
        update: {},
        create: {
          code: supplier.code,
          nameAr: supplier.nameAr,
          nameEn: supplier.nameEn,
          phone: '+966 XX XXX XXXX',
          email: `${supplier.code.toLowerCase()}@supplier.local`,
          tenantId: TENANT_ID,
        },
      });
      stats.suppliersCreated++;
    } catch (error: any) {
      stats.errors.push(`Supplier ${supplier.code}: ${error.message}`);
    }
  }
  
  // Products
  for (const product of PRODUCTS) {
    try {
      await prisma.product.upsert({
        where: { code: product.code },
        update: {},
        create: {
          code: product.code,
          nameAr: product.nameAr,
          nameEn: product.nameEn,
          type: 'finished_good',
          price: product.price,
          cost: product.cost,
          stock: product.stock,
          minStock: Math.floor(product.stock * 0.2),
          unit: 'قطعة',
          tenantId: TENANT_ID,
        },
      });
      stats.productsCreated++;
    } catch (error: any) {
      stats.errors.push(`Product ${product.code}: ${error.message}`);
    }
  }
  
  console.log(`✅ Created: ${stats.customersCreated} customers, ${stats.suppliersCreated} suppliers, ${stats.productsCreated} products\n`);
}

async function createSalesInvoices() {
  console.log('🛒 Creating sales invoices...\n');
  
  const customers = await prisma.customer.findMany({ where: { tenantId: TENANT_ID } });
  const products = await prisma.product.findMany({ where: { tenantId: TENANT_ID, stock: { gt: 0 } } });
  
  for (let i = 1; i <= 10; i++) {
    try {
      const customer = customers[i % customers.length];
      const numItems = Math.floor(Math.random() * 3) + 1;
      const items = [];
      
      for (let j = 0; j < numItems; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        
        if (product.stock >= quantity) {
          items.push({
            productId: product.id,
            quantity,
            price: Number(product.price),
            unitCost: Number(product.cost),
          });
        }
      }
      
      if (items.length > 0) {
        const invoiceNumber = `SI-${Date.now()}-${i}`;
        await createSalesInvoiceAtomic({
          invoiceData: {
            invoiceNumber,
            date: new Date(),
            customerId: customer.id,
            notes: `Sales invoice for ${customer.nameAr}`,
          },
          items,
          tenantId: TENANT_ID,
          userId: USER_ID,
        });
        
        stats.salesInvoices++;
        const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        console.log(`  ✅ ${invoiceNumber}: ${total.toFixed(2)} SAR`);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for unique timestamps
      }
    } catch (error: any) {
      stats.errors.push(`Sales invoice ${i}: ${error.message}`);
      console.log(`  ❌ SI-${String(i).padStart(4, '0')}: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Created ${stats.salesInvoices} sales invoices\n`);
}

async function createPurchaseInvoices() {
  console.log('📦 Creating purchase invoices...\n');
  
  const suppliers = await prisma.supplier.findMany({ where: { tenantId: TENANT_ID } });
  const products = await prisma.product.findMany({ where: { tenantId: TENANT_ID } });
  
  for (let i = 1; i <= 5; i++) {
    try {
      const supplier = suppliers[i % suppliers.length];
      const numItems = Math.floor(Math.random() * 4) + 2;
      const items = [];
      
      for (let j = 0; j < numItems; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 20) + 10;
        
        items.push({
          productId: product.id,
          quantity,
          price: Number(product.cost),
          unitCost: Number(product.cost),
        });
      }
      
      const invoiceNumber = `PI-${Date.now()}-${i}`;
      await createPurchaseInvoiceAtomic({
        invoiceData: {
          invoiceNumber,
          date: new Date(),
          supplierId: supplier.id,
          notes: `Purchase from ${supplier.nameAr}`,
        },
        items,
        tenantId: TENANT_ID,
        userId: USER_ID,
      });
      
      stats.purchaseInvoices++;
      const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      console.log(`  ✅ ${invoiceNumber}: ${total.toFixed(2)} SAR`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for unique timestamps
    } catch (error: any) {
      stats.errors.push(`Purchase invoice ${i}: ${error.message}`);
      console.log(`  ❌ PI-${String(i).padStart(4, '0')}: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Created ${stats.purchaseInvoices} purchase invoices\n`);
}

async function verifySystem() {
  console.log('🔍 Verifying system integrity...\n');
  
  // Check stock
  const products = await prisma.product.findMany({ where: { tenantId: TENANT_ID } });
  const negativeStock = products.filter(p => Number(p.stock) < 0);
  
  if (negativeStock.length > 0) {
    console.log(`❌ Found ${negativeStock.length} products with negative stock!`);
    stats.errors.push(`Negative stock detected`);
  } else {
    console.log('✅ No negative stock');
  }
  
  // Check journal entries
  const journalEntries = await prisma.journalEntry.findMany({
    where: { tenantId: TENANT_ID },
    include: { lines: true },
  });
  
  let balanced = true;
  for (const entry of journalEntries) {
    const debit = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const credit = entry.lines.reduce((sum, line) => sum + Number(line.credit), 0);
    
    if (Math.abs(debit - credit) > 0.01) {
      balanced = false;
      stats.errors.push(`Unbalanced entry ${entry.entryNumber}`);
    }
  }
  
  console.log(`✅ Journal entries: ${journalEntries.length} (${balanced ? 'all balanced' : 'UNBALANCED!'})`);
  
  // Check invoices have items
  const salesInvoices = await prisma.salesInvoice.findMany({
    where: { tenantId: TENANT_ID },
    include: { items: true },
  });
  
  const emptyInvoices = salesInvoices.filter(inv => inv.items.length === 0);
  if (emptyInvoices.length > 0) {
    console.log(`❌ Found ${emptyInvoices.length} invoices without items!`);
    stats.errors.push(`Empty invoices detected`);
  } else {
    console.log('✅ All invoices have items');
  }
  
  console.log();
}

async function runTest() {
  console.log('🚀 FINAL PRODUCTION TEST\n');
  console.log('═══════════════════════════════════════\n');
  
  try {
    await cleanupExistingData();
    await setupTenant();
    await createMasterData();
    await createSalesInvoices();
    await createPurchaseInvoices();
    await verifySystem();
    
    console.log('═══════════════════════════════════════');
    console.log('📊 FINAL RESULTS\n');
    console.log(`✅ Customers: ${stats.customersCreated}`);
    console.log(`✅ Suppliers: ${stats.suppliersCreated}`);
    console.log(`✅ Products: ${stats.productsCreated}`);
    console.log(`✅ Sales Invoices: ${stats.salesInvoices}`);
    console.log(`✅ Purchase Invoices: ${stats.purchaseInvoices}`);
    console.log(`\n${stats.errors.length === 0 ? '✅ NO ERRORS' : `❌ Errors: ${stats.errors.length}`}`);
    
    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.slice(0, 5).forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
    
    console.log('\n═══════════════════════════════════════\n');
    
    process.exit(stats.errors.length > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();
