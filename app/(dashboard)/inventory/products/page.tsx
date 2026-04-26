'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import { Plus, AlertTriangle, X, Pencil, Trash2, Search, Package, CheckCircle } from 'lucide-react';
import { TableSkeleton, EmptyState, ErrorBanner, Toast, useToast, PageHeader } from '@/components/ui/patterns';

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

function fmtEGP(v?: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

const typeLabels: Record<string, string> = {
  finished_product: 'منتج نهائي',
  raw_material:     'مواد خام',
  packaging:        'تغليف',
};

const typeColors: Record<string, string> = {
  finished_product: 'bg-blue-50 text-blue-700',
  raw_material:     'bg-amber-50 text-amber-700',
  packaging:        'bg-purple-50 text-purple-700',
};

const typeTabs = [
  { key: 'all',              label: 'الكل' },
  { key: 'finished_product', label: 'منتجات نهائية' },
  { key: 'raw_material',     label: 'مواد خام' },
  { key: 'packaging',        label: 'تغليف' },
];

const emptyForm = { code: '', nameAr: '', nameEn: '', type: 'finished_product', unit: 'قطعة', price: '', cost: '', stock: '0', minStock: '' };

const TABLE_COLS = ['w-16', 'w-32', 'w-20', 'w-16', 'w-16', 'w-24', 'w-24', 'w-16', 'w-20'];

export default function ProductsPage() {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<string>('all');
  const [search, setSearch]       = useState('');

  const productsQ = useQuery({
    queryKey: queryKeys.products(activeType),
    queryFn: () => apiGet<Product[]>(
      activeType === 'all' ? '/api/products' : `/api/products?type=${activeType}`
    ),
    staleTime: 0,
  });
  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const loading  = productsQ.isLoading;
  const error    = productsQ.error ? (productsQ.error as Error).message : null;

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm]           = useState(emptyForm);

  const [editItem, setEditItem]   = useState<Product | null>(null);
  const [editForm, setEditForm]   = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, showToast] = useToast();

  // After mutations, invalidate ALL products variants (any activeType filter).
  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['products'] });
  }, [qc]);

  const filtered = useMemo(() =>
    products.filter(p =>
      !search ||
      p.nameAr.includes(search) ||
      (p.nameEn || '').toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
    ), [products, search]);

  const lowStockCount = useMemo(() => products.filter(p => p.stock <= (p.minStock ?? 0)).length, [products]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await fetch('/api/products', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code, nameAr: form.nameAr,
          ...(form.nameEn && { nameEn: form.nameEn }),
          type: form.type, unit: form.unit || 'قطعة',
          price: Number(form.price) || 0, cost: Number(form.cost) || 0,
          stock: Number(form.stock) || 0,
          ...(form.minStock && { minStock: Number(form.minStock) }),
        }),
      });
      const j = await res.json();
      if (j.success) { setShowModal(false); setForm(emptyForm); reload(); showToast('تم إضافة المنتج بنجاح'); }
      else setFormError(j.message || j.error || 'فشل الحفظ');
    } catch { setFormError('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  function openEdit(p: Product) {
    setEditItem(p);
    setEditForm({ code: p.code, nameAr: p.nameAr, nameEn: p.nameEn || '', type: p.type || 'finished_product',
      unit: p.unit || 'قطعة', price: p.price != null ? String(p.price) : '',
      cost: p.cost != null ? String(p.cost) : '', stock: '', minStock: p.minStock != null ? String(p.minStock) : '' });
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
        body: JSON.stringify({ id: editItem.id, code: editForm.code, nameAr: editForm.nameAr,
          nameEn: editForm.nameEn || null, type: editForm.type, unit: editForm.unit || 'قطعة',
          price: Number(editForm.price) || 0, cost: Number(editForm.cost) || 0,
          minStock: editForm.minStock ? Number(editForm.minStock) : null }),
      });
      const j = await res.json();
      if (j.success) { setEditItem(null); reload(); showToast('تم تحديث بيانات المنتج'); }
      else setEditError(j.message || j.error || 'فشل الحفظ');
    } catch { setEditError('تعذر الاتصال بالخادم'); }
    finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/products?id=${deleteId}`, { method: 'DELETE', credentials: 'include' });
      const j = await res.json();
      if (j.success) { setDeleteId(null); reload(); showToast('تم حذف المنتج'); }
      else setDeleteError(j.message || j.error || 'فشل الحذف');
    } catch { setDeleteError('تعذر الاتصال بالخادم'); }
    finally { setDeleting(false); }
  }

  const ProductFormFields = ({ f, setF }: { f: typeof emptyForm; setF: (fn: (p: typeof emptyForm) => typeof emptyForm) => void }) => (
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
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
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
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">الحد الأدنى للمخزون</label>
        <input type="number" min="0" value={f.minStock} onChange={e => setF(p => ({ ...p, minStock: e.target.value }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
      </div>
    </>
  );

  return (
    <div dir="rtl">
      <Toast toast={toast} />

      <PageHeader
        title="المنتجات والمخزون"
        subtitle={
          <span className="flex items-center gap-2">
            {loading ? 'جاري التحميل…' : `${products.length} منتج`}
            {!loading && lowStockCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                <AlertTriangle className="w-3 h-3" /> {lowStockCount} منخفض المخزون
              </span>
            )}
          </span>
        }
        actions={
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> إضافة منتج
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {typeTabs.map(t => (
            <button key={t.key} onClick={() => setActiveType(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeType === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرمز…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-5"><ErrorBanner message={error} onRetry={() => productsQ.refetch()} /></div>}

      {loading ? (
        <TableSkeleton cols={TABLE_COLS} rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد منتجات في هذا التصنيف'}
          description={!search ? 'أضف منتجات لبدء إدارة المخزون' : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الرمز</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الاسم</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">النوع</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">المخزون</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">الحد الأدنى</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">التكلفة</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">سعر البيع</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">حالة</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => {
                const lowStock = p.stock <= (p.minStock ?? 0);
                return (
                  <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${lowStock ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3 text-sm font-mono text-slate-500">{p.code}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">
                      {p.nameAr}
                      {p.nameEn && <span className="block text-xs text-slate-400 font-normal">{p.nameEn}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[p.type ?? ''] || 'bg-slate-100 text-slate-600'}`}>
                        {typeLabels[p.type ?? ''] ?? p.type ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700 text-left tabular-nums">
                      {p.stock.toLocaleString('ar-EG')} {p.unit ?? ''}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500 text-left tabular-nums">
                      {p.minStock != null ? p.minStock.toLocaleString('ar-EG') : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 text-left tabular-nums">{fmtEGP(p.cost)}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 font-medium text-left tabular-nums">{fmtEGP(p.price)}</td>
                    <td className="px-5 py-3 text-center">
                      {lowStock
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" /> منخفض
                          </span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                            <CheckCircle className="w-3 h-3" /> متاح
                          </span>
                      }
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1.5">
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المخزون الابتدائي</label>
                <input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
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
    </div>
  );
}
