'use client';

import { useState } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Edit, Trash2, Download, MoreVertical } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
  mobilePriority?: 'high' | 'medium' | 'low';
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps {
  columns: Column[];
  data: any[];
  searchable?: boolean;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onView?: (item: any) => void;
  className?: string;
}

export default function ResponsiveTable({ 
  columns, 
  data, 
  searchable = true, 
  onEdit, 
  onDelete, 
  onView,
  className = '' 
}: ResponsiveTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const filteredData = data.filter((item) =>
    Object.values(item).some((value) =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const toggleRowExpanded = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const getVisibleColumns = () => columns.filter(col => !col.hideOnMobile);
  const getHighPriorityColumns = () => getVisibleColumns().filter(col => !col.mobilePriority || col.mobilePriority === 'high');
  const getRemainingColumns = () => getVisibleColumns().filter(col => col.mobilePriority && col.mobilePriority !== 'high');

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${className}`}>
      {/* Table Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex flex-col gap-4">
          {searchable && (
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {filteredData.length} نتيجة
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <Filter className="w-4 h-4 text-gray-600" />
              </button>
              <button className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <Download className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {getVisibleColumns().map((column, index) => (
                <th
                  key={index}
                  className={`px-6 py-4 text-right text-sm font-semibold text-gray-700 ${column.className || ''}`}
                >
                  {column.label}
                </th>
              ))}
              {(onView || onEdit || onDelete) && (
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentData.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                className="hover:bg-gray-50 transition-colors duration-150"
              >
                {getVisibleColumns().map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-6 py-4 text-sm text-gray-900 ${column.className || ''}`}
                  >
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
                {(onView || onEdit || onDelete) && (
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {onView && (
                        <button
                          onClick={() => onView(row)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-150"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-150"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-150"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Table */}
      <div className="lg:hidden divide-y divide-gray-100">
        {currentData.map((row, rowIndex) => (
          <div key={rowIndex} className="p-4 space-y-3">
            {/* Main Row */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  {getHighPriorityColumns().map((column, colIndex) => (
                    <div key={colIndex} className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 mb-1">{column.label}</div>
                      <div className={`text-sm text-gray-900 font-medium truncate ${column.className || ''}`}>
                        {column.render ? column.render(row[column.key], row) : row[column.key]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1 ml-2">
                {(onView || onEdit || onDelete) && (
                  <div className="relative">
                    <button
                      onClick={() => toggleRowExpanded(rowIndex)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {expandedRows.has(rowIndex) && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                        {onView && (
                          <button
                            onClick={() => {
                              onView(row);
                              toggleRowExpanded(rowIndex);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                            <span>عرض</span>
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => {
                              onEdit(row);
                              toggleRowExpanded(rowIndex);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                          >
                            <Edit className="w-4 h-4 text-green-600" />
                            <span>تعديل</span>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => {
                              onDelete(row);
                              toggleRowExpanded(rowIndex);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {expandedRows.has(rowIndex) && getRemainingColumns().length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <div className="grid grid-cols-1 gap-3">
                  {getRemainingColumns().map((column, colIndex) => (
                    <div key={colIndex} className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{column.label}</span>
                      <span className={`text-sm text-gray-900 font-medium ${column.className || ''}`}>
                        {column.render ? column.render(row[column.key], row) : row[column.key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-100">
          <div className="flex flex-col gap-4">
            <div className="text-sm text-gray-600 text-center">
              عرض {startIndex + 1} إلى {Math.min(endIndex, filteredData.length)} من {filteredData.length} نتيجة
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
