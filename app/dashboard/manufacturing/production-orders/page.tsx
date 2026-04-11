'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Trash2, Settings, Factory, Calendar, Package, PlayCircle, CheckCircle, XCircle, Clock, Search } from 'lucide-react';
import Link from 'next/link';

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    orderNumber: '',
    productId: '',
    quantity: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'pending',
    notes: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const productsRes = await fetch('/api/products');
      setProducts(await productsRes.json());
    } catch (error) {
      console.error('Error fetching products:', error);
      // Mock data for demonstration
      setProducts([
        { id: '1', nameAr: 'أكياس بلاستيك', nameEn: 'Plastic Bags' },
        { id: '2', nameAr: 'زجاجات بلاستيك', nameEn: 'Plastic Bottles' },
        { id: '3', nameAr: 'صناديق بلاستيك', nameEn: 'Plastic Containers' },
        { id: '4', nameAr: 'أنابيب بلاستيك', nameEn: 'Plastic Pipes' },
        { id: '5', nameAr: 'ألواح بلاستيك', nameEn: 'Plastic Sheets' },
      ]);
    }
  };

  useEffect(() => {
    fetchProducts();
    // Mock orders data
    setOrders([
      {
        id: '1',
        orderNumber: 'PO-001',
        product: 'أكياس بلاستيك',
        quantity: 1000,
        startDate: '2024-01-15',
        endDate: '2024-01-20',
        status: 'completed'
      },
      {
        id: '2',
        orderNumber: 'PO-002',
        product: 'زجاجات بلاستيك',
        quantity: 500,
        startDate: '2024-01-18',
        endDate: '',
        status: 'in_progress'
      },
      {
        id: '3',
        orderNumber: 'PO-003',
        product: 'صناديق بلاستيك',
        quantity: 750,
        startDate: '2024-01-20',
        endDate: '',
        status: 'pending'
      }
    ]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      startDate: new Date(formData.startDate),
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      quantity: parseFloat(formData.quantity.toString()) || 0,
    };

    setIsModalOpen(false);
    resetForm();
    alert('order created successfully');
  };

  const resetForm = () => {
    setFormData({
      orderNumber: '',
      productId: '',
      quantity: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      status: 'pending',
      notes: '',
    });
  };

  const filteredOrders = orders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    inProgressOrders: orders.filter(o => o.status === 'in_progress').length,
    completedOrders: orders.filter(o => o.status === 'completed').length,
  };

  const columns = [
    { key: 'orderNumber', label: 'رقم الأمر', className: 'font-medium' },
    { key: 'product', label: 'المنتج', className: 'font-medium' },
    { key: 'quantity', label: 'الكمية', className: 'font-medium' },
    { key: 'startDate', label: 'تاريخ البدء', className: 'font-medium' },
    { key: 'endDate', label: 'تاريخ الانتهاء', className: 'font-medium' },
    { key: 'status', label: 'الحالة', render: (value: any) => {
      const statusConfig: Record<string, { color: string; bg: string; icon: any; text: string }> = {
        pending: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock, text: 'قيد الانتظار' },
        in_progress: { color: 'text-blue-600', bg: 'bg-blue-100', icon: PlayCircle, text: 'قيد التنفيذ' },
        completed: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle, text: 'مكتمل' },
        cancelled: { color: 'text-red-600', bg: 'bg-red-100', icon: XCircle, text: 'ملغي' },
      };
      const config = statusConfig[value] || statusConfig.pending;
      const Icon = config.icon;
      return (
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
            {config.text}
          </span>
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
      );
    }},
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-3xl backdrop-blur-xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-3">أوامر الإنتاج</h1>
            <p className="text-gray-600/80 text-lg">إدارة أوامر الإنتاج والمتابعة</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/manufacturing/operations"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <Settings className="w-4 h-4" />
              <span className="font-medium">عمليات الإنتاج</span>
            </Link>
            <Link
              href="/manufacturing/cost-study"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <Package className="w-4 h-4" />
              <span className="font-medium">دراسة التكاليف</span>
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">إضافة أمر إنتاج</span>
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
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">إجمالي الأوامر</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.totalOrders}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-xl animate-float">
                <Factory className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.1s' }}>
          <div className="card-modern p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">قيد الانتظار</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.pendingOrders}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-xl animate-float">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <div className="card-modern p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">قيد التنفيذ</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.inProgressOrders}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-xl animate-float">
                <PlayCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <div className="card-modern p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">مكتملة</span>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stats.completedOrders}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-xl animate-float">
                <CheckCircle className="w-6 h-6 text-white" />
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
              placeholder="البحث عن أوامر الإنتاج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-300 group-hover:bg-white/70 backdrop-blur-sm"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Production Orders Table Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">قائمة أوامر الإنتاج</h2>
          <div className="hidden lg:block">
            <EnhancedTable 
              columns={columns} 
              data={filteredOrders} 
              searchable={false}
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
          resetForm();
        }}
        title="إضافة أمر إنتاج جديد"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">رقم الأمر</label>
              <input
                type="text"
                required
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">المنتج</label>
              <select
                required
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 backdrop-blur-sm transition-all duration-300"
              >
                <option value="">اختر المنتج</option>
                {products.map((product: any) => (
                  <option key={product.id} value={product.id}>
                    {product.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الكمية</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 backdrop-blur-sm transition-all duration-300"
              >
                <option value="pending">قيد الانتظار</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="completed">مكتمل</option>
                <option value="cancelled">ملغي</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ البدء</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ الانتهاء</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 backdrop-blur-sm transition-all duration-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 backdrop-blur-sm transition-all duration-300"
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
              className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl font-medium"
            >
              حفظ
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
