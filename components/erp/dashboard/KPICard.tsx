'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface KPICardProps {
  title: string;
  titleAr: string;
  value: number;
  format: 'currency' | 'number' | 'percentage';
  trend?: 'up' | 'down' | 'neutral';
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  loading?: boolean;
}

export function KPICard({
  title,
  titleAr,
  value,
  format,
  trend = 'neutral',
  change = 0,
  icon: Icon,
  color,
  loading = false,
}: KPICardProps) {
  const formatValue = () => {
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
      default:
        return formatNumber(value);
    }
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">{titleAr}</p>
            {loading ? (
              <div className="h-8 w-32 bg-gray-200 animate-pulse rounded" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">{formatValue()}</p>
            )}
            
            {!loading && change !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
                <TrendIcon className="w-4 h-4" />
                <span>{Math.abs(change).toFixed(1)}%</span>
                <span className="text-gray-500">مقارنة بالفترة السابقة</span>
              </div>
            )}
          </div>
          
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
