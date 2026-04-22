'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, FileText, ShoppingCart, Package, Clock } from 'lucide-react';

interface WorkflowStatusItem {
  label: string;
  count: number;
  route: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const workflowItems: WorkflowStatusItem[] = [
  {
    label: 'أوامر بيع معلقة',
    count: 12,
    route: '/erp/sales/orders?status=pending',
    color: 'bg-amber-100 text-amber-700',
    icon: FileText,
  },
  {
    label: 'فواتير بيع غير مدفوعة',
    count: 8,
    route: '/erp/sales/invoices?status=unpaid',
    color: 'bg-red-100 text-red-700',
    icon: ShoppingCart,
  },
  {
    label: 'أوامر شراء قيد التنفيذ',
    count: 5,
    route: '/erp/purchases/orders?status=in_progress',
    color: 'bg-blue-100 text-blue-700',
    icon: Package,
  },
  {
    label: 'فواتير شراء مستحقة',
    count: 3,
    route: '/erp/purchases/invoices?status=overdue',
    color: 'bg-orange-100 text-orange-700',
    icon: Clock,
  },
];

interface WorkflowStatusOverviewProps {
  loading?: boolean;
}

export function WorkflowStatusOverview({ loading = false }: WorkflowStatusOverviewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">حالة سير العمل</CardTitle>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {workflowItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.route}
                  href={item.route}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">
                        {item.count} عنصر
                      </p>
                    </div>
                  </div>
                  
                  <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
