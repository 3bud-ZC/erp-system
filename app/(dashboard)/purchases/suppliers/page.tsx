'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Filter, Download, Users, Building, Phone, Mail, MapPin, FileText } from 'lucide-react';
import Link from 'next/link';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
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
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      // Mock data for demonstration
      setSuppliers([
        {
          id: '1',
          code: 'SUP-001',
          nameAr: 'مورد أ',
          nameEn: 'Supplier A',
          phone: '01234567890',
          email: 'supplier.a@example.com',
          address: 'القاهرة، مصر',
          taxNumber: '123456789',
        },
        {
          id: '2',
          code: 'SUP-002',
          nameAr: 'مورد ب',
          nameEn: 'Supplier B',
          phone: '01123456789',
          email: 'supplier.b@example.com',
          address: 'الإسكندرية، مصر',
          taxNumber: '987654321',
        },
        {
          id: '3',
          code: 'SUP-003',
          nameAr: 'مورد ج',
          nameEn: 'Supplier C',
          phone: '01098765432',
          email: 'supplier.c@example.com',
          address: 'الجيزة، مصر',
          taxNumber: '456789123',
        }
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingSupplier ? 'PUT' : 'POST';
    const body = editingSupplier ? { id: editingSupplier.id, ...formData } : formData;

    await fetch('/api/suppliers', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setIsModalOpen(false);
    setEditingSupplier(null);
    setFormData({ code: '', nameAr: '', nameEn: '', phone: '', email: '', address: '', taxNumber: '' });
    fetchSuppliers();
  };

  const handleEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    setFormData(supplier);
    setIsModalOpen(true);
  };

  const handleDelete = async (supplier: any) => {
    if (confirm('هل أنت متأكد من حذف هذا المورد؟')) {
      await fetch(`/api/suppliers?id=${supplier.id}`, { method: 'DELETE' });
      fetchSuppliers();
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.phone.includes(searchTerm)
  );

  const stats = {
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter(s => s.phone).length,
    withEmail: suppliers.filter(s => s.email).length,
    withTaxNumber: suppliers.filter(s => s.taxNumber).length,
  };

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
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl backdrop-blur-xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-3">الموردين</h1>
            <p className="text-gray-600/80 text-lg">إدارة الموردين والموردين</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/purchases/invoices"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <FileText className="w-4 h-4" />
              <span className="font-medium">فواتير الشراء</span>
            </Link>
            <Link
              href="/purchases/orders"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <Building className="w-4 h-4" />
              <span className="font-medium">أوامر الشراء</span>
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">إضافة مورد</span>
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
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">إجمالي الموردين</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.totalSuppliers}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-xl animate-float">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.1s' }}>
          <div className="card-modern p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">نشطين</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.activeSuppliers}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-xl animate-float">
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
              placeholder="البحث عن الموردين..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 group-hover:bg-white/70 backdrop-blur-sm"
            />
            <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Suppliers Table Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">قائمة الموردين</h2>
          <div className="hidden lg:block">
            <EnhancedTable 
              columns={columns} 
              data={filteredSuppliers} 
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
          setEditingSupplier(null);
          setFormData({ code: '', nameAr: '', nameEn: '', phone: '', email: '', address: '', taxNumber: '' });
        }}
        title={editingSupplier ? 'تعديل مورد' : 'إضافة مورد جديد'}
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
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم العربي</label>
              <input
                type="text"
                required
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الإنجليزي</label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الهاتف</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الرقم الضريبي</label>
              <input
                type="text"
                value={formData.taxNumber}
                onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
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
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl font-medium"
            >
              {editingSupplier ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
