'use client';

import React from 'react';
import { WorkflowState, WorkflowTransitionEvent } from '@/lib/erp-frontend-core/types';
import { getStatusConfig } from '@/lib/erp-frontend-core/workflow-utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface WorkflowTimelineProps {
  workflow: WorkflowState;
}

export function WorkflowTimeline({ workflow }: WorkflowTimelineProps) {
  const history = workflow?.history || [];

  if (history.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4 text-center">
        لا يوجد تاريخ للحالة
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">تاريخ سير العمل</h4>
      <div className="relative">
        <div className="absolute right-3 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        {history.map((event, index) => {
          const fromConfig = getStatusConfig(event.from);
          const toConfig = getStatusConfig(event.to);
          
          return (
            <div key={index} className="relative flex gap-4 pr-8 pb-4">
              <div className={`absolute right-0 w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${toConfig.bgColor}`}>
                <div className={`w-2 h-2 rounded-full ${toConfig.color.replace('text-', 'bg-')}`} />
              </div>
              
              <div className="flex-1 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${fromConfig.color}`}>
                      {fromConfig.labelAr}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className={`text-sm font-medium ${toConfig.color}`}>
                      {toConfig.labelAr}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(event.timestamp), 'PPp', { locale: ar })}
                  </span>
                </div>
                
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                  <span>بواسطة:</span>
                  <span className="font-medium">{event.userName}</span>
                </div>
                
                {event.notes && (
                  <p className="mt-2 text-sm text-gray-500 bg-white p-2 rounded">
                    {event.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
