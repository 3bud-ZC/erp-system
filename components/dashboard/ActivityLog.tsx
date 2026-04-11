'use client';

import { 
  FileText, 
  UserPlus, 
  Package, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Factory
} from 'lucide-react';

interface Activity {
  id: string;
  type: 'sale' | 'purchase' | 'product' | 'customer' | 'supplier' | 'production' | 'expense';
  title: string;
  description: string;
  amount?: number;
  date: string;
  status?: 'completed' | 'pending' | 'cancelled';
}

interface ActivityLogProps {
  activities: Activity[];
}

const activityIcons = {
  sale: { icon: FileText, color: 'bg-green-100 text-green-600', arrow: ArrowUpRight },
  purchase: { icon: FileText, color: 'bg-blue-100 text-blue-600', arrow: ArrowDownRight },
  product: { icon: Package, color: 'bg-purple-100 text-purple-600', arrow: null },
  customer: { icon: UserPlus, color: 'bg-orange-100 text-orange-600', arrow: null },
  supplier: { icon: UserPlus, color: 'bg-cyan-100 text-cyan-600', arrow: null },
  production: { icon: Factory, color: 'bg-indigo-100 text-indigo-600', arrow: null },
  expense: { icon: DollarSign, color: 'bg-red-100 text-red-600', arrow: ArrowDownRight },
};

const statusColors = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels = {
  completed: 'مكتمل',
  pending: 'معلق',
  cancelled: 'ملغي',
};

export default function ActivityLog({ activities }: ActivityLogProps) {
  if (activities.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
        <p className="text-gray-500 text-sm">لا توجد نشاطات حديثة</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
      {activities.map((activity) => {
        const config = activityIcons[activity.type];
        const Icon = config.icon;
        const Arrow = config.arrow;

        return (
          <div
            key={activity.id}
            className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
          >
            <div className={`w-10 h-10 ${config.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900 text-sm truncate">{activity.title}</h4>
                {activity.status && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[activity.status]}`}>
                    {statusLabels[activity.status]}
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-xs mt-0.5">{activity.description}</p>
            </div>

            <div className="text-left flex-shrink-0">
              {activity.amount !== undefined && (
                <div className={`flex items-center gap-1 text-sm font-semibold ${
                  activity.type === 'sale' ? 'text-green-600' : 
                  activity.type === 'expense' || activity.type === 'purchase' ? 'text-red-600' : 
                  'text-gray-700'
                }`}>
                  {Arrow && <Arrow className="w-4 h-4" />}
                  <span>
                    {new Intl.NumberFormat('ar-EG', {
                      style: 'currency',
                      currency: 'EGP',
                      minimumFractionDigits: 0,
                    }).format(activity.amount)}
                  </span>
                </div>
              )}
              <p className="text-gray-400 text-xs mt-0.5">{activity.date}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
