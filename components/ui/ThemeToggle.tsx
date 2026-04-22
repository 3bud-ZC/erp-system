'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers/AppProviders';

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`inline-flex items-center gap-2 ${compact ? 'w-9 h-9 justify-center' : 'px-3 py-2'} rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 transition-colors`}
    >
      <span className="relative w-4 h-4">
        <Sun size={16} className={`absolute inset-0 transition-all duration-300 ${isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} />
        <Moon size={16} className={`absolute inset-0 transition-all duration-300 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
      </span>
      {!compact && <span className="text-sm font-medium">{isDark ? 'فاتح' : 'داكن'}</span>}
    </button>
  );
}
