'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import { Plus, X, Pencil, Trash2, FileText, AlertCircle, Search, Truck } from 'lucide-react';
import Link from 'next/link';
import { TableSkeleton, EmptyState, ErrorBanner, Toast, useToast, PageHeader } from '@/components/ui/patterns';

interface Supplier {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  phone?: string;
  email?: string;
  creditLimit?: number;
  balance?: number;
}

function fmtEGP(v?: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

const emptyForm = { code: '', nameAr: '', nameEn: '', email: '', phone: '', creditLimit: '' };

const TABLE_COLS = ['w-16', 'w-36', 'w-24', 'w-32', 'w-24', 'w-20'];

function InputField({ label, required, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}{required && ' *'}</label>
      <input {...props} required={required}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

export default function SuppliersPage() {
  const qc = useQueryClient();
  const suppliersQ = useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => apiGet<Supplier[]>('/api/suppliers'),
    staleTime: 60_000,
  });
  const suppliers = useMemo(() => suppliersQ.data ?? [], [suppliersQ.data]);
  const loading = suppliersQ.isLoading;
  const error = suppliersQ.error ? (suppliersQ.error as Error).message : null;
  const [search, setSearch]       = useState('');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm]           = useState(emptyForm);

  const [editItem, setEditItem]   = useState<Supplier | null>(null);
  const [editForm, setEditForm]   = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.suppliers });
  }, [qc]);

  const filtered = useMemo(() =>
    suppliers.filter(s =>
      !search ||
      s.nameAr.includes(search) ||
      (s.nameEn || '').toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone || '').includes(search) ||
      (s.email || '').toLowerCase().includes(search.toLowerCase())
    ), [suppliers, search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code, nameAr: form.nameAr,
          ...(form.nameEn && { nameEn: form.nameEn }),
          ...(form.email && { email: form.email }),
          ...(form.phone && { phone: form.phone }),
          ...(form.creditLimit && { creditLimit: Number(form.creditLimit) }),
        }),
      });
      const j = await res.json();
      if (j.success) { setShowModal(false); setForm(emptyForm); load(); showToast('تم إضافة المورد بنجاح'); }
      else setFormError(j.message || j.error || 'فشل الحفظ');
    } catch { setFormError('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  function openEdit(s: Supplier) {
    setEditItem(s);
    setEditForm({ code: s.code, nameAr: s.nameAr, nameEn: s.nameEn || '', email: s.email || '', phone: s.phone || '',
      creditLimit: s.creditLimit != null ? String(s.creditLimit) : '' });
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditSaving(true); setEditError(null);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editItem.id, code: editForm.code, nameAr: editForm.nameAr,
          nameEn: editForm.nameEn || null, email: editForm.email || null, phone: editForm.phone || null,
          creditLimit: editForm.creditLimit ? Number(editForm.creditLimit) : null }),
      });
      const j = await res.json();
      if (j.success) { setEditItem(null); load(); showToast('تم تحديث بيانات المورد'); }
      else setEditError(j.message || j.error || 'فشل الحفظ');
    } catch { setEditError('تعذر الاتصال بالخادم'); }
    finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/suppliers?id=${deleteId}`, { method: 'DELETE', credentials: 'include' });
      const j = await res.json();
      if (j.success) { setDeleteId(null); setDeleteError(null); load(); showToast('تم حذف المورد'); }
      else setDeleteError(j.message || j.error || 'فشل الحذف');
    } catch { setDeleteError('تعذر الاتصال بالخادم'); }
    finally { setDeleting(false); }
  }

  return (
    <div dir="rtl">
      <Toast toast={toast} />

      <PageHeader
        title="الموردون"
        subtitle={loading ? 'جاري التحميل…' : `${suppliers.length} مورد`}
        actions={
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> إضافة مورد
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرمز أو الهاتف…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {search && <div className="flex items-center text-sm text-slate-500 self-center">{filtered.length} نتيجة</div>}
      </div>

      {error && <div className="mb-5"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading ? (
        <TableSkeleton cols={TABLE_COLS} rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={search ? 'لا توجد نتائج مطابقة' : 'لا يوجد موردون حتى الآن'}
          description={!search ? 'ابدأ بإضافة أول مورد لمتابعة المشتريات' : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الرمز</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الاسم</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الهاتف</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">البريد الإلكتروني</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">حد الائتمان</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-mono text-slate-500">{s.code}</td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">
                    {s.nameAr}
                    {s.nameEn && <span className="block text-xs text-slate-400 font-normal">{s.nameEn}</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{s.phone ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{s.email ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 text-left tabular-nums">{fmtEGP(s.creditLimit)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/invoices/purchases?supplier=${encodeURIComponent(s.nameAr)}`}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="فواتير المورد">
                        <FileText className="w-4 h-4" />
                      </Link>
                      <button onClick={() => openEdit(s)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setDeleteId(s.id); setDeleteError(null); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">إضافة مورد جديد</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <InputField label="الرمز" required value={form.code} placeholder="SUP-001"
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                <InputField label="حد الائتمان (ج.م)" type="number" min="0" value={form.creditLimit} placeholder="0"
                  onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} />
              </div>
              <InputField label="الاسم بالعربية" required value={form.nameAr} placeholder="شركة التوريد"
                onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} />
              <InputField label="الاسم بالإنجليزية" value={form.nameEn} placeholder="Supply Company (اختياري)"
                onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="الهاتف" value={form.phone} placeholder="0501234567"
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <InputField label="البريد الإلكتروني" type="email" value={form.email} placeholder="info@supplier.com"
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'جاري الحفظ…' : 'حفظ'}
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

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">تعديل بيانات المورد</h2>
              <button onClick={() => setEditItem(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              {editError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{editError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <InputField label="الرمز" required value={editForm.code}
                  onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} />
                <InputField label="حد الائتمان (ج.م)" type="number" min="0" value={editForm.creditLimit}
                  onChange={e => setEditForm(f => ({ ...f, creditLimit: e.target.value }))} />
              </div>
              <InputField label="الاسم بالعربية" required value={editForm.nameAr}
                onChange={e => setEditForm(f => ({ ...f, nameAr: e.target.value }))} />
              <InputField label="الاسم بالإنجليزية" value={editForm.nameEn}
                onChange={e => setEditForm(f => ({ ...f, nameEn: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="الهاتف" value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                <InputField label="البريد الإلكتروني" type="email" value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={editSaving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {editSaving ? 'جاري الحفظ…' : 'حفظ التعديلات'}
                </button>
                <button type="button" onClick={() => setEditItem(null)}
                  className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200 transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">تأكيد الحذف</h3>
            <p className="text-sm text-slate-500 mb-4">هل أنت متأكد من حذف هذا المورد؟ لا يمكن حذف مورد مرتبط بفواتير.</p>
            {deleteError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />{deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'جاري الحذف…' : 'حذف'}
              </button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
