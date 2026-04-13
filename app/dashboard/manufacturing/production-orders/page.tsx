'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Clock, Package } from 'lucide-react';
import EnhancedCard from '@/components/EnhancedCard';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  productId: string;
  product: { nameAr: string; code: string };
  quantity: number;
  status: string;
  date: string;
  workInProgress: { totalCost: number; status: string } | null;
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
      const [ordersRes, productsRes] = await Promise.all([
        fetch('/api/production-orders'),
        fetch('/api/products'),
      ]);

      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({ productId: '', quantity: 0, laborCost: 0, overheadCost: 0, date: new Date().toISOString().split('T')[0] });
        setShowForm(false);
        loadData();
      }
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const response = await fetch('/api/production-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'completed' }),
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error completing order:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف أمر الإنتاج؟')) return;
    try {
      const response = await fetch(`/api/production-orders?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error deleting order:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
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
                  {order.workInProgress && (
                    <p className="text-sm text-blue-600 mt-1">
                      التكلفة الإجمالية: {order.workInProgress.totalCost.toFixed(2)} ريال
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {order.status === 'pending' ? (
                    <>
                      <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        قيد الإنتظار
                      </span>
                      <button
                        onClick={() => handleComplete(order.id)}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        إكمال
                      </button>
                    </>
                  ) : (
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
