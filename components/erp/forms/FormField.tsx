'use client';

import React, { useState, useEffect } from 'react';
import { fetchEntityList } from '@/lib/erp-frontend-core/engine-integration';
import { Search, X, Plus, Minus } from 'lucide-react';

interface FormFieldProps {
  config: {
    name: string;
    label: string;
    labelAr: string;
    type: string;
    required?: boolean;
    options?: { value: string; label: string; labelAr: string }[];
    entityType?: string;
    validation?: any;
    defaultValue?: any;
  };
  value: any;
  onChange: (value: any) => void;
  error?: string;
  readonly?: boolean;
  mode?: 'create' | 'edit' | 'view';
}

export function FormField({ config, value, onChange, error, readonly, mode }: FormFieldProps) {
  const [autocompleteOptions, setAutocompleteOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  useEffect(() => {
    if (config.type === 'autocomplete' && config.entityType) {
      loadAutocompleteOptions();
    }
  }, [config.type, config.entityType]);

  async function loadAutocompleteOptions() {
    if (!config.entityType) return;
    setLoading(true);
    try {
      const result = await fetchEntityList(config.entityType);
      setAutocompleteOptions(result.data);
    } catch (error) {
      console.error('Failed to load autocomplete options:', error);
    } finally {
      setLoading(false);
    }
  }

  const inputClasses = `
    w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
    ${error ? 'border-red-300' : 'border-gray-300'}
    ${readonly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    transition-colors
  `;

  const labelClasses = "block text-sm font-medium text-gray-700 mb-1";
  const errorClasses = "mt-1 text-sm text-red-600";

  const renderLabel = () => (
    <label className={labelClasses}>
      {config.labelAr}
      {config.required && <span className="text-red-500 mr-1">*</span>}
    </label>
  );

  switch (config.type) {
    case 'text':
      return (
        <div>
          {renderLabel()}
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readonly}
            className={inputClasses}
            placeholder={`أدخل ${config.labelAr}`}
          />
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );

    case 'number':
      return (
        <div>
          {renderLabel()}
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            disabled={readonly}
            className={inputClasses}
            min={config.validation?.min}
            max={config.validation?.max}
            placeholder={`أدخل ${config.labelAr}`}
          />
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );

    case 'money':
      return (
        <div>
          {renderLabel()}
          <div className="relative">
            <input
              type="number"
              value={value || ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
              disabled={readonly}
              className={`${inputClasses} pl-16`}
              placeholder="0.00"
              step="0.01"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">SAR</span>
          </div>
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );

    case 'select':
      return (
        <div>
          {renderLabel()}
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readonly}
            className={inputClasses}
          >
            <option value="">اختر {config.labelAr}</option>
            {config.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.labelAr}
              </option>
            ))}
          </select>
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );

    case 'date':
      return (
        <div>
          {renderLabel()}
          <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
            disabled={readonly}
            className={inputClasses}
          />
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );

    case 'textarea':
      return (
        <div>
          {renderLabel()}
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readonly}
            className={`${inputClasses} min-h-[100px] resize-y`}
            rows={4}
            placeholder={`أدخل ${config.labelAr}`}
          />
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={readonly}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label className="text-sm font-medium text-gray-700">{config.labelAr}</label>
          {config.required && <span className="text-red-500">*</span>}
        </div>
      );

    case 'autocomplete':
      const selectedOption = autocompleteOptions.find((opt) => opt.id === value);
      
      return (
        <div className="relative">
          {renderLabel()}
          <div className="relative">
            <input
              type="text"
              value={selectedOption?.nameAr || selectedOption?.name || ''}
              onFocus={() => setShowAutocomplete(true)}
              onChange={() => {}}
              disabled={readonly}
              className={`${inputClasses} pr-10`}
              placeholder={`ابحث عن ${config.labelAr}`}
              readOnly
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          
          {showAutocomplete && !readonly && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
              {loading ? (
                <div className="p-3 text-center text-gray-500">جاري التحميل...</div>
              ) : autocompleteOptions.length === 0 ? (
                <div className="p-3 text-center text-gray-500">لا توجد نتائج</div>
              ) : (
                autocompleteOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id);
                      setShowAutocomplete(false);
                    }}
                    className="w-full px-4 py-2 text-right hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium">{option.nameAr || option.name}</div>
                    {option.code && <div className="text-sm text-gray-500">{option.code}</div>}
                  </button>
                ))
              )}
            </div>
          )}
          
          {value && !readonly && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );

    case 'items':
      const items = value || [];
      
      return (
        <div className="col-span-full">
          {renderLabel()}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right text-sm font-medium">المنتج</th>
                  <th className="px-4 py-2 text-right text-sm font-medium">الكمية</th>
                  <th className="px-4 py-2 text-right text-sm font-medium">السعر</th>
                  <th className="px-4 py-2 text-right text-sm font-medium">الإجمالي</th>
                  {!readonly && <th className="px-4 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, index: number) => (
                  <tr key={index} className="border-t border-gray-200">
                    <td className="px-4 py-2">{item.productName}</td>
                    <td className="px-4 py-2">{item.quantity}</td>
                    <td className="px-4 py-2">{item.unitPrice?.toFixed(2)}</td>
                    <td className="px-4 py-2 font-medium">{item.total?.toFixed(2)}</td>
                    {!readonly && (
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = items.filter((_: any, i: number) => i !== index);
                            onChange(newItems);
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {!readonly && (
              <button
                type="button"
                onClick={() => {
                  // Open item selector modal
                  console.log('Add item');
                }}
                className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4 inline-block ml-1" />
                إضافة صنف
              </button>
            )}
          </div>
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );

    default:
      return (
        <div>
          {renderLabel()}
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readonly}
            className={inputClasses}
          />
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );
  }
}
