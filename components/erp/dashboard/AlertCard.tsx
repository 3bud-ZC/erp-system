'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, AlertCircle, Info, CheckCircle, ArrowLeft } from 'lucide-react';
import { ERPAlert } from '@/lib/erp-frontend-core/types';
import Link from 'next/link';

interface AlertCardProps {
  alerts: ERPAlert[];
  loading?: boolean;
}

const alertIcons = {
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
  success: CheckCircle,
};

const alertColors = {
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  error: 'text-red-600 bg-red-50 border-red-200',
  info: 'text-blue-600 bg-blue-50 border-blue-200',
  success: 'text-green-600 bg-green-50 border-green-200',
};

export function AlertCard({ alerts, loading = false }: AlertCardProps) {
  const unreadAlerts = alerts.filter(a => !a.isRead);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">التنبيهات</CardTitle>
          {unreadAlerts.length > 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              {unreadAlerts.length} جديد
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p>لا توجد تنبيهات</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {alerts.map((alert) => {
              const Icon = alertIcons[alert.type];
              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${alertColors[alert.type]} ${
                    !alert.isRead ? 'border-l-4' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{alert.title}</p>
                      <p className="text-sm opacity-90 mt-1">{alert.message}</p>
                      
                      {alert.entityId && (
                        <Link
                          href={`/erp/${alert.module}/${alert.entityId}`}
                          className="inline-flex items-center gap-1 text-sm mt-2 hover:underline"
                        >
                          عرض التفاصيل
                          <ArrowLeft className="w-4 h-4" />
                        </Link>
                      )}
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
