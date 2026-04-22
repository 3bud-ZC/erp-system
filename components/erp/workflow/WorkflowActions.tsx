'use client';

import React, { useState } from 'react';
import { WorkflowState, WorkflowStatus } from '@/lib/erp-frontend-core/types';
import {
  getStatusConfig,
  getWorkflowForEntityType,
  getAvailableActions,
  WORKFLOW_ACTIONS,
  isActionAllowed,
} from '@/lib/erp-frontend-core/workflow-utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface WorkflowActionsProps {
  entityType: string;
  entityId: string;
  workflow: WorkflowState;
  onAction: (action: string, notes?: string) => Promise<void>;
  disabled?: boolean;
}

export function WorkflowActions({
  entityType,
  entityId,
  workflow,
  onAction,
  disabled = false,
}: WorkflowActionsProps) {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const workflowDef = getWorkflowForEntityType(entityType);
  const availableActions = getAvailableActions(workflow.currentStatus, workflowDef);

  const handleAction = async () => {
    if (!confirmAction) return;
    
    setLoading(true);
    try {
      await onAction(confirmAction, notes);
      setConfirmAction(null);
      setNotes('');
    } finally {
      setLoading(false);
    }
  };

  const currentStatusConfig = getStatusConfig(workflow.currentStatus);

  if (availableActions.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        لا توجد إجراءات متاحة للحالة الحالية
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-500">الحالة الحالية:</span>
          <span className={`mr-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium ${currentStatusConfig.bgColor} ${currentStatusConfig.color}`}>
            {currentStatusConfig.labelAr}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {availableActions.map((actionKey) => {
          const action = WORKFLOW_ACTIONS[actionKey];
          if (!action) return null;

          return (
            <Button
              key={actionKey}
              variant={action.variant === 'danger' ? 'destructive' : action.variant === 'success' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (action.requiresConfirmation) {
                  setConfirmAction(actionKey);
                } else {
                  onAction(actionKey);
                }
              }}
              disabled={disabled || loading}
            >
              {action.labelAr}
            </Button>
          );
        })}
      </div>

      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الإجراء</DialogTitle>
            <DialogDescription>
              {confirmAction && WORKFLOW_ACTIONS[confirmAction]?.confirmationMessageAr}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Textarea
              placeholder="ملاحظات (اختياري)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={loading}>
              إلغاء
            </Button>
            <Button 
              onClick={handleAction} 
              disabled={loading}
              variant={confirmAction && WORKFLOW_ACTIONS[confirmAction]?.variant === 'danger' ? 'destructive' : 'default'}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
