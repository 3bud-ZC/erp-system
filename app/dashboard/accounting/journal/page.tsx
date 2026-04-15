'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Trash2, Edit, FileText, AlertTriangle, HelpCircle, Calendar } from 'lucide-react';
import { fetchApi, getAuthHeadersOnly } from '@/lib/api-client';

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  totalDebit: number;
  totalCredit: number;
  isPosted: boolean;
  lines: JournalLine[];
}

interface JournalLine {
  id?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description?: string;
}

interface Account {
  id: string;
  code: string;
  nameAr: string;
  type: string;
}

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  
  const [formData, setFormData] = useState({
    entryNumber: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' },
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeadersOnly();
      const [entriesRes, accountsRes] = await Promise.all([
        fetch('/api/journal-entries', { headers }),
        fetch('/api/accounts', { headers }),
      ]);

      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(data.data || data);
      }
      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.data || data);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLine = () => {
    setLines([...lines, { accountId: '', debit: 0, credit: 0, description: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleLineChange = (index: number, field: keyof JournalLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const calculateTotals = () => {
    const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return { totalDebit, totalCredit };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { totalDebit, totalCredit } = calculateTotals();
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      setError('القيد غير متوازن! المدين يجب أن يساوي الدائن');
      return;
    }

    if (!formData.entryNumber || !formData.description) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const validLines = lines.filter(l => l.accountId && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      setError('يجب إدخال سطرين على الأقل');
      return;
    }

    try {
      setLoading(true);
      const method = editingEntry ? 'PUT' : 'POST';
      const body = {
        ...(editingEntry ? { id: editingEntry.id } : {}),
        ...formData,
        date: new Date(formData.date).toISOString(),
        totalDebit,
        totalCredit,
        lines: validLines.map(line => ({
          accountId: line.accountId,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          description: line.description || '',
        })),
      };
      
      await fetchApi('/api/journal-entries', {
        method,
        body: JSON.stringify(body),
      });

      setIsModalOpen(false);
      resetForm();
      setEditingEntry(null);
      await fetchData();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save journal entry');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormData({
      entryNumber: entry.entryNumber,
      date: new Date(entry.date).toISOString().split('T')[0],
      description: entry.description,
    });
    setLines(entry.lines.map(line => ({
      accountId: line.accountId || '',
      debit: line.debit,
      credit: line.credit,
      description: line.description || '',
    })));
    setIsModalOpen(true);
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (!confirm('هل أنت متأكد من حذف هذا القيد؟')) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/journal-entries?id=${entry.id}`, { 
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل حذف القيد');
      }
      await fetchData();
    } catch (err) {
      console.error('Error deleting entry:', err);
      setError(err instanceof Error ? err.message : 'فشل حذف القيد');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      entryNumber: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
    setLines([
      { accountId: '', debit: 0, credit: 0, description: '' },
      { accountId: '', debit: 0, credit: 0, description: '' },
    ]);
    setError(null);
  };

  const columns = [
    { key: 'entryNumber', label: 'رقم القيد', className: 'font-medium' },
    {
      key: 'date',
      label: 'التاريخ',
      render: (value: string) => new Date(value).toLocaleDateString('ar-EG'),
    },
    { key: 'description', label: 'البيان' },
    {
      key: 'totalDebit',
      label: 'المدين',
      render: (value: number) => `${value.toFixed(2)} ج.م`,
    },
    {
      key: 'totalCredit',
      label: 'الدائن',
      render: (value: number) => `${value.toFixed(2)} ج.م`,
    },
    {
      key: 'isPosted',
      label: 'الحالة',
      render: (value: boolean) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>
          {value ? 'مرحّل' : 'مسودة'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (_: any, row: JournalEntry) => (
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

  const { totalDebit, totalCredit } = calculateTotals();
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">القيود اليومية</h1>
          <p className="text-gray-600 mt-1">تسجيل العمليات المالية اليومية</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingEntry(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          قيد يومي جديد
        </button>
      </div>

      {/* Explanation Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 mb-2">ما هي القيود اليومية؟</h3>
            <p className="text-sm text-blue-800 leading-relaxed mb-2">
              القيود اليومية هي تسجيل العمليات المالية اليومية للشركة. كل قيد يجب أن يكون <strong>متوازناً</strong>:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-700 mt-2">
              <div>• <strong>المدين (Debit):</strong> الحسابات التي تزيد (الأصول والمصروفات)</div>
              <div>• <strong>الدائن (Credit):</strong> الحسابات التي تنقص (الخصوم والإيرادات)</div>
              <div>• <strong>القاعدة الذهبية:</strong> إجمالي المدين = إجمالي الدائن</div>
              <div>• <strong>مثال:</strong> شراء بضاعة نقداً → مدين: المخزون | دائن: النقدية</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-sm">إجمالي القيود</p>
          <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 text-sm">قيود مرحّلة</p>
          <p className="text-2xl font-bold text-green-800">
            {entries.filter(e => e.isPosted).length}
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-yellow-700 text-sm">مسودات</p>
          <p className="text-2xl font-bold text-yellow-800">
            {entries.filter(e => !e.isPosted).length}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-700 text-sm">هذا الشهر</p>
          <p className="text-2xl font-bold text-blue-800">
            {entries.filter(e => new Date(e.date).getMonth() === new Date().getMonth()).length}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">لا توجد قيود يومية</p>
          <p className="text-sm text-gray-400 mt-1">أضف قيد يومي جديد للبدء</p>
        </div>
      ) : (
        <EnhancedTable columns={columns} data={entries} />
      )}

      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
          setEditingEntry(null);
        }}
        title={editingEntry ? 'تعديل قيد يومي' : 'إضافة قيد يومي جديد'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم القيد *</label>
              <input
                type="text"
                required
                value={formData.entryNumber}
                onChange={(e) => setFormData({ ...formData, entryNumber: e.target.value })}
                placeholder="JE-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البيان *</label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف العملية"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">سطور القيد</h3>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                إضافة سطر
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">الحساب</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">البيان</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">مدين</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">دائن</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-2">
                        <select
                          required
                          value={line.accountId}
                          onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">اختر الحساب</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.nameAr}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => handleLineChange(index, 'debit', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => handleLineChange(index, 'credit', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        {lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(index)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200 font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3">الإجمالي</td>
                    <td className="px-4 py-3 text-blue-700">{totalDebit.toFixed(2)} ج.م</td>
                    <td className="px-4 py-3 text-green-700">{totalCredit.toFixed(2)} ج.م</td>
                    <td className="px-4 py-3">
                      {isBalanced ? (
                        <span className="text-green-600 text-xs">✓ متوازن</span>
                      ) : (
                        <span className="text-red-600 text-xs">✗ غير متوازن</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
                setEditingEntry(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || !isBalanced}
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
