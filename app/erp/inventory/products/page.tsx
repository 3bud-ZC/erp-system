'use client';

import React from 'react';
import { ERPDataTable, ColumnConfig } from '@/components/erp/tables/ERPDataTable';

const columns: ColumnConfig[] = [
  { key: 'code', header: 'Code', headerAr: 'الكود', type: 'text', sortable: true, width: '100px' },
  { key: 'nameAr', header: 'Name (AR)', headerAr: 'الاسم', type: 'text', sortable: true },
  { key: 'type', header: 'Type', headerAr: 'النوع', type: 'text', sortable: true, width: '100px' },
  { key: 'category', header: 'Category', headerAr: 'التصنيف', type: 'text', sortable: true },
  { key: 'quantity', header: 'Stock', headerAr: 'المخزون', type: 'number', sortable: true, width: '80px' },
  { key: 'unit', header: 'Unit', headerAr: 'الوحدة', type: 'text', sortable: false, width: '80px' },
  { key: 'price', header: 'Price', headerAr: 'السعر', type: 'currency', sortable: true, width: '100px' },
  { key: 'cost', header: 'Cost', headerAr: 'التكلفة', type: 'currency', sortable: true, width: '100px' },
  { key: 'status', header: 'Status', headerAr: 'الحالة', type: 'status', sortable: false, width: '100px' },
  { key: 'actions', header: 'Actions', headerAr: 'إجراءات', type: 'actions', sortable: false, width: '100px' },
];

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">المنتجات</h1>
        <p className="text-gray-500 mt-1">إدارة المنتجات والمخزون</p>
      </div>

      <ERPDataTable
        entityType="product"
        columns={columns}
        title="Products"
        titleAr="المنتجات"
        createRoute="/erp/inventory/products/create"
        detailRoute="/erp/inventory/products"
        workflowEnabled={false}
        bulkActions={true}
        exportEnabled={true}
      />
    </div>
  );
}
