'use client';

import { useState, useEffect } from 'react';
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
  DollarSign,
  Calendar,
  FileText,
  Save,
  Copy,
  Trash,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  AlertTriangle,
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

interface Expense {
  id: string;
  expenseNumber: string;
  supplierId?: string;
  supplier?: { nameAr: string };
  date: string;
  branch: string;
  taxNumber: string;
  invoiceNumber: string;
  amount: number;
  tax: number;
  total: number;
  status: string;
  notes: string;
  costCenter?: string;
  accountNumber?: string;
  category?: string;
  description?: string;
}

interface Supplier {
  id: string;
  nameAr: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [formData, setFormData] = useState({
    expenseNumber: '',
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    branch: '',
    taxNumber: '',
    invoiceNumber: '',
    amount: 0,
    tax: 0,
    total: 0,
    status: 'pending',
    notes: '',
    costCenter: '',
    accountNumber: '',
    category: '',
    description: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [expensesRes, suppliersRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/suppliers'),
      ]);

      if (!expensesRes.ok || !suppliersRes.ok) {
        throw new Error('فشل في تحميل البيانات');
      }

      setExpenses(await expensesRes.json());
      setSuppliers(await suppliersRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      exp.expenseNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.supplier?.nameAr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || exp.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalAmount = expenses.reduce((sum, exp) => sum + exp.total, 0);
  const totalTax = expenses.reduce((sum, exp) => sum + (exp.tax || 0), 0);

  const calculateTotals = () => {
    const amount = formData.amount || 0;
    const tax = formData.tax || 0;
    return amount + tax;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Enhanced validation
      if (!formData.expenseNumber.trim()) {
        alert('يرجى إدخال رقم المصروف');
        return;
      }

      if (!formData.date) {
        alert('يرجى اختيار التاريخ');
        return;
      }

      if (formData.amount <= 0) {
        alert('يرجى إدخال مبلغ المصروف');
        return;
      }

      const total = (formData.amount || 0) + (formData.tax || 0);
      const data = {
        expenseNumber: formData.expenseNumber.trim(),
        supplierId: formData.supplierId || null,
        date: new Date(formData.date + 'T00:00:00.000Z'),
        category: formData.category || '',
        description: formData.description || '',
        amount: parseFloat(formData.amount.toString()),
        tax: parseFloat(formData.tax.toString()),
        total,
        status: formData.status,
        notes: formData.notes?.trim() || null,
        branch: formData.branch || null,
        taxNumber: formData.taxNumber?.trim() || null,
        invoiceNumber: formData.invoiceNumber?.trim() || null,
        costCenter: formData.costCenter?.trim() || null,
        accountNumber: formData.accountNumber?.trim() || null,
      };

      console.log('Submitting expense:', data);

      const method = editingExpense ? 'PUT' : 'POST';
      const url = editingExpense ? `/api/expenses?id=${editingExpense.id}` : '/api/expenses';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingExpense ? { id: editingExpense.id, ...data } : data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Expense submission error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to save expense');
      }

      const result = await response.json();
      console.log('Expense saved successfully:', result);

      // Only close form and reset if it's a new expense
      if (!editingExpense) {
        resetForm();
        setIsFormOpen(false);
      } else {
        // For editing, keep form open but refresh data
        setEditingExpense(null);
      }

      fetchData();
    } catch (err) {
      console.error('Error submitting expense:', err);
      alert(err instanceof Error ? err.message : 'خطأ في حفظ المصروف');
    }
  };

  const resetForm = () => {
    setFormData({
      expenseNumber: '',
      supplierId: '',
      date: new Date().toISOString().split('T')[0],
      branch: '',
      taxNumber: '',
      invoiceNumber: '',
      amount: 0,
      tax: 0,
      total: 0,
      status: 'pending',
      notes: '',
      costCenter: '',
      accountNumber: '',
      category: '',
      description: '',
    });
  };

