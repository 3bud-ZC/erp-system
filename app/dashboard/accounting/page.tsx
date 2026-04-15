'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Trash2, Edit, BookOpen, AlertTriangle, HelpCircle } from 'lucide-react';
import { fetchApi, getAuthHeadersOnly } from '@/lib/api-client';

interface Account {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  parentId?: string;
  parent?: { nameAr: string };
  balance: number;
  isActive: boolean;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    type: 'asset',
    parentId: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const headers = getAuthHeadersOnly();
      const res = await fetch('/api/accounts', { 
        headers,
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : (data.data || []));
      } else {
        setAccounts([]);
      }
      setError(null);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      if (err.name === 'AbortError') {
        setError('استغرق تحميل البيانات وقتاً طويلاً. يرجى المحاولة مرة أخرى.');
      } else {
        setError(err instanceof Error ? err.message : 'فشل في تحميل البيانات');
      }
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.nameAr || !formData.type) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setLoading(true);
      const method = editingAccount ? 'PUT' : 'POST';
      const body = {
        ...(editingAccount ? { id: editingAccount.id } : {}),
        ...formData,
        parentId: formData.parentId || null,
      };
      
      await fetchApi('/api/accounts', {
        method,
        body: JSON.stringify(body),
      });

      setIsModalOpen(false);
      resetForm();
      setEditingAccount(null);
      await fetchData();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      nameAr: account.nameAr,
      nameEn: account.nameEn || '',
      type: account.type,
      parentId: account.parentId || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (account: Account) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/accounts?id=${account.id}`, { 
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل حذف الحساب');
      }
      await fetchData();
    } catch (err) {
      console.error('Error deleting account:', err);
      setError(err instanceof Error ? err.message : 'فشل حذف الحساب');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      nameAr: '',
      nameEn: '',
      type: 'asset',
      parentId: '',
    });
    setError(null);
  };

  const getAccountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      asset: 'أصول',
      liability: 'خصوم',
      equity: 'حقوق ملكية',
      revenue: 'إيرادات',
      expense: 'مصروفات',
    };
    return types[type] || type;
  };

  const getAccountTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      asset: 'bg-blue-100 text-blue-700',
      liability: 'bg-red-100 text-red-700',
      equity: 'bg-purple-100 text-purple-700',
      revenue: 'bg-green-100 text-green-700',
      expense: 'bg-orange-100 text-orange-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const columns = [
    { key: 'code', label: 'الكود', className: 'font-medium' },
    { key: 'nameAr', label: 'الاسم بالعربي', className: 'font-medium' },
    { key: 'nameEn', label: 'الاسم بالإنجليزي' },
    {
      key: 'type',
      label: 'النوع',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAccountTypeColor(value)}`}>
          {getAccountTypeLabel(value)}
        </span>
      ),
    },
    {
      key: 'parent',
      label: 'الحساب الأب',
      render: (value: any) => value?.nameAr || '-',
    },
    {
      key: 'balance',
      label: 'الرصيد',
      render: (value: number) => `${value.toFixed(2)} ج.م`,
    },
    {
      key: 'isActive',
      label: 'الحالة',
      render: (value: boolean) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {value ? 'نشط' : 'غير نشط'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (_: any, row: Account) => (
        <div className="flex gap-2 items-center">
          <button
            onClick={() => handleEdit(row)}
            className="text-blue-600 hover:text-blue-800 transition-colors"
            title="تعديل"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="text-red-600 hover:text-red-800 transition-colors"
            title="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const accountsByType = {
    asset: Array.isArray(accounts) ? accounts.filter(a => a.type === 'asset') : [],
    liability: Array.isArray(accounts) ? accounts.filter(a => a.type === 'liability') : [],
    equity: Array.isArray(accounts) ? accounts.filter(a => a.type === 'equity') : [],
    revenue: Array.isArray(accounts) ? accounts.filter(a => a.type === 'revenue') : [],
    expense: Array.isArray(accounts) ? accounts.filter(a => a.type === 'expense') : [],
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل دليل الحسابات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">دليل الحسابات</h1>
          <p className="text-gray-600 mt-1">إدارة الحسابات المحاسبية</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingAccount(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          حساب جديد
        </button>
      </div>

      {/* Explanation Banner */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-green-900 mb-2">ما هو دليل الحسابات؟</h3>
            <p className="text-sm text-green-800 leading-relaxed mb-2">
              دليل الحسابات هو قائمة منظمة بجميع الحسابات المحاسبية المستخدمة في الشركة. يتم تصنيفها إلى:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-green-700 mt-2">
              <div>• <strong>الأصول (Assets):</strong> ما تملكه الشركة (نقدية، مخزون، معدات)</div>
              <div>• <strong>الخصوم (Liabilities):</strong> ما على الشركة من التزامات (قروض، موردين)</div>
              <div>• <strong>حقوق الملكية (Equity):</strong> رأس المال والأرباح المحتجزة</div>
              <div>• <strong>الإيرادات (Revenue):</strong> دخل الشركة من المبيعات والخدمات</div>
              <div>• <strong>المصروفات (Expenses):</strong> تكاليف تشغيل الشركة</div>
            </div>
            <p className="text-xs text-green-600 mt-3 font-medium">
              💡 المعادلة المحاسبية: الأصول = الخصوم + حقوق الملكية
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-700 text-sm">الأصول</p>
          <p className="text-2xl font-bold text-blue-800">{accountsByType.asset.length}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm">الخصوم</p>
          <p className="text-2xl font-bold text-red-800">{accountsByType.liability.length}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-purple-700 text-sm">حقوق الملكية</p>
          <p className="text-2xl font-bold text-purple-800">{accountsByType.equity.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 text-sm">الإيرادات</p>
          <p className="text-2xl font-bold text-green-800">{accountsByType.revenue.length}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-orange-700 text-sm">المصروفات</p>
          <p className="text-2xl font-bold text-orange-800">{accountsByType.expense.length}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">لا توجد حسابات</p>
          <p className="text-sm text-gray-400 mt-1">أضف حساب جديد للبدء</p>
        </div>
      ) : (
        <EnhancedTable columns={columns} data={accounts} />
      )}

      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
          setEditingAccount(null);
        }}
        title={editingAccount ? 'تعديل حساب' : 'إضافة حساب جديد'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الكود *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="مثال: 1010"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">النوع *</label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="asset">أصول</option>
                <option value="liability">خصوم</option>
                <option value="equity">حقوق ملكية</option>
                <option value="revenue">إيرادات</option>
                <option value="expense">مصروفات</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم بالعربي *</label>
              <input
                type="text"
                required
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                placeholder="مثال: النقدية بالصندوق"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم بالإنجليزي</label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder="Cash on Hand"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">الحساب الأب (اختياري)</label>
              <select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">لا يوجد</option>
                {Array.isArray(accounts) && accounts
                  .filter(a => a.type === formData.type && (!editingAccount || a.id !== editingAccount.id))
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.nameAr}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
                setEditingAccount(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
