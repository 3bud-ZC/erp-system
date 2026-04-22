'use client';

import React from 'react';
import { ERPDataTable, ColumnConfig } from '@/components/erp/tables/ERPDataTable';

const columns: ColumnConfig[] = [
  { key: 'orderNumber', header: 'PO #', headerAr: 'رقم أمر الشراء', type: 'text', sortable: true },
  { key: 'supplierName', header: 'Supplier', headerAr: 'المورد', type: 'text', sortable: true },
  { key: 'date', header: 'Date', headerAr: 'التاريخ', type: 'date', sortable: true },
  { key: 'expectedDate', header: 'Expected', headerAr: 'تاريخ التوقع', type: 'date', sortable: true },
  { key: 'total', header: 'Total', headerAr: 'الإجمالي', type: 'currency', sortable: true },
  { key: 'workflow', header: 'Status', headerAr: 'الحالة', type: 'workflow', sortable: false },
  { key: 'actions', header: 'Actions', headerAr: 'إجراءات', type: 'actions', sortable: false, width: '120px' },
];

export default function PurchaseOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">أوامر الشراء</h1>
        <p className="text-gray-500 mt-1">إدارة أوامر الشراء والاستلام</p>
      </div>

      <ERPDataTable
        entityType="purchase_order"
        columns={columns}
        title="Purchase Orders"
        titleAr="أوامر الشراء"
        createRoute="/erp/purchases/orders/create"
        detailRoute="/erp/purchases/orders"
        workflowEnabled={true}
        bulkActions={true}
        exportEnabled={true}
      />
    </div>
  );
}
