'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, LayoutDashboard, ShoppingCart, Package, Truck, Calculator, Factory,
  LineChart, Settings, Users, FileText, LogOut,
} from 'lucide-react';

interface Cmd { id: string; label: string; hint?: string; icon: React.ReactNode; action: () => void; keywords?: string }

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (href: string) => () => { setOpen(false); router.push(href); };

  const commands = useMemo<Cmd[]>(() => [
    { id: 'dash', label: 'لوحة التحكم', hint: '/dashboard', icon: <LayoutDashboard size={16} />, action: go('/dashboard'), keywords: 'dashboard home' },
    { id: 'analytics', label: 'النظرة المالية', hint: '/analytics', icon: <LineChart size={16} />, action: go('/analytics'), keywords: 'financial overview' },
    { id: 'sales', label: 'تحليلات المبيعات', hint: '/analytics/sales', icon: <ShoppingCart size={16} />, action: go('/analytics/sales'), keywords: 'sales revenue' },
    { id: 'purchase', label: 'تحليلات المشتريات', hint: '/analytics/purchase', icon: <Truck size={16} />, action: go('/analytics/purchase'), keywords: 'purchase' },
    { id: 'inventory', label: 'تحليلات المخزون', hint: '/analytics/inventory', icon: <Package size={16} />, action: go('/analytics/inventory'), keywords: 'inventory stock' },
    { id: 'accounting', label: 'المحاسبة', hint: '/analytics/accounting', icon: <Calculator size={16} />, action: go('/analytics/accounting'), keywords: 'accounting' },
    { id: 'production', label: 'الإنتاج', hint: '/analytics/production', icon: <Factory size={16} />, action: go('/analytics/production'), keywords: 'production manufacturing' },
    { id: 'logs', label: 'سجل الأنشطة', hint: '/dashboard/activity', icon: <FileText size={16} />, action: go('/dashboard/activity'), keywords: 'activity logs audit' },
    { id: 'users', label: 'المستخدمون', hint: '/dashboard/users', icon: <Users size={16} />, action: go('/dashboard/users'), keywords: 'users team' },
    { id: 'settings', label: 'الإعدادات', hint: '/onboarding', icon: <Settings size={16} />, action: go('/onboarding'), keywords: 'settings onboarding' },
    { id: 'logout', label: 'تسجيل الخروج', icon: <LogOut size={16} />, action: async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); window.location.href = '/login'; }, keywords: 'logout signout' },
  ], [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c => (c.label + ' ' + (c.hint || '') + ' ' + (c.keywords || '')).toLowerCase().includes(q));
  }, [commands, query]);

  // Global keyboard listeners
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onCustom as any);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', onCustom as any);
    };
  }, []);

  useEffect(() => { if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);
  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  const run = (cmd?: Cmd) => { if (cmd) cmd.action(); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 animate-[fadeIn_150ms_ease-out]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div
        className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-[slideDown_200ms_cubic-bezier(0.16,1,0.3,1)]"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); run(filtered[active]); }
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <Search size={18} className="text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="اكتب للبحث أو الانتقال..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono border border-gray-200 dark:border-gray-700 rounded text-gray-500">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-gray-400">لا توجد نتائج</li>
          )}
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => run(cmd)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${i === active ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <span className={i === active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}>{cmd.icon}</span>
                <span className="flex-1 text-right font-medium">{cmd.label}</span>
                {cmd.hint && <span className="text-[11px] text-gray-400 font-mono">{cmd.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
          <span>تنقل: ↑↓ • تنفيذ: ↵</span>
          <span><kbd className="px-1 py-0.5 font-mono border border-gray-200 dark:border-gray-700 rounded">Ctrl</kbd> + <kbd className="px-1 py-0.5 font-mono border border-gray-200 dark:border-gray-700 rounded">K</kbd></span>
        </div>
      </div>
    </div>
  );
}
