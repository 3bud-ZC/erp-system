'use client';

import { AlertTriangle, TrendingDown, Clock, Package } from 'lucide-react';

interface Alert {
  id: string;
  type: 'stock' | 'payment' | 'expiry' | 'order';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  date: string;
}

interface AlertsSectionProps {
  alerts: Alert[];
}

const alertIcons = {
  stock: Package,
  payment: Clock,
  expiry: AlertTriangle,
  order: TrendingDown,
};

const alertColors = {
  high: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    text: 'text-red-800',
  },
  medium: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: 'text-orange-500',
    text: 'text-orange-800',
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    text: 'text-blue-800',
  },
};

export default function AlertsSection({ alerts }: AlertsSectionProps) {
  // Defensive check for undefined alerts
  const safeAlerts = alerts || [];
  
  if (safeAlerts.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-600 font-medium">لا توجد تنبيهات</p>
        <p className="text-gray-400 text-sm">النظام يعمل بشكل طبيعي</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
      {safeAlerts.map((alert) => {
        const Icon = alertIcons[alert.type];
        const colors = alertColors[alert.severity];

        return (
          <div
            key={alert.id}
            className={`${colors.bg} ${colors.border} border rounded-lg p-3 flex items-start gap-3`}
          >
            <div className={`${colors.icon} mt-0.5 flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-sm ${colors.text}`}>{alert.title}</h4>
              <p className="text-gray-600 text-xs mt-0.5">{alert.description}</p>
              <p className="text-gray-400 text-xs mt-1">{alert.date}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
