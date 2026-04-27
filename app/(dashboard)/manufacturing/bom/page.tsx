'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { Layers, Search, ChevronLeft, Package } from 'lucide-react';
import { TableSkeleton, EmptyState, ErrorBanner } from '@/components/ui/patterns';
import { ManufacturingLayout } from '@/components/manufacturing/ManufacturingLayout';

interface ProductLite {
  id:     string;
  code:   string;
  nameAr: string;
  type?:  string | null;
  unit?:  string | null;
  stock:  number;
}
interface BOMItemEntry {
  id:        string;
  productId: string;
  materialId: string;
  quantity:  number;
  product:   { id: string; nameAr: string; code: string; unit?: string | null };
  material:  { id: string; nameAr: string; code: string; unit?: string | null };
}

const TABLE_COLS = ['w-32', 'w-32', 'w-24', 'w-24'];

export default function BOMHubPage() {
  const productsQ = useQuery({
    queryKey: ['products'],
    queryFn:  () => apiGet<ProductLite[]>('/api/products'),
    staleTime: 60_000,
  });
  const bomQ = useQuery({
    queryKey: ['bom'],
    queryFn:  () => apiGet<BOMItemEntry[]>('/api/bom'),
    staleTime: 30_000,
  });

  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const bom      = useMemo(() => bomQ.data      ?? [], [bomQ.data]);
  const finished = useMemo(
    () => products.filter(p => (p.type ?? 'finished_product') === 'finished_product'),
    [products],
  );

  const summary = useMemo(() => {
    const map = new Map<string, { product: ProductLite; count: number }>();
    for (const b of bom) {
      const product = products.find(p => p.id === b.productId);
      if (!product) continue;
      const existing = map.get(b.productId);
      if (existing) existing.count += 1;
      else          map.set(b.productId, { product, count: 1 });
    }
    return Array.from(map.values());
  }, [bom, products]);

  const productsWithoutBOM = useMemo(
    () => finished.filter(p => !summary.some(s => s.product.id === p.id)),
    [finished, summary],
  );

  const [search, setSearch] = useState('');
  const filteredSummary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summary;
    return summary.filter(s =>
      [s.product.nameAr, s.product.code].some(x => (x || '').toLowerCase().includes(q)),
    );
  }, [summary, search]);

  const loading = productsQ.isLoading || bomQ.isLoading;
  const error   = bomQ.error ? (bomQ.error as Error).message : null;

  return (
    <ManufacturingLayout
      title="قوائم المواد (BOM)"
      subtitle={loading ? 'جاري التحميل…' : `${summary.length} منتج معرّف · ${productsWithoutBOM.length} منتج بدون BOM`}
    >
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-48 max-w-md">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالمنتج…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {error && <div className="mb-5"><ErrorBanner message={error} onRetry={() => bomQ.refetch()} /></div>}

      {loading ? (
        <TableSkeleton cols={TABLE_COLS} rows={4} />
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" /> منتجات بقائمة مواد ({filteredSummary.length})
            </h3>
            {filteredSummary.length === 0 ? (
              <EmptyState
                icon={Layers}
                title={search ? 'لا توجد قوائم مطابقة' : 'لا توجد قوائم مواد بعد'}
                description={!search ? 'اختر منتجاً نهائياً وأضف موادّه الخام لتعريف الـ BOM' : undefined}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSummary.map(s => (
                  <Link key={s.product.id}
                    href={`/manufacturing/bom/${s.product.id}`}
                    className="group bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-200 transition-all p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate group-hover:text-emerald-700">{s.product.nameAr}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{s.product.code}</div>
                        <div className="text-xs text-slate-500 mt-1">{s.count} مادة في القائمة</div>
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {productsWithoutBOM.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" /> منتجات بدون قائمة مواد ({productsWithoutBOM.length})
              </h3>
              <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-4">
                <div className="flex flex-wrap gap-2">
                  {productsWithoutBOM.map(p => (
                    <Link key={p.id} href={`/manufacturing/bom/${p.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-slate-700 hover:bg-amber-100 transition-colors"
                    >
                      <Package className="w-3.5 h-3.5 text-amber-600" />
                      {p.nameAr}
                      <span className="text-slate-400 font-mono">({p.code})</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ManufacturingLayout>
  );
}
