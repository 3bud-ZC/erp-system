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
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Calendar,
  DollarSign,
  ShoppingCart,
} from 'lucide-react';

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier: { nameAr: string; code: string };
  date: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
}

interface OrderItem {
  id?: string;
  productId: string;
  product?: { nameAr: string; code: string };
  quantity: number;
  price: number;
  total: number;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  
  const [formData, setFormData] = useState<{
    supplierId: string;
    date: string;
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
    notes: string;
  }>({
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    notes: '',
  });
  
  const [items, setItems] = useState<OrderItem[]>([
    { productId: '', quantity: 1, price: 0, total: 0 },
  ]);

  // Auto-generate order number
  const generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PO-${year}${month}${day}-${random}`;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const headers = getAuthHeadersOnly();
      const [ordersRes, customersRes, productsRes] = await Promise.all([
        fetch('/api/purchase-orders', { headers, signal: controller.signal, cache: 'no-store' }),
        fetch('/api/suppliers', { headers, signal: controller.signal, cache: 'no-store' }),
        fetch('/api/products?type=product', { headers, signal: controller.signal, cache: 'no-store' }),
      ]);
      
      clearTimeout(timeoutId);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(Array.isArray(data) ? data : (data.data || []));
      } else {
        setOrders([]);
      }
      
      if (customersRes.ok) {
        const data = await customersRes.json();
        setSuppliers(Array.isArray(data) ? data : (data.data || []));
      } else {
        setSuppliers([]);
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
      setSuppliers([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, price: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-fill price when product is selected
    if (field === 'productId' && value) {
      const product = products.find((p: any) => p.id === value);
      if (product) {
        newItems[index].price = product.price || 0;
      }
    }
    
    // Calculate total for this item
    newItems[index].total = newItems[index].quantity * newItems[index].price;
    
    setItems(newItems);
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId) {
      alert('يرجى اختيار مورد');
      return;
    }
    
    if (items.some(item => !item.productId || item.quantity <= 0)) {
      alert('يرجى ملء جميع بيانات الأصناف بشكل صحيح');
      return;
    }
    
    try {
      const orderNumber = editingOrder ? editingOrder.orderNumber : generateOrderNumber();
      
      const response = await fetch('/api/purchase-orders', {
        method: editingOrder ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...(editingOrder && { id: editingOrder.id }),
          orderNumber,
          supplierId: formData.supplierId,
          date: new Date(formData.date).toISOString(),
          status: formData.status,
          notes: formData.notes,
          total: calculateGrandTotal(),
          items: items.map(item => ({
            productId: item.productId,
            quantity: Number(item.quantity),
            price: Number(item.price),
            total: Number(item.total),
          })),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في حفظ أمر الشراء');
      }
      
      alert(editingOrder ? 'تم تحديث أمر الشراء بنجاح!' : 'تم إنشاء أمر الشراء بنجاح!');
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving order:', error);
      alert(error.message || 'حدث خطأ أثناء حفظ أمر الشراء');
    }
  };

  const handleEdit = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setFormData({
      supplierId: order.supplierId,
      date: new Date(order.date).toISOString().split('T')[0],
      status: order.status,
      notes: order.notes || '',
    });
    
    if (order.items && order.items.length > 0) {
      setItems(order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })));
    }
    
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف أمر الشراء؟')) return;
    
    try {
      const response = await fetch(`/api/purchase-orders?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeadersOnly(),
      });

      if (response.ok) {
        alert('تم حذف أمر الشراء بنجاح!');
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

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, status: newStatus }),
      });
      
      if (response.ok) {
        alert('تم تحديث الحالة بنجاح!');
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

  const resetForm = () => {
    setFormData({
      supplierId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setItems([{ productId: '', quantity: 1, price: 0, total: 0 }]);
    setEditingOrder(null);
    setIsModalOpen(false);
  };

  const filteredOrders = Array.isArray(orders)
    ? orders.filter(o =>
        o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.supplier?.nameAr?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const statusCounts = {
    pending: filteredOrders.filter(o => o.status === 'pending').length,
    confirmed: filteredOrders.filter(o => o.status === 'confirmed').length,
    shipped: filteredOrders.filter(o => o.status === 'shipped').length,
    delivered: filteredOrders.filter(o => o.status === 'delivered').length,
    cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, color: 'yellow', text: 'قيد الانتظار' },
      confirmed: { icon: CheckCircle2, color: 'blue', text: 'مؤكد' },
      shipped: { icon: Package, color: 'purple', text: 'تم الشحن' },
      delivered: { icon: CheckCircle2, color: 'green', text: 'تم التسليم' },
      cancelled: { icon: AlertCircle, color: 'red', text: 'ملغي' },
    };
    
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 bg-${badge.color}-100 text-${badge.color}-800 text-xs rounded-full`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل أوامر الشراء...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">أوامر الشراء</h1>
          <p className="text-gray-600 mt-1">إدارة أوامر الشراء والمشتريات</p>
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
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            أمر شراء جديد
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">إجمالي الأوامر</p>
              <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
            </div>
            <ShoppingCart className="w-10 h-10 text-blue-600" />
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
              <p className="text-sm text-gray-600">مؤكد</p>
              <p className="text-2xl font-bold text-blue-600">{statusCounts.confirmed}</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">تم الشحن</p>
              <p className="text-2xl font-bold text-purple-600">{statusCounts.shipped}</p>
            </div>
            <Package className="w-10 h-10 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">تم التسليم</p>
              <p className="text-2xl font-bold text-green-600">{statusCounts.delivered}</p>
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
          placeholder="بحث عن أمر شراء..."
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
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المورد</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">التاريخ</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الإجمالي</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  لا توجد أوامر شراء
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {order.supplier?.nameAr} <span className="text-gray-500">({order.supplier?.code})</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(order.date).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {order.total.toFixed(2)} ج.م
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'confirmed')}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                          title="تأكيد"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'shipped')}
                          className="text-purple-600 hover:text-purple-800 text-xs"
                          title="شحن"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                      )}
                      {order.status === 'shipped' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'delivered')}
                          className="text-green-600 hover:text-green-800 text-xs"
                          title="تسليم"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(order)}
                        className="text-blue-600 hover:text-blue-800"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                {editingOrder ? 'تعديل أمر شراء' : 'أمر شراء جديد'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    المورد <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">اختر مورد</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.nameAr} ({supplier.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الحالة <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">قيد الانتظار</option>
                    <option value="confirmed">مؤكد</option>
                    <option value="shipped">تم الشحن</option>
                    <option value="received">تم الاستلام</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ملاحظات
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ملاحظات إضافية..."
                  />
                </div>
              </div>

              {/* Items */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">الأصناف</h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة صنف
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          المنتج <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">اختر منتج</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nameAr} ({p.code}) - {p.price} ج.م
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          الكمية <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          السعر <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          الإجمالي
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={item.total.toFixed(2)}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        />
                      </div>

                      <div className="col-span-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                          className="w-full p-2 text-red-600 hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grand Total */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">الإجمالي الكلي:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {calculateGrandTotal().toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingOrder ? 'تحديث' : 'إنشاء'}
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
