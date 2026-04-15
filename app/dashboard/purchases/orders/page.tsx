'use client';

import { useState, useEffect } from 'react';
import { getAuthHeadersOnly, getAuthHeaders } from '@/lib/api-client';
import Link from 'next/link';
import { fetchApi } from '@/lib/api-client';
import {
  Plus,
  Search,
  Filter,
  Download,
  ArrowUpDown,
  Edit,
  Trash2,
  RefreshCw,
  ShoppingCart,
  Calendar,
  FileText,
  Save,
  Copy,
  Trash,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  Paperclip,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

// Toolbar Button Component
function ToolbarButton({ label, shortcut, icon: Icon, color, onClick }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    green: 'bg-emerald-500 hover:bg-emerald-600',
    red: 'bg-red-500 hover:bg-red-600',
    gray: 'bg-gray-500 hover:bg-gray-600',
  };

  return (
    <button
      onClick={onClick}
      className={`${colorClasses[color]} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span>{label}</span>
      {shortcut && <span className="text-xs opacity-75">{shortcut}</span>}
    </button>
  );
}

// Navigation Button
function NavButton({ icon: Icon, onClick, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-3 py-2 rounded-lg transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// Stats Card Component
function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId?: string;
  supplier?: { nameAr: string };
  date: string;
  total: number;
  status: string;
  notes: string;
  items?: Array<{
    productId: string;
    quantity: number;
    price: number;
    total: number;
    product?: { nameAr: string; code: string; unit: string };
  }>;
}

interface Supplier {
  id: string;
  nameAr: string;
}

interface Product {
  id: string;
  nameAr: string;
  code: string;
  unit: string;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'completed' | 'cancelled'>('all');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [formData, setFormData] = useState({
    orderNumber: '',
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    notes: '',
  });

  const [items, setItems] = useState([
    { productId: '', productName: '', productCode: '', unit: '', quantity: 0, price: 0, total: 0 },
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getAuthHeadersOnly();
      const [ordersRes, suppliersRes, productsRes] = await Promise.all([
        fetch('/api/purchase-orders', { headers }),
        fetch('/api/suppliers', { headers }),
        fetch('/api/products', { headers }),
      ]);

      if (!ordersRes.ok) throw new Error('Failed to fetch orders');
      const ordersData = await ordersRes.json();
      setOrders(Array.isArray(ordersData.data || ordersData) ? (ordersData.data || ordersData) : []);
      const suppliersData = await suppliersRes.json();
      setSuppliers(suppliersData.data || suppliersData);
      const productsData = await productsRes.json();
      setProducts(productsData.data || productsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplier?.nameAr?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalAmount = orders.reduce((sum, order) => sum + order.total, 0);

  const handleAddItem = () => {
    const newItem = { 
      productId: '', 
      productName: '', 
      productCode: '', 
      unit: '', 
      quantity: 0, 
      price: 0, 
      total: 0 
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    // Don't remove the last item
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      // Reset the last item instead of removing it
      setItems([{ 
        productId: '', 
        productName: '', 
        productCode: '', 
        unit: '', 
        quantity: 0, 
        price: 0, 
        total: 0 
      }]);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill product details when product is selected
    if (field === 'productId' && value) {
      const product = products.find((p: any) => p.id === value);
      if (product) {
        newItems[index].productName = product.nameAr || '';
        newItems[index].productCode = product.code || '';
        newItems[index].unit = product.unit || '';
        // Also set quantity to 1 if not set
        if (!newItems[index].quantity || newItems[index].quantity === 0) {
          newItems[index].quantity = 1;
        }
      }
    } else if (field === 'productId' && !value) {
      // Clear product details when product is cleared
      newItems[index].productName = '';
      newItems[index].productCode = '';
      newItems[index].unit = '';
      newItems[index].price = 0;
      newItems[index].quantity = 0;
    }

    // Auto-calculate totals
    if (field === 'quantity' || field === 'price' || field === 'productId') {
      const qty = Math.max(0, parseFloat(newItems[index].quantity.toString()) || 0);
      const price = Math.max(0, parseFloat(newItems[index].price.toString()) || 0);
      
      newItems[index].quantity = qty;
      newItems[index].price = price;
      newItems[index].total = qty * price;
    }

    setItems(newItems);
  };

  const calculateTotal = () => items.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Enhanced validation
      if (!formData.orderNumber.trim()) {
        alert('يرجى إدخال رقم أمر الشراء');
        return;
      }

      if (!formData.supplierId) {
        alert('يرجى اختيار مورد');
        return;
      }

      if (!formData.date) {
        alert('يرجى اختيار التاريخ');
        return;
      }

      // Filter out empty items and validate
      const validItems = items.filter(i => i.productId && i.quantity > 0);
      if (validItems.length === 0) {
        alert('يرجى إدخال منتج واحد على الأقل');
        return;
      }

      // Verify supplier is selected
      if (!formData.supplierId) {
        alert('يرجى اختيار مورد');
        return;
      }

      // Check if products exist
      const invalidProducts = validItems.filter(item => !products.find(p => p.id === item.productId));
      if (invalidProducts.length > 0) {
        alert('بعض المنتجات غير موجودة في النظام');
        return;
      }

      // Check for invalid prices
      if (validItems.some(i => i.price < 0)) {
        alert('السعر لا يمكن أن يكون سالباً');
        return;
      }

      const total = calculateTotal();
      
      // Ensure date is valid
      const orderDate = formData.date ? new Date(formData.date) : new Date();
      
      const data = {
        orderNumber: formData.orderNumber.trim(),
        supplierId: formData.supplierId,
        date: orderDate.toISOString(),
        status: formData.status,
        notes: formData.notes?.trim() || null,
        total,
        items: validItems.map(item => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity.toString()),
          unitPrice: parseFloat(item.price.toString()),
        })),
      };

      console.log('Submitting purchase order:', data);

      const method = editingOrder ? 'PUT' : 'POST';
      const url = editingOrder ? `/api/purchase-orders?id=${editingOrder.id}` : '/api/purchase-orders';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingOrder ? { id: editingOrder.id, ...data } : data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Order submission error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to save order');
      }

      const result = await response.json();
      console.log('Order saved successfully:', result);

      // Only close form and reset if it's a new order
      if (!editingOrder) {
        resetForm();
        setIsFormOpen(false);
      } else {
        // For editing, keep form open but refresh data
        setEditingOrder(null);
      }

      fetchData();
    } catch (err) {
      console.error('Error submitting order:', err);
      alert(err instanceof Error ? err.message : 'خطأ في حفظ أمر الشراء');
    }
  };

  const resetForm = () => {
    setFormData({
      orderNumber: '',
      supplierId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setItems([{ productId: '', productName: '', productCode: '', unit: '', quantity: 0, price: 0, total: 0 }]);
  };

  const handleNew = () => {
    resetForm();
    setEditingOrder(null);
    // Generate auto order number
    const newOrderNumber = `PO-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, '0')}`;
    setFormData(prev => ({ ...prev, orderNumber: newOrderNumber }));
    setIsFormOpen(true);
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
    // Populate items when editing
    if (order.items && order.items.length > 0) {
      setItems(order.items.map((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        return {
          productId: item.productId || '',
          productName: product?.nameAr || item.product?.nameAr || '',
          productCode: product?.code || item.product?.code || '',
          unit: product?.unit || item.product?.unit || '',
          quantity: item.quantity || 0,
          price: item.price || item.unitPrice || 0,
          total: (item.quantity || 0) * (item.price || item.unitPrice || 0),
        };
      }));
    } else {
      setItems([{ productId: '', productName: '', productCode: '', unit: '', quantity: 0, price: 0, total: 0 }]);
    }
    setIsFormOpen(true);
  };

  const handleDelete = async (order: PurchaseOrder) => {
    if (confirm('هل أنت متأكد من حذف هذا الأمر؟')) {
      try {
        const response = await fetch(`/api/purchase-orders?id=${order.id}`, { 
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to delete order');
        }
        
        // Close form if deleting the currently edited order
        if (editingOrder && editingOrder.id === order.id) {
          setIsFormOpen(false);
          setEditingOrder(null);
          resetForm();
        }
        
        fetchData();
      } catch (error: any) {
        console.error('Delete error:', error);
        alert(`خطأ في الحذف: ${error.message}`);
      }
    }
  };

  const handleSave = async () => {
    const form = document.getElementById('purchase-order-form') as HTMLFormElement;
    if (form) {
      try {
        form.requestSubmit();
      } catch (error) {
        console.error('Save error:', error);
        alert('حدث خطأ أثناء الحفظ');
      }
    }
  };

  const handleCopy = () => {
    if (editingOrder) {
      // Create a copy with new order number and current date
      const newOrderNumber = `PO-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, '0')}`;
      setFormData({ 
        ...formData, 
        orderNumber: newOrderNumber, 
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
      });
      setEditingOrder(null);
      // Keep items as they are for copying
    }
  };

  const handleDeleteCurrent = () => {
    if (editingOrder && confirm('هل أنت متأكد من حذف هذا الأمر؟')) {
      handleDelete(editingOrder);
      setIsFormOpen(false);
    }
  };

  const handleNavigate = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (filteredOrders.length === 0) return;
    
    let newIndex = currentIndex;
    switch (direction) {
      case 'first':
        newIndex = 0;
        break;
      case 'prev':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'next':
        newIndex = Math.min(filteredOrders.length - 1, currentIndex + 1);
        break;
      case 'last':
        newIndex = filteredOrders.length - 1;
        break;
    }
    
    setCurrentIndex(newIndex);
    handleEdit(filteredOrders[newIndex]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFormOpen) return;
      
      if (e.key === 'F7') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleCopy();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleDeleteCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen, editingOrder, formData, handleSave, handleCopy, handleDeleteCurrent]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'معلق',
      approved: 'معتمد',
      completed: 'مكتمل',
      cancelled: 'ملغي',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري تحميل أوامر الشراء...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-red-50 border border-red-200 rounded-xl p-8 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 font-medium mb-2">حدث خطأ</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isFormOpen ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">أوامر الشراء</h1>
              <p className="text-gray-500 text-sm mt-1">إدارة أوامر الشراء من الموردين</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/purchases/suppliers" className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
                الموردين
              </Link>
              <Link href="/dashboard/purchases/invoices" className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
                فواتير الشراء
              </Link>
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                أمر جديد
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="إجمالي الأوامر" value={orders.length} subtitle="أمر" icon={FileText} color="bg-blue-500" />
            <StatCard title="إجمالي القيمة" value={formatCurrency(totalAmount)} subtitle="جميع الأوامر" icon={ShoppingCart} color="bg-green-500" />
            <StatCard title="معلق" value={orders.filter(o => o.status === 'pending').length} subtitle="أمر" icon={Calendar} color="bg-yellow-500" />
            <StatCard title="معتمد" value={orders.filter(o => o.status === 'approved').length} subtitle="أمر" icon={ArrowUpDown} color="bg-purple-500" />
          </div>

          {/* Filters & Table */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="البحث..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="all">جميع الحالات</option>
                <option value="pending">معلق</option>
                <option value="approved">معتمد</option>
                <option value="completed">مكتمل</option>
                <option value="cancelled">ملغي</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">رقم الأمر</th>
                    <th className="px-4 py-3 font-semibold">المورد</th>
                    <th className="px-4 py-3 font-semibold">التاريخ</th>
                    <th className="px-4 py-3 font-semibold">الإجمالي</th>
                    <th className="px-4 py-3 font-semibold">الحالة</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        لا توجد أوامر شراء
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{order.orderNumber || order.id.slice(-6)}</td>
                        <td className="px-4 py-3">{order.supplier?.nameAr || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(order.date).toLocaleDateString('ar-EG')}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(order.total)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleEdit(order)} className="text-blue-600 hover:underline text-sm ml-2">تعديل</button>
                          <button onClick={() => handleDelete(order)} className="text-red-600 hover:underline text-sm">حذف</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Form Header with Toolbar */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ToolbarButton label="حفظ" shortcut="F7" icon={Save} color="blue" onClick={handleSave} />
                <ToolbarButton label="نسخ" shortcut="F8" icon={Copy} color="green" onClick={handleCopy} />
                <ToolbarButton label="حذف" shortcut="F9" icon={Trash} color="red" onClick={handleDeleteCurrent} />
              </div>
              <div className="flex items-center gap-2">
                <NavButton icon={ChevronsLeft} onClick={() => handleNavigate('first')} disabled={currentIndex === 0} />
                <NavButton icon={ChevronLeft} onClick={() => handleNavigate('prev')} disabled={currentIndex === 0} />
                <NavButton icon={ChevronRight} onClick={() => handleNavigate('next')} disabled={currentIndex >= filteredOrders.length - 1} />
                <NavButton icon={ChevronsRight} onClick={() => handleNavigate('last')} disabled={currentIndex >= filteredOrders.length - 1} />
              </div>
              <button onClick={() => setIsFormOpen(false)} className="mr-4 text-lg">أوامر الشراء</button>
            </div>
          </div>

          {/* Purchase Order Form - Matching Image */}
          <form id="purchase-order-form" onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Row 1 - Order Info */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">رقم الأمر</label>
                <input type="text" required value={formData.orderNumber} onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">التاريخ</label>
                <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">المورد</label>
                <select required value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">اختر المورد...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.nameAr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الحالة</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="pending">معلق</option>
                  <option value="approved">معتمد</option>
                  <option value="completed">مكتمل</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>
            </div>

            {/* Row 2 - Totals */}
            <div className="grid grid-cols-3 gap-4 p-4 border-b border-gray-200 bg-gray-50">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">المجموع الفرعي</label>
                <div className="text-lg font-bold">{calculateTotal().toFixed(2)}</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                <div className="text-lg font-bold">{getStatusLabel(formData.status)}</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الإجمالي</label>
                <div className="text-xl font-bold text-blue-600">{calculateTotal().toFixed(2)}</div>
              </div>
            </div>

            {/* Description */}
            <div className="p-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-right">البيان / الملاحظات</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="أدخل بيان أو ملاحظات عن أمر الشراء..."
              />
            </div>

            {/* Items Table */}
            <div className="p-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 border border-gray-300 text-center">م</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">ك.الصنف</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">الصنف</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">الوحدة</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">الكمية</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">السعر</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">المجموع</th>
                      <th className="px-2 py-2 border border-gray-300 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-2 py-2 border border-gray-300 text-center">{index + 1}</td>
                        <td className="px-2 py-2 border border-gray-300">
                          <select
                            value={item.productId}
                            onChange={(e) => {
                              const product = products.find((p: any) => p.id === e.target.value);
                              const newItems = [...items];
                              const productId = e.target.value;
                              
                              if (productId && product) {
                                // Product selected - fill all details at once
                                newItems[index] = { 
                                  ...newItems[index], 
                                  productId: productId,
                                  productCode: product.code || '',
                                  productName: product.nameAr || '',
                                  unit: product.unit || '',
                                  quantity: newItems[index].quantity || 1,
                                  price: newItems[index].price || 0
                                };
                              } else {
                                // Product cleared - reset fields
                                newItems[index] = { 
                                  ...newItems[index], 
                                  productId: '',
                                  productCode: '',
                                  productName: '',
                                  unit: '',
                                  quantity: 0,
                                  price: 0
                                };
                              }
                              
                              // Recalculate total
                              const qty = Math.max(0, parseFloat(newItems[index].quantity.toString()) || 0);
                              const price = Math.max(0, parseFloat(newItems[index].price.toString()) || 0);
                              newItems[index].total = qty * price;
                              
                              setItems(newItems);
                            }}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value=""></option>
                            {products.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input type="text" value={item.productName} readOnly className="w-full px-1 py-1 border border-gray-300 rounded text-sm bg-gray-50" />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input type="text" value={item.unit} readOnly className="w-full px-1 py-1 border border-gray-300 rounded text-sm bg-gray-50 text-center" />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center" />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input type="number" min="0" step="0.01" value={item.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center" />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <div className="text-center font-bold text-sm">{item.total.toFixed(2)}</div>
                        </td>
                        <td className="px-2 py-2 border border-gray-300 text-center">
                          <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={handleAddItem} className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                <Plus className="w-4 h-4" /> إضافة صنف
              </button>
            </div>

            <button type="submit" className="hidden">Submit</button>
          </form>
        </>
      )}
    </div>
  );
}
