'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  CreditCard,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface Invoice {
  id: string;
  invoiceNumber: string;
  supplier: { nameAr: string };
  date: string;
  total: number;
  status: string;
  branch?: string;
  warehouse?: string;
  costCenter?: string;
  sourceNumber?: string;
  permissionNumber?: string;
  resourceInvoiceNo?: string;
}

interface Supplier {
  id: string;
  nameAr: string;
}

interface Product {
  id: string;
  nameAr: string;
  code: string;
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
    branch: '',
    warehouse: '',
    costCenter: '',
    sourceNumber: '',
    permissionNumber: '',
    resourceInvoiceNo: '',
    receiptDate: '',
    status: 'pending',
    notes: '',
    barcode: '',
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
  });

  const [items, setItems] = useState([
    { productId: '', quantity: 0, price: 0, discount: 0, discountPercent: 0, tax: 0, total: 0 },
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
    setItems([...items, { productId: '', quantity: 0, price: 0, discount: 0, discountPercent: 0, tax: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'price' || field === 'discount' || field === 'discountPercent' || field === 'tax') {
      const qty = newItems[index].quantity || 0;
      const price = newItems[index].price || 0;
      const disc = newItems[index].discount || 0;
      const discPercent = newItems[index].discountPercent || 0;
      const tax = newItems[index].tax || 0;
      
      const subtotal = qty * price;
      const discountAmount = disc + (subtotal * discPercent / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * tax / 100;
      
      newItems[index].total = afterDiscount + taxAmount;
    }

    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const totalDiscount = items.reduce((sum, item) => sum + item.discount + (item.quantity * item.price * item.discountPercent / 100), 0);
    const totalTax = items.reduce((sum, item) => sum + ((item.quantity * item.price - item.discount) * item.tax / 100), 0);
    const total = items.reduce((sum, item) => sum + item.total, 0);
    
    // Apply invoice-level discounts
    const invoiceDiscount = formData.discountAmount + (total * formData.discountPercent / 100);
    const finalTotal = total - invoiceDiscount + (formData.taxAmount || 0);
    
    return { subtotal, totalDiscount, totalTax, total: finalTotal };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!formData.supplierId) {
        alert('يرجى اختيار مورد');
        return;
      }

      if (items.some((i) => !i.productId || i.quantity <= 0)) {
        alert('يرجى إدخال المنتجات والكميات بشكل صحيح');
        return;
      }

      const totals = calculateTotals();
      const data = {
        ...formData,
        date: new Date(formData.date),
        total: totals.total,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity.toString()),
          price: parseFloat(item.price.toString()),
          total: item.total,
        })),
      };

      const method = editingInvoice ? 'PUT' : 'POST';
      const body = editingInvoice ? { id: editingInvoice.id, ...data } : data;

      const res = await fetch('/api/purchase-invoices', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('فشل في حفظ الفاتورة');

      resetForm();
      setIsFormOpen(false);
      setEditingInvoice(null);
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
      branch: '',
      warehouse: '',
      costCenter: '',
      sourceNumber: '',
      permissionNumber: '',
      resourceInvoiceNo: '',
      receiptDate: '',
      status: 'pending',
      notes: '',
      barcode: '',
      discountPercent: 0,
      discountAmount: 0,
      taxPercent: 0,
      taxAmount: 0,
    });
    setItems([{ productId: '', quantity: 0, price: 0, discount: 0, discountPercent: 0, tax: 0, total: 0 }]);
  };

  const handleNew = () => {
    resetForm();
    setEditingInvoice(null);
    setIsFormOpen(true);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      invoiceNumber: invoice.invoiceNumber,
      supplierId: invoice.supplier?.nameAr || '',
      date: new Date(invoice.date).toISOString().split('T')[0],
      branch: invoice.branch || '',
      warehouse: invoice.warehouse || '',
      costCenter: invoice.costCenter || '',
      sourceNumber: invoice.sourceNumber || '',
      permissionNumber: invoice.permissionNumber || '',
      resourceInvoiceNo: invoice.resourceInvoiceNo || '',
      receiptDate: '',
      status: invoice.status,
      notes: '',
      barcode: '',
      discountPercent: 0,
      discountAmount: 0,
      taxPercent: 0,
      taxAmount: 0,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      await fetch(`/api/purchase-invoices?id=${invoice.id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleSave = () => {
    const form = document.getElementById('purchase-invoice-form') as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const handleCopy = () => {
    if (editingInvoice) {
      setFormData({ ...formData, invoiceNumber: '' });
      setEditingInvoice(null);
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

  const totals = calculateTotals();

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
              <Link href="/purchases/suppliers" className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
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

          {/* Purchase Invoice Form - Matching Image 5 */}
          <form id="purchase-invoice-form" onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Row 1 */}
            <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">رقم الفاتورة</label>
                <input type="text" required value={formData.invoiceNumber} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">التاريخ</label>
                <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الفرع</label>
                <select value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">اختر...</option>
                  <option value="main">الرئيسي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">المخازن</label>
                <select value={formData.warehouse} onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">اختر...</option>
                  <option value="main">المخزن الرئيسي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">مراكز التكلفة</label>
                <select value={formData.costCenter} onChange={(e) => setFormData({ ...formData, costCenter: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">اختر...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الموردين</label>
                <select required value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">اختر...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.nameAr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-8 gap-4 p-4 border-b border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الموردين</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"><option>اختر...</option></select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">رصيد</label>
                <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الاستلام</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"><option>اختر...</option></select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الحالة</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">رقم المصدر</label>
                <input type="text" value={formData.sourceNumber} onChange={(e) => setFormData({ ...formData, sourceNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">رقم الاذن</label>
                <input type="text" value={formData.permissionNumber} onChange={(e) => setFormData({ ...formData, permissionNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">ح.فاتورة الموارد</label>
                <input type="text" value={formData.resourceInvoiceNo} onChange={(e) => setFormData({ ...formData, resourceInvoiceNo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">ح.الاستحقاق</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>

            {/* Row 3 - Description */}
            <div className="p-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-right">البيان</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Payments Section Header */}
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
              <div className="w-1 h-4 bg-cyan-500"></div>
              <span className="font-bold text-gray-700">المدفوعات</span>
              <CreditCard className="w-4 h-4 text-cyan-500 mr-auto" />
            </div>

            {/* Barcode */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">باركود</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="باركود"
                  className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Totals Row */}
            <div className="grid grid-cols-8 gap-4 p-4 border-b border-gray-200 bg-gray-50">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">دفع نقدي</label>
                <input type="number" className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center" />
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">بنكي</label>
                <input type="number" className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center" />
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">دفع اجل</label>
                <input type="number" className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center" />
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الخصم $</label>
                <input type="number" value={formData.discountAmount} onChange={(e) => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center" />
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الخصم %</label>
                <input type="number" value={formData.discountPercent} onChange={(e) => setFormData({ ...formData, discountPercent: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center" />
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">اجمالي المدفوع</label>
                <div className="text-lg font-bold">0</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الضريبة</label>
                <div className="text-lg font-bold text-green-600">{totals.totalTax.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الخصومات</label>
                <div className="text-lg font-bold text-red-600">{totals.totalDiscount.toFixed(2)}</div>
              </div>
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
                      <th className="px-2 py-2 border border-gray-300 text-center">الوحدات</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">الكمية</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">سعر</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">الخصم</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">الخصم%</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">ن.ضريبة</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">الضريبة</th>
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
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value=""></option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 border border-gray-300"><input type="text" className="w-full px-1 py-1 border border-gray-300 rounded text-sm" readOnly /></td>
                        <td className="px-2 py-2 border border-gray-300"><input type="text" className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center" readOnly /></td>
                        <td className="px-2 py-2 border border-gray-300"><input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center" /></td>
                        <td className="px-2 py-2 border border-gray-300"><input type="number" min="0" step="0.01" value={item.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center" /></td>
                        <td className="px-2 py-2 border border-gray-300"><input type="number" min="0" step="0.01" value={item.discount} onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center" /></td>
                        <td className="px-2 py-2 border border-gray-300"><input type="number" min="0" max="100" value={item.discountPercent} onChange={(e) => handleItemChange(index, 'discountPercent', parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center" /></td>
                        <td className="px-2 py-2 border border-gray-300"><div className="text-center text-sm">0</div></td>
                        <td className="px-2 py-2 border border-gray-300"><input type="number" min="0" step="0.01" value={item.tax} onChange={(e) => handleItemChange(index, 'tax', parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center" /></td>
                        <td className="px-2 py-2 border border-gray-300"><div className="text-center font-bold text-sm">{item.total.toFixed(2)}</div></td>
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
