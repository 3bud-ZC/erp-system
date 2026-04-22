/**
 * ERP Module Registry
 * Central registry for all ERP modules and their configuration
 */

import { ERPModule, ERPSubModule, ERPModuleCode } from './types';

// ==================== MODULE DEFINITIONS ====================

export const MODULES: ERPModule[] = [
  {
    code: 'dashboard',
    name: 'Dashboard',
    nameAr: 'لوحة المعلومات',
    icon: 'LayoutDashboard',
    route: '/erp/dashboard',
    permissions: ['view_dashboard'],
  },
  {
    code: 'sales',
    name: 'Sales',
    nameAr: 'المبيعات',
    icon: 'ShoppingCart',
    route: '/erp/sales',
    permissions: ['view_sales'],
    subModules: [
      {
        code: 'quotations',
        name: 'Quotations',
        nameAr: 'عروض الأسعار',
        route: '/erp/sales/quotations',
        icon: 'FileText',
        permissions: ['view_quotations'],
      },
      {
        code: 'orders',
        name: 'Sales Orders',
        nameAr: 'أوامر البيع',
        route: '/erp/sales/orders',
        icon: 'ClipboardList',
        permissions: ['view_sales_orders'],
      },
      {
        code: 'invoices',
        name: 'Sales Invoices',
        nameAr: 'فواتير البيع',
        route: '/erp/sales/invoices',
        icon: 'FileInvoice',
        permissions: ['view_sales_invoices'],
      },
      {
        code: 'returns',
        name: 'Sales Returns',
        nameAr: 'مرتجعات المبيعات',
        route: '/erp/sales/returns',
        icon: 'Undo2',
        permissions: ['view_sales_returns'],
      },
      {
        code: 'payments',
        name: 'Customer Payments',
        nameAr: 'مدفوعات العملاء',
        route: '/erp/sales/payments',
        icon: 'CreditCard',
        permissions: ['view_payments'],
      },
    ],
  },
  {
    code: 'purchases',
    name: 'Purchases',
    nameAr: 'المشتريات',
    icon: 'ShoppingBag',
    route: '/erp/purchases',
    permissions: ['view_purchases'],
    subModules: [
      {
        code: 'requisitions',
        name: 'Purchase Requisitions',
        nameAr: 'طلبات الشراء',
        route: '/erp/purchases/requisitions',
        icon: 'FileQuestion',
        permissions: ['view_requisitions'],
      },
      {
        code: 'orders',
        name: 'Purchase Orders',
        nameAr: 'أوامر الشراء',
        route: '/erp/purchases/orders',
        icon: 'ClipboardList',
        permissions: ['view_purchase_orders'],
      },
      {
        code: 'invoices',
        name: 'Purchase Invoices',
        nameAr: 'فواتير الشراء',
        route: '/erp/purchases/invoices',
        icon: 'FileInvoice',
        permissions: ['view_purchase_invoices'],
      },
      {
        code: 'returns',
        name: 'Purchase Returns',
        nameAr: 'مرتجعات المشتريات',
        route: '/erp/purchases/returns',
        icon: 'Undo2',
        permissions: ['view_purchase_returns'],
      },
      {
        code: 'payments',
        name: 'Supplier Payments',
        nameAr: 'مدفوعات الموردين',
        route: '/erp/purchases/payments',
        icon: 'CreditCard',
        permissions: ['view_payments'],
      },
    ],
  },
  {
    code: 'inventory',
    name: 'Inventory',
    nameAr: 'المخزون',
    icon: 'Package',
    route: '/erp/inventory',
    permissions: ['view_inventory'],
    subModules: [
      {
        code: 'products',
        name: 'Products',
        nameAr: 'المنتجات',
        route: '/erp/inventory/products',
        icon: 'Box',
        permissions: ['view_products'],
      },
      {
        code: 'movements',
        name: 'Stock Movements',
        nameAr: 'حركات المخزون',
        route: '/erp/inventory/movements',
        icon: 'ArrowLeftRight',
        permissions: ['view_stock_movements'],
      },
      {
        code: 'adjustments',
        name: 'Stock Adjustments',
        nameAr: 'تعديلات المخزون',
        route: '/erp/inventory/adjustments',
        icon: 'SlidersHorizontal',
        permissions: ['view_stock_adjustments'],
      },
      {
        code: 'transfers',
        name: 'Stock Transfers',
        nameAr: 'نقل المخزون',
        route: '/erp/inventory/transfers',
        icon: 'Truck',
        permissions: ['view_stock_transfers'],
      },
      {
        code: 'valuation',
        name: 'Stock Valuation',
        nameAr: 'تقييم المخزون',
        route: '/erp/inventory/valuation',
        icon: 'TrendingUp',
        permissions: ['view_inventory_valuation'],
      },
    ],
  },
  {
    code: 'accounting',
    name: 'Accounting',
    nameAr: 'المحاسبة',
    icon: 'Calculator',
    route: '/erp/accounting',
    permissions: ['view_accounting'],
    subModules: [
      {
        code: 'accounts',
        name: 'Chart of Accounts',
        nameAr: 'دليل الحسابات',
        route: '/erp/accounting/accounts',
        icon: 'BookOpen',
        permissions: ['view_chart_of_accounts'],
      },
      {
        code: 'journal',
        name: 'Journal Entries',
        nameAr: 'القيود اليومية',
        route: '/erp/accounting/journal',
        icon: 'BookText',
        permissions: ['view_journal_entries'],
      },
      {
        code: 'ledger',
        name: 'General Ledger',
        nameAr: 'دفتر الأستاذ العام',
        route: '/erp/accounting/ledger',
        icon: 'ScrollText',
        permissions: ['view_general_ledger'],
      },
      {
        code: 'trial',
        name: 'Trial Balance',
        nameAr: 'ميزان المراجعة',
        route: '/erp/accounting/trial-balance',
        icon: 'Scale',
        permissions: ['view_trial_balance'],
      },
      {
        code: 'financial',
        name: 'Financial Statements',
        nameAr: 'القوائم المالية',
        route: '/erp/accounting/financial',
        icon: 'FileSpreadsheet',
        permissions: ['view_financial_statements'],
      },
      {
        code: 'periods',
        name: 'Accounting Periods',
        nameAr: 'الفترات المحاسبية',
        route: '/erp/accounting/periods',
        icon: 'Calendar',
        permissions: ['manage_accounting_periods'],
      },
    ],
  },
  {
    code: 'production',
    name: 'Production',
    nameAr: 'الإنتاج',
    icon: 'Factory',
    route: '/erp/production',
    permissions: ['view_production'],
    subModules: [
      {
        code: 'bom',
        name: 'BOM Management',
        nameAr: 'إدارة قوائم المواد',
        route: '/erp/production/bom',
        icon: 'ListTree',
        permissions: ['view_bom'],
      },
      {
        code: 'orders',
        name: 'Production Orders',
        nameAr: 'أوامر الإنتاج',
        route: '/erp/production/orders',
        icon: 'ClipboardList',
        permissions: ['view_production_orders'],
      },
      {
        code: 'lines',
        name: 'Production Lines',
        nameAr: 'خطوط الإنتاج',
        route: '/erp/production/lines',
        icon: 'Workflow',
        permissions: ['view_production_lines'],
      },
    ],
  },
  {
    code: 'reports',
    name: 'Reports',
    nameAr: 'التقارير',
    icon: 'BarChart3',
    route: '/erp/reports',
    permissions: ['view_reports'],
    subModules: [
      {
        code: 'sales',
        name: 'Sales Reports',
        nameAr: 'تقارير المبيعات',
        route: '/erp/reports/sales',
        icon: 'TrendingUp',
        permissions: ['view_sales_reports'],
      },
      {
        code: 'purchase',
        name: 'Purchase Reports',
        nameAr: 'تقارير المشتريات',
        route: '/erp/reports/purchase',
        icon: 'TrendingDown',
        permissions: ['view_purchase_reports'],
      },
      {
        code: 'inventory',
        name: 'Inventory Reports',
        nameAr: 'تقارير المخزون',
        route: '/erp/reports/inventory',
        icon: 'Package',
        permissions: ['view_inventory_reports'],
      },
      {
        code: 'financial',
        name: 'Financial Reports',
        nameAr: 'التقارير المالية',
        route: '/erp/reports/financial',
        icon: 'PieChart',
        permissions: ['view_financial_reports'],
      },
      {
        code: 'aging',
        name: 'AR/AP Aging',
        nameAr: 'شيخوخة الديون',
        route: '/erp/reports/aging',
        icon: 'Clock',
        permissions: ['view_aging_reports'],
      },
      {
        code: 'cashflow',
        name: 'Cash Flow',
        nameAr: 'التدفقات النقدية',
        route: '/erp/reports/cashflow',
        icon: 'Wallet',
        permissions: ['view_cashflow_reports'],
      },
    ],
  },
  {
    code: 'settings',
    name: 'Settings',
    nameAr: 'الإعدادات',
    icon: 'Settings',
    route: '/erp/settings',
    permissions: ['manage_settings'],
    subModules: [
      {
        code: 'company',
        name: 'Company Settings',
        nameAr: 'إعدادات الشركة',
        route: '/erp/settings/company',
        icon: 'Building2',
        permissions: ['manage_company_settings'],
      },
      {
        code: 'users',
        name: 'Users & Roles',
        nameAr: 'المستخدمين والأدوار',
        route: '/erp/settings/users',
        icon: 'Users',
        permissions: ['manage_users'],
      },
      {
        code: 'workflow',
        name: 'Workflow Settings',
        nameAr: 'إعدادات سير العمل',
        route: '/erp/settings/workflow',
        icon: 'GitBranch',
        permissions: ['manage_workflow'],
      },
      {
        code: 'system',
        name: 'System Settings',
        nameAr: 'إعدادات النظام',
        route: '/erp/settings/system',
        icon: 'Cog',
        permissions: ['manage_system_settings'],
      },
    ],
  },
];

// ==================== UTILITY FUNCTIONS ====================

export function getModule(code: ERPModuleCode): ERPModule | undefined {
  return MODULES.find(m => m.code === code);
}

export function getSubModule(moduleCode: ERPModuleCode, subCode: string): ERPSubModule | undefined {
  const mod = getModule(moduleCode);
  return mod?.subModules?.find(sm => sm.code === subCode);
}

export function getAllModules(): ERPModule[] {
  return MODULES;
}

export function getAllRoutes(): string[] {
  const routes: string[] = [];

  MODULES.forEach(mod => {
    routes.push(mod.route);
    mod.subModules?.forEach(sub => {
      routes.push(sub.route);
    });
  });

  return routes;
}

export function getModuleByRoute(route: string): ERPModule | undefined {
  return MODULES.find(m => 
    m.route === route || 
    m.subModules?.some(sm => sm.route === route)
  );
}

export function getBreadcrumb(route: string): { module: ERPModule; subModule?: ERPSubModule } | null {
  for (const mod of MODULES) {
    if (mod.route === route) {
      return { module: mod };
    }
    
    const subModule = mod.subModules?.find(sm => sm.route === route);
    if (subModule) {
      return { module: mod, subModule };
    }
  }
  
  return null;
}
