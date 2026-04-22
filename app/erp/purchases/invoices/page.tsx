'use client';

import React from 'react';
import { ERPDataTable, ColumnConfig } from '@/components/erp/tables/ERPDataTable';

const columns: ColumnConfig[] = [
  { key: 'invoiceNumber', header: 'Invoice #', headerAr: 'رقم الفاتورة', type: 'text', sortable: true },
  { key: 'supplierName', header: 'Supplier', headerAr: 'المورد', type: 'text', sortable: true },
  { key: 'purchaseOrderNumber', header: 'PO Ref', headerAr: 'مرجع أمر الشراء', type: 'text', sortable: true },
  { key: 'date', header: 'Date', headerAr: 'التاريخ', type: 'date', sortable: true },
  { key: 'dueDate', header: 'Due', headerAr: 'تاريخ الاستحقاق', type: 'date', sortable: true },
  { key: 'total', header: 'Total', headerAr: 'الإجمالي', type: 'currency', sortable: true },
  { key: 'paidAmount', header: 'Paid', headerAr: 'المدفوع', type: 'currency', sortable: true },
  { key: 'balance', header: 'Balance', headerAr: 'الرصيد', type: 'currency', sortable: true },
  { key: 'workflow', header: 'Status', headerAr: 'الحالة', type: 'workflow', sortable: false },
  { key: 'actions', header: 'Actions', headerAr: 'إجراءات', type: 'actions', sortable: false, width: '120px' },
];

export default function PurchaseInvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">فواتير الشراء</h1>
        <p className="text-gray-500 mt-1">إدارة فواتير الشراء والمدفوعات</p>
      </div>

      <ERPDataTable
        entityType="purchase_invoice"
        columns={columns}
        title="Purchase Invoices"
        titleAr="فواتير الشراء"
        createRoute="/erp/purchases/invoices/create"
        detailRoute="/erp/purchases/invoices"
        workflowEnabled={true}
        bulkActions={true}
        exportEnabled={true}
      />
    </div>
  );
}
