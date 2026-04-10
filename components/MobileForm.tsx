import React from 'react';

interface MobileFormProps {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  className?: string;
  title?: string;
  description?: string;
}

export default function MobileForm({ 
  children, 
  onSubmit, 
  className = '', 
  title,
  description 
}: MobileFormProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${className}`}>
      {(title || description) && (
        <div className="p-4 border-b border-gray-100">
          {title && <h3 className="text-lg font-bold text-gray-900">{title}</h3>}
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
      )}
      <form onSubmit={onSubmit} className="p-4 space-y-4">
        {children}
      </form>
    </div>
  );
}

interface MobileFormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}

export function MobileFormField({ label, error, required, description, children }: MobileFormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </label>
      {children}
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <span className="w-1 h-1 bg-red-600 rounded-full" />
          {error}
        </p>
      )}
    </div>
  );
}
