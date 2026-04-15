'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Trash2, FileText, ArrowRight, RefreshCw, AlertTriangle, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { fetchApi, getAuthHeadersOnly } from '@/lib/api-client';

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId?: string;
  supplier?: { nameAr: string };
  date: string;
  status: string;
  total: number;
  notes?: string;
  items?: any[];
}

interface FormItem {
  productId: string;
  quantity: number;
  price: number;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    orderNumber: '',
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'confirmed',
    notes: '',
  });
  
  const [items, setItems] = useState<FormItem[]>([
    { productId: '', quantity: 0, price: 0 },
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeadersOnly();
      const [ordersRes, suppliersRes, productsRes] = await Promise.all([
        fetch('/api/purchase-orders', { headers }),
        fetch('/api/suppliers', { headers }),
        fetch('/api/products', { headers }),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.data || data);
      }
      if (suppliersRes.ok) {
        const data = await suppliersRes.json();
        setSuppliers(data.data || data);
      }
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.data || data);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 0, price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-fill product details when product is selected
    if (field === 'productId' && value) {
      const product = products.find((p: any) => p.id === value);
      if (product) {
        newItems[index].price = product.price || 0;
      }
    }
    
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId) {
      setError('يرجى اختيار مورد');
      return;
    }

    if (items.some(item => !item.productId || item.quantity <= 0)) {
      setError('يرجى ملء جميع بيانات الأصناف');
      return;
    }

    try {
      setLoading(true);
      const method = editingOrder ? 'PUT' : 'POST';
      const body = {
        ...(editingOrder ? { id: editingOrder.id } : {}),
        ...formData,
        date: new Date(formData.date).toISOString(),
        items: items.map(item => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.quantity) * Number(item.price),
        })),
      };
      
      await fetchApi('/api/purchase-orders', {
        method,
        body: JSON.stringify(body),
      });

      setIsModalOpen(false);
      resetForm();
      setEditingOrder(null);
      await fetchData();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setFormData({
      orderNumber: order.orderNumber || '',
      supplierId: order.supplierId || '',
      date: new Date(order.date).toISOString().split('T')[0],
      status: order.status || 'pending',
      notes: order.notes || '',
    });
    
    // Populate items
    if (order.items && order.items.length > 0) {
      setItems(order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price || 0,
      })));
    } else {
      setItems([{ productId: '', quantity: 0, price: 0 }]);
    }
    
    setIsModalOpen(true);
  };

  const handleDelete = async (order: PurchaseOrder) => {
    if (!confirm('هل أنت متأكد من حذف هذا الأمر؟')) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/purchase-orders?id=${order.id}`, { 
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل حذف أمر الشراء');
      }
      await fetchData();
    } catch (err) {
      console.error('Error deleting order:', err);
      setError(err instanceof Error ? err.message : 'فشل حذف أمر الشراء');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (order: PurchaseOrder, newStatus: string) => {
    try {
      setLoading(true);
      await fetchApi('/api/purchase-orders', {
        method: 'PUT',
        body: JSON.stringify({ id: order.id, status: newStatus }),
      });
      await fetchData();
    } catch (err) {
      console.error('Error updating status:', err);
      setError('فشل تحديث الحالة');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      orderNumber: '',
      supplierId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'confirmed',
      notes: '',
    });
    setItems([{ productId: '', quantity: 0, price: 0 }]);
    setError(null);
  };

  const columns = [
    { key: 'orderNumber', label: 'رقم الأمر', className: 'font-medium' },
    {
      key: 'supplier',
      label: 'المورد',
      render: (value: any) => value?.nameAr || 'N/A',
    },
    {
      key: 'date',
      label: 'التاريخ',
      render: (value: string) => new Date(value).toLocaleDateString('ar-EG'),
    },
    {
      key: 'total',
      label: 'الإجمالي',
      render: (value: number) => `${value.toFixed(2)} ج.م`,
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (value: string, row: PurchaseOrder) => (
        <select
          value={value}
          onChange={(e) => handleStatusChange(row, e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 cursor-pointer transition-all ${getStatusColor(value)}`}
        >
          <option value="confirmed">مؤكد</option>
          <option value="shipped">تم الشحن</option>
          <option value="delivered">تم التسليم</option>
          <option value="cancelled">ملغي</option>
        </select>
      ),
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (_: any, row: PurchaseOrder) => (
        <div className="flex gap-2 items-center">
          <button
            onClick={() => handleDelete(row)}
            className="text-red-600 hover:text-red-800 transition-colors"
            title="حذف الأمر"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];


  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100',
      shipped: 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100',
      delivered: 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100',
      cancelled: 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100',
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      confirmed: 'مؤكد',
      shipped: 'تم الشحن',
      delivered: 'تم التسليم',
      cancelled: 'ملغي',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Header with Info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">أوامر الشراء</h1>
          <p className="text-gray-600 mt-1">حجز طلبات الموردين قبل إصدار الفاتورة النهائية</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/purchases/suppliers"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            الموردين
          </Link>
          <Link
            href="/dashboard/purchases/invoices"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <FileText className="w-4 h-4 inline ml-1" />
            فواتير الشراء
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            أمر شراء جديد
          </button>
        </div>
      </div>

      {/* Info Card: What is Purchase Order */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 mb-2">ما هو &quot;أمر الشراء&quot;؟</h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              أمر الشراء هو <strong>حجز مؤقت</strong> لطلب من المورد. يمكنك تتبع حالة الطلب من خلال:
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 mr-4">
              <li>• <strong>مؤكد:</strong> تم تأكيد الطلب من المورد</li>
              <li>• <strong>تم الشحن:</strong> تم شحن المنتجات من المورد</li>
              <li>• <strong>تم التسليم:</strong> استلمت المنتجات من المورد</li>
            </ul>
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 bg-white/50 p-2 rounded">
              <ArrowRight className="w-4 h-4" />
              <span>سير العمل: مؤكد → تم الشحن → تم التسليم</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-sm">إجمالي الأوامر</p>
          <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-700 text-sm">مؤكدة</p>
          <p className="text-2xl font-bold text-blue-800">
            {orders.filter(o => o.status === 'confirmed').length}
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-purple-700 text-sm">تم الشحن</p>
          <p className="text-2xl font-bold text-purple-800">
            {orders.filter(o => o.status === 'shipped').length}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 text-sm">تم التسليم</p>
          <p className="text-2xl font-bold text-green-800">
            {orders.filter(o => o.status === 'delivered').length}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">لا توجد أوامر شراء</p>
          <p className="text-sm text-gray-400 mt-1">أضف أمر شراء جديد لتسجيل طلب من مورد</p>
        </div>
      ) : (
        <EnhancedTable columns={columns} data={orders} />
      )}

      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
          setEditingOrder(null);
        }}
        title={editingOrder ? 'تعديل أمر شراء' : 'إضافة أمر شراء جديد'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم الأمر</label>
              <input
                type="text"
                required
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                placeholder="مثال: PO-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
              <select
                required
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر المورد</option>
                {suppliers.map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">الأصناف</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                إضافة صنف
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">المنتج</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">الكمية</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">سعر الوحدة</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">الإجمالي</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-2">
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">اختر المنتج</option>
                          {products.map((product: any) => (
                            <option key={product.id} value={product.id}>
                              {product.nameAr}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{(item.quantity * item.price).toFixed(2)} ج.م</span>
                      </td>
                      <td className="px-4 py-2">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="bg-gray-50 px-6 py-3 rounded-lg">
                <span className="text-sm text-gray-600 ml-4">الإجمالي:</span>
                <span className="text-xl font-bold text-gray-900">{calculateTotal().toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
