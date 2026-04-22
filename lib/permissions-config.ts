/**
 * Granular RBAC Configuration
 * Defines roles and their associated permissions for the ERP system
 */

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Admin - Full system access
  admin: [
    'manage_system',
    'manage_users',
    'manage_roles',
    'manage_permissions',
    'view_audit_logs',
    'manage_tenants',
    'view_all_data',
    'sales_full_access',
    'purchase_full_access',
    'inventory_full_access',
    'accounting_full_access',
    'production_full_access',
    'reports_full_access',
  ],

  // Manager - Full access to business operations, no system admin
  manager: [
    'manage_users',
    'view_audit_logs',
    'sales_full_access',
    'purchase_full_access',
    'inventory_full_access',
    'accounting_full_access',
    'production_full_access',
    'reports_full_access',
    'approve_orders',
    'approve_invoices',
    'approve_payments',
  ],

  // Accountant - Accounting and financial access
  accountant: [
    'accounting_full_access',
    'view_journal_entries',
    'create_journal_entries',
    'approve_journal_entries',
    'view_reports',
    'create_reports',
    'manage_accounts',
    'view_invoices',
    'create_invoices',
    'view_payments',
    'record_payments',
    'reconcile_accounts',
    'manage_tax',
    'view_budget',
    'manage_budget',
  ],

  // Sales - Sales operations access
  sales: [
    'sales_full_access',
    'view_customers',
    'create_customers',
    'edit_customers',
    'view_quotations',
    'create_quotations',
    'edit_quotations',
    'view_sales_orders',
    'create_sales_orders',
    'edit_sales_orders',
    'view_sales_invoices',
    'create_sales_invoices',
    'view_sales_returns',
    'create_sales_returns',
    'view_sales_reports',
  ],

  // Warehouse - Inventory and warehouse access
  warehouse: [
    'inventory_full_access',
    'view_products',
    'create_products',
    'edit_products',
    'view_warehouses',
    'manage_stock',
    'view_stock_transfers',
    'create_stock_transfers',
    'view_stock_adjustments',
    'create_stock_adjustments',
    'view_stocktakes',
    'create_stocktakes',
    'view_purchase_orders',
    'receive_goods',
    'view_inventory_reports',
  ],

  // Viewer - Read-only access to all modules
  viewer: [
    'view_all_data',
    'view_customers',
    'view_products',
    'view_sales_orders',
    'view_sales_invoices',
    'view_purchase_orders',
    'view_purchase_invoices',
    'view_inventory',
    'view_journal_entries',
    'view_reports',
  ],
};

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  // System permissions
  manage_system: 'Manage system-wide settings and configuration',
  manage_users: 'Create, edit, and delete users',
  manage_roles: 'Manage user roles and permissions',
  manage_permissions: 'Assign permissions to roles',
  view_audit_logs: 'View system audit logs',
  manage_tenants: 'Manage multi-tenant organizations',
  view_all_data: 'View all data across all modules',

  // Sales permissions
  sales_full_access: 'Full access to sales module',
  view_customers: 'View customer information',
  create_customers: 'Create new customers',
  edit_customers: 'Edit customer information',
  view_quotations: 'View sales quotations',
  create_quotations: 'Create sales quotations',
  edit_quotations: 'Edit sales quotations',
  view_sales_orders: 'View sales orders',
  create_sales_orders: 'Create sales orders',
  edit_sales_orders: 'Edit sales orders',
  view_sales_invoices: 'View sales invoices',
  create_sales_invoices: 'Create sales invoices',
  view_sales_returns: 'View sales returns',
  create_sales_returns: 'Create sales returns',
  view_sales_reports: 'View sales reports',

  // Purchase permissions
  purchase_full_access: 'Full access to purchase module',
  view_suppliers: 'View supplier information',
  create_suppliers: 'Create new suppliers',
  edit_suppliers: 'Edit supplier information',
  view_purchase_orders: 'View purchase orders',
  create_purchase_orders: 'Create purchase orders',
  edit_purchase_orders: 'Edit purchase orders',
  view_purchase_invoices: 'View purchase invoices',
  create_purchase_invoices: 'Create purchase invoices',
  view_purchase_returns: 'View purchase returns',
  create_purchase_returns: 'Create purchase returns',

  // Inventory permissions
  inventory_full_access: 'Full access to inventory module',
  view_products: 'View product information',
  create_products: 'Create new products',
  edit_products: 'Edit product information',
  view_warehouses: 'View warehouse information',
  manage_stock: 'Manage stock levels',
  view_stock_transfers: 'View stock transfers',
  create_stock_transfers: 'Create stock transfers',
  view_stock_adjustments: 'View stock adjustments',
  create_stock_adjustments: 'Create stock adjustments',
  view_stocktakes: 'View stocktakes',
  create_stocktakes: 'Create stocktakes',
  receive_goods: 'Receive goods from purchase orders',
  view_inventory_reports: 'View inventory reports',

  // Accounting permissions
  accounting_full_access: 'Full access to accounting module',
  view_journal_entries: 'View journal entries',
  create_journal_entries: 'Create journal entries',
  approve_journal_entries: 'Approve journal entries',
  view_reports: 'View financial reports',
  create_reports: 'Create financial reports',
  manage_accounts: 'Manage chart of accounts',
  view_invoices: 'View invoices',
  create_invoices: 'Create invoices',
  view_payments: 'View payments',
  record_payments: 'Record payments',
  reconcile_accounts: 'Reconcile bank accounts',
  manage_tax: 'Manage tax settings',
  view_budget: 'View budgets',
  manage_budget: 'Manage budgets',

  // Production permissions
  production_full_access: 'Full access to production module',
  view_production_orders: 'View production orders',
  create_production_orders: 'Create production orders',
  edit_production_orders: 'Edit production orders',
  view_production_lines: 'View production lines',
  manage_production_lines: 'Manage production lines',
  view_production_reports: 'View production reports',

  // General permissions
  reports_full_access: 'Full access to all reports',
  approve_orders: 'Approve orders',
  approve_invoices: 'Approve invoices',
  approve_payments: 'Approve payments',
  view_inventory: 'View inventory levels',
};

/**
 * Get permissions for a role
 */
export function getRolePermissions(roleCode: string): string[] {
  return ROLE_PERMISSIONS[roleCode] || [];
}

/**
 * Check if role has specific permission
 */
export function roleHasPermission(roleCode: string, permissionCode: string): boolean {
  return ROLE_PERMISSIONS[roleCode]?.includes(permissionCode) || false;
}

/**
 * Get all available permissions
 */
export function getAllPermissions(): string[] {
  return Object.keys(PERMISSION_DESCRIPTIONS);
}

/**
 * Get permission description
 */
export function getPermissionDescription(permissionCode: string): string {
  return PERMISSION_DESCRIPTIONS[permissionCode] || permissionCode;
}
