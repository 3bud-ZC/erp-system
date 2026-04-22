'use client';

import React from 'react';
import { ERPDataTable, ColumnConfig } from '@/components/erp/tables/ERPDataTable';

const columns: ColumnConfig[] = [
  { key: 'quotationNumber', header: 'Quotation #', headerAr: 'رقم العرض', type: 'text', sortable: true },
  { key: 'customerName', header: 'Customer', headerAr: 'العميل', type: 'text', sortable: true },
  { key: 'date', header: 'Date', headerAr: 'التاريخ', type: 'date', sortable: true },
  { key: 'expiryDate', header: 'Expiry', headerAr: 'تاريخ الانتهاء', type: 'date', sortable: true },
  { key: 'total', header: 'Total', headerAr: 'الإجمالي', type: 'currency', sortable: true },
  { key: 'workflow', header: 'Status', headerAr: 'الحالة', type: 'workflow', sortable: false },
  { key: 'actions', header: 'Actions', headerAr: 'إجراءات', type: 'actions', sortable: false, width: '120px' },
];

export default function QuotationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">عروض الأسعار</h1>
        <p className="text-gray-500 mt-1">إدارة عروض الأسعار وتحويلها إلى أوامر بيع</p>
      </div>

      <ERPDataTable
        entityType="quotation"
        columns={columns}
        title="Quotations"
        titleAr="عروض الأسعار"
        createRoute="/erp/sales/quotations/create"
        detailRoute="/erp/sales/quotations"
        workflowEnabled={true}
        bulkActions={true}
        exportEnabled={true}
      />
    </div>
  );
}
