/**
 * Workflow UI Utilities
 * Helpers for workflow state visualization and action management
 */

import { WorkflowState, WorkflowStatus, ERPModuleCode } from './types';

// ==================== STATUS CONFIGURATION ====================

export interface StatusConfig {
  label: string;
  labelAr: string;
  color: string;
  bgColor: string;
  icon: string;
  description?: string;
  descriptionAr?: string;
}

export const STATUS_CONFIG: Record<WorkflowStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    labelAr: 'مسودة',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: 'FileEdit',
    description: 'Document is in draft state',
    descriptionAr: 'الوثيقة في حالة مسودة',
  },
  pending: {
    label: 'Pending',
    labelAr: 'معلق',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: 'Clock',
    description: 'Waiting for approval',
    descriptionAr: 'بانتظار الموافقة',
  },
  confirmed: {
    label: 'Confirmed',
    labelAr: 'مؤكد',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: 'CheckCircle',
    description: 'Document has been confirmed',
    descriptionAr: 'تم تأكيد الوثيقة',
  },
  in_progress: {
    label: 'In Progress',
    labelAr: 'قيد التنفيذ',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    icon: 'Loader2',
    description: 'Operation is in progress',
    descriptionAr: 'العملية قيد التنفيذ',
  },
  completed: {
    label: 'Completed',
    labelAr: 'مكتمل',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: 'CheckCircle2',
    description: 'Operation completed successfully',
    descriptionAr: 'اكتملت العملية بنجاح',
  },
  cancelled: {
    label: 'Cancelled',
    labelAr: 'ملغي',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: 'XCircle',
    description: 'Document has been cancelled',
    descriptionAr: 'تم إلغاء الوثيقة',
  },
  posted: {
    label: 'Posted',
    labelAr: 'مرحل',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: 'FileCheck',
    description: 'Posted to ledger',
    descriptionAr: 'مرحل إلى دفتر الأستاذ',
  },
  partially_paid: {
    label: 'Partially Paid',
    labelAr: 'مدفوع جزئياً',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: 'Wallet',
    description: 'Partial payment received',
    descriptionAr: 'تم استلام دفع جزئي',
  },
  paid: {
    label: 'Paid',
    labelAr: 'مدفوع',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: 'Banknote',
    description: 'Fully paid',
    descriptionAr: 'مدفوع بالكامل',
  },
  void: {
    label: 'Void',
    labelAr: 'ملغي محاسبياً',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: 'Ban',
    description: 'Voided in accounting',
    descriptionAr: 'تم الإلغاء محاسبياً',
  },
  shipped: {
    label: 'Shipped',
    labelAr: 'تم الشحن',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: 'Truck',
    description: 'Items have been shipped',
    descriptionAr: 'تم شحن الأصناف',
  },
  delivered: {
    label: 'Delivered',
    labelAr: 'تم التوصيل',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: 'PackageCheck',
    description: 'Items delivered to customer',
    descriptionAr: 'تم توصيل الأصناف للعميل',
  },
  invoiced: {
    label: 'Invoiced',
    labelAr: 'مفوتر',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    icon: 'Receipt',
    description: 'Invoice has been created',
    descriptionAr: 'تم إنشاء الفاتورة',
  },
  received: {
    label: 'Received',
    labelAr: 'مستلم',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: 'PackageCheck',
    description: 'Items received',
    descriptionAr: 'تم استلام الأصناف',
  },
  released: {
    label: 'Released',
    labelAr: 'مُطلق',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: 'Unlock',
    description: 'Production order released',
    descriptionAr: 'تم إطلاق أمر الإنتاج',
  },
  planned: {
    label: 'Planned',
    labelAr: 'مخطط',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: 'CalendarDays',
    description: 'Order is planned',
    descriptionAr: 'الأمر مخطط',
  },
  in_transit: {
    label: 'In Transit',
    labelAr: 'قيد النقل',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: 'Truck',
    description: 'Items in transit',
    descriptionAr: 'الأصناف قيد النقل',
  },
};

