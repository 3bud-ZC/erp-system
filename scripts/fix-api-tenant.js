#!/usr/bin/env node
/**
 * Auto-fix API routes - Add tenantId to all create/update operations
 * Usage: node scripts/fix-api-tenant.js
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// List of API routes that need tenantId fix
const API_ROUTES = [
  'api/accounts/route.ts',
  'api/batches/route.ts',
  'api/bom/route.ts',
  'api/companies/route.ts',
  'api/expenses/route.ts',
  'api/fixed-assets/route.ts',
  'api/goods-receipts/route.ts',
  'api/item-groups/route.ts',
  'api/journal-entries/route.ts',
  'api/payments/route.ts',
  'api/production-lines/route.ts',
  'api/production-lines/assignments/route.ts',
  'api/production-orders/route.ts',
  'api/purchase-invoices/route.ts',
  'api/purchase-orders/route.ts',
  'api/purchase-requisitions/route.ts',
  'api/quotations/route.ts',
  'api/sales-invoices/route.ts',
  'api/sales-orders/route.ts',
  'api/sales-returns/route.ts',
  'api/stock-adjustments/route.ts',
  'api/stock-transfers/route.ts',
  'api/stocktakes/route.ts',
  'api/suppliers/route.ts',
  'api/units/route.ts',
];

async function fixFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), 'app', filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipping (not found): ${filePath}`);
      return;
    }
    
    let content = await readFile(fullPath, 'utf8');
    
    // Check if already has tenantId check
    if (content.includes('user.tenantId')) {
      console.log(`✅ Already fixed: ${filePath}`);
      return;
    }
    
    // Check if file has POST handler with prisma create
    if (!content.includes('prisma.') || !content.includes('.create(')) {
      console.log(`⏭️  No create operation: ${filePath}`);
      return;
    }
    
    // Extract model name from the create call
    const createMatch = content.match(/prisma\.(\w+)\.create\(/);
    if (!createMatch) {
      console.log(`⏭️  No model found: ${filePath}`);
      return;
    }
    
    const modelName = createMatch[1];
    console.log(`🔧 Fixing: ${filePath} (model: ${modelName})`);
    
    // Add tenantId check after permission check
    const permissionCheckPattern = /if \(!checkPermission\(user, ['"](\w+)['"]\)\) \{[^}]+\}/;
    const tenantCheck = `
    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }`;
    
    // Find where to insert tenant check
    if (content.includes('checkPermission')) {
      content = content.replace(
        permissionCheckPattern,
        (match) => `${match}${tenantCheck}`
      );
    }
    
    // Fix prisma create to add tenantId
    const createPattern = new RegExp(
      `prisma\.${modelName}\.create\(\{\\s*data:\\s*(\{[^}]+\}|body)\s*\}\)`,
      'g'
    );
    
    content = content.replace(
      createPattern,
      (match, dataPart) => {
        // Check if already has tenantId
        if (match.includes('tenantId')) return match;
        
        // Add tenantId to data
        return match.replace(
          `data: ${dataPart}`,
          `data: { ...${dataPart}, tenantId: user.tenantId }`
        );
      }
    );
    
    await writeFile(fullPath, content, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
}

async function main() {
  console.log('🔧 Starting API routes tenant fix...\n');
  
  for (const route of API_ROUTES) {
    await fixFile(route);
  }
  
  console.log('\n✅ Done! Run `npm run build` to apply changes.');
}

main().catch(console.error);
