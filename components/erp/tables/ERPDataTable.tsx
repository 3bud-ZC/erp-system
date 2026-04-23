'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { WorkflowStatusBadge } from '@/components/erp/workflow/WorkflowStatusBadge';
import { fetchEntityList, approveTransaction, postTransaction, cancelTransaction } from '@/lib/erp-frontend-core/engine-integration';
import { WorkflowStatus } from '@/lib/erp-frontend-core/types';
import { getAvailableActions, WORKFLOW_ACTIONS } from '@/lib/erp-frontend-core/workflow-utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Search,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  Printer,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  FileCheck,
  Loader2,
} from 'lucide-react';

export interface ColumnConfig {
  key: string;
  header: string;
  headerAr: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'status' | 'actions' | 'workflow';
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  format?: (value: any, row: any) => string | React.ReactNode;
}

export interface ERPDataTableProps {
  entityType: string;
  columns: ColumnConfig[];
  title: string;
  titleAr: string;
  createRoute?: string;
  detailRoute?: string;
  workflowEnabled?: boolean;
  bulkActions?: boolean;
  exportEnabled?: boolean;
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  filters?: { key: string; label: string; type: 'text' | 'select' | 'date'; options?: any[] }[];
}

export function ERPDataTable({
  entityType,
  columns,
  title,
  titleAr,
  createRoute,
  detailRoute,
  workflowEnabled = true,
  bulkActions = true,
  exportEnabled = true,
  defaultSort,
  filters,
}: ERPDataTableProps) {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
  });
  const [sort, setSort] = useState(defaultSort || { key: 'createdAt', direction: 'desc' });
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchEntityList(entityType, {
        search: search || undefined,
        sortKey: sort.key,
        sortDirection: sort.direction,
        ...activeFilters,
      }, {
        page: pagination.page,
        perPage: pagination.perPage,
      });

      setData(result.data);
      setPagination((prev) => ({
        ...prev,
        total: result.total,
        totalPages: Math.ceil(result.total / prev.perPage),
      }));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [entityType, search, sort, activeFilters, pagination.page, pagination.perPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (key: string) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleRowSelect = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedRows((prev) => [...prev, id]);
    } else {
      setSelectedRows((prev) => prev.filter((rowId) => rowId !== id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedRows(data.map((row) => row.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleWorkflowAction = async (action: string, entityId: string) => {
    setActionLoading(entityId);
    try {
      let result;
      switch (action) {
        case 'approve':
          result = await approveTransaction(entityType, entityId);
          break;
        case 'post':
          result = await postTransaction(entityType, entityId);
          break;
        case 'cancel':
          result = await cancelTransaction(entityType, entityId, 'Cancelled by user');
          break;
        default:
          console.warn('Unknown action:', action);
          return;
      }

      if (result.success) {
        loadData();
      } else {
        alert(result.error || 'Action failed');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const renderCell = (column: ColumnConfig, value: any, row: any) => {
    if (column.format) {
      return column.format(value, row);
    }

    switch (column.type) {
      case 'currency':
        return value?.toLocaleString('ar-SA', { style: 'currency', currency: 'EGP' });
      case 'date':
        return value ? format(new Date(value), 'PP', { locale: ar }) : '-';
      case 'status':
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            value === 'active' ? 'bg-green-100 text-green-800' :
            value === 'inactive' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {value}
          </span>
        );
      case 'workflow':
        return row.workflow ? (
          <WorkflowStatusBadge
            status={row.workflow.currentStatus}
            showLabel
            size="sm"
            language="ar"
          />
        ) : '-';
      default:
        return value || '-';
    }
  };

  const renderActions = (row: any) => {
    const availableActions = workflowEnabled && row.workflow
      ? getAvailableActions(row.workflow.currentStatus, [])
      : [];

    return (
      <div className="flex items-center gap-1">
        {detailRoute && (
          <button
            onClick={() => router.push(`${detailRoute}/${row.id}`)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="عرض"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}

        {availableActions.includes('approve') && (
          <button
            onClick={() => handleWorkflowAction('approve', row.id)}
            disabled={actionLoading === row.id}
            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
            title="موافقة"
          >
            {actionLoading === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        )}

        {availableActions.includes('post') && (
          <button
            onClick={() => handleWorkflowAction('post', row.id)}
            disabled={actionLoading === row.id}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="ترحيل"
          >
            {actionLoading === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
          </button>
        )}

        {availableActions.includes('cancel') && (
          <button
            onClick={() => handleWorkflowAction('cancel', row.id)}
            disabled={actionLoading === row.id}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="إلغاء"
          >
            {actionLoading === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          </button>
        )}

        <button
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title="المزيد"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{titleAr}</h2>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="البحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9 pl-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            {filters && (
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Filter className="w-4 h-4" />
              </button>
            )}

            {/* Export */}
            {exportEnabled && (
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Create */}
            {createRoute && (
              <button
                onClick={() => router.push(createRoute)}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                إنشاء جديد
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {bulkActions && selectedRows.length > 0 && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700">
              {selectedRows.length} عنصر محدد
            </span>
            <div className="flex-1" />
            <button className="px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 rounded transition-colors">
              ترحيل الكل
            </button>
            <button className="px-3 py-1 text-sm text-red-700 hover:bg-red-100 rounded transition-colors">
              إلغاء الكل
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {bulkActions && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === data.length && data.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: column.width }}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      {column.headerAr}
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  ) : (
                    column.headerAr
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (bulkActions ? 1 : 0)} className="px-3 py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (bulkActions ? 1 : 0)}
                  className="px-3 py-8 text-center text-gray-500"
                >
                  لا توجد بيانات
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {bulkActions && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.id)}
                        onChange={(e) => handleRowSelect(row.id, e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-3 text-sm text-gray-900">
                      {column.type === 'actions'
                        ? renderActions(row)
                        : renderCell(column, row[column.key], row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          عرض {((pagination.page - 1) * pagination.perPage) + 1} - {Math.min(pagination.page * pagination.perPage, pagination.total)} من {pagination.total}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          
          <span className="text-sm text-gray-700">
            صفحة {pagination.page} من {pagination.totalPages}
          </span>
          
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
