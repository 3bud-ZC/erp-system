'use client';

import React from 'react';
import { ERPDataTable, ColumnConfig } from '@/components/erp/tables/ERPDataTable';

const columns: ColumnConfig[] = [
  { key: 'entryNumber', header: 'Entry #', headerAr: 'رقم القيد', type: 'text', sortable: true },
  { key: 'date', header: 'Date', headerAr: 'التاريخ', type: 'date', sortable: true },
  { key: 'reference', header: 'Reference', headerAr: 'المرجع', type: 'text', sortable: true },
  { key: 'description', header: 'Description', headerAr: 'الوصف', type: 'text', sortable: false },
  { key: 'totalDebit', header: 'Debit', headerAr: 'مدين', type: 'currency', sortable: true },
  { key: 'totalCredit', header: 'Credit', headerAr: 'دائن', type: 'currency', sortable: true },
  { key: 'workflow', header: 'Status', headerAr: 'الحالة', type: 'workflow', sortable: false },
  { key: 'actions', header: 'Actions', headerAr: 'إجراءات', type: 'actions', sortable: false, width: '120px' },
];

export default function JournalEntriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">القيود اليومية</h1>
        <p className="text-gray-500 mt-1">إدارة القيود المحاسبية والترحيل</p>
      </div>

      <ERPDataTable
        entityType="journal_entry"
        columns={columns}
        title="Journal Entries"
        titleAr="القيود اليومية"
        createRoute="/erp/accounting/journal/create"
        detailRoute="/erp/accounting/journal"
        workflowEnabled={true}
        bulkActions={true}
        exportEnabled={true}
      />
    </div>
  );
}
