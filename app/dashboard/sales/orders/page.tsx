'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api-client';

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId?: string;
  customer?: { nameAr: string };
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

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    orderNumber: '',
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
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
      const [ordersRes, customersRes, productsRes] = await Promise.all([
        fetch('/api/sales-orders'),
        fetch('/api/customers'),
        fetch('/api/products'),
      ]);

      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (customersRes.ok) setCustomers(await customersRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
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

  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId) {
      setError('يرجى اختيار عميل');
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
      
      await fetchApi('/api/sales-orders', {
        method,
        body: JSON.stringify(body),
      });

      setIsModalOpen(false);
      resetForm();
      setEditingOrder(null);
      await fetchData();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sales order');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (order: SalesOrder) => {
    setEditingOrder(order);
    setFormData({
      orderNumber: order.orderNumber || '',
      customerId: order.customerId || '',
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

  const handleDelete = async (order: SalesOrder) => {
    if (!confirm('هل أنت متأكد من حذف هذا الأمر؟')) return;
    
    try {
      setLoading(true);
      await fetch(`/api/sales-orders?id=${order.id}`, { method: 'DELETE' });
      await fetchData();
    } catch (err) {
      console.error('Error deleting order:', err);
      setError('فشل حذف أمر البيع');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      orderNumber: '',
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setItems([{ productId: '', quantity: 0, price: 0 }]);
    setError(null);
  };

  const columns = [
    { key: 'orderNumber', label: 'رقم الأمر', className: 'font-medium' },
    {
      key: 'customer',
      label: 'العميل',
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
      render: (value: string) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          value === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          value === 'confirmed' ? 'bg-blue-100 text-blue-800' :
          value === 'shipped' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value === 'pending' ? 'قيد الانتظار' :
           value === 'confirmed' ? 'مؤكد' :
           value === 'shipped' ? 'مشحون' : value}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (_: any, row: SalesOrder) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            تعديل
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            حذف
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">أوامر البيع</h1>
          <p className="text-gray-600 mt-1">إدارة أوامر البيع (لا تؤثر على المخزون - يتم التأثير عند إصدار الفاتورة)</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/sales/customers"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            العملاء
          </Link>
          <Link
            href="/dashboard/sales/invoices"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            فواتير البيع
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            إضافة أمر بيع
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">لا توجد أوامر بيع</p>
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
        title={editingOrder ? 'تعديل أمر بيع' : 'إضافة أمر بيع جديد'}
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
                placeholder="مثال: SO-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">العميل</label>
              <select
                required
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر العميل</option>
                {customers.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.nameAr}
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
