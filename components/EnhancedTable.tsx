'use client';

import { useState } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Edit, Trash2, Download } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

interface EnhancedTableProps {
  columns: Column[];
  data: any[];
  searchable?: boolean;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onView?: (item: any) => void;
  className?: string;
}

export default function EnhancedTable({ 
  columns, 
  data, 
  searchable = true, 
  onEdit, 
  onDelete, 
  onView,
  className = '' 
}: EnhancedTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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

  return (
    <div className={`bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden ${className}`}>
      {/* Table Header */}
      <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/50 to-white/30">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            {searchable && (
              <div className="relative group">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus:text-blue-500 transition-all duration-300 group-hover:scale-110" />
                <input
                  type="text"
                  placeholder="بحث..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 group-hover:bg-white/70 backdrop-blur-sm"
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20">
              <span className="text-sm font-medium">تصفية</span>
              <Filter className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20">
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">تصدير</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 border-b border-white/20">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-6 py-4 text-right text-sm font-bold text-gray-800/90 ${column.className || ''}`}
                >
                  {column.label}
                </th>
              ))}
              {(onView || onEdit || onDelete) && (
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-800/90">
                  إجراءات
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {currentData.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-purple-50/30 transition-all duration-300 group hover:scale-[1.01]"
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-6 py-4 text-sm text-gray-900 border-b border-white/5 ${column.className || ''}`}
                  >
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
                {(onView || onEdit || onDelete) && (
                  <td className="px-6 py-4 border-b border-white/5">
                    <div className="flex items-center justify-end gap-2">
                      {onView && (
                        <button
                          onClick={() => onView(row)}
                          className="p-2 text-blue-600 hover:bg-blue-100/50 hover:text-blue-700 rounded-xl transition-all duration-300 transform hover:scale-110 hover:shadow-lg"
                          title="عرض"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="p-2 text-green-600 hover:bg-green-100/50 hover:text-green-700 rounded-xl transition-all duration-300 transform hover:scale-110 hover:shadow-lg"
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="p-2 text-red-600 hover:bg-red-100/50 hover:text-red-700 rounded-xl transition-all duration-300 transform hover:scale-110 hover:shadow-lg"
                          title="حذف"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-6 border-t border-white/10 bg-gradient-to-r from-white/30 to-white/20">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="text-sm text-gray-600/80 font-medium">
              <span>عرض {startIndex + 1} إلى {Math.min(endIndex, filteredData.length)} من {filteredData.length} نتيجة</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-white/20 hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-110 disabled:hover:scale-100 backdrop-blur-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 hover:scale-110 ${
                      currentPage === page
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : 'hover:bg-white/50 text-gray-700 backdrop-blur-sm'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-white/20 hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-110 disabled:hover:scale-100 backdrop-blur-sm"
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
