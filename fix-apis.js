const fs = require('fs');
const path = require('path');

// API routes to fix
const apiRoutes = [
  'app/api/suppliers/route.ts',
  'app/api/sales-invoices/route.ts',
  'app/api/sales-orders/route.ts',
  'app/api/purchase-invoices/route.ts',
  'app/api/purchase-orders/route.ts',
  'app/api/production-orders/route.ts',
  'app/api/expenses/route.ts',
];

apiRoutes.forEach(routePath => {
  const fullPath = path.join(__dirname, routePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${routePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Remove authentication check from GET requests
  const getPattern = /export async function GET\(request: Request\) \{\s*try \{\s*const user = await getAuthenticatedUser\(request\);\s*if \(!user\) \{\s*return apiError\([^)]+\);\s*\}/g;
  
  if (getPattern.test(content)) {
    content = content.replace(
      /export async function GET\(request: Request\) \{\s*try \{\s*const user = await getAuthenticatedUser\(request\);\s*if \(!user\) \{\s*return apiError\([^)]+\);\s*\}/,
      'export async function GET(request: Request) {\n  try {'
    );
    
    fs.writeFileSync(fullPath, content);
    console.log(`✅ Fixed: ${routePath}`);
  } else {
    console.log(`ℹ️  No changes needed: ${routePath}`);
  }
});

console.log('\n✅ All API routes processed!');
