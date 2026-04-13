'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api-client';
import {
  Plus,
  Trash2,
  FileText,
  RefreshCw,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  ArrowUpDown,
  Edit,
  Save,
  Copy,
  Trash,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplier: { nameAr: string };
  date: string;
  total: number;
  status: string;
  notes?: string;
  items?: Array<{ productId: string; quantity: number; price: number; total: number }>;
}

interface Supplier {
  id: string;
  nameAr: string;
}

interface Product {
  id: string;
  nameAr: string;
  code: string;
  unit?: string;
  price?: number;
}

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

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [formData, setFormData] = useState({
    invoiceNumber: '',
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
      const [invoicesRes, suppliersRes, productsRes] = await Promise.all([
        fetch('/api/purchase-invoices'),
        fetch('/api/suppliers'),
        fetch('/api/products'),
      ]);

      if (!invoicesRes.ok || !suppliersRes.ok || !productsRes.ok) {
        throw new Error('فشل في تحميل البيانات');
      }

      setInvoices(await invoicesRes.json());
      setSuppliers(await suppliersRes.json());
      setProducts(await productsRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.supplier?.nameAr.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const pendingAmount = invoices.filter((inv) => inv.status === 'pending').reduce((sum, inv) => sum + inv.total, 0);

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
        newItems[index].price = parseFloat((product.price || 0).toString());
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
      if (!formData.invoiceNumber.trim()) {
        alert('يرجى إدخال رقم الفاتورة');
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

      // Check for invalid prices
      if (validItems.some(i => i.price < 0)) {
        alert('السعر لا يمكن أن يكون سالباً');
        return;
      }

      const data = {
        invoiceNumber: formData.invoiceNumber.trim(),
        supplierId: formData.supplierId,
        date: new Date(formData.date + 'T00:00:00.000Z'),
        status: formData.status,
        notes: formData.notes?.trim() || null,
        total: calculateTotal(),
        items: validItems.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity.toString()),
          price: parseFloat(item.price.toString()),
          total: parseFloat(item.total.toString()),
        })),
      };

      console.log('Submitting purchase invoice:', data);

      const method = editingInvoice ? 'PUT' : 'POST';
      const body = editingInvoice ? { id: editingInvoice.id, ...data } : data;

      const response = await fetch('/api/purchase-invoices', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Invoice submission error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to save invoice');
      }

      const result = await response.json();
      console.log('Invoice saved successfully:', result);

      // Only close form and reset if it's a new invoice
      if (!editingInvoice) {
        resetForm();
        setIsFormOpen(false);
      } else {
        // For editing, keep form open but refresh data
        setEditingInvoice(null);
      }

      fetchData();
    } catch (err) {
      console.error('Error submitting invoice:', err);
      alert(err instanceof Error ? err.message : 'خطأ في حفظ الفاتورة');
    }
  };

  const resetForm = () => {
    setFormData({
      invoiceNumber: '',
      supplierId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setItems([{ productId: '', productName: '', productCode: '', unit: '', quantity: 0, price: 0, total: 0 }]);
  };

  const handleNew = () => {
    resetForm();
    setEditingInvoice(null);
    // Generate auto invoice number
    const newInvoiceNumber = `PINV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`;
    setFormData(prev => ({ ...prev, invoiceNumber: newInvoiceNumber }));
    setIsFormOpen(true);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      invoiceNumber: invoice.invoiceNumber,
      supplierId: invoice.supplierId || '',
      date: new Date(invoice.date).toISOString().split('T')[0],
      status: invoice.status,
      notes: '',
    });
    if (invoice.items && invoice.items.length > 0) {
      setItems(invoice.items.map((item) => {
        const product = products.find((p: any) => p.id === item.productId);
        return {
          productId: item.productId || '',
          productName: product?.nameAr || '',
          productCode: product?.code || '',
          unit: product?.unit || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: item.total || 0,
        };
      }));
    } else {
      setItems([{ productId: '', productName: '', productCode: '', unit: '', quantity: 0, price: 0, total: 0 }]);
    }
    setIsFormOpen(true);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      try {
        const response = await fetch(`/api/purchase-invoices?id=${invoice.id}`, { 
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to delete invoice');
        }
        
        // Close form if deleting the currently edited invoice
        if (editingInvoice && editingInvoice.id === invoice.id) {
          setIsFormOpen(false);
          setEditingInvoice(null);
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
    const form = document.getElementById('purchase-invoice-form') as HTMLFormElement;
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
    if (editingInvoice) {
      // Create a copy with new invoice number and current date
      const newInvoiceNumber = `PINV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`;
      setFormData({ 
        ...formData, 
        invoiceNumber: newInvoiceNumber, 
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
      });
      setEditingInvoice(null);
      // Keep items as they are for copying
    }
  };

  const handleDeleteCurrent = () => {
    if (editingInvoice && confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      handleDelete(editingInvoice);
      setIsFormOpen(false);
    }
  };

  const handleNavigate = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (filteredInvoices.length === 0) return;
    
    let newIndex = currentIndex;
    switch (direction) {
      case 'first':
        newIndex = 0;
        break;
      case 'prev':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'next':
        newIndex = Math.min(filteredInvoices.length - 1, currentIndex + 1);
        break;
      case 'last':
        newIndex = filteredInvoices.length - 1;
        break;
    }
    
    setCurrentIndex(newIndex);
    handleEdit(filteredInvoices[newIndex]);
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
  }, [isFormOpen, editingInvoice, formData]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'معلقة',
      completed: 'مكتملة',
      cancelled: 'ملغية',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري تحميل الفواتير...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">فواتير الشراء</h1>
              <p className="text-gray-500 text-sm mt-1">إدارة فواتير المشتريات من الموردين</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/purchases/suppliers" className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
                الموردين
              </Link>
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                فاتورة جديدة
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="إجمالي الفواتير" value={invoices.length} subtitle="فاتورة" icon={FileText} color="bg-blue-500" />
            <StatCard title="إجمالي المشتريات" value={formatCurrency(totalAmount)} subtitle="جميع الفواتير" icon={Download} color="bg-green-500" />
            <StatCard title="المبالغ المعلقة" value={formatCurrency(pendingAmount)} subtitle="فواتير معلقة" icon={Calendar} color="bg-yellow-500" />
            <StatCard title="متوسط الفاتورة" value={formatCurrency(invoices.length > 0 ? totalAmount / invoices.length : 0)} subtitle="لكل فاتورة" icon={ArrowUpDown} color="bg-purple-500" />
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
                <option value="pending">معلقة</option>
                <option value="completed">مكتملة</option>
                <option value="cancelled">ملغية</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">رقم الفاتورة</th>
                    <th className="px-4 py-3 font-semibold">المورد</th>
                    <th className="px-4 py-3 font-semibold">التاريخ</th>
                    <th className="px-4 py-3 font-semibold">الإجمالي</th>
                    <th className="px-4 py-3 font-semibold">الحالة</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-3">{invoice.supplier?.nameAr || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(invoice.date).toLocaleDateString('ar-EG')}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(invoice.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {getStatusLabel(invoice.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleEdit(invoice)} className="text-blue-600 hover:underline text-sm ml-2">تعديل</button>
                        <button onClick={() => handleDelete(invoice)} className="text-red-600 hover:underline text-sm">حذف</button>
                      </td>
                    </tr>
                  ))}
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
                <NavButton icon={ChevronRight} onClick={() => handleNavigate('next')} disabled={currentIndex >= filteredInvoices.length - 1} />
                <NavButton icon={ChevronsRight} onClick={() => handleNavigate('last')} disabled={currentIndex >= filteredInvoices.length - 1} />
              </div>
              <button onClick={() => setIsFormOpen(false)} className="mr-4 text-lg">فواتير الشراء</button>
            </div>
          </div>

          {/* Purchase Invoice Form */}
          <form id="purchase-invoice-form" onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Header Fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الفاتورة</label>
                <input type="text" required value={formData.invoiceNumber} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
                <select required value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">اختر المورد...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.nameAr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="pending">معلقة</option>
                  <option value="completed">مكتملة</option>
                  <option value="cancelled">ملغية</option>
                </select>
              </div>
            </div>

            {/* Totals Display */}
            <div className="grid grid-cols-2 gap-4 p-4 border-b border-gray-200 bg-gray-50">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">المجموع الفرعي</label>
                <div className="text-lg font-bold text-gray-900">{calculateTotal().toFixed(2)}</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الإجمالي</label>
                <div className="text-xl font-bold text-blue-600">{calculateTotal().toFixed(2)}</div>
              </div>
            </div>

            {/* Notes */}
            <div className="px-4 py-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
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
                            onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value=""></option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>{product.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input
                            type="text"
                            value={item.productName}
                            readOnly
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm bg-gray-50"
                          />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input
                            type="text"
                            value={item.unit}
                            readOnly
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm bg-gray-50 text-center"
                          />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center"
                          />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center"
                          />
                        </td>
                        <td className="px-2 py-2 border border-gray-300 text-center font-bold">{item.total.toFixed(2)}</td>
                        <td className="px-2 py-2 border border-gray-300 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={handleAddItem} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                  <Plus className="w-4 h-4" /> إضافة صنف
                </button>
                <div className="bg-gray-50 px-6 py-2 rounded-lg border border-gray-200">
                  <span className="text-sm text-gray-600 ml-3">الإجمالي:</span>
                  <span className="text-xl font-bold text-gray-900">{calculateTotal().toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>

            <button type="submit" className="hidden">Submit</button>
          </form>
        </>
      )}
    </div>
  );
}
