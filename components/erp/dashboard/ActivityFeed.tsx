'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityEvent } from '@/lib/erp-frontend-core/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  FileText,
  CheckCircle,
  DollarSign,
  Package,
  User,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface ActivityFeedProps {
  activities: ActivityEvent[];
  loading?: boolean;
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATE: FileText,
  UPDATE: CheckCircle,
  DELETE: Clock,
  POST: DollarSign,
  APPROVE: CheckCircle,
  PAY: DollarSign,
  SHIP: Package,
  RECEIVE: Package,
  LOGIN: User,
  LOGOUT: User,
};

const activityColors: Record<string, string> = {
  CREATE: 'bg-blue-100 text-blue-600',
  UPDATE: 'bg-amber-100 text-amber-600',
  DELETE: 'bg-red-100 text-red-600',
  POST: 'bg-green-100 text-green-600',
  APPROVE: 'bg-green-100 text-green-600',
  PAY: 'bg-green-100 text-green-600',
  SHIP: 'bg-blue-100 text-blue-600',
  RECEIVE: 'bg-blue-100 text-blue-600',
  LOGIN: 'bg-gray-100 text-gray-600',
  LOGOUT: 'bg-gray-100 text-gray-600',
};

export function ActivityFeed({ activities, loading = false }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">آخر النشاطات</CardTitle>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-10 h-10 bg-gray-200 animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-gray-200 animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>لا توجد نشاطات</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.type] || FileText;
              const colorClass = activityColors[activity.type] || activityColors.CREATE;
              
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{activity.userName}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(activity.timestamp), 'PPp', { locale: ar })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
