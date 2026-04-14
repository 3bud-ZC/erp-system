'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
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

interface Product {
  id: string;
  nameAr: string;
  code: string;
  unit: string;
  price: number;
  stock?: number;
}

interface Customer {
  id: string;
  nameAr: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: { nameAr: string };
  date: string;
  total: number;
  status: string;
  notes?: string;
  items?: Array<{ productId: string; quantity: number; price: number; total: number }>;
}

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    notes: '',
  });

  const [items, setItems] = useState([
    { productId: '', productName: '', productCode: '', unit: '', quantity: 0, price: 0, discount: 0, discountPercent: 0, tax: 0, netTax: 0, total: 0 },
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

      const invoicesJson = await invoicesRes.json();
      const customersJson = await customersRes.json();
      const productsJson = await productsRes.json();
      // APIs return { success, data } wrapper — extract .data, fall back to raw array
      setInvoices(Array.isArray(invoicesJson) ? invoicesJson : (invoicesJson.data ?? []));
      setCustomers(Array.isArray(customersJson) ? customersJson : (customersJson.data ?? []));
      setProducts(Array.isArray(productsJson) ? productsJson : (productsJson.data ?? []));
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل البيانات');
      setInvoices([]);
      setCustomers([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const newItem = { 
      productId: '', 
      productName: '', 
      productCode: '', 
      unit: '', 
      quantity: 0, 
      price: 0, 
      discount: 0, 
      discountPercent: 0, 
      tax: 0, 
      netTax: 0, 
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
        discount: 0, 
        discountPercent: 0, 
        tax: 0, 
        netTax: 0, 
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
        newItems[index].price = parseFloat(product.price.toString()) || 0;
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
    if (field === 'quantity' || field === 'price' || field === 'discount' || field === 'discountPercent' || field === 'tax' || field === 'productId') {
      const qty = Math.max(0, parseFloat(newItems[index].quantity.toString()) || 0);
      const price = Math.max(0, parseFloat(newItems[index].price.toString()) || 0);
      const disc = Math.max(0, parseFloat(newItems[index].discount.toString()) || 0);
      const discPercent = Math.max(0, Math.min(100, parseFloat(newItems[index].discountPercent.toString()) || 0));
      const tax = Math.max(0, parseFloat(newItems[index].tax.toString()) || 0);
      
      const subtotal = qty * price;
      const discountAmount = disc + (subtotal * discPercent / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * tax / 100;
      
      newItems[index].quantity = qty;
      newItems[index].price = price;
      newItems[index].discount = disc;
      newItems[index].discountPercent = discPercent;
      newItems[index].tax = tax;
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
    
    return { subtotal, totalDiscount, totalTax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Enhanced validation
      if (!formData.invoiceNumber.trim()) {
        alert('يرجى إدخال رقم الفاتورة');
        return;
      }

      if (!formData.customerId) {
        alert('يرجى اختيار عميل');
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

      const totals = calculateTotals();
      const data = {
        invoiceNumber: formData.invoiceNumber.trim(),
        customerId: formData.customerId,
        date: new Date(formData.date + 'T00:00:00.000Z'),
        status: formData.status,
        notes: formData.notes?.trim() || null,
        total: totals.total,
        items: validItems.map(item => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity.toString()),
          price: parseFloat(item.price.toString()),
          total: parseFloat(item.total.toString()),
        })),
      };

      console.log('Submitting invoice:', data);

      const method = editingInvoice ? 'PUT' : 'POST';
      const body = editingInvoice ? { id: editingInvoice.id, ...data } : data;

      const response = await fetch('/api/sales-invoices', {
        method,
        headers: { 
          'Content-Type': 'application/json',
        },
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
        setTimeout(() => {
          // Find and reopen the updated invoice
          const updatedInvoice = invoices.find(inv => inv.id === result.data?.id);
          if (updatedInvoice) {
            handleEdit(updatedInvoice);
          }
        }, 100);
      }
      
      // Always refresh the main data
      fetchData();
    } catch (err) {
      console.error('Error submitting invoice:', err);
      const message = err instanceof Error ? err.message : 'Error saving invoice';
      alert(message);
    }
  };

  const resetForm = () => {
    setFormData({
      invoiceNumber: '',
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setItems([{ productId: '', productName: '', productCode: '', unit: '', quantity: 0, price: 0, discount: 0, discountPercent: 0, tax: 0, netTax: 0, total: 0 }]);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      date: new Date(invoice.date).toISOString().split('T')[0],
      status: invoice.status,
      notes: invoice.notes || '',
    });
    if (invoice.items && invoice.items.length > 0) {
      setItems(invoice.items.map((item) => {
        const product = products.find((p: any) => p.id === item.productId);
        const qty = item.quantity || 0;
        const storedTotal = item.total || 0;
        // Use the effective per-unit price (total / quantity) so that any
        // discount or tax originally applied is preserved in recalculations.
        // discount/tax fields are not persisted in the DB schema.
        const effectivePrice = qty > 0 ? storedTotal / qty : (item.price || 0);
        return {
          productId: item.productId || '',
          productName: product?.nameAr || '',
          productCode: product?.code || '',
          unit: product?.unit || '',
          quantity: qty,
          price: effectivePrice,
          discount: 0,
          discountPercent: 0,
          tax: 0,
          netTax: 0,
          total: storedTotal,
        };
      }));
    } else {
      setItems([{ productId: '', productName: '', productCode: '', unit: '', quantity: 0, price: 0, discount: 0, discountPercent: 0, tax: 0, netTax: 0, total: 0 }]);
    }
    setIsFormOpen(true);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      try {
        const response = await fetch(`/api/sales-invoices?id=${invoice.id}`, { 
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

  const handleNew = () => {
    resetForm();
    setEditingInvoice(null);
    // Generate auto invoice number
    const newInvoiceNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`;
    setFormData(prev => ({ ...prev, invoiceNumber: newInvoiceNumber }));
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    const form = document.getElementById('sales-invoice-form') as HTMLFormElement;
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
      const newInvoiceNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`;
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
              <h1 className="text-2xl font-bold text-gray-900">فواتير البيع</h1>
              <p className="text-gray-500 text-sm mt-1">إدارة فواتير البيع</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/sales/customers" className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
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
                  {(invoices || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        لا توجد فواتير
                      </td>
                    </tr>
                  ) : (
                    (invoices || []).map((invoice) => (
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
                <span className="text-lg">فواتير البيع</span>
              </button>
            </div>
          </div>

          {/* Sales Invoice Form */}
          <form id="sales-invoice-form" onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* First Row - Basic Info */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-200">
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الفاتورة</label>
                <input
                  type="text"
                  required
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  placeholder="INV-YYYY-0001"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">العميل</label>
                <select
                  required
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="">اختر عميل...</option>
                  {(customers || []).map((customer: any) => (
                    <option key={customer.id} value={customer.id}>{customer.nameAr}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="pending">معلقة</option>
                  <option value="completed">مكتملة</option>
                  <option value="cancelled">ملغية</option>
                </select>
              </div>
            </div>

            {/* Second Row - Totals Display */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200 bg-gray-50">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">المجموع الفرعي</label>
                <div className="text-lg font-bold text-gray-900">{totals.subtotal.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الخصم</label>
                <div className="text-lg font-bold text-red-600">{totals.totalDiscount.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الضريبة</label>
                <div className="text-lg font-bold text-green-600">{totals.totalTax.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الإجمالي</label>
                <div className="text-xl font-bold text-blue-600">{totals.total.toFixed(2)}</div>
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
                    {(items || []).map((item, index) => (
                      <tr key={index}>
                        <td className="px-2 py-2 border border-gray-300 text-center">{index + 1}</td>
                        <td className="px-2 py-2 border border-gray-300">
                          <select
                            value={item.productId}
                            onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value=""></option>
                            {(products || []).map((product: any) => (
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
