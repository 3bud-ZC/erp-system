const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function checkDatabase() {
  console.log('🔍 Checking database connection...\n');
  
  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully!\n');
    
    // Check tables
    console.log('📊 Checking tables...\n');
    
    const products = await prisma.product.count();
    console.log(`  Products: ${products}`);
    
    const customers = await prisma.customer.count();
    console.log(`  Customers: ${customers}`);
    
    const suppliers = await prisma.supplier.count();
    console.log(`  Suppliers: ${suppliers}`);
    
    const salesInvoices = await prisma.salesInvoice.count();
    console.log(`  Sales Invoices: ${salesInvoices}`);
    
    const purchaseInvoices = await prisma.purchaseInvoice.count();
    console.log(`  Purchase Invoices: ${purchaseInvoices}`);
    
    const warehouses = await prisma.warehouse.count();
    console.log(`  Warehouses: ${warehouses}`);
    
    console.log('\n✅ Database check complete!');
    
    if (products === 0 && customers === 0 && suppliers === 0) {
      console.log('\n⚠️  WARNING: Database is empty! Run: npx prisma db seed');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
