import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MobileCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'red' | 'purple' | 'orange' | 'yellow';
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
  compact?: boolean;
}

const colorClasses = {
  green: {
    bg: 'from-green-500 to-emerald-600',
    light: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
  },
  blue: {
    bg: 'from-blue-500 to-indigo-600',
    light: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  red: {
    bg: 'from-red-500 to-rose-600',
    light: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  purple: {
    bg: 'from-purple-500 to-violet-600',
    light: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
  },
  orange: {
    bg: 'from-orange-500 to-amber-600',
    light: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
  },
  yellow: {
    bg: 'from-yellow-500 to-amber-600',
    light: 'bg-yellow-50',
    text: 'text-yellow-600',
    border: 'border-yellow-200',
  },
};

export default function MobileCard({ 
  title, 
  value, 
  icon, 
  color, 
  trend,
  className = '',
  compact = false
}: MobileCardProps) {
  const colorClass = colorClasses[color];

  if (compact) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-600">{title}</p>
            <p className="text-lg font-bold text-gray-900">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${colorClass.light}`}>
            <div className={colorClass.text}>
              {icon}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 ${className}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
          </div>
          
          {/* Icon */}
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClass.bg} shadow-md group-hover:scale-105 transition-transform duration-300`}>
            <div className="text-white">
              {icon}
            </div>
          </div>
        </div>

        {/* Trend */}
        {trend && (
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${colorClass.light} ${colorClass.border} border`}>
              <span className={`text-xs font-semibold ${colorClass.text}`}>
                {trend.isPositive ? '+' : ''}{trend.value}
              </span>
              <svg 
                className={`w-3 h-3 ${colorClass.text} ${trend.isPositive ? '' : 'rotate-180'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <span className="text-xs text-gray-500">vs last month</span>
          </div>
        )}
      </div>
    </div>
  );
}
