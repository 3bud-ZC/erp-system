'use client';

import { useState, useEffect } from 'react';
import { getAuthHeaders, getAuthHeadersOnly } from '@/lib/api-client';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Package,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  productId: string;
  product: { nameAr: string; code: string };
  quantity: number;
  status: 'pending' | 'in_progress' | 'completed';
  date: string;
  createdAt: string;
}

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 0,
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const headers = getAuthHeadersOnly();
      const [ordersRes, productsRes] = await Promise.all([
        fetch('/api/production-orders', { headers, signal: controller.signal, cache: 'no-store' }),
        fetch('/api/products?type=product', { headers, signal: controller.signal, cache: 'no-store' }),
      ]);
      
      clearTimeout(timeoutId);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(Array.isArray(data) ? data : (data.data || []));
      } else {
        setOrders([]);
      }
      
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(Array.isArray(data) ? data : (data.data || []));
      } else {
        setProducts([]);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      if (error.name === 'AbortError') {
        alert('استغرق تحميل البيانات وقتاً طويلاً. يرجى المحاولة مرة أخرى.');
      }
      setOrders([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productId) {
      alert('يرجى اختيار منتج');
      return;
    }
    
    if (formData.quantity <= 0) {
      alert('يرجى إدخال كمية صحيحة');
      return;
    }
    
    try {
      const response = await fetch('/api/production-orders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          productId: formData.productId,
          quantity: Number(formData.quantity),
          date: new Date(formData.date).toISOString(),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في إنشاء أمر الإنتاج');
      }
      
      alert('تم إنشاء أمر الإنتاج بنجاح!');
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error creating order:', error);
      alert(error.message || 'حدث خطأ أثناء إنشاء أمر الإنتاج');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/production-orders', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, status: newStatus }),
      });
      
      if (response.ok) {
        loadData();
      } else {
        const error = await response.json();
        alert(error.message || 'حدث خطأ');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف أمر الإنتاج؟')) return;
    
    try {
      const response = await fetch(`/api/production-orders?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeadersOnly(),
      });

      if (response.ok) {
        loadData();
      } else {
        const error = await response.json();
        alert(error.message || 'حدث خطأ أثناء الحذف');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  const resetForm = () => {
    setFormData({
      productId: '',
      quantity: 0,
      date: new Date().toISOString().split('T')[0],
    });
    setIsModalOpen(false);
  };

  const filteredOrders = Array.isArray(orders)
    ? orders.filter(o =>
        o.product?.nameAr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const statusCounts = {
    pending: filteredOrders.filter(o => o.status === 'pending').length,
    in_progress: filteredOrders.filter(o => o.status === 'in_progress').length,
    completed: filteredOrders.filter(o => o.status === 'completed').length,
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل أوامر الإنتاج...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">أوامر الإنتاج</h1>
          <p className="text-gray-600 mt-1">إدارة أوامر التصنيع والإنتاج</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            أمر إنتاج جديد
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">إجمالي الأوامر</p>
              <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
            </div>
            <Package className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">قيد الانتظار</p>
              <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">جاري الإنتاج</p>
              <p className="text-2xl font-bold text-blue-600">{statusCounts.in_progress}</p>
            </div>
            <PlayCircle className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">مكتمل</p>
              <p className="text-2xl font-bold text-green-600">{statusCounts.completed}</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="بحث عن أمر إنتاج..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم الأمر</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المنتج</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الكمية</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">التاريخ</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  لا توجد أوامر إنتاج
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {order.product?.nameAr} <span className="text-gray-500">({order.product?.code})</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{order.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(order.date).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="px-4 py-3">
                    {order.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        <Clock className="w-3 h-3" />
                        قيد الانتظار
                      </span>
                    )}
                    {order.status === 'in_progress' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        <PlayCircle className="w-3 h-3" />
                        جاري الإنتاج
                      </span>
                    )}
                    {order.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        مكتمل
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'in_progress')}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                          title="بدء الإنتاج"
                        >
                          <PlayCircle className="w-4 h-4" />
                        </button>
                      )}
                      {order.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'completed')}
                          className="text-green-600 hover:text-green-800 text-xs"
                          title="إتمام الإنتاج"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(order.id)}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">أمر إنتاج جديد</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  المنتج <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">اختر منتج</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الكمية <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  التاريخ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  إنشاء
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
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
