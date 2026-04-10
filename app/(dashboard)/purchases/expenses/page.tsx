'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [formData, setFormData] = useState({
    expenseNumber: '',
    category: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    const res = await fetch('/api/expenses');
    if (res.ok) {
      const data = await res.json();
      setExpenses(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingExpense ? 'PUT' : 'POST';
    const body = editingExpense ? { id: editingExpense.id, ...formData } : formData;

    await fetch('/api/expenses', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setIsModalOpen(false);
    setEditingExpense(null);
    resetForm();
    fetchExpenses();
  };

  const resetForm = () => {
    setFormData({
      expenseNumber: '',
      category: '',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setFormData(expense);
    setIsModalOpen(true);
  };

  const handleDelete = async (expense: any) => {
    if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      await fetch(`/api/expenses?id=${expense.id}`, { method: 'DELETE' });
      fetchExpenses();
    }
  };

  const columns = [
    { key: 'expenseNumber', label: 'رقم المصروف' },
    { key: 'category', label: 'الفئة' },
    { key: 'description', label: 'الوصف' },
    { key: 'amount', label: 'المبلغ' },
    { key: 'date', label: 'التاريخ' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المصروفات</h1>
          <p className="text-gray-600 mt-1">إدارة المصروفات</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/purchases/suppliers"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            الموردين
          </Link>
          <Link
            href="/purchases/invoices"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            فواتير الشراء
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            إضافة مصروف
          </button>
        </div>
      </div>

      <EnhancedTable
        columns={columns}
        data={expenses}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
          resetForm();
        }}
        title={editingExpense ? 'تعديل مصروف' : 'إضافة مصروف'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم المصروف</label>
              <input
                type="text"
                required
                value={formData.expenseNumber}
                onChange={(e) => setFormData({ ...formData, expenseNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر الفئة</option>
                <option value="رواتب">رواتب</option>
                <option value="كهرباء">كهرباء</option>
                <option value="مياه">مياه</option>
                <option value="صيانة">صيانة</option>
                <option value="نقل">نقل</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingExpense ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
