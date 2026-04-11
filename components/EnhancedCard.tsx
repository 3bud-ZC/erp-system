import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EnhancedCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'red' | 'purple' | 'orange' | 'yellow';
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
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

export default function EnhancedCard({ 
  title, 
  value, 
  icon, 
  color, 
  trend,
  className = '' 
}: EnhancedCardProps) {
  const colorClass = colorClasses[color];

  return (
    <div className={`group relative overflow-hidden rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-3 border border-white/20 ${className}`}>
      {/* Gradient Background Effect */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClass.bg} opacity-10 group-hover:opacity-20 transition-all duration-500`} />
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
      </div>
      
      {/* Card Content */}
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 relative z-10">
          <div className="flex-1">
            <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">{title}</span>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1 truncate">{value}</p>
          </div>
          
          {/* Icon */}
          <div className={`p-4 rounded-2xl bg-gradient-to-br ${colorClass.bg} shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 animate-float`}>
            <div className="text-white">
              {icon}
            </div>
          </div>
        </div>

        {/* Trend */}
        {trend && (
          <div className="flex items-center gap-3 relative z-10">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${colorClass.light} ${colorClass.border} border animate-pulse shadow-lg`}>
              <span className={`text-sm font-bold ${colorClass.text}`}>
                {trend.isPositive ? '+' : ''}{trend.value}
              </span>
              <svg 
                className={`w-4 h-4 ${colorClass.text} ${trend.isPositive ? 'animate-bounce' : 'animate-bounce rotate-180'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <span className="text-xs text-gray-500/80 font-medium">مقارنة بالشهر الماضي</span>
          </div>
        )}

        {/* Decorative Elements */}
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br opacity-20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500 animate-float" />
        <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br opacity-15 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 animate-pulse-slow" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br opacity-10 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
      </div>

      {/* Hover Effect Border */}
      <div className={`absolute inset-0 rounded-3xl border-2 border-transparent group-hover:border-white/30 transition-all duration-500 pointer-events-none`} />
      {/* Glow Effect */}
      <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none shadow-glow-${color}`} />
    </div>
  );
}
