import React from 'react';
import { LucideIcon } from 'lucide-react';

interface QuickStatsProps {
  items: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
    color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
    change?: string;
    isPositive?: boolean;
  }>;
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-green-50 text-green-600 border-green-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
};

export default function QuickStats({ items }: QuickStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${colorClasses[item.color].split(' ')[0]}`}>
              <item.icon className="w-4 h-4" />
            </div>
            {item.change && (
              <div className={`text-xs font-medium ${
                item.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {item.isPositive ? '+' : ''}{item.change}
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900">{item.value}</div>
          <div className="text-sm text-gray-600 mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
