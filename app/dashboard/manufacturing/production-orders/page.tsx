'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { Plus, Trash2, CheckCircle2, Clock, Package, PlayCircle, Info } from 'lucide-react';
import EnhancedCard from '@/components/EnhancedCard';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  productId: string;
  product: { nameAr: string; code: string; bom?: any[] };
  quantity: number;
  status: string;
  date: string;
  laborCost?: number;
  overheadCost?: number;
  workInProgress: { totalCost: number; materialCost: number; laborCost: number; overheadCost: number; status: string } | null;
}

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 0,
    laborCost: 0,
    overheadCost: 0,
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const [ordersRes, productsRes] = await Promise.all([
        fetch('/api/production-orders', { headers, signal: controller.signal, cache: 'no-store' }),
        fetch('/api/products', { headers, signal: controller.signal, cache: 'no-store' }),
      ]);
      
      clearTimeout(timeoutId);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(Array.isArray(ordersData) ? ordersData : (ordersData.data || []));
      } else {
        setOrders([]);
      }
      
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(Array.isArray(productsData) ? productsData : (productsData.data || []));
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
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const response = await fetch('/api/production-orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: formData.productId,
          quantity: Number(formData.quantity),
          laborCost: Number(formData.laborCost) || 0,
          overheadCost: Number(formData.overheadCost) || 0,
          date: new Date(formData.date).toISOString(),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في إنشاء أمر الإنتاج');
      }
      
      alert('تم إنشاء أمر الإنتاج بنجاح!');
      setFormData({ productId: '', quantity: 0, laborCost: 0, overheadCost: 0, date: new Date().toISOString().split('T')[0] });
      setShowForm(false);
      loadData();
    } catch (error: any) {
      console.error('Error creating order:', error);
      alert(error.message || 'حدث خطأ أثناء إنشاء أمر الإنتاج');
    }
  };

  const handleStart = async (id: string) => {
    try {
      await fetchApi('/api/production-orders', {
        method: 'PUT',
        body: JSON.stringify({ id, status: 'in_progress' }),
      });
      loadData();
    } catch (error) {
      console.error('Error starting order:', error);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await fetchApi('/api/production-orders', {
        method: 'PUT',
        body: JSON.stringify({ id, status: 'completed' }),
      });
      loadData();
    } catch (error) {
      console.error('Error completing order:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف أمر الإنتاج؟')) return;
    try {
      await fetchApi(`/api/production-orders?id=${id}`, { method: 'DELETE' });
      loadData();
    } catch (error) {
      console.error('Error deleting order:', error);
    }
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
      {/* Guide Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="bg-blue-500 text-white p-2 rounded-lg">
            <Info className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-blue-900 mb-2">📋 دليل سير العمل الإنتاجي</p>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-medium">1. قيد الانتظار</span>
                <span>→ إنشاء أمر إنتاج جديد</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">2. جاري الإنتاج</span>
                <span>→ بدء التشغيل وخصم المواد الخام من المخزون</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium">3. مكتمل</span>
                <span>→ إضافة المنتج النهائي للمخزون + تسجيل التكاليف</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-3 font-medium">💡 ملاحظة: يتم ربط الإنتاج تلقائياً بالمخزون والمحاسبة</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">أوامر الإنتاج</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          أمر إنتاج جديد
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">إنشاء أمر إنتاج جديد</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">المنتج</label>
                <select
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
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
                <label className="block text-sm font-medium mb-1">الكمية</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">تكلفة العمل</label>
                <input
                  type="number"
                  value={formData.laborCost}
                  onChange={(e) => setFormData({ ...formData, laborCost: parseFloat(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">تكلفة النفقات العامة</label>
                <input
                  type="number"
                  value={formData.overheadCost}
                  onChange={(e) => setFormData({ ...formData, overheadCost: parseFloat(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">التاريخ</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg">
                إنشاء
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">لا توجد أوامر إنتاج</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{order.product.nameAr}</h3>
                    <span className="text-sm bg-gray-100 px-2 py-1 rounded">{order.orderNumber}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    الكمية: {order.quantity} | التاريخ: {new Date(order.date).toLocaleDateString('ar-SA')}
                  </p>
                  
                  {/* BOM Display */}
                  {order.product.bom && order.product.bom.length > 0 && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <p className="font-semibold text-gray-700 mb-1">📦 المواد الخام المطلوبة:</p>
                      <div className="space-y-1">
                        {order.product.bom.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-gray-600">
                            <span>• {item.material?.nameAr || 'مادة'}</span>
                            <span className="font-medium">{(item.quantity * order.quantity).toFixed(2)} {item.material?.unit || 'وحدة'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Cost Breakdown */}
                  {order.workInProgress && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                      <p className="font-semibold text-blue-800 mb-1">💰 تفاصيل التكلفة:</p>
                      <div className="space-y-1 text-blue-700">
                        <div className="flex justify-between">
                          <span>تكلفة المواد:</span>
                          <span className="font-medium">{order.workInProgress.materialCost?.toFixed(2) || '0.00'} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span>تكلفة العمالة:</span>
                          <span className="font-medium">{order.workInProgress.laborCost?.toFixed(2) || '0.00'} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span>النفقات العامة:</span>
                          <span className="font-medium">{order.workInProgress.overheadCost?.toFixed(2) || '0.00'} ج.م</span>
                        </div>
                        <div className="flex justify-between border-t border-blue-200 pt-1 font-bold">
                          <span>الإجمالي:</span>
                          <span>{order.workInProgress.totalCost.toFixed(2)} ج.م</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {order.status === 'pending' && (
                    <>
                      <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        قيد الانتظار
                      </span>
                      <button
                        onClick={() => handleStart(order.id)}
                        className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"
                      >
                        <PlayCircle className="w-4 h-4" />
                        بدء الإنتاج
                      </button>
                    </>
                  )}
                  {order.status === 'in_progress' && (
                    <>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded flex items-center gap-1">
                        <PlayCircle className="w-4 h-4" />
                        جاري الإنتاج
                      </span>
                      <button
                        onClick={() => handleComplete(order.id)}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        إتمام الإنتاج
                      </button>
                    </>
                  )}
                  {order.status === 'completed' && (
                    <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      مكتمل
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(order.id)}
                    className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
