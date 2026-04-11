'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  AlertTriangle,
  RefreshCw,
  Save,
  Copy,
  Trash,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calculator,
} from 'lucide-react';
import Link from 'next/link';
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: { nameAr: string };
  date: string;
  total: number;
  status: string;
  branch?: string;
  discountPercent?: number;
  discountAmount?: number;
  tax?: number;
}

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    customerId: '',
    store: '',
    branch: '',
    account: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    notes: '',
    discountPercent: 0,
    discountAmount: 0,
    tax: 0,
  });

  const [items, setItems] = useState([
    { productId: '', productName: '', unit: '', quantity: 0, price: 0, discount: 0, discountPercent: 0, tax: 0, netTax: 0, total: 0 },
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invoicesRes, customersRes, productsRes] = await Promise.all([
        fetch('/api/sales-invoices'),
        fetch('/api/customers'),
        fetch('/api/products'),
      ]);

      if (!invoicesRes.ok || !customersRes.ok || !productsRes.ok) {
        throw new Error('فشل في تحميل البيانات');
      }

      setInvoices(await invoicesRes.json());
      setCustomers(await customersRes.json());
      setProducts(await productsRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', productName: '', unit: '', quantity: 0, price: 0, discount: 0, discountPercent: 0, tax: 0, netTax: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-calculate totals
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
      newItems[index].netTax = taxAmount;
    }
    
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const totalDiscount = items.reduce((sum, item) => sum + item.discount + (item.quantity * item.price * item.discountPercent / 100), 0);
    const totalTax = items.reduce((sum, item) => sum + item.netTax, 0);
    const total = items.reduce((sum, item) => sum + item.total, 0);
    
    // Apply invoice-level discounts
    const invoiceDiscount = formData.discountAmount + (total * formData.discountPercent / 100);
    const finalTotal = total - invoiceDiscount;
    
    return { subtotal, totalDiscount, totalTax, total: finalTotal };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formData.customerId) {
        alert('يرجى اختيار عميل');
        return;
      }

      if (items.some(i => !i.productId || i.quantity <= 0)) {
        alert('يرجى إدخال المنتجات والكميات بشكل صحيح');
        return;
      }

      const totals = calculateTotals();
      const data = {
        ...formData,
        date: new Date(formData.date),
        total: totals.total,
        items: items.map(item => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity.toString()),
          price: parseFloat(item.price.toString()),
          discount: item.discount,
          discountPercent: item.discountPercent,
          tax: item.tax,
          total: item.total,
        })),
      };

      const method = editingInvoice ? 'PUT' : 'POST';
      const body = editingInvoice ? { id: editingInvoice.id, ...data } : data;

      const res = await fetch('/api/sales-invoices', {
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
      customerId: '',
      store: '',
      branch: '',
      account: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
      discountPercent: 0,
      discountAmount: 0,
      tax: 0,
    });
    setItems([{ productId: '', productName: '', unit: '', quantity: 0, price: 0, discount: 0, discountPercent: 0, tax: 0, netTax: 0, total: 0 }]);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      store: invoice.branch || '',
      branch: invoice.branch || '',
      account: '',
      date: new Date(invoice.date).toISOString().split('T')[0],
      status: invoice.status,
      notes: '',
      discountPercent: invoice.discountPercent || 0,
      discountAmount: invoice.discountAmount || 0,
      tax: invoice.tax || 0,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      await fetch(`/api/sales-invoices?id=${invoice.id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleNew = () => {
    resetForm();
    setEditingInvoice(null);
    setIsFormOpen(true);
  };

  const handleSave = () => {
    const form = document.getElementById('sales-invoice-form') as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const handleCopy = () => {
    if (editingInvoice) {
      setFormData({ ...formData, invoiceNumber: '', date: new Date().toISOString().split('T')[0] });
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
    if (invoices.length === 0) return;
    
    let newIndex = currentIndex;
    switch (direction) {
      case 'first':
        newIndex = 0;
        break;
      case 'prev':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'next':
        newIndex = Math.min(invoices.length - 1, currentIndex + 1);
        break;
      case 'last':
        newIndex = invoices.length - 1;
        break;
    }
    
    setCurrentIndex(newIndex);
    handleEdit(invoices[newIndex]);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-green-600 mx-auto animate-spin mb-4" />
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
              <h1 className="text-2xl font-bold text-gray-900">أوامر البيع</h1>
              <p className="text-gray-500 text-sm mt-1">إدارة فواتير البيع</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/sales/customers" className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                العملاء
              </Link>
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                فاتورة جديدة
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700">رقم الفاتورة</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">العميل</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">التاريخ</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">الإجمالي</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">الحالة</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        لا توجد فواتير
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
                        <td className="px-4 py-3">{invoice.customer?.nameAr || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(invoice.date).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(invoice.total)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            invoice.status === 'completed' ? 'bg-green-100 text-green-700' : 
                            invoice.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {invoice.status === 'completed' ? 'مكتملة' : 
                             invoice.status === 'cancelled' ? 'ملغية' : 'معلقة'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleEdit(invoice)}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDelete(invoice)}
                            className="text-red-600 hover:underline text-sm mr-3"
                          >
                            حذف
                          </button>
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
                <NavButton icon={ChevronRight} onClick={() => handleNavigate('next')} disabled={currentIndex >= invoices.length - 1} />
                <NavButton icon={ChevronsRight} onClick={() => handleNavigate('last')} disabled={currentIndex >= invoices.length - 1} />
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="mr-4 text-white hover:text-gray-200"
              >
                <span className="text-lg">أوامر البيع</span>
              </button>
            </div>
          </div>

          {/* Sales Invoice Form */}
          <form id="sales-invoice-form" onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* First Row */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-200">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">رقم الفاتورة</label>
                <input
                  type="text"
                  required
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">التاريخ</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الفرع</label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="">اختر...</option>
                  <option value="main">الرئيسي</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الخصم %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-center"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الخصم $</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discountAmount}
                  onChange={(e) => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-center"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الضريبة</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tax}
                  onChange={(e) => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-center"
                />
              </div>
            </div>

            {/* Second Row - Totals */}
            <div className="grid grid-cols-8 gap-4 p-4 border-b border-gray-200 bg-gray-50">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">المجموع</label>
                <div className="text-lg font-bold text-gray-900">{totals.total.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الخصومات</label>
                <div className="text-lg font-bold text-red-600">{totals.totalDiscount.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الضريبة</label>
                <div className="text-lg font-bold text-green-600">{totals.totalTax.toFixed(2)}</div>
              </div>
            </div>

            {/* Third Row - Customer & Store */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">العميل</label>
                <select
                  required
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="">اختر...</option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>{customer.nameAr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">المخزن</label>
                <select
                  value={formData.store}
                  onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="">اختر...</option>
                  <option value="main">المخزن الرئيسي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الحركة</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="">اختر...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">رقم المصدر</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
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
                      <th className="px-2 py-2 border border-gray-300 text-center">ضريبة</th>
                      <th className="px-2 py-2 border border-gray-300 text-center">ن.ضريبة</th>
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
                              handleItemChange(index, 'productId', e.target.value);
                              if (product) {
                                handleItemChange(index, 'productName', (product as any).nameAr);
                                handleItemChange(index, 'unit', (product as any).unit);
                                handleItemChange(index, 'price', (product as any).price);
                              }
                            }}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value=""></option>
                            {products.map((product: any) => (
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
                        <td className="px-2 py-2 border border-gray-300">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center"
                          />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent}
                            onChange={(e) => handleItemChange(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center"
                          />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.tax}
                            onChange={(e) => handleItemChange(index, 'tax', parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm text-center"
                          />
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <div className="text-center text-sm">{item.netTax.toFixed(2)}</div>
                        </td>
                        <td className="px-2 py-2 border border-gray-300">
                          <div className="text-center font-bold text-sm">{item.total.toFixed(2)}</div>
                        </td>
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
              <button
                type="button"
                onClick={handleAddItem}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                إضافة صنف
              </button>
            </div>

            {/* Notes */}
            <div className="p-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">البيان</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              />
            </div>

            <button type="submit" className="hidden">Submit</button>
          </form>
        </>
      )}
    </div>
  );
}
