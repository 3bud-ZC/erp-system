'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WorkflowStatusBadge } from '@/components/erp/workflow/WorkflowStatusBadge';
import { WorkflowActions } from '@/components/erp/workflow/WorkflowActions';
import { WorkflowTimeline } from '@/components/erp/workflow/WorkflowTimeline';
import { createTransaction, updateWorkflowState, fetchBusinessState } from '@/lib/erp-frontend-core/engine-integration';
import { ERPTransactionType, WorkflowStatus } from '@/lib/erp-frontend-core/types';
import { FormField } from './FormField';
import { Loader2, Save, X, Send, CheckCircle } from 'lucide-react';

export interface FieldConfig {
  name: string;
  label: string;
  labelAr: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox' | 'autocomplete' | 'items' | 'money';
  required?: boolean;
  options?: { value: string; label: string; labelAr: string }[];
  entityType?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    message?: string;
  };
  section?: string;
  readonly?: boolean;
  hidden?: boolean;
  defaultValue?: any;
}

export interface EntityFormProps {
  entityType: string;
  entityId?: string;
  transactionType: ERPTransactionType;
  fields: FieldConfig[];
  sections?: { key: string; title: string; titleAr: string; fields: string[] }[];
  mode: 'create' | 'edit' | 'view';
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
  initialData?: any;
  workflowEnabled?: boolean;
}

export function EntityForm({
  entityType,
  entityId,
  transactionType,
  fields,
  sections,
  mode,
  onSuccess,
  onCancel,
  initialData,
  workflowEnabled = true,
}: EntityFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<any>(initialData || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entity, setEntity] = useState<any>(initialData);

  useEffect(() => {
    if (entityId && mode !== 'create') {
      loadEntity();
    }
  }, [entityId]);

  async function loadEntity() {
    setLoading(true);
    try {
      const data = await fetchBusinessState(entityType, entityId!);
      setEntity(data);
      setFormData(data);
    } catch (error) {
      console.error('Failed to load entity:', error);
    } finally {
      setLoading(false);
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.labelAr} مطلوب`;
      }

      if (field.validation && formData[field.name]) {
        const value = formData[field.name];
        
        if (field.validation.min !== undefined && Number(value) < field.validation.min) {
          newErrors[field.name] = field.validation.message || `الحد الأدنى ${field.validation.min}`;
        }
        
        if (field.validation.max !== undefined && Number(value) > field.validation.max) {
          newErrors[field.name] = field.validation.message || `الحد الأقصى ${field.validation.max}`;
        }
        
        if (field.validation.pattern && !field.validation.pattern.test(value)) {
          newErrors[field.name] = field.validation.message || 'قيمة غير صالحة';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (submitAction: 'save' | 'submit' = 'save') => {
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        id: entityId,
        submitAction,
      };

      const result = await createTransaction({
        type: transactionType,
        payload,
      });

      if (result.success) {
        onSuccess?.(result.data);
        if (mode === 'create') {
          router.push(`/erp/${entityType.replace('_', '/')}/${result.data.id}`);
        }
      } else {
        setErrors({ submit: result.error || 'فشل الحفظ' });
      }
    } catch (error: any) {
      setErrors({ submit: error.message || 'حدث خطأ غير متوقع' });
    } finally {
      setSaving(false);
    }
  };

  const handleWorkflowAction = async (action: string, notes?: string) => {
    if (!entityId) return;

    const statusMap: Record<string, WorkflowStatus> = {
      approve: 'confirmed',
      confirm: 'confirmed',
      post: 'posted',
      cancel: 'cancelled',
      void: 'void',
      ship: 'shipped',
      deliver: 'delivered',
      receive: 'received',
      complete: 'completed',
    };

    const targetStatus = statusMap[action];
    if (!targetStatus) {
      console.warn('Unknown workflow action:', action);
      return;
    }

    const result = await updateWorkflowState({
      entityType,
      entityId,
      targetStatus,
      notes,
    });

    if (result.success) {
      loadEntity();
    }
  };

  const updateField = (name: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const renderField = (field: FieldConfig) => {
    if (field.hidden) return null;

    return (
      <FormField
        key={field.name}
        config={field}
        value={formData[field.name]}
        onChange={(value) => updateField(field.name, value)}
        error={errors[field.name]}
        readonly={mode === 'view' || field.readonly}
        mode={mode}
      />
    );
  };

  const renderSection = (section: { key: string; title: string; titleAr: string; fields: string[] }) => {
    const sectionFields = fields.filter((f) => section.fields.includes(f.name));
    
    return (
      <div key={section.key} className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{section.titleAr}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectionFields.map(renderField)}
        </div>
      </div>
    );
  };

  const renderUnsectionedFields = () => {
    const sectionedFieldNames = sections?.flatMap((s) => s.fields) || [];
    const unsectionedFields = fields.filter((f) => !sectionedFieldNames.includes(f.name));
    
    if (unsectionedFields.length === 0) return null;

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unsectionedFields.map(renderField)}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isDraft = entity?.workflow?.currentStatus === 'draft';
  const canEdit = mode === 'create' || (mode === 'edit' && isDraft);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'create' ? 'إنشاء جديد' : mode === 'edit' ? 'تعديل' : 'عرض'}
            </h1>
            {entity?.id && (
              <p className="text-gray-500 mt-1">رقم: {entity.id}</p>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {entity?.workflow && (
              <WorkflowStatusBadge
                status={entity.workflow.currentStatus}
                showLabel
                size="lg"
                language="ar"
              />
            )}
          </div>
        </div>

        {/* Workflow Actions */}
        {workflowEnabled && entity?.workflow && mode !== 'create' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <WorkflowActions
              entityType={entityType}
              entityId={entityId!}
              workflow={entity.workflow}
              onAction={handleWorkflowAction}
              disabled={saving}
            />
          </div>
        )}
      </div>

      {/* Form Sections */}
      <div className="space-y-6">
        {sections?.map(renderSection)}
        {renderUnsectionedFields()}
      </div>

      {/* Error Display */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {errors.submit}
        </div>
      )}

      {/* Action Buttons */}
      {mode !== 'view' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel || (() => router.back())}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              إلغاء
            </button>

            {mode === 'create' && (
              <button
                type="button"
                onClick={() => handleSubmit('save')}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                حفظ كمسودة
              </button>
            )}

            <button
              type="submit"
              onClick={() => handleSubmit('submit')}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'create' ? (
                <>
                  <Send className="w-4 h-4" />
                  إنشاء
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  حفظ التغييرات
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Workflow Timeline */}
      {workflowEnabled && entity?.workflow?.history?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <WorkflowTimeline workflow={entity.workflow} />
        </div>
      )}
    </div>
  );
}
