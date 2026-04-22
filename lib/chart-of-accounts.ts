import { prisma } from './db';

export const DEFAULT_COA = [
  // Assets
  { code: '1000', nameAr: 'الأصول', nameEn: 'Assets', type: 'ASSET', subType: 'Header' },
  { code: '1100', nameAr: 'النقدية', nameEn: 'Cash', type: 'ASSET', subType: 'Cash' },
  { code: '1110', nameAr: 'البنك', nameEn: 'Bank', type: 'ASSET', subType: 'Bank' },
  { code: '1200', nameAr: 'العملاء', nameEn: 'Accounts Receivable', type: 'ASSET', subType: 'Receivable' },
  { code: '1300', nameAr: 'المخزون', nameEn: 'Inventory', type: 'ASSET', subType: 'Inventory' },
  { code: '1400', nameAr: 'الأصول الثابتة', nameEn: 'Fixed Assets', type: 'ASSET', subType: 'FixedAsset' },
  // Liabilities
  { code: '2000', nameAr: 'الخصوم', nameEn: 'Liabilities', type: 'LIABILITY', subType: 'Header' },
  { code: '2100', nameAr: 'الموردون', nameEn: 'Accounts Payable', type: 'LIABILITY', subType: 'Payable' },
  { code: '2200', nameAr: 'ضريبة القيمة المضافة', nameEn: 'VAT Payable', type: 'LIABILITY', subType: 'Tax' },
  // Equity
  { code: '3000', nameAr: 'حقوق الملكية', nameEn: 'Equity', type: 'EQUITY', subType: 'Header' },
  { code: '3100', nameAr: 'رأس المال', nameEn: 'Capital', type: 'EQUITY', subType: 'Capital' },
  { code: '3200', nameAr: 'الأرباح المحتجزة', nameEn: 'Retained Earnings', type: 'EQUITY', subType: 'Retained' },
  // Revenue
  { code: '4000', nameAr: 'الإيرادات', nameEn: 'Revenue', type: 'REVENUE', subType: 'Header' },
  { code: '4100', nameAr: 'إيرادات المبيعات', nameEn: 'Sales Revenue', type: 'REVENUE', subType: 'Sales' },
  // Expenses
  { code: '5000', nameAr: 'المصروفات', nameEn: 'Expenses', type: 'EXPENSE', subType: 'Header' },
  { code: '5100', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'COGS', type: 'EXPENSE', subType: 'COGS' },
  { code: '5200', nameAr: 'مصروفات تشغيلية', nameEn: 'Operating Expenses', type: 'EXPENSE', subType: 'Operating' },
  { code: '5300', nameAr: 'رواتب', nameEn: 'Salaries', type: 'EXPENSE', subType: 'Payroll' },
];

export async function seedChartOfAccounts(tenantId: string = 'default') {
  for (const acc of DEFAULT_COA) {
    await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: acc.code } },
      update: {},
      create: { ...acc, isActive: true, tenantId },
    });
  }
  return DEFAULT_COA.length;
}
