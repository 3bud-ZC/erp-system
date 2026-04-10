import React from 'react';

interface EnhancedFormProps {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  className?: string;
  title?: string;
  description?: string;
}

export default function EnhancedForm({ 
  children, 
  onSubmit, 
  className = '', 
  title,
  description 
}: EnhancedFormProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden ${className}`}>
      {(title || description) && (
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          {title && <h3 className="text-lg font-bold text-gray-900">{title}</h3>}
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
      )}
      <form onSubmit={onSubmit} className="p-6 space-y-6">
        {children}
      </form>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}

export function FormField({ label, error, required, description, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
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
