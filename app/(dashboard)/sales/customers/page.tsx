'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Filter, Download, Users, Building, Phone, Mail, MapPin, FileText, User } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/customers');
      if (!res.ok) throw new Error('فشل في تحميل العملاء');
      const data = await res.json();
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل العملاء');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingCustomer ? 'PUT' : 'POST';
    const body = editingCustomer ? { id: editingCustomer.id, ...formData } : formData;

    await fetch('/api/customers', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({ code: '', nameAr: '', nameEn: '', phone: '', email: '', address: '', taxNumber: '' });
    fetchCustomers();
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData(customer);
    setIsModalOpen(true);
  };

  const handleDelete = async (customer: any) => {
    if (confirm('هل أنت متأكد من حذف هذا العميل؟')) {
      await fetch(`/api/customers?id=${customer.id}`, { method: 'DELETE' });
      fetchCustomers();
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  const stats = {
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => c.phone).length,
    withEmail: customers.filter(c => c.email).length,
    withTaxNumber: customers.filter(c => c.taxNumber).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Users className="w-8 h-8 text-blue-600 mx-auto" />
          </div>
          <p className="text-gray-600">جاري تحميل العملاء...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border border-red-300 rounded-lg p-6 max-w-md mx-auto">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-red-800 font-medium mb-4">{error}</p>
          <button
            onClick={fetchCustomers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            إعادة محاولة
          </button>
        </div>
      </div>
    );
  }

  const columns = [
    { key: 'code', label: 'الكود', className: 'font-medium' },
    { key: 'nameAr', label: 'الاسم العربي', className: 'font-medium' },
    { key: 'nameEn', label: 'الاسم الإنجليزي', className: 'font-medium' },
    { key: 'phone', label: 'الهاتف', render: (value: any) => (
      <div className="flex items-center gap-2">
        <Phone className="w-4 h-4 text-gray-400" />
        <span>{value}</span>
      </div>
    )},
    { key: 'email', label: 'البريد الإلكتروني', render: (value: any) => (
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-gray-400" />
        <span className="text-sm">{value}</span>
      </div>
    )},
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-3xl backdrop-blur-xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-3">العملاء</h1>
            <p className="text-gray-600/80 text-lg">إدارة العملاء والعملاء</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/sales/invoices"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <FileText className="w-4 h-4" />
              <span className="font-medium">فواتير البيع</span>
            </Link>
            <Link
              href="/sales/orders"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <Building className="w-4 h-4" />
              <span className="font-medium">أوامر البيع</span>
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">إضافة عميل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="hidden lg:block animate-slideUp">
          <div className="card-modern p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">إجمالي العملاء</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.totalCustomers}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-xl animate-float">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.1s' }}>
          <div className="card-modern p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">نشطين</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.activeCustomers}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-xl animate-float">
                <Phone className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <div className="card-modern p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">لديهم بريد</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.withEmail}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-xl animate-float">
                <Mail className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <div className="card-modern p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">رقم ضريبي</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.withTaxNumber}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-xl animate-float">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <div className="relative">
            <input
              type="text"
              placeholder="البحث عن العملاء..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-300 group-hover:bg-white/70 backdrop-blur-sm"
            />
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Customers Table Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">قائمة العملاء</h2>
          <div className="hidden lg:block">
            <EnhancedTable 
              columns={columns} 
              data={filteredCustomers} 
              searchable={false}
              onEdit={handleEdit}
              onDelete={handleDelete}
              className="shadow-xl"
            />
          </div>
        </div>
      </div>

      {/* Modal */}
      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCustomer(null);
          setFormData({ code: '', nameAr: '', nameEn: '', phone: '', email: '', address: '', taxNumber: '' });
        }}
        title={editingCustomer ? 'تعديل عميل' : 'إضافة عميل جديد'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الكود</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم العربي</label>
              <input
                type="text"
                required
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الإنجليزي</label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الهاتف</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الرقم الضريبي</label>
              <input
                type="text"
                value={formData.taxNumber}
                onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 backdrop-blur-sm transition-all duration-300"
            />
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-white/20">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 bg-white/50 hover:bg-white/70 rounded-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm border border-white/20 font-medium"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl font-medium"
            >
              {editingCustomer ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
