/**
 * ERP Frontend Core Types
 * Production-grade type definitions for the ERP frontend layer
 */

import { ReactNode } from 'react';

// ==================== TRANSACTION TYPES ====================

export type ERPTransactionType =
  | "SALES_ORDER"
  | "SALES_INVOICE"
  | "SALES_RETURN"
  | "PURCHASE_ORDER"
  | "PURCHASE_INVOICE"
  | "PURCHASE_RETURN"
  | "PAYMENT"
  | "STOCK_TRANSFER"
  | "STOCK_ADJUSTMENT"
  | "PRODUCTION_ORDER";

// ==================== MODULE TYPES ====================

export type ERPModuleCode = 
  | 'dashboard'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'accounting'
  | 'production'
  | 'reports'
  | 'settings';

export interface ERPModule {
  code: ERPModuleCode;
  name: string;
  nameAr: string;
  icon: string;
  route: string;
  permissions: string[];
  subModules?: ERPSubModule[];
}

export interface ERPSubModule {
  code: string;
  name: string;
  nameAr: string;
  route: string;
  icon: string;
  permissions: string[];
}

// ==================== WORKFLOW TYPES ====================

export type WorkflowStatus = 
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'posted'
  | 'partially_paid'
  | 'paid'
  | 'void'
  | 'shipped'
  | 'delivered'
  | 'invoiced'
  | 'received'
  | 'released'
  | 'planned'
  | 'in_transit';

export interface WorkflowState {
  currentStatus: WorkflowStatus;
  previousStatus?: WorkflowStatus;
  availableTransitions: WorkflowStatus[];
  history: WorkflowTransitionEvent[];
  updatedAt: string;
}

export interface WorkflowTransitionEvent {
  from: WorkflowStatus;
  to: WorkflowStatus;
  timestamp: string;
  userId: string;
  userName: string;
  notes?: string;
}

// ==================== ENTITY TYPES ====================

export interface EntityBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  workflow: WorkflowState;
}

export interface SalesOrder extends EntityBase {
  orderNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
}

export interface SalesInvoice extends EntityBase {
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  salesOrderId?: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
}

export interface PurchaseOrder extends EntityBase {
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  expectedDate: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface PurchaseInvoice extends EntityBase {
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  discount?: number;
  total: number;
}

export interface Payment extends EntityBase {
  paymentNumber: string;
  date: string;
  amount: number;
  method: 'cash' | 'bank' | 'check' | 'card';
  reference?: string;
  salesInvoiceId?: string;
  purchaseInvoiceId?: string;
  notes?: string;
}

export interface Product extends EntityBase {
  code: string;
  nameAr: string;
  nameEn?: string;
  type: 'product' | 'service' | 'raw_material';
  category: string;
  unit: string;
  price: number;
  cost: number;
  quantity: number;
  minStock: number;
  warehouseId?: string;
}

export interface JournalEntry extends EntityBase {
  entryNumber: string;
  date: string;
  reference?: string;
  description: string;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface Account {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  balance: number;
  isActive: boolean;
}

// ==================== KPI TYPES ====================

export interface KPI {
  id: string;
  title: string;
  titleAr: string;
  value: number;
  format: 'currency' | 'number' | 'percentage';
  trend?: 'up' | 'down' | 'neutral';
  change?: number;
  icon: string;
  color: string;
}

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'list' | 'alert' | 'activity';
  title: string;
  titleAr: string;
  position: { x: number; y: number; w: number; h: number };
  data?: any;
}

// ==================== ALERT TYPES ====================

export interface ERPAlert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  module: ERPModuleCode;
  entityId?: string;
  entityType?: string;
  createdAt: string;
  isRead: boolean;
}

// ==================== ACTIVITY TYPES ====================

export interface ActivityEvent {
  id: string;
  type: string;
  userId: string;
  userName: string;
  module: ERPModuleCode;
  entityId?: string;
  entityType?: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

// ==================== FORM TYPES ====================

export interface FormField {
  name: string;
  label: string;
  labelAr: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox' | 'autocomplete';
  required?: boolean;
  options?: { value: string; label: string; labelAr: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface FormConfig {
  fields: FormField[];
  sections?: {
    title: string;
    titleAr: string;
    fields: string[];
  }[];
}

// ==================== TABLE TYPES ====================

export interface TableColumn {
  key: string;
  header: string;
  headerAr: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'status' | 'actions';
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
}

export interface TableAction {
  key: string;
  label: string;
  labelAr: string;
  icon: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  condition?: (row: any) => boolean;
  onClick: (row: any) => void;
}

// ==================== REPORT TYPES ====================

export interface ReportConfig {
  id: string;
  name: string;
  nameAr: string;
  type: 'financial' | 'sales' | 'purchase' | 'inventory' | 'custom';
  parameters: ReportParameter[];
}

export interface ReportParameter {
  name: string;
  label: string;
  labelAr: string;
  type: 'date' | 'daterange' | 'select' | 'multiselect' | 'entity';
  required?: boolean;
  options?: { value: string; label: string }[];
  entityType?: string;
}

// ==================== API RESPONSE TYPES ====================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export interface ListResponse<T> extends APIResponse<T[]> {
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}
