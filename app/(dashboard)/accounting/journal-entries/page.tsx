'use client';

import { useEffect, useState } from 'react';
import { Plus, X, CheckCircle, Clock, Trash2 } from 'lucide-react';

interface JournalEntry {
  id: string;
  entryNumber?: string;
  date?: string;
  createdAt: string;
  description?: string;
  totalDebit?: number;
  totalCredit?: number;
  isPosted?: boolean;
}

interface JournalLine {
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
}

function formatEGP(v?: number) {
  if (v == null) return '—';
  return `${v.toLocaleString('ar-EG')} ج.م`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG');
}

const emptyLine = (): JournalLine => ({ accountCode: '', description: '', debit: '', credit: '' });

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);

  function load() {
    setLoading(true);
    fetch('/api/journal-entries', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const raw = j.data;
          setEntries(Array.isArray(raw) ? raw : (raw?.entries ?? raw?.data ?? []));
        } else setError(j.message || 'فشل تحميل القيود');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  function updateLine(i: number, field: keyof JournalLine, val: string) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  }

  function addLine() { setLines(ls => [...ls, emptyLine()]); }
  function removeLine(i: number) { if (lines.length > 2) setLines(ls => ls.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!balanced) { setFormError('مجموع المدين يجب أن يساوي مجموع الدائن'); return; }
    if (lines.some(l => !l.accountCode)) { setFormError('يجب إدخال رمز الحساب لكل سطر'); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await fetch('/api/journal-entries', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate,
          description,
          lines: lines.map(l => ({
            accountCode: l.accountCode,
            description: l.description,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
        }),
      });
      const j = await res.json();
      if (j.success) {
        setShowModal(false);
        setDescription(''); setLines([emptyLine(), emptyLine()]);
        setEntryDate(new Date().toISOString().split('T')[0]);
        load();
      } else setFormError(j.message || j.error || 'فشل الحفظ');
    } catch { setFormError('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64" dir="rtl"><div className="text-slate-500">جاري تحميل القيود المحاسبية…</div></div>;
  if (error) return <div className="flex items-center justify-center h-64" dir="rtl"><div className="text-red-500">{error}</div></div>;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">القيود المحاسبية</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> قيد جديد
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">قيد محاسبي جديد</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ القيد *</label>
                  <input type="date" required value={entryDate} onChange={e => setEntryDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">البيان *</label>
                  <input required value={description} onChange={e => setDescription(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="وصف القيد" />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">بنود القيد</label>
                  <button type="button" onClick={addLine} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ إضافة سطر</button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">رمز الحساب</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">البيان</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">مدين</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">دائن</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((line, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5">
                            <input value={line.accountCode} onChange={e => updateLine(i, 'accountCode', e.target.value)}
                              className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="1001" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                              className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="وصف" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)}
                              className="w-24 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)}
                              className="w-24 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0" />
                          </td>
                          <td className="px-2 py-1.5">
                            <button type="button" onClick={() => removeLine(i)} className="text-slate-300 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-slate-600 text-left">الإجمالي</td>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-700">{totalDebit.toLocaleString('ar-EG')}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-700">{totalCredit.toLocaleString('ar-EG')}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!balanced && totalDebit > 0 && (
                  <p className="text-red-500 text-xs mt-1">⚠ الفرق: {Math.abs(totalDebit - totalCredit).toLocaleString('ar-EG')} ج.م — المدين يجب أن يساوي الدائن</p>
                )}
                {balanced && totalDebit > 0 && (
                  <p className="text-green-600 text-xs mt-1">✓ القيد متوازن</p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving || !balanced}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'جاري الحفظ…' : 'حفظ القيد'}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200 transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">لا توجد قيود محاسبية حتى الآن</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رقم القيد</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">البيان</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">إجمالي المدين</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">إجمالي الدائن</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-700">{e.entryNumber ?? e.id.slice(-6)}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{formatDate(e.date ?? e.createdAt)}</td>
                  <td className="px-5 py-3 text-sm text-slate-700 max-w-xs truncate">{e.description ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatEGP(e.totalDebit)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatEGP(e.totalCredit)}</td>
                  <td className="px-5 py-3">
                    {e.isPosted
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium"><CheckCircle className="w-3 h-3" /> مرحّل</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-medium"><Clock className="w-3 h-3" /> مسودة</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
