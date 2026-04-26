'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import { Plus, X, Pencil, Trash2, CheckCircle, XCircle, Warehouse } from 'lucide-react';
import { CardGridSkeleton, EmptyState, ErrorBanner, Toast, useToast, PageHeader } from '@/components/ui/patterns';

interface WarehouseItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  manager?: string;
  isActive?: boolean;
}

const emptyForm = { code: '', nameAr: '', nameEn: '', address: '', phone: '', manager: '' };

function InputField({ label, required, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}{required && ' *'}</label>
      <input {...props} required={required}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

export default function WarehousesPage() {
  const qc = useQueryClient();

  const warehousesQ = useQuery({
    queryKey: queryKeys.warehouses,
    queryFn: () => apiGet<WarehouseItem[]>('/api/warehouses'),
  });
  const warehouses = useMemo(() => warehousesQ.data ?? [], [warehousesQ.data]);
  const loading    = warehousesQ.isLoading;
  const error      = warehousesQ.error ? (warehousesQ.error as Error).message : null;

  const [showModal, setShowModal]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [form, setForm]             = useState(emptyForm);

  const [editItem, setEditItem]     = useState<WarehouseItem | null>(null);
  const [editForm, setEditForm]     = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState<string | null>(null);

  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, showToast] = useToast();

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.warehouses });
  }, [qc]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await fetch('/api/warehouses', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code, nameAr: form.nameAr,
          ...(form.nameEn && { nameEn: form.nameEn }),
          ...(form.address && { address: form.address }),
          ...(form.phone && { phone: form.phone }),
          ...(form.manager && { manager: form.manager }),
        }),
      });
      const j = await res.json();
      if (j.success) { setShowModal(false); setForm(emptyForm); reload(); showToast('تم إضافة المستودع بنجاح'); }
      else setFormError(j.message || j.error || 'فشل الحفظ');
    } catch { setFormError('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  function openEdit(w: WarehouseItem) {
    setEditItem(w);
    setEditForm({ code: w.code, nameAr: w.nameAr, nameEn: w.nameEn || '', address: w.address || '', phone: w.phone || '', manager: w.manager || '' });
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditSaving(true); setEditError(null);
    try {
      const res = await fetch('/api/warehouses', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editItem.id, code: editForm.code, nameAr: editForm.nameAr,
          nameEn: editForm.nameEn || null, address: editForm.address || null, phone: editForm.phone || null,
          manager: editForm.manager || null }),
      });
      const j = await res.json();
      if (j.success) { setEditItem(null); reload(); showToast('تم تحديث بيانات المستودع'); }
      else setEditError(j.message || j.error || 'فشل الحفظ');
    } catch { setEditError('تعذر الاتصال بالخادم'); }
    finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/warehouses?id=${deleteId}`, { method: 'DELETE', credentials: 'include' });
      const j = await res.json();
      if (j.success) { setDeleteId(null); reload(); showToast('تم حذف المستودع'); }
      else setDeleteError(j.message || j.error || 'فشل الحذف');
    } catch { setDeleteError('تعذر الاتصال بالخادم'); }
    finally { setDeleting(false); }
  }

  const WarehouseFormFields = ({ f, setF }: { f: typeof emptyForm; setF: (fn: (prev: typeof emptyForm) => typeof emptyForm) => void }) => (
    <>
      <div className="grid grid-cols-2 gap-3">
        <InputField label="الرمز" required value={f.code} placeholder="WH-001"
          onChange={e => setF(p => ({ ...p, code: e.target.value }))} />
        <InputField label="الهاتف" value={f.phone} placeholder="0501234567"
          onChange={e => setF(p => ({ ...p, phone: e.target.value }))} />
      </div>
      <InputField label="الاسم بالعربية" required value={f.nameAr} placeholder="المستودع الرئيسي"
        onChange={e => setF(p => ({ ...p, nameAr: e.target.value }))} />
      <InputField label="الاسم بالإنجليزية" value={f.nameEn} placeholder="Main Warehouse (اختياري)"
        onChange={e => setF(p => ({ ...p, nameEn: e.target.value }))} />
      <InputField label="العنوان" value={f.address} placeholder="القاهرة، مصر"
        onChange={e => setF(p => ({ ...p, address: e.target.value }))} />
      <InputField label="المدير المسؤول" value={f.manager} placeholder="أحمد محمد"
        onChange={e => setF(p => ({ ...p, manager: e.target.value }))} />
    </>
  );

  return (
    <div dir="rtl">
      <Toast toast={toast} />

      <PageHeader
        title="المستودعات"
        subtitle={loading ? 'جاري التحميل…' : `${warehouses.length} مستودع`}
        actions={
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> إضافة مستودع
          </button>
        }
      />

      {error && <div className="mb-5"><ErrorBanner message={error} onRetry={() => warehousesQ.refetch()} /></div>}

      {loading ? (
        <CardGridSkeleton cols={2} count={4} />
      ) : warehouses.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="لا توجد مستودعات حتى الآن"
          description="أضف مستودعاً لإدارة المخزون بفعالية"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map(w => (
            <div key={w.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{w.nameAr}</h3>
                  {w.nameEn && <p className="text-xs text-slate-400 mt-0.5">{w.nameEn}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {w.isActive !== false ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3 h-3" /> نشط
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
                      <XCircle className="w-3 h-3" /> غير نشط
                    </span>
                  )}
                  <button onClick={() => openEdit(w)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setDeleteId(w.id); setDeleteError(null); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-slate-500">
                <div><span className="text-slate-400">الرمز: </span><span className="font-mono text-slate-600">{w.code}</span></div>
                {w.address && <div><span className="text-slate-400">العنوان: </span>{w.address}</div>}
                {w.phone && <div><span className="text-slate-400">الهاتف: </span>{w.phone}</div>}
                {w.manager && <div><span className="text-slate-400">المدير: </span>{w.manager}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">إضافة مستودع جديد</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{formError}</div>}
              <WarehouseFormFields f={form} setF={setForm} />
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
              <h2 className="text-lg font-semibold text-slate-900">تعديل بيانات المستودع</h2>
              <button onClick={() => setEditItem(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              {editError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{editError}</div>}
              <WarehouseFormFields f={editForm} setF={setEditForm} />
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
            <p className="text-sm text-slate-500 mb-3">هل أنت متأكد من حذف هذا المستودع؟ لا يمكن حذف مستودع يحتوي على منتجات.</p>
            {deleteError && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{deleteError}</p>}
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