// ==================== ACTION CONFIGURATION ====================

export interface ActionConfig {
  key: string;
  label: string;
  labelAr: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'danger' | 'success';
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  confirmationMessageAr?: string;
}

export const WORKFLOW_ACTIONS: Record<string, ActionConfig> = {
  approve: {
    key: 'approve',
    label: 'Approve',
    labelAr: 'موافقة',
    icon: 'CheckCircle',
    variant: 'success',
  },
  confirm: {
    key: 'confirm',
    label: 'Confirm',
    labelAr: 'تأكيد',
    icon: 'CheckCircle',
    variant: 'success',
  },
  post: {
    key: 'post',
    label: 'Post',
    labelAr: 'ترحيل',
    icon: 'FileCheck',
    variant: 'primary',
    requiresConfirmation: true,
    confirmationMessage: 'Are you sure you want to post this document? This action cannot be undone.',
    confirmationMessageAr: 'هل أنت متأكد من ترحيل هذه الوثيقة؟ لا يمكن التراجع عن هذا الإجراء.',
  },
  cancel: {
    key: 'cancel',
    label: 'Cancel',
    labelAr: 'إلغاء',
    icon: 'XCircle',
    variant: 'danger',
    requiresConfirmation: true,
    confirmationMessage: 'Are you sure you want to cancel this document?',
    confirmationMessageAr: 'هل أنت متأكد من إلغاء هذه الوثيقة؟',
  },
  void: {
    key: 'void',
    label: 'Void',
    labelAr: 'إلغاء محاسبي',
    icon: 'Ban',
    variant: 'danger',
    requiresConfirmation: true,
    confirmationMessage: 'Are you sure you want to void this document? This will create a reversing journal entry.',
    confirmationMessageAr: 'هل أنت متأكد من الإلغاء المحاسبي؟ سيتم إنشاء قيد عكسي.',
  },
  convert: {
    key: 'convert',
    label: 'Convert',
    labelAr: 'تحويل',
    icon: 'ArrowRightLeft',
    variant: 'primary',
  },
  ship: {
    key: 'ship',
    label: 'Ship',
    labelAr: 'شحن',
    icon: 'Truck',
    variant: 'primary',
  },
  deliver: {
    key: 'deliver',
    label: 'Deliver',
    labelAr: 'توصيل',
    icon: 'PackageCheck',
    variant: 'success',
  },
  receive: {
    key: 'receive',
    label: 'Receive',
    labelAr: 'استلام',
    icon: 'PackageCheck',
    variant: 'success',
  },
  release: {
    key: 'release',
    label: 'Release',
    labelAr: 'إطلاق',
    icon: 'Unlock',
    variant: 'primary',
  },
  start: {
    key: 'start',
    label: 'Start',
    labelAr: 'بدء',
    icon: 'Play',
    variant: 'primary',
  },
  complete: {
    key: 'complete',
    label: 'Complete',
    labelAr: 'إكمال',
    icon: 'CheckCircle2',
    variant: 'success',
  },
  pay: {
    key: 'pay',
    label: 'Record Payment',
    labelAr: 'تسجيل دفعة',
    icon: 'CreditCard',
    variant: 'primary',
  },
  edit: {
    key: 'edit',
    label: 'Edit',
    labelAr: 'تعديل',
    icon: 'Pencil',
    variant: 'secondary',
  },
  delete: {
    key: 'delete',
    label: 'Delete',
    labelAr: 'حذف',
    icon: 'Trash2',
    variant: 'danger',
    requiresConfirmation: true,
    confirmationMessage: 'Are you sure you want to delete this document?',
    confirmationMessageAr: 'هل أنت متأكد من حذف هذه الوثيقة؟',
  },
  print: {
    key: 'print',
    label: 'Print',
    labelAr: 'طباعة',
    icon: 'Printer',
    variant: 'secondary',
  },
  pdf: {
    key: 'pdf',
    label: 'Export PDF',
    labelAr: 'تصدير PDF',
    icon: 'FileDown',
    variant: 'secondary',
  },
};

