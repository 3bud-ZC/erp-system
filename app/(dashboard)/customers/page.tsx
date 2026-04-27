'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import { Plus, X, Pencil, Trash2, FileText, AlertCircle, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { TableSkeleton, EmptyState, ErrorBanner, Toast, useToast } from '@/components/ui/patterns';
import { ServicesLayout } from '@/components/services/ServicesLayout';
import { Modal, Field, PrimaryButton, SecondaryButton, FormError } from '@/components/ui/modal';

interface Customer {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  email?: string;
  phone?: string;
  creditLimit?: number;
  balance?: number;
}

function fmtEGP(v?: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

const emptyForm = { code: '', nameAr: '', nameEn: '', email: '', phone: '', creditLimit: '' };

const TABLE_COLS = ['w-16', 'w-36', 'w-24', 'w-32', 'w-24', 'w-24', 'w-20'];

/* ─── Page ────────────────────────────────────────────────── */
export default function CustomersPage() {
  const qc = useQueryClient();
  const customersQ = useQuery({
    queryKey: queryKeys.customers,
    queryFn: () => apiGet<Customer[]>('/api/customers'),
    staleTime: 60_000,
  });
  const customers = useMemo(() => customersQ.data ?? [], [customersQ.data]);
  const loading = customersQ.isLoading;
  const error = customersQ.error ? (customersQ.error as Error).message : null;
  const [search, setSearch]       = useState('');

  // Add modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm]           = useState(emptyForm);

  // Edit modal
  const [editItem, setEditItem]   = useState<Customer | null>(null);
  const [editForm, setEditForm]   = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.customers });
  }, [qc]);

  const filtered = useMemo(() =>
    customers.filter(c =>
      !search ||
      c.nameAr.includes(search) ||
      (c.nameEn || '').toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
    ), [customers, search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await fetch('/api/customers', {
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
      if (j.success) { setShowModal(false); setForm(emptyForm); load(); showToast('تم إضافة العميل بنجاح'); }
      else setFormError(j.message || j.error || 'فشل الحفظ');
    } catch { setFormError('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  function openEdit(c: Customer) {
    setEditItem(c);
    setEditForm({ code: c.code, nameAr: c.nameAr, nameEn: c.nameEn || '', email: c.email || '', phone: c.phone || '',
      creditLimit: c.creditLimit != null ? String(c.creditLimit) : '' });
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditSaving(true); setEditError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editItem.id, code: editForm.code, nameAr: editForm.nameAr,
          nameEn: editForm.nameEn || null, email: editForm.email || null, phone: editForm.phone || null,
          creditLimit: editForm.creditLimit ? Number(editForm.creditLimit) : null }),
      });
      const j = await res.json();
      if (j.success) { setEditItem(null); load(); showToast('تم تحديث بيانات العميل'); }
      else setEditError(j.message || j.error || 'فشل الحفظ');
    } catch { setEditError('تعذر الاتصال بالخادم'); }
    finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers?id=${deleteId}`, { method: 'DELETE', credentials: 'include' });
      const j = await res.json();
      if (j.success) { setDeleteId(null); setDeleteError(null); load(); showToast('تم حذف العميل'); }
      else setDeleteError(j.message || j.error || 'فشل الحذف');
    } catch { setDeleteError('تعذر الاتصال بالخادم'); }
    finally { setDeleting(false); }
  }

  return (
    <ServicesLayout
      title="العملاء"
      subtitle={loading ? 'جاري التحميل…' : `${customers.length} عميل`}
      toolbar={
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium">
          <Plus className="w-4 h-4" /> إضافة عميل
        </button>
      }
    >
      <Toast toast={toast} />

      {/* Search bar */}
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
        {search && (
          <div className="flex items-center text-sm text-slate-500 self-center">
            {filtered.length} نتيجة
          </div>
        )}
      </div>

      {error && <div className="mb-5"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading ? (
        <TableSkeleton cols={TABLE_COLS} rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء حتى الآن'}
          description={!search ? 'ابدأ بإضافة أول عميل لمتابعة المعاملات' : undefined}
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
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">الرصيد</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-mono text-slate-500">{c.code}</td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">
                    {c.nameAr}
                    {c.nameEn && <span className="block text-xs text-slate-400 font-normal">{c.nameEn}</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{c.phone || '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{c.email || '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 text-left tabular-nums">{fmtEGP(c.creditLimit)}</td>
                  <td className="px-5 py-3 text-sm text-left tabular-nums">
                    <span className={c.balance != null && c.balance > 0 ? 'text-orange-600 font-medium' : 'text-slate-600'}>
                      {fmtEGP(c.balance)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/invoices/sales?customer=${encodeURIComponent(c.nameAr)}`}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="فواتير العميل">
                        <FileText className="w-4 h-4" />
                      </Link>
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setDeleteId(c.id); setDeleteError(null); }}
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
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="إضافة عميل جديد"
        footer={
          <>
            <SecondaryButton onClick={() => setShowModal(false)}>إلغاء</SecondaryButton>
            <PrimaryButton type="submit" form="add-customer-form" disabled={saving}>
              {saving ? 'جاري الحفظ…' : 'حفظ'}
            </PrimaryButton>
          </>
        }
      >
        <form id="add-customer-form" onSubmit={handleSubmit} className="space-y-4">
          <FormError>{formError}</FormError>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الرمز" required value={form.code} placeholder="CUS-001"
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            <Field label="حد الائتمان (ج.م)" type="number" min="0" value={form.creditLimit} placeholder="0"
              onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} />
          </div>
          <Field label="الاسم بالعربية" required value={form.nameAr} placeholder="شركة الأمل"
            onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} />
          <Field label="الاسم بالإنجليزية" value={form.nameEn} placeholder="Al Amal Company (اختياري)"
            onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="الهاتف" value={form.phone} placeholder="0501234567"
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Field label="البريد الإلكتروني" type="email" value={form.email} placeholder="info@co.com"
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title="تعديل بيانات العميل"
        footer={
          <>
            <SecondaryButton onClick={() => setEditItem(null)}>إلغاء</SecondaryButton>
            <PrimaryButton type="submit" form="edit-customer-form" disabled={editSaving}>
              {editSaving ? 'جاري الحفظ…' : 'حفظ التعديلات'}
            </PrimaryButton>
          </>
        }
      >
        <form id="edit-customer-form" onSubmit={handleEdit} className="space-y-4">
          <FormError>{editError}</FormError>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الرمز" required value={editForm.code}
              onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} />
            <Field label="حد الائتمان (ج.م)" type="number" min="0" value={editForm.creditLimit}
              onChange={e => setEditForm(f => ({ ...f, creditLimit: e.target.value }))} />
          </div>
          <Field label="الاسم بالعربية" required value={editForm.nameAr}
            onChange={e => setEditForm(f => ({ ...f, nameAr: e.target.value }))} />
          <Field label="الاسم بالإنجليزية" value={editForm.nameEn}
            onChange={e => setEditForm(f => ({ ...f, nameEn: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="الهاتف" value={editForm.phone}
              onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            <Field label="البريد الإلكتروني" type="email" value={editForm.email}
              onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">تأكيد الحذف</h3>
            <p className="text-sm text-slate-500 mb-4">هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.</p>
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
    </ServicesLayout>
  );
}
