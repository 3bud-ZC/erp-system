'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  BarChart3,
  Factory,
  ChevronRight,
  Search,
  Menu,
  X,
  Building2,
  Boxes,
  Calculator,
  FileText,
  ArrowUpDown,
  BookOpen,
  Scale,
  Wallet,
  PieChart,
} from 'lucide-react';

interface MenuItem {
  title: string;
  icon: React.ElementType;
  href?: string;
  children?: MenuItem[];
  badge?: string;
}

/* ─── Navigation map — mirrors app/(dashboard)/* routes ─── */
const menuItems: MenuItem[] = [
  {
    title: 'لوحة التحكم',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    title: 'المبيعات',
    icon: TrendingUp,
    children: [
      { title: 'فواتير المبيعات',  icon: FileText,    href: '/sales/invoices' },
      { title: 'العملاء',          icon: Users,        href: '/customers' },
    ],
  },
  {
    title: 'المشتريات',
    icon: ShoppingCart,
    children: [
      { title: 'فواتير المشتريات', icon: FileText,    href: '/purchases/invoices' },
      { title: 'الموردين',         icon: Users,        href: '/suppliers' },
    ],
  },
  {
    title: 'المخزون',
    icon: Package,
    children: [
      { title: 'المنتجات',          icon: Boxes,        href: '/inventory/products' },
      { title: 'تسوية المخزون',    icon: ArrowUpDown,  href: '/inventory/stock-adjustments/new' },
      { title: 'المخازن',          icon: Building2,    href: '/warehouses' },
    ],
  },
  {
    title: 'المحاسبة',
    icon: Calculator,
    children: [
      { title: 'قيود اليومية',     icon: BookOpen,     href: '/accounting/journal-entries' },
    ],
  },
  {
    title: 'المالية',
    icon: Wallet,
    href: '/finance',
  },
  {
    title: 'التقارير',
    icon: PieChart,
    href: '/reports',
  },
];

/* ─── Single menu item ─── */
function SidebarItem({ item }: { item: MenuItem }) {
  const pathname = usePathname();

  const isExactActive    = item.href ? pathname === item.href : false;
  const hasActiveChild   = item.children?.some(c => c.href && (pathname === c.href || pathname.startsWith(c.href + '/')));
  const [open, setOpen]  = useState(!!hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  /* ── Parent with children ── */
  if (item.children) {
    return (
      <div className="mb-1">
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 ${
            hasActiveChild
              ? 'bg-blue-600/90 text-white shadow-md'
              : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <item.icon className="w-4 h-4 opacity-80" />
            <span className="font-medium text-sm">{item.title}</span>
            {item.badge && (
              <span className="text-[10px] bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded-full">{item.badge}</span>
            )}
          </div>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-60 mt-1' : 'max-h-0'}`}>
          <div className="mr-3 border-r border-slate-700/50 pr-2 space-y-0.5">
            {item.children.map((child, i) => {
              const childActive = child.href ? (pathname === child.href || pathname.startsWith(child.href + '/')) : false;
              return (
                <Link
                  key={i}
                  href={child.href || '#'}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                    childActive
                      ? 'bg-blue-500/25 text-white font-medium border-r-2 border-blue-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{child.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── Leaf link ── */
  return (
    <Link
      href={item.href || '#'}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mb-1 ${
        isExactActive
          ? 'bg-blue-600/90 text-white shadow-md'
          : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
      }`}
    >
      <item.icon className="w-4 h-4 opacity-80" />
      <span className="font-medium text-sm">{item.title}</span>
    </Link>
  );
}

/* ─── Sidebar shell ─── */
export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Flatten all items for search
  const allLinks = menuItems.flatMap(m =>
    m.children
      ? m.children.map(c => ({ ...c, parent: m.title }))
      : [{ ...m, parent: '' }]
  );

  const filtered = search.trim()
    ? allLinks.filter(l => l.title.includes(search) || (l.parent && l.parent.includes(search)))
    : null;

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(o => !o)}
        className="fixed top-4 right-4 z-50 lg:hidden bg-blue-600 text-white p-2.5 rounded-lg shadow-lg"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 right-0 h-full w-64 bg-gradient-to-b from-slate-800 to-slate-900 z-40 shadow-2xl flex flex-col transition-transform duration-300 ${
        mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      }`}>

        {/* Brand */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">نظام ERP</p>
              <p className="text-slate-400 text-xs mt-0.5">إدارة المصنع</p>
            </div>
            <button onClick={() => setMobileOpen(false)} className="mr-auto p-1 hover:bg-slate-700 rounded-lg lg:hidden">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              type="text"
              placeholder="بحث في القائمة…"
              className="w-full pr-8 pl-3 py-2 bg-slate-700/50 border border-slate-600/40 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/60 transition-all"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          {filtered ? (
            /* Search results */
            <div className="space-y-0.5">
              {filtered.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-4">لا توجد نتائج</p>
              ) : filtered.map((item, i) => {
                const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
                const active = item.href ? pathname === item.href : false;
                return (
                  <Link key={i} href={item.href || '#'}
                    onClick={() => setSearch('')}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                    }`}>
                    <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{item.title}</span>
                    {item.parent && <span className="text-xs text-slate-500 mr-auto">{item.parent}</span>}
                  </Link>
                );
              })}
            </div>
          ) : (
            /* Normal menu */
            <div className="space-y-0.5">
              {menuItems.map((item, i) => <SidebarItem key={i} item={item} />)}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/50">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
              <span className="text-xs text-slate-400">متصل</span>
            </div>
            <span className="text-xs text-slate-600">v1.0.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
