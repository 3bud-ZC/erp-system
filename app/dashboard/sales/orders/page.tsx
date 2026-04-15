'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Trash2, FileText, ArrowRight, RefreshCw, FileCheck, AlertTriangle, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchApi, getAuthHeadersOnly } from '@/lib/api-client';

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
  const router = useRouter();
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
      const headers = getAuthHeadersOnly();
      const [ordersRes, customersRes, productsRes] = await Promise.all([
        fetch('/api/sales-orders', { headers }),
        fetch('/api/customers', { headers }),
        fetch('/api/products', { headers }),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.data || data);
      }
      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data.data || data);
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
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/sales-orders?id=${order.id}`, { 
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل حذف أمر البيع');
      }
      await fetchData();
    } catch (err) {
      console.error('Error deleting order:', err);
      setError(err instanceof Error ? err.message : 'فشل حذف أمر البيع');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (order: SalesOrder, newStatus: string) => {
    try {
      setLoading(true);
      await fetchApi('/api/sales-orders', {
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
      render: (value: string, row: SalesOrder) => (
        <div className="flex flex-col gap-1">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(value)}`}>
            {getStatusLabel(value)}
          </span>
          {value === 'invoiced' && (
            <span className="text-xs text-green-600">تم التحويل ✓</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (_: any, row: SalesOrder) => (
        <div className="flex gap-2 items-center flex-wrap">
          {/* Status Change Dropdown */}
          {!['invoiced', 'cancelled'].includes(row.status) && (
            <select
              value={row.status}
              onChange={(e) => handleStatusChange(row, e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="pending">قيد الانتظار</option>
              <option value="confirmed">مؤكد</option>
              <option value="shipped">تم الشحن</option>
              <option value="delivered">تم التسليم</option>
            </select>
          )}
          
          {/* Convert to Invoice Button - Main Action! */}
          {row.status !== 'invoiced' && row.status !== 'cancelled' && (
            <button
              onClick={() => convertToInvoice(row)}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              title="تحويل أمر البيع إلى فاتورة نهائية"
            >
              <FileCheck className="w-3.5 h-3.5" />
              تحويل لفاتورة
            </button>
          )}
          
          {row.status === 'invoiced' && (
            <Link
              href="/dashboard/sales/invoices"
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200"
            >
              <FileText className="w-3.5 h-3.5" />
              عرض الفاتورة
            </Link>
          )}
          
          <button
            onClick={() => handleEdit(row)}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1"
          >
            تعديل
          </button>
          
          <button
            onClick={() => handleDelete(row)}
            className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1"
          >
            حذف
          </button>
        </div>
      ),
    },
  ];

  // Helper: Convert order to invoice
  const convertToInvoice = async (order: SalesOrder) => {
    if (!confirm(`تحويل أمر البيع "${order.orderNumber}" إلى فاتورة؟\n\nسيتم إنشاء فاتورة جديدة بنفس بيانات الأمر.`)) return;

    try {
      setLoading(true);
      
      // 1. Create invoice from order data
      const invoiceData = {
        invoiceNumber: `INV-${order.orderNumber}`,
        customerId: order.customerId,
        date: new Date().toISOString(),
        status: 'issued',
        notes: `تم إنشاء الفاتورة تلقائياً من أمر البيع: ${order.orderNumber}`,
        items: order.items?.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })) || [],
      };

      const response = await fetchApi('/api/sales-invoices', {
        method: 'POST',
        body: JSON.stringify(invoiceData),
      });

      // 2. Update order status to delivered (completed)
      await fetchApi('/api/sales-orders', {
        method: 'PUT',
        body: JSON.stringify({ 
          id: order.id, 
          status: 'invoiced',
          notes: `${order.notes || ''} | تم تحويله إلى فاتورة: ${response.data?.invoiceNumber || ''}`
        }),
      });

      alert('تم تحويل أمر البيع إلى فاتورة بنجاح!');
      fetchData();
      
      // Redirect to invoices page
      router.push('/dashboard/sales/invoices');
    } catch (err) {
      console.error('Error converting to invoice:', err);
      alert('فشل تحويل أمر البيع إلى فاتورة');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      shipped: 'bg-purple-100 text-purple-800 border-purple-200',
      delivered: 'bg-green-100 text-green-800 border-green-200',
      invoiced: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'قيد الانتظار',
      confirmed: 'مؤكد',
      shipped: 'تم الشحن',
      delivered: 'تم التسليم',
      invoiced: 'تم الفوترة ✓',
      cancelled: 'ملغي',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Header with Info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">أوامر البيع</h1>
          <p className="text-gray-600 mt-1">حجز طلبات العملاء قبل إصدار الفاتورة النهائية</p>
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
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <FileText className="w-4 h-4 inline ml-1" />
            فواتير البيع
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            أمر بيع جديد
          </button>
        </div>
      </div>

      {/* Info Card: What is Sales Order */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 mb-2">ما هو "أمر البيع"؟</h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              أمر البيع هو <strong>حجز مؤقت</strong> لطلب العميل. يمكنك استخدامه لـ:
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 mr-4">
              <li>• تسجيل طلب العميل قبل التأكد من توفر المخزون</li>
              <li>• حجز المنتجات للعميل مؤقتاً</li>
              <li>• <strong className="text-blue-900">تحويله لاحقاً إلى فاتورة نهائية</strong> (الضغط على زر "تحويل لفاتورة")</li>
            </ul>
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 bg-white/50 p-2 rounded">
              <ArrowRight className="w-4 h-4" />
              <span>سير العمل: أمر بيع → تأكيد → شحن → <strong>تحويل لفاتورة</strong></span>
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-yellow-700 text-sm">قيد الانتظار</p>
          <p className="text-2xl font-bold text-yellow-800">
            {orders.filter(o => o.status === 'pending').length}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-700 text-sm">مؤكدة</p>
          <p className="text-2xl font-bold text-blue-800">
            {orders.filter(o => ['confirmed', 'shipped'].includes(o.status)).length}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 text-sm">تم الفوترة</p>
          <p className="text-2xl font-bold text-green-800">
            {orders.filter(o => o.status === 'invoiced').length}
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
          <p className="text-gray-500">لا توجد أوامر بيع</p>
          <p className="text-sm text-gray-400 mt-1">أضف أمر بيع جديد لتسجيل طلب عميل</p>
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
