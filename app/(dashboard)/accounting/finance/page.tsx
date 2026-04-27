'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import {
  Plus,
  X,
  DollarSign,
  TrendingDown,
  Wallet,
  AlertCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { AccountingLayout, KpiCard } from '@/components/accounting/AccountingLayout';
import { Modal, Field, SelectField, TextAreaField, PrimaryButton, SecondaryButton, FormError } from '@/components/ui/modal';

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  paymentMethod: string;
}

/**
 * Finance / expenses page — lives under `/accounting/finance` so it shares
 * the unified accounting tab strip. Mirrors the original `/finance` page
 * (which is now a thin redirect) but wrapped in AccountingLayout.
 */
export default function AccountingFinancePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories' | 'settings'>('expenses');

  const expensesQ = useQuery({
    queryKey: queryKeys.expenses,
    queryFn: () => apiGet<Expense[]>('/api/expenses'),
    staleTime: 30_000,
  });

  // Stable reference so the useMemo below doesn't re-run on every render.
  const expenses = useMemo(() => expensesQ.data ?? [], [expensesQ.data]);
  const loading = expensesQ.isLoading;
  const loadError = expensesQ.error ? (expensesQ.error as Error).message : null;
  const loadExpenses = () => expensesQ.refetch();

  function openCreate() { setEditingExpense(null); setShowForm(true); }
  function openEdit(expense: Expense) { setEditingExpense(expense); setShowForm(true); }

  async function runDelete() {
    if (!confirmDelete) return;
    setDeleteRunning(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/expenses?id=${encodeURIComponent(confirmDelete.id)}`, {
        method: 'DELETE', credentials: 'include',
      });
      const j = await res.json();
      if (j.success) {
        setConfirmDelete(null);
        qc.invalidateQueries({ queryKey: queryKeys.expenses });
        qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      } else {
        setDeleteError(j.message || j.error || 'فشل الحذف');
      }
    } catch {
      setDeleteError('تعذر الاتصال بالخادم');
    } finally {
      setDeleteRunning(false);
    }
  }

  const totals = useMemo(() => {
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

  const fmt = (v: number) =>
    `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

  return (
    <AccountingLayout
      title="المالية والمصروفات"
      subtitle="إدارة المصروفات والإيرادات والتصنيفات"
      toolbar={
        <button
          onClick={openCreate}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          مصروف جديد
        </button>
      }
    >
      {loadError && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{loadError}</span>
          <button onClick={loadExpenses} className="mr-auto text-blue-600 hover:underline text-xs font-medium">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title="إجمالي المصروفات"
          value={fmt(totals.total)}
          subtitle={`${expenses.length} مصروف`}
          icon={TrendingDown}
          color="red"
        />
        <KpiCard
          title="مصروفات الشهر"
          value={fmt(totals.monthTotal)}
          icon={DollarSign}
          color="amber"
        />
      </div>

      {/* Inner sub-tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 p-1">
            <SubTab active={activeTab === 'expenses'}    onClick={() => setActiveTab('expenses')}    label="المصروفات" />
            <SubTab active={activeTab === 'categories'}  onClick={() => setActiveTab('categories')}  label="التصنيفات" />
            <SubTab active={activeTab === 'settings'}    onClick={() => setActiveTab('settings')}    label="الإعدادات" />
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'expenses' && (
            <ExpensesTab
              expenses={expenses}
              loading={loading}
              onEdit={openEdit}
              onDelete={(e) => { setConfirmDelete(e); setDeleteError(null); }}
            />
          )}
          {activeTab === 'categories' && <CategoriesTab expenses={expenses} />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          onClose={() => { setShowForm(false); setEditingExpense(null); }}
          onSaved={loadExpenses}
        />
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">حذف المصروف</h3>
            <p className="text-sm text-slate-600 mb-4">
              هل أنت متأكد من حذف المصروف &quot;<strong>{confirmDelete.description}</strong>&quot;؟
              لا يمكن التراجع عن هذا الإجراء.
            </p>
            {deleteError && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-2 rounded mb-3">{deleteError}</div>
            )}
            <div className="flex gap-3">
              <button onClick={runDelete} disabled={deleteRunning}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleteRunning ? 'جاري الحذف…' : 'نعم، احذف'}
              </button>
              <button onClick={() => setConfirmDelete(null)} disabled={deleteRunning}
                className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </AccountingLayout>
  );
}

function SubTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 rounded-lg transition-colors text-sm ${
        active ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function ExpensesTab({
  expenses,
  loading,
  onEdit,
  onDelete,
}: {
  expenses: Expense[];
  loading: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  if (loading) return <div className="text-center py-8 text-slate-400">جاري التحميل...</div>;

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
        <div key={expense.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
          <div className="flex-1">
            <p className="font-medium text-slate-900">{expense.description}</p>
            <p className="text-sm text-slate-500 mt-1">{expense.category} • {expense.date}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-lg font-bold text-red-600">{(expense.amount ?? 0).toLocaleString('ar-EG')} ج.م</p>
            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(expense)} title="تعديل"
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(expense)} title="حذف"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
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

function ExpenseForm({
  expense,
  onClose,
  onSaved,
}: {
  expense?: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!expense;
  const [formData, setFormData] = useState({
    date: (expense?.date ?? new Date().toISOString()).slice(0, 10),
    category: expense?.category ?? '',
    amount: expense ? String(expense.amount ?? '') : '',
    description: expense?.description ?? '',
    paymentMethod: expense?.paymentMethod ?? 'نقدي',
  });

  type ExpensePayload = Omit<typeof formData, 'amount'> & { amount: number; total: number };
  const saveExpense = useMutation({
    mutationFn: async (payload: ExpensePayload) => {
      if (isEdit && expense) {
        const res = await fetch('/api/expenses', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: expense.id, ...payload }),
        });
        const j = await res.json();
        if (!j.success) throw new Error(j.message || j.error || 'فشل التعديل');
        return j.data;
      }
      return apiPost('/api/expenses', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      onSaved();
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'تعذر الاتصال بالخادم');
    },
  });
  const saving = saveExpense.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(formData.amount) || 0;
    saveExpense.mutate({ ...formData, amount: amt, total: amt });
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEdit ? 'تعديل مصروف' : 'مصروف جديد'}
      footer={
        <>
          <SecondaryButton onClick={onClose}>إلغاء</SecondaryButton>
          <PrimaryButton type="submit" form="expense-form" disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </PrimaryButton>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
        <FormError>{error}</FormError>
        <Field label="التاريخ" type="date" required value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
        <SelectField label="التصنيف" required value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
          <option value="">اختر التصنيف</option>
          <option value="رواتب">رواتب</option>
          <option value="إيجار">إيجار</option>
          <option value="كهرباء ومياه">كهرباء ومياه</option>
          <option value="صيانة">صيانة</option>
          <option value="مصروفات إدارية">مصروفات إدارية</option>
        </SelectField>
        <Field label="المبلغ" type="number" step="0.01" required value={formData.amount} placeholder="0.00"
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
        <TextAreaField label="الوصف" required rows={3} value={formData.description} placeholder="تفاصيل المصروف..."
          onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
        <SelectField label="طريقة الدفع" value={formData.paymentMethod}
          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}>
          <option value="نقدي">نقدي</option>
          <option value="بنك">بنك</option>
          <option value="شيك">شيك</option>
          <option value="تحويل بنكي">تحويل بنكي</option>
        </SelectField>
      </form>
    </Modal>
  );
}