  const handleNew = () => {
    resetForm();
    setEditingExpense(null);
    // Generate auto expense number
    const newExpenseNumber = `EXP-${new Date().getFullYear()}-${String(expenses.length + 1).padStart(4, '0')}`;
    setFormData(prev => ({ ...prev, expenseNumber: newExpenseNumber }));
    setIsFormOpen(true);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      expenseNumber: expense.expenseNumber || '',
      supplierId: expense.supplierId || '',
      date: new Date(expense.date).toISOString().split('T')[0],
      branch: expense.branch || '',
      taxNumber: expense.taxNumber || '',
      invoiceNumber: expense.invoiceNumber || '',
      amount: expense.amount || 0,
      tax: expense.tax || 0,
      total: expense.total || 0,
      status: expense.status || 'pending',
      notes: expense.notes || '',
      costCenter: expense.costCenter || '',
      accountNumber: expense.accountNumber || '',
      category: expense.category || '',
      description: expense.description || '',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (expense: Expense) => {
    if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      try {
        const response = await fetch(`/api/expenses?id=${expense.id}`, { 
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to delete expense');
        }
        
        // Close form if deleting the currently edited expense
        if (editingExpense && editingExpense.id === expense.id) {
          setIsFormOpen(false);
          setEditingExpense(null);
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
    const form = document.getElementById('expense-form') as HTMLFormElement;
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
    if (editingExpense) {
      // Create a copy with new expense number and current date
      const newExpenseNumber = `EXP-${new Date().getFullYear()}-${String(expenses.length + 1).padStart(4, '0')}`;
      setFormData({ 
        ...formData, 
        expenseNumber: newExpenseNumber, 
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
      });
      setEditingExpense(null);
    }
  };

  const handleDeleteCurrent = () => {
    if (editingExpense && confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      handleDelete(editingExpense);
      setIsFormOpen(false);
    }
  };

  const handleNavigate = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (filteredExpenses.length === 0) return;
    
    let newIndex = currentIndex;
    switch (direction) {
      case 'first':
        newIndex = 0;
        break;
      case 'prev':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'next':
        newIndex = Math.min(filteredExpenses.length - 1, currentIndex + 1);
        break;
      case 'last':
        newIndex = filteredExpenses.length - 1;
        break;
    }
    
    setCurrentIndex(newIndex);
    handleEdit(filteredExpenses[newIndex]);
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
  }, [isFormOpen, editingExpense, formData]);

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
          <p className="text-gray-600">جاري تحميل المصروفات...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">المصروفات</h1>
              <p className="text-gray-500 text-sm mt-1">إدارة مصروفات الشراء والتشغيل</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                مصروف جديد
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="إجمالي المصروفات" value={expenses.length} subtitle="مصروف" icon={FileText} color="bg-blue-500" />
            <StatCard title="إجمالي المبالغ" value={formatCurrency(totalAmount)} subtitle="جميع المصروفات" icon={DollarSign} color="bg-green-500" />
            <StatCard title="إجمالي الضرائب" value={formatCurrency(totalTax)} subtitle="ضريبة" icon={Calendar} color="bg-yellow-500" />
            <StatCard title="متوسط المصروف" value={formatCurrency(expenses.length > 0 ? totalAmount / expenses.length : 0)} subtitle="لكل مصروف" icon={ArrowUpDown} color="bg-purple-500" />
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
                    <th className="px-4 py-3 font-semibold">رقم القيد</th>
                    <th className="px-4 py-3 font-semibold">التاريخ</th>
                    <th className="px-4 py-3 font-semibold">المورد</th>
                    <th className="px-4 py-3 font-semibold">رقم الفاتورة</th>
                    <th className="px-4 py-3 font-semibold">المبلغ</th>
                    <th className="px-4 py-3 font-semibold">الحالة</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{expense.expenseNumber || expense.id.slice(-6)}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(expense.date).toLocaleDateString('ar-EG')}</td>
                      <td className="px-4 py-3">{expense.supplier?.nameAr || '-'}</td>
                      <td className="px-4 py-3">{expense.invoiceNumber || '-'}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(expense.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                          {getStatusLabel(expense.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleEdit(expense)} className="text-blue-600 hover:underline text-sm ml-2">تعديل</button>
                        <button onClick={() => handleDelete(expense)} className="text-red-600 hover:underline text-sm">حذف</button>
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
                <NavButton icon={ChevronRight} onClick={() => handleNavigate('next')} disabled={currentIndex >= filteredExpenses.length - 1} />
                <NavButton icon={ChevronsRight} onClick={() => handleNavigate('last')} disabled={currentIndex >= filteredExpenses.length - 1} />
              </div>
              <button onClick={() => setIsFormOpen(false)} className="mr-4 text-lg">المصروفات</button>
            </div>
          </div>

          {/* Expense Form - Matching Image */}
          <form id="expense-form" onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Row 1 */}
            <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-200">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم القيد</label>
                <div className="text-xl font-bold">{editingExpense ? currentIndex + 1 : 0}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">تاريخ القيد</label>
                <input type="datetime-local" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الفرع</label>
                <select value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">الفرع الرئيسي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الموردين</label>
                <select value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value=""></option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.nameAr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الرقم الضريبي</label>
                <input type="text" value={formData.taxNumber} onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">رقم الفاتورة</label>
                <input type="text" required value={formData.invoiceNumber} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>

            {/* Row 2 - Amount Fields */}
            <div className="grid grid-cols-3 gap-4 p-4 border-b border-gray-200 bg-gray-50">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                />
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الضريبة</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tax}
                  onChange={(e) => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                />
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-1">الإجمالي</label>
                <div className="text-xl font-bold text-blue-600">{(formData.amount + formData.tax).toFixed(2)}</div>
              </div>
            </div>

            {/* Row 3 - Category & Description */}
            <div className="grid grid-cols-2 gap-4 p-4 border-b border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="مثال: مصاريف تشغيلية"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مركز التكلفة</label>
                <input
                  type="text"
                  value={formData.costCenter}
                  onChange={(e) => setFormData({ ...formData, costCenter: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div className="p-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-right">البيان / الوصف</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="أدخل وصف المصروف..."
              />
            </div>

            {/* Notes */}
            <div className="p-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-right">ملاحظات إضافية</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <button type="submit" className="hidden">Submit</button>
          </form>
        </>
      )}
    </div>
  );
}
