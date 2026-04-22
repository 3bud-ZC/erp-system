'use client';

import React from 'react';
import { ERPDataTable, ColumnConfig } from '@/components/erp/tables/ERPDataTable';

const columns: ColumnConfig[] = [
  { key: 'orderNumber', header: 'Order #', headerAr: 'رقم الأمر', type: 'text', sortable: true },
  { key: 'customerName', header: 'Customer', headerAr: 'العميل', type: 'text', sortable: true },
  { key: 'date', header: 'Date', headerAr: 'التاريخ', type: 'date', sortable: true },
  { key: 'total', header: 'Total', headerAr: 'الإجمالي', type: 'currency', sortable: true },
  { key: 'workflow', header: 'Status', headerAr: 'الحالة', type: 'workflow', sortable: false },
  { key: 'actions', header: 'Actions', headerAr: 'إجراءات', type: 'actions', sortable: false, width: '120px' },
];

export default function SalesOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">أوامر البيع</h1>
        <p className="text-gray-500 mt-1">إدارة أوامر البيع وتحويلها إلى فواتير</p>
      </div>

      <ERPDataTable
        entityType="sales_order"
        columns={columns}
        title="Sales Orders"
        titleAr="أوامر البيع"
        createRoute="/erp/sales/orders/create"
        detailRoute="/erp/sales/orders"
        workflowEnabled={true}
        bulkActions={true}
        exportEnabled={true}
        filters={[
          { key: 'status', label: 'Status', type: 'select' },
          { key: 'customerId', label: 'Customer', type: 'select' },
          { key: 'dateFrom', label: 'Date From', type: 'date' },
          { key: 'dateTo', label: 'Date To', type: 'date' },
        ]}
      />
    </div>
  );
}
