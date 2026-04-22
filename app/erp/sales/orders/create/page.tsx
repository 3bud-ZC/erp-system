'use client';

import React from 'react';
import { EntityForm, FieldConfig } from '@/components/erp/forms/EntityForm';

const fields: FieldConfig[] = [
  { name: 'customerId', label: 'Customer', labelAr: 'العميل', type: 'autocomplete', entityType: 'customer', required: true, section: 'basic' },
  { name: 'date', label: 'Date', labelAr: 'التاريخ', type: 'date', required: true, section: 'basic' },
  { name: 'dueDate', label: 'Due Date', labelAr: 'تاريخ الاستحقاق', type: 'date', required: true, section: 'basic' },
  { name: 'reference', label: 'Reference', labelAr: 'المرجع', type: 'text', section: 'basic' },
  { name: 'items', label: 'Items', labelAr: 'الأصناف', type: 'items', required: true },
  { name: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
];

const sections = [
  { key: 'basic', title: 'Basic Information', titleAr: 'المعلومات الأساسية', fields: ['customerId', 'date', 'dueDate', 'reference'] },
];

export default function CreateSalesOrderPage() {
  return (
    <EntityForm
      entityType="sales_order"
      transactionType="SALES_ORDER"
      fields={fields}
      sections={sections}
      mode="create"
      workflowEnabled={true}
    />
  );
}
