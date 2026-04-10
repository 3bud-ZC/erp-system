import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'py-2 px-3 text-sm',
  md: 'py-2.5 px-4 text-sm',
  lg: 'py-3 px-5 text-base',
};

export default function SearchInput({
  value,
  onChange,
  placeholder = 'بحث...',
  onClear,
  className = '',
  size = 'md',
}: SearchInputProps) {
  return (
    <div className={`relative group ${className}`}>
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus:text-blue-500 transition-colors" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`
          w-full pr-10 pl-4
          bg-gray-50/50 border border-gray-200 rounded-xl
          focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
          transition-all duration-200 group-hover:bg-white
          ${sizeClasses[size]}
        `}
      />
      {value && onClear && (
        <button
          onClick={onClear}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
