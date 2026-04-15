'use client';

import { useState, useEffect } from 'react';
import { getAuthHeaders, getAuthHeadersOnly } from '@/lib/api-client';
import {
  User,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  RefreshCw,
  X,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';

interface Customer {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
  });

  // Auto-generate customer code
  const generateCustomerCode = () => {
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CUST-${random}`;
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const headers = getAuthHeadersOnly();
      const response = await fetch('/api/customers', { 
        headers,
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setCustomers(Array.isArray(data) ? data : (data.data || []));
      } else {
        setCustomers([]);
      }
    } catch (error: any) {
      console.error('Error loading customers:', error);
      if (error.name === 'AbortError') {
        alert('استغرق تحميل البيانات وقتاً طويلاً. يرجى المحاولة مرة أخرى.');
      }
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCustomer ? '/api/customers' : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';
      
      const code = editingCustomer ? editingCustomer.code : generateCustomerCode();
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...(editingCustomer && { id: editingCustomer.id }),
          code,
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          taxNumber: formData.taxNumber,
        }),
      });

      if (response.ok) {
        resetForm();
        loadCustomers();
      } else {
        const error = await response.json();
        alert(error.message || 'حدث خطأ');
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      code: customer.code,
      nameAr: customer.nameAr,
      nameEn: customer.nameEn || '',
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      taxNumber: customer.taxNumber || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف العميل؟')) return;
    
    try {
      const response = await fetch(`/api/customers?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeadersOnly(),
      });

      if (response.ok) {
        loadCustomers();
      } else {
        const error = await response.json();
        alert(error.message || 'حدث خطأ أثناء الحذف');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('حدث خطأ أثناء الحذف');
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
    setEditingCustomer(null);
    setIsModalOpen(false);
  };

  const filteredCustomers = Array.isArray(customers) 
    ? customers.filter(c =>
        c.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
      )
    : [];

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل العملاء...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">العملاء</h1>
          <p className="text-gray-600 mt-1">إدارة بيانات العملاء</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadCustomers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            عميل جديد
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">إجمالي العملاء</p>
              <p className="text-2xl font-bold text-gray-900">{filteredCustomers.length}</p>
            </div>
            <User className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">تمت إضافتهم اليوم</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredCustomers.filter(c => {
                  const today = new Date().toISOString().split('T')[0];
                  return new Date(c.createdAt).toISOString().split('T')[0] === today;
                }).length}
              </p>
            </div>
            <User className="w-10 h-10 text-green-600" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="بحث عن عميل..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الكود</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الاسم</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الهاتف</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">البريد الإلكتروني</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">العنوان</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  لا يوجد عملاء
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{customer.nameAr}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {customer.phone}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {customer.email || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {customer.address || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="text-blue-600 hover:text-blue-800"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="text-red-600 hover:text-red-800"
                        title="حذف"
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCustomer ? 'تعديل عميل' : 'عميل جديد'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الكود {editingCustomer ? '' : <span className="text-gray-500">(تلقائي)</span>}
                  </label>
                  <input
                    type="text"
                    value={editingCustomer ? formData.code : generateCustomerCode()}
                    disabled={!editingCustomer}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الاسم بالعربية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الاسم بالإنجليزية
                  </label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الهاتف <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الرقم الضريبي
                  </label>
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    العنوان
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingCustomer ? 'تحديث' : 'إنشاء'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
