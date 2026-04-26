'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Search, LogOut, X, FileText, Users, Package, Clock, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/* ─── Types ──────────────────────────────────────────────── */
interface SearchResult {
  type: 'invoice' | 'purchase' | 'customer' | 'product';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface Notif {
  id: string;
  type: 'overdue' | 'lowstock';
  title: string;
  subtitle: string;
  href: string;
  severity: 'high' | 'medium';
}

/* ─── Search helpers ─────────────────────────────────────── */
const typeIcon: Record<SearchResult['type'], React.ElementType> = {
  invoice:  FileText,
  purchase: ShoppingCart,
  customer: Users,
  product:  Package,
};

const typeCls: Record<SearchResult['type'], string> = {
  invoice:  'bg-blue-50 text-blue-600',
  purchase: 'bg-orange-50 text-orange-600',
  customer: 'bg-purple-50 text-purple-600',
  product:  'bg-emerald-50 text-emerald-600',
};

function filterResults(q: string, data: { invoices: any[]; purchases: any[]; customers: any[]; products: any[] }): SearchResult[] {
  const lower = q.toLowerCase();
  const results: SearchResult[] = [];

  data.invoices
    .filter(i => i.invoiceNumber?.toLowerCase().includes(lower) || i.customer?.nameAr?.includes(q))
    .slice(0, 3)
    .forEach(i => results.push({
      type: 'invoice', id: i.id,
      title: `فاتورة مبيعات #${i.invoiceNumber}`,
      subtitle: i.customer?.nameAr ?? 'بدون عميل',
      href: `/invoices/sales/${i.id}`,
    }));

  data.purchases
    .filter(i => i.invoiceNumber?.toLowerCase().includes(lower) || i.supplier?.nameAr?.includes(q))
    .slice(0, 2)
    .forEach(i => results.push({
      type: 'purchase', id: i.id,
      title: `فاتورة مشتريات #${i.invoiceNumber}`,
      subtitle: i.supplier?.nameAr ?? 'بدون مورد',
      href: `/invoices/purchases/${i.id}`,
    }));

  data.customers
    .filter(c => c.nameAr?.includes(q) || c.phone?.includes(q))
    .slice(0, 3)
    .forEach(c => results.push({
      type: 'customer', id: c.id,
      title: c.nameAr,
      subtitle: c.phone ?? c.email ?? 'عميل',
      href: `/customers`,
    }));

  data.products
    .filter(p => p.nameAr?.includes(q) || p.code?.toLowerCase().includes(lower))
    .slice(0, 3)
    .forEach(p => results.push({
      type: 'product', id: p.id,
      title: p.nameAr,
      subtitle: p.code ?? 'منتج',
      href: `/inventory/products`,
    }));

  return results;
}

/* ─── Topbar ─────────────────────────────────────────────── */
export function Topbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  /* ── Search ─────────────────────────────────── */
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDrop,  setShowDrop]  = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const cacheRef  = useRef<{ invoices: any[]; purchases: any[]; customers: any[]; products: any[] } | null>(null);

  /* ── Notifications ───────────────────────────── */
  const [showNotif,    setShowNotif]    = useState(false);
  const [notifs,       setNotifs]       = useState<Notif[]>([]);
  const [notifCount,   setNotifCount]   = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  /* close on outside click */
  useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, []);

  /* ── Global search with one-time data fetch ── */
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDrop(false);
      return;
    }

    // If cache is already loaded, filter instantly
    if (cacheRef.current) {
      setResults(filterResults(query, cacheRef.current));
      setShowDrop(true);
      return;
    }

    // First search: fetch everything, cache it, then filter
    const t = setTimeout(async () => {
      setSearching(true);
      setShowDrop(true);
      try {
        const [invRes, purRes, custRes, prodRes] = await Promise.all([
          fetch('/api/sales-invoices',    { credentials: 'include' }),
          fetch('/api/purchase-invoices', { credentials: 'include' }),
          fetch('/api/customers',         { credentials: 'include' }),
          fetch('/api/products',          { credentials: 'include' }),
        ]);
        const [invJ, purJ, custJ, prodJ] = await Promise.all([
          invRes.json(), purRes.json(), custRes.json(), prodRes.json(),
        ]);
        cacheRef.current = {
          invoices:  invJ.success  ? invJ.data  ?? [] : [],
          purchases: purJ.success  ? purJ.data  ?? [] : [],
          customers: custJ.success ? custJ.data ?? [] : [],
          products:  prodJ.success ? prodJ.data ?? [] : [],
        };
        setResults(filterResults(query, cacheRef.current));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);

    return () => clearTimeout(t);
  }, [query]);

  /* ── Notification fetch ──────────────────────── */
  const fetchNotifs = useCallback(async () => {
    setNotifLoading(true);
    try {
      const [invRes, stockRes] = await Promise.all([
        fetch('/api/sales-invoices',             { credentials: 'include' }),
        fetch('/api/inventory/low-stock-alerts', { credentials: 'include' }),
      ]);
      const [invJ, stockJ] = await Promise.all([invRes.json(), stockRes.json()]);

      const list: Notif[] = [];

      if (invJ.success) {
        const sevenDaysAgo = Date.now() - 7 * 864e5;
        (invJ.data ?? [])
          .filter((i: any) => i.status === 'pending' && new Date(i.date ?? i.createdAt).getTime() < sevenDaysAgo)
          .slice(0, 5)
          .forEach((i: any) => list.push({
            id: `inv-${i.id}`, type: 'overdue',
            title: `فاتورة متأخرة #${i.invoiceNumber}`,
            subtitle: i.customer?.nameAr ?? 'بدون عميل',
            href: `/invoices/sales/${i.id}`, severity: 'high',
          }));
      }

      if (stockJ.success) {
        (stockJ.data ?? []).slice(0, 5).forEach((p: any) => list.push({
          id: `stk-${p.id}`, type: 'lowstock',
          title: `مخزون منخفض: ${p.nameAr}`,
          subtitle: `متاح ${p.stock} / الحد ${p.minStock ?? 0}`,
          href: '/inventory/products', severity: 'medium',
        }));
      }

      setNotifs(list);
      setNotifCount(list.length);
    } catch { /* silent */ }
    finally { setNotifLoading(false); }
  }, []);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  function clearSearch() {
    setQuery(''); setResults([]); setShowDrop(false);
  }

  return (
    <div className="sticky top-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/70 flex items-center justify-between px-6 z-40 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]" dir="rtl">

      {/* ── Search ─────────────────────────────────────────── */}
      <div className="flex-1 max-w-md" ref={searchRef}>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => query.trim() && setShowDrop(true)}
            placeholder="بحث في الفواتير والعملاء والمنتجات…"
            className="w-full pr-10 pl-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-right transition-all placeholder:text-slate-400"
          />
          {query && (
            <button onClick={clearSearch}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Search dropdown */}
          {showDrop && (
            <div className="absolute top-full right-0 left-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              {searching ? (
                <div className="flex items-center gap-2 p-4 text-slate-400 text-sm justify-center">
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                  جاري البحث…
                </div>
              ) : results.length === 0 ? (
                <div className="p-5 text-center">
                  <Search className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">لا نتائج لـ «{query}»</p>
                </div>
              ) : (
                <div className="py-1">
                  {results.map(r => {
                    const Icon = typeIcon[r.type];
                    return (
                      <Link key={`${r.type}-${r.id}`} href={r.href}
                        onClick={clearSearch}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${typeCls[r.type]}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                          <p className="text-xs text-slate-400 truncate">{r.subtitle}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(v => !v)}
            className="relative p-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-all text-slate-600"
            aria-label="الإشعارات">
            <Bell className="w-5 h-5" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {showNotif && (
            <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">الإشعارات</h3>
                <div className="flex items-center gap-2">
                  {notifCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                      {notifCount}
                    </span>
                  )}
                  <button onClick={fetchNotifs}
                    className="text-xs text-blue-600 hover:underline">
                    تحديث
                  </button>
                </div>
              </div>

              {notifLoading ? (
                <div className="p-6 text-center text-slate-400 text-sm">
                  <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin mb-2" />
                  <p>جاري التحميل…</p>
                </div>
              ) : notifs.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Bell className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">لا توجد إشعارات</p>
                  <p className="text-xs text-slate-400 mt-0.5">كل شيء يسير بشكل طبيعي</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {notifs.map(n => (
                    <Link key={n.id} href={n.href}
                      onClick={() => setShowNotif(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        n.severity === 'high' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
                      }`}>
                        {n.type === 'overdue'
                          ? <Clock className="w-4 h-4" />
                          : <Package className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 leading-snug">{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{n.subtitle}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                        n.severity === 'high' ? 'bg-red-400' : 'bg-amber-400'
                      }`} />
                    </Link>
                  ))}
                </div>
              )}

              <div className="px-4 py-2.5 border-t border-slate-100 flex gap-3 text-xs">
                <Link href="/invoices/sales" onClick={() => setShowNotif(false)}
                  className="text-blue-600 hover:underline font-medium">
                  الفواتير المعلقة
                </Link>
                <span className="text-slate-300">·</span>
                <Link href="/inventory/products" onClick={() => setShowNotif(false)}
                  className="text-blue-600 hover:underline font-medium">
                  المخزون المنخفض
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* User */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
            {user?.name?.[0]?.toUpperCase() ?? 'م'}
          </div>
          <div className="text-right hidden sm:block leading-tight">
            <p className="text-sm font-semibold text-slate-800">{user?.name ?? 'مدير النظام'}</p>
            <p className="text-xs text-slate-400">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all text-slate-400"
            title="تسجيل الخروج">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
