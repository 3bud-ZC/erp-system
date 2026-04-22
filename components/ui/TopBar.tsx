'use client';

import ThemeToggle from './ThemeToggle';
import TenantBadge from './TenantBadge';
import { Search } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-6 lg:px-8 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-100 dark:border-gray-800 transition-colors">
      <TenantBadge />
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
        >
          <Search size={14} />
          <span>بحث سريع...</span>
          <kbd className="font-mono text-[10px] px-1 py-0.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">Ctrl K</kbd>
        </button>
        <ThemeToggle compact />
      </div>
    </header>
  );
}
