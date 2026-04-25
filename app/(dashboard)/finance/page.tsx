'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, X, DollarSign, TrendingDown, Wallet, AlertCircle } from 'lucide-react';

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  paymentMethod: string;
}

export default function FinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories' | 'settings'>('expenses');

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses', { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setExpenses(json.data || []);
      }
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">المالية</h1>
          <p className="text-sm text-slate-500 mt-1">إدارة المصروفات والإيرادات</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          مصروف جديد
        </button>
      </div>

      {/* Summary Cards — derived from real expenses */}
      <FinanceSummary expenses={expenses} />

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 p-1">
            <TabButton
              active={activeTab === 'expenses'}
              onClick={() => setActiveTab('expenses')}
              label="المصروفات"
            />
            <TabButton
              active={activeTab === 'categories'}
              onClick={() => setActiveTab('categories')}
              label="التصنيفات"
            />
            <TabButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              label="الإعدادات"
            />
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'expenses' && <ExpensesTab expenses={expenses} loading={loading} />}
          {activeTab === 'categories' && <CategoriesTab expenses={expenses} />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showForm && <ExpenseForm onClose={() => setShowForm(false)} onSaved={loadExpenses} />}
    </div>
  );
}

function FinanceSummary({ expenses }: { expenses: Expense[] }) {
  const { total, monthTotal } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    let total = 0, monthTotal = 0;
    for (const e of expenses) {
      const amt = Number(e.amount) || 0;
      total += amt;
      const d = e.date ? new Date(e.date) : null;
      if (d && d.getFullYear() === y && d.getMonth() === m) monthTotal += amt;
    }
    return { total, monthTotal };
  }, [expenses]);

  const fmt = (v: number) => `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SummaryCard
        title="إجمالي المصروفات"
        value={fmt(total)}
        icon={<TrendingDown className="w-5 h-5" />}
        color="red"
      />
      <SummaryCard
        title="مصروفات الشهر"
        value={fmt(monthTotal)}
        icon={<DollarSign className="w-5 h-5" />}
        color="orange"
      />
    </div>
  );
}

function SummaryCard({ title, value, icon, color }: any) {
  const colors = {
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${colors[color as keyof typeof colors]} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 rounded-lg transition-colors ${
        active
          ? 'bg-blue-50 text-blue-600 font-medium'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span className="text-sm">{label}</span>
    </button>
  );
}

function ExpensesTab({ expenses, loading }: { expenses: Expense[]; loading: boolean }) {
  if (loading) {
    return <div className="text-center py-8 text-slate-400">جاري التحميل...</div>;
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingDown className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">لا توجد مصروفات مسجلة</p>
        <p className="text-sm text-slate-400 mt-1">ابدأ بإضافة مصروف جديد</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expenses.map((expense) => (
        <div key={expense.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
          <div className="flex-1">
            <p className="font-medium text-slate-900">{expense.description}</p>
            <p className="text-sm text-slate-500 mt-1">{expense.category} • {expense.date}</p>
          </div>
          <p className="text-lg font-bold text-red-600">{(expense.amount ?? 0).toLocaleString('ar-EG')} ج.م</p>
        </div>
      ))}
    </div>
  );
}

function CategoriesTab({ expenses }: { expenses: Expense[] }) {
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const name = (e.category || '').trim();
      if (!name) continue;
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [expenses]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">تصنيفات المصروفات</h3>
      </div>
      {categories.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">لا توجد تصنيفات بعد</div>
      ) : (
        categories.map((cat) => (
          <div key={cat.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="font-medium text-slate-900">{cat.name}</span>
            <span className="text-sm text-slate-500">{cat.count} مصروف</span>
          </div>
        ))
      )}
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">طرق الدفع</h3>
        <div className="space-y-2">
          {['نقدي', 'بنك', 'شيك', 'تحويل بنكي'].map((method) => (
            <div key={method} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Wallet className="w-4 h-4 text-slate-400" />
              <span className="text-slate-900">{method}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-900 mb-4">حسابات الموظفين</h3>
        <p className="text-sm text-slate-500">إدارة حسابات العهد النقدية للموظفين</p>
        <button className="mt-3 text-sm text-blue-600 hover:text-blue-700">+ إضافة حساب موظف</button>
      </div>
    </div>
  );
}

function ExpenseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    amount: '',
    description: '',
    paymentMethod: 'نقدي',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount) || 0,
          total: Number(formData.amount) || 0,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onSaved();
        onClose();
      } else {
        setError(json.message || json.error || 'فشل حفظ المصروف');
      }
    } catch (err) {
      console.error('Failed to save expense:', err);
      setError('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">مصروف جديد</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            >
              <option value="">اختر التصنيف</option>
              <option value="رواتب">رواتب</option>
              <option value="إيجار">إيجار</option>
              <option value="كهرباء ومياه">كهرباء ومياه</option>
              <option value="صيانة">صيانة</option>
              <option value="مصروفات إدارية">مصروفات إدارية</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المبلغ</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              rows={3}
              placeholder="تفاصيل المصروف..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">طريقة الدفع</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="نقدي">نقدي</option>
              <option value="بنك">بنك</option>
              <option value="شيك">شيك</option>
              <option value="تحويل بنكي">تحويل بنكي</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
