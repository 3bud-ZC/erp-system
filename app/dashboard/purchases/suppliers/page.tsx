'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api-client';
import {
  Plus,
  Search,
  Phone,
  Mail,
  Building2,
  FileText,
  RefreshCw,
  AlertTriangle,
  Users,
  Truck,
  Edit,
  Trash2,
  ArrowUpDown,
} from 'lucide-react';

interface Supplier {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
}

// Stats Card Component
function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Supplier; direction: 'asc' | 'desc' } | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/suppliers');
      if (!res.ok) throw new Error('فشل في تحميل الموردين');
      const data = await res.json();
      setSuppliers(data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل الموردين');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: keyof Supplier) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredSuppliers = suppliers
    .filter((s) => {
      const search = searchTerm.toLowerCase();
      return (
        s.nameAr.toLowerCase().includes(search) ||
        s.nameEn?.toLowerCase().includes(search) ||
        s.code.toLowerCase().includes(search) ||
        s.phone?.includes(search)
      );
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const stats = {
    total: suppliers.length,
    withPhone: suppliers.filter((s) => s.phone).length,
    withEmail: suppliers.filter((s) => s.email).length,
    withTax: suppliers.filter((s) => s.taxNumber).length,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const method = editingSupplier ? 'PUT' : 'POST';
      const body = editingSupplier ? { id: editingSupplier.id, ...formData } : formData;

      await fetchApi('/api/suppliers', {
        method,
        body: JSON.stringify(body),
      });

      setIsModalOpen(false);
      setEditingSupplier(null);
      resetForm();
      fetchSuppliers();
    } catch (err) {
      console.error('Error saving supplier:', err);
      alert(err instanceof Error ? err.message : 'خطأ في حفظ المورد');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      nameAr: '',
      nameEn: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
    });
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      code: supplier.code,
      nameAr: supplier.nameAr,
      nameEn: supplier.nameEn || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      taxNumber: supplier.taxNumber || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (confirm('هل أنت متأكد من حذف هذا المورد؟')) {
      try {
        await fetchApi(`/api/suppliers?id=${supplier.id}`, { method: 'DELETE' });
      } catch (error: any) {
        alert(`خطأ في الحذف: ${error.message}`);
      }
      fetchSuppliers();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري تحميل الموردين...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-red-50 border border-red-200 rounded-xl p-8 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 font-medium mb-2">حدث خطأ</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchSuppliers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الموردين</h1>
          <p className="text-gray-500 text-sm mt-1">إدارة الموردين وبياناتهم</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/purchases/invoices"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            <FileText className="w-4 h-4" />
            فواتير الشراء
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            إضافة مورد
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي الموردين"
          value={stats.total}
          subtitle="مورد مسجل"
          icon={Truck}
          color="bg-blue-500"
        />
        <StatCard
          title="لديهم هاتف"
          value={stats.withPhone}
          subtitle={`${stats.total > 0 ? Math.round((stats.withPhone / stats.total) * 100) : 0}%`}
          icon={Phone}
          color="bg-green-500"
        />
        <StatCard
          title="لديهم بريد"
          value={stats.withEmail}
          subtitle={`${stats.total > 0 ? Math.round((stats.withEmail / stats.total) * 100) : 0}%`}
          icon={Mail}
          color="bg-purple-500"
        />
        <StatCard
          title="رقم ضريبي"
          value={stats.withTax}
          subtitle={`${stats.total > 0 ? Math.round((stats.withTax / stats.total) * 100) : 0}%`}
          icon={Building2}
          color="bg-orange-500"
        />
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="البحث في الموردين (الاسم، الكود، الهاتف)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1">
                    الكود
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('nameAr')}
                >
                  <div className="flex items-center gap-1">
                    الاسم
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-gray-700">الهاتف</th>
                <th className="px-4 py-3 font-semibold text-gray-700">البريد الإلكتروني</th>
                <th className="px-4 py-3 font-semibold text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    لا يوجد موردين مطابقين للبحث
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{supplier.code}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{supplier.nameAr}</p>
                        {supplier.nameEn && <p className="text-xs text-gray-500">{supplier.nameEn}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {supplier.phone ? (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Phone className="w-3 h-3" />
                          {supplier.phone}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {supplier.email ? (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Mail className="w-3 h-3" />
                          <span className="text-xs">{supplier.email}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {editingSupplier ? 'تعديل مورد' : 'إضافة مورد جديد'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الكود *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم العربي *</label>
                  <input
                    type="text"
                    required
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الإنجليزي</label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الهاتف</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الضريبي</label>
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingSupplier(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium"
                >
                  {isSubmitting ? 'جاري الحفظ...' : (editingSupplier ? 'تحديث' : 'إضافة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
