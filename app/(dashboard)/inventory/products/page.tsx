'use client';

import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, X, Pencil, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type?: string;
  unit?: string;
  stock: number;
  minStock?: number;
  cost: number;
  price: number;
}

function formatEGP(v?: number) {
  if (v == null) return '—';
  return `${v.toLocaleString('ar-EG')} ج.م`;
}

const typeLabels: Record<string, string> = {
  finished_product: 'منتج نهائي',
  raw_material: 'مواد خام',
  packaging: 'تغليف',
};

const typeTabs = [
  { key: 'all', label: 'الكل' },
  { key: 'finished_product', label: 'منتجات نهائية' },
  { key: 'raw_material', label: 'مواد خام' },
  { key: 'packaging', label: 'تغليف' },
];

const emptyForm = { code: '', nameAr: '', nameEn: '', type: 'finished_product', unit: 'قطعة', price: '', cost: '', stock: '0', minStock: '' };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string>('all');

  // Add modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Edit modal
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load(type = activeType) {
    setLoading(true);
    const url = type === 'all' ? '/api/products' : `/api/products?type=${type}`;
    fetch(url, { credentials: 'include' })
      .then(r => r.json())
      .then(j => { if (j.success) setProducts(j.data ?? []); else setError(j.message || 'فشل التحميل'); })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(activeType); }, [activeType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await fetch('/api/products', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          nameAr: form.nameAr,
          ...(form.nameEn && { nameEn: form.nameEn }),
          type: form.type,
          unit: form.unit || 'قطعة',
          price: Number(form.price) || 0,
          cost: Number(form.cost) || 0,
          stock: Number(form.stock) || 0,
          ...(form.minStock && { minStock: Number(form.minStock) }),
        }),
      });
      const j = await res.json();
      if (j.success) { setShowModal(false); setForm(emptyForm); load(); }
      else setFormError(j.message || j.error || 'فشل الحفظ');
    } catch { setFormError('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  function openEdit(p: Product) {
    setEditItem(p);
    setEditForm({
      code: p.code || '',
      nameAr: p.nameAr || '',
      nameEn: p.nameEn || '',
      type: p.type || 'finished_product',
      unit: p.unit || 'قطعة',
      price: p.price != null ? String(p.price) : '',
      cost: p.cost != null ? String(p.cost) : '',
      stock: '',      // stock cannot be changed directly
      minStock: p.minStock != null ? String(p.minStock) : '',
    });
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditSaving(true); setEditError(null);
    try {
      const res = await fetch('/api/products', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editItem.id,
          code: editForm.code,
          nameAr: editForm.nameAr,
          nameEn: editForm.nameEn || null,
          type: editForm.type,
          unit: editForm.unit || 'قطعة',
          price: Number(editForm.price) || 0,
          cost: Number(editForm.cost) || 0,
          minStock: editForm.minStock ? Number(editForm.minStock) : null,
          // stock is intentionally omitted (controlled via inventory ops)
        }),
      });
      const j = await res.json();
      if (j.success) { setEditItem(null); load(); }
      else setEditError(j.message || j.error || 'فشل الحفظ');
    } catch { setEditError('تعذر الاتصال بالخادم'); }
    finally { setEditSaving(false); }
  }

  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/products?id=${deleteId}`, { method: 'DELETE', credentials: 'include' });
      const j = await res.json();
      if (j.success) { setDeleteId(null); load(); }
      else setDeleteError(j.message || j.error || 'فشل الحذف');
    } catch { setDeleteError('تعذر الاتصال بالخادم'); }
    finally { setDeleting(false); }
  }

  const ProductFormFields = ({ f, setF }: { f: typeof emptyForm; setF: (fn: (p: typeof emptyForm) => typeof emptyForm) => void; showStock?: boolean }) => (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">الرمز *</label>
          <input required value={f.code} onChange={e => setF(p => ({ ...p, code: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="PRD-001" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">النوع</label>
          <select value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="finished_product">منتج نهائي</option>
            <option value="raw_material">مواد خام</option>
            <option value="packaging">تغليف</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالعربية *</label>
        <input required value={f.nameAr} onChange={e => setF(p => ({ ...p, nameAr: e.target.value }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="اسم المنتج" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالإنجليزية</label>
        <input value={f.nameEn} onChange={e => setF(p => ({ ...p, nameEn: e.target.value }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Product Name (اختياري)" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">سعر البيع (ج.م) *</label>
          <input required type="number" min="0" step="0.01" value={f.price} onChange={e => setF(p => ({ ...p, price: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">التكلفة (ج.م)</label>
          <input type="number" min="0" step="0.01" value={f.cost} onChange={e => setF(p => ({ ...p, cost: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">وحدة القياس</label>
          <input value={f.unit} onChange={e => setF(p => ({ ...p, unit: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="قطعة" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">الحد الأدنى للمخزون</label>
          <input type="number" min="0" value={f.minStock} onChange={e => setF(p => ({ ...p, minStock: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
        </div>
      </div>
    </>
  );

  if (loading) return <div className="flex items-center justify-center h-64" dir="rtl"><div className="text-slate-500">جاري تحميل المنتجات…</div></div>;
  if (error) return <div className="flex items-center justify-center h-64" dir="rtl"><div className="text-red-500">{error}</div></div>;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">المنتجات والمخزون</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> إضافة منتج
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
        {typeTabs.map(t => (
          <button key={t.key} onClick={() => setActiveType(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeType === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">إضافة منتج جديد</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{formError}</div>}
              <ProductFormFields f={form} setF={setForm} />
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المخزون الابتدائي</label>
                  <input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">تعديل بيانات المنتج</h2>
              <button onClick={() => setEditItem(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              {editError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{editError}</div>}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-700">
                ملاحظة: لا يمكن تعديل المخزون مباشرة — استخدم &quot;تسويات المخزون&quot; لذلك.
              </div>
              <ProductFormFields f={editForm} setF={setEditForm} />
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
            <p className="text-sm text-slate-500 mb-3">هل أنت متأكد من حذف هذا المنتج؟ لا يمكن حذف منتج مرتبط بفواتير أو أوامر.</p>
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

      {products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">لا توجد منتجات في هذا التصنيف</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الرمز</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الاسم</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">النوع</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">المخزون</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الحد الأدنى</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التكلفة</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">سعر البيع</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">حالة</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(p => {
                const lowStock = p.stock <= (p.minStock ?? 0);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-slate-600">{p.code}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{p.nameAr}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{typeLabels[p.type ?? ''] ?? p.type ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 font-semibold">{p.stock} {p.unit ?? ''}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{p.minStock ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatEGP(p.cost)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatEGP(p.price)}</td>
                    <td className="px-5 py-3 text-sm">
                      {lowStock
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium"><AlertTriangle className="w-3 h-3" /> منخفض</span>
                        : <span className="inline-flex px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">متاح</span>
                      }
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteId(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
