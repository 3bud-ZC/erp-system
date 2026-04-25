'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, X, CheckCircle, Clock, Trash2, BookOpen, RefreshCw } from 'lucide-react';

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

function fmtEGP(v?: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG');
}

const emptyLine = (): JournalLine => ({ accountCode: '', description: '', debit: '', credit: '' });

/* ─── Skeleton ────────────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-pulse">
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex gap-8">
        {['w-24', 'w-24', 'w-48', 'w-28', 'w-28', 'w-16'].map((w, i) => (
          <div key={i} className={`${w} h-3.5 bg-slate-200 rounded`} />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 border-b border-slate-100 flex gap-8 items-center last:border-0">
          <div className="w-24 h-4 bg-slate-100 rounded" />
          <div className="w-24 h-4 bg-slate-100 rounded" />
          <div className="w-48 h-4 bg-slate-100 rounded" />
          <div className="w-28 h-4 bg-slate-100 rounded" />
          <div className="w-28 h-4 bg-slate-100 rounded" />
          <div className="w-16 h-5 bg-slate-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function JournalEntriesPage() {
  const [entries, setEntries]     = useState<JournalEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [lines, setLines]         = useState<JournalLine[]>([emptyLine(), emptyLine()]);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    fetch('/api/journal-entries', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const raw = j.data;
          setEntries(Array.isArray(raw) ? raw : (raw?.entries ?? []));
        } else setError(j.message || 'فشل تحميل القيود');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01;

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
          entryDate, description,
          lines: lines.map(l => ({
            accountCode: l.accountCode, description: l.description,
            debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0,
          })),
        }),
      });
      const j = await res.json();
      if (j.success) {
        setShowModal(false); setDescription('');
        setLines([emptyLine(), emptyLine()]);
        setEntryDate(new Date().toISOString().split('T')[0]);
        load();
      } else setFormError(j.message || j.error || 'فشل الحفظ');
    } catch { setFormError('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">القيود المحاسبية</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'جاري التحميل…' : `${entries.length} قيد`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm text-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> قيد جديد
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
          <span className="flex-1">{error}</span>
          <button onClick={load} className="font-medium hover:underline">إعادة المحاولة</button>
        </div>
      )}

      {/* New entry modal */}
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
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">مدين</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">دائن</th>
                        <th className="px-2 py-2" />
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
                        <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-slate-600">الإجمالي</td>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-700 tabular-nums">
                          {totalDebit.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-700 tabular-nums">
                          {totalCredit.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!balanced && totalDebit > 0 && (
                  <p className="text-red-500 text-xs mt-1.5">
                    ⚠ الفرق: {Math.abs(totalDebit - totalCredit).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م — المدين يجب أن يساوي الدائن
                  </p>
                )}
                {balanced && totalDebit > 0 && (
                  <p className="text-green-600 text-xs mt-1.5">✓ القيد متوازن</p>
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

      {loading ? (
        <TableSkeleton />
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-16 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">لا توجد قيود محاسبية حتى الآن</p>
          <p className="text-slate-400 text-sm mt-1">تُنشأ القيود تلقائياً من الفواتير، أو يمكنك إنشاء قيد يدوي</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رقم القيد</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">البيان</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">إجمالي المدين</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">إجمالي الدائن</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-700 font-mono">
                    {e.entryNumber ?? e.id.slice(-6).toUpperCase()}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{fmtDate(e.date ?? e.createdAt)}</td>
                  <td className="px-5 py-3 text-sm text-slate-700 max-w-xs truncate">{e.description ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">{fmtEGP(e.totalDebit)}</td>
                  <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">{fmtEGP(e.totalCredit)}</td>
                  <td className="px-5 py-3 text-center">
                    {e.isPosted
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                          <CheckCircle className="w-3 h-3" /> مرحّل
                        </span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-medium">
                          <Clock className="w-3 h-3" /> مسودة
                        </span>
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