// ==================== WORKFLOW STATE MACHINES ====================

export interface WorkflowTransition {
  from: WorkflowStatus;
  to: WorkflowStatus;
  action: string;
  condition?: (state: any) => boolean;
}

export const SALES_ORDER_WORKFLOW: WorkflowTransition[] = [
  { from: 'draft', to: 'pending', action: 'submit' },
  { from: 'pending', to: 'confirmed', action: 'approve' },
  { from: 'pending', to: 'cancelled', action: 'cancel' },
  { from: 'confirmed', to: 'shipped', action: 'ship' },
  { from: 'confirmed', to: 'invoiced', action: 'convert' },
  { from: 'confirmed', to: 'cancelled', action: 'cancel' },
  { from: 'shipped', to: 'delivered', action: 'deliver' },
  { from: 'shipped', to: 'invoiced', action: 'convert' },
  { from: 'delivered', to: 'completed', action: 'complete' },
  { from: 'invoiced', to: 'completed', action: 'complete' },
];

export const SALES_INVOICE_WORKFLOW: WorkflowTransition[] = [
  { from: 'draft', to: 'posted', action: 'post' },
  { from: 'draft', to: 'cancelled', action: 'cancel' },
  { from: 'posted', to: 'partially_paid', action: 'pay' },
  { from: 'posted', to: 'paid', action: 'pay' },
  { from: 'partially_paid', to: 'paid', action: 'pay' },
  { from: 'paid', to: 'completed', action: 'complete' },
];

export const PURCHASE_ORDER_WORKFLOW: WorkflowTransition[] = [
  { from: 'draft', to: 'pending', action: 'submit' },
  { from: 'pending', to: 'confirmed', action: 'approve' },
  { from: 'pending', to: 'cancelled', action: 'cancel' },
  { from: 'confirmed', to: 'received', action: 'receive' },
  { from: 'confirmed', to: 'cancelled', action: 'cancel' },
  { from: 'received', to: 'invoiced', action: 'convert' },
  { from: 'invoiced', to: 'completed', action: 'complete' },
];

// ==================== UTILITY FUNCTIONS ====================

export function getStatusConfig(status: WorkflowStatus): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.draft;
}

export function getAvailableActions(
  currentStatus: WorkflowStatus,
  workflow: WorkflowTransition[]
): string[] {
  return workflow
    .filter(t => t.from === currentStatus)
    .map(t => t.action);
}

export function canTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
  workflow: WorkflowTransition[]
): boolean {
  return workflow.some(t => t.from === from && t.to === to);
}

export function getNextStatus(
  currentStatus: WorkflowStatus,
  action: string,
  workflow: WorkflowTransition[]
): WorkflowStatus | null {
  const transition = workflow.find(
    t => t.from === currentStatus && t.action === action
  );
  return transition?.to || null;
}

export function getWorkflowForEntityType(entityType: string): WorkflowTransition[] {
  const workflowMap: Record<string, WorkflowTransition[]> = {
    'sales_order': SALES_ORDER_WORKFLOW,
    'sales_invoice': SALES_INVOICE_WORKFLOW,
    'purchase_order': PURCHASE_ORDER_WORKFLOW,
    'purchase_invoice': SALES_INVOICE_WORKFLOW, // Same as sales invoice
  };
  
  return workflowMap[entityType] || [];
}

export function isActionAllowed(
  action: string,
  currentStatus: WorkflowStatus,
  entityType: string
): boolean {
  const workflow = getWorkflowForEntityType(entityType);
  return workflow.some(t => t.from === currentStatus && t.action === action);
}

export function formatStatus(status: WorkflowStatus, language: 'en' | 'ar' = 'en'): string {
  const config = getStatusConfig(status);
  return language === 'ar' ? config.labelAr : config.label;
}

export function getStatusBadgeClasses(status: WorkflowStatus): string {
  const config = getStatusConfig(status);
  return `${config.bgColor} ${config.color}`;
}
