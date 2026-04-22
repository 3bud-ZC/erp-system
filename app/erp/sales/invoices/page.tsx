/**
 * Sales Invoices List Page
 * Production-ready sales invoice management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, FileText, Printer, ArrowLeft } from 'lucide-react';
import { WorkflowStatusBadge } from '@/components/erp/workflow/WorkflowStatusBadge';
import { SalesInvoice, WorkflowStatus } from '@/lib/erp-frontend-core/types';
import { fetchEntityList, approveTransaction, postTransaction } from '@/lib/erp-frontend-core/engine-integration';
import { getStatusConfig } from '@/lib/erp-frontend-core/workflow-utils';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function SalesInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    try {
      const result = await fetchEntityList('sales_invoice', {
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setInvoices(result.data as SalesInvoice[]);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePost(invoiceId: string) {
    const result = await postTransaction('sales_invoice', invoiceId);
    if (result.success) {
      loadInvoices();
    } else {
      alert(result.error || 'Failed to post invoice');
    }
  }

  async function handleApprove(invoiceId: string) {
    const result = await approveTransaction('sales_invoice', invoiceId);
    if (result.success) {
      loadInvoices();
    } else {
      alert(result.error || 'Failed to approve invoice');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">فواتير المبيعات</h1>
          <p className="text-gray-500 mt-1">إدارة فواتير البيع والتحصيل</p>
        </div>
        <button
          onClick={() => router.push('/erp/sales/invoices/create')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إنشاء فاتورة
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="البحث برقم الفاتورة أو العميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as WorkflowStatus | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">جميع الحالات</option>
            <option value="draft">مسودة</option>
            <option value="posted">مرحل</option>
            <option value="partially_paid">مدفوع جزئياً</option>
            <option value="paid">مدفوع</option>
          </select>

          <button
            onClick={loadInvoices}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">رقم الفاتورة</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">العميل</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">التاريخ</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المبلغ</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المدفوع</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    لا توجد فواتير
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{invoice.invoiceNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{invoice.customerName}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {format(new Date(invoice.date), 'PP', { locale: ar })}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-4 py-3 text-green-600">
                      {formatCurrency(invoice.paidAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <WorkflowStatusBadge
                        status={invoice.workflow.currentStatus}
                        showLabel
                        size="sm"
                        language="ar"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/erp/sales/invoices/${invoice.id}`)}
                          className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                          title="عرض"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePost(invoice.id)}
                          className="p-1 text-gray-500 hover:text-green-600 transition-colors"
                          title="ترحيل"
                          disabled={invoice.workflow.currentStatus !== 'draft'}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {/* Print */}}
                          className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                          title="طباعة"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
