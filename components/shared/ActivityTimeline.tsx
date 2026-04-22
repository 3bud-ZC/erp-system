'use client';

import { useEffect, useState } from 'react';
import { Clock, FileText, Package, DollarSign, User } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface ActivityEvent {
  id: string;
  type: 'invoice' | 'payment' | 'stock' | 'customer' | 'other';
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
}

interface ActivityTimelineProps {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

export function ActivityTimeline({ entityType, entityId, limit = 10 }: ActivityTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivities() {
      try {
        // In production, call the audit API
        // const response = await auditApi.getEntityHistory(entityType, entityId);
        
        // Mock data for now
        const mockEvents: ActivityEvent[] = [
          {
            id: '1',
            type: 'invoice',
            title: 'Invoice Created',
            description: 'Invoice #INV-001 created for Customer ABC',
            timestamp: new Date(Date.now() - 3600000),
            userId: 'user-1',
            userName: 'John Doe',
          },
          {
            id: '2',
            type: 'stock',
            title: 'Stock Adjusted',
            description: 'Product ABC stock increased by 50 units',
            timestamp: new Date(Date.now() - 7200000),
            userId: 'user-1',
            userName: 'John Doe',
          },
          {
            id: '3',
            type: 'payment',
            title: 'Payment Received',
            description: 'Payment of $2,500 received from Customer ABC',
            timestamp: new Date(Date.now() - 86400000),
            userId: 'user-2',
            userName: 'Jane Smith',
          },
        ];

        setEvents(mockEvents.slice(0, limit));
      } catch (error) {
        console.error('Failed to load activities:', error);
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, [entityType, entityId, limit]);

  const getIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'invoice':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'payment':
        return <DollarSign className="w-5 h-5 text-green-600" />;
      case 'stock':
        return <Package className="w-5 h-5 text-purple-600" />;
      case 'customer':
        return <User className="w-5 h-5 text-indigo-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getIconBg = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'invoice':
        return 'bg-blue-100';
      case 'payment':
        return 'bg-green-100';
      case 'stock':
        return 'bg-purple-100';
      case 'customer':
        return 'bg-indigo-100';
      default:
        return 'bg-slate-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-slate-600">Loading activities...</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getIconBg(event.type)}`}>
              {getIcon(event.type)}
            </div>
            {index < events.length - 1 && (
              <div className="w-0.5 h-full bg-slate-200 mt-2" />
            )}
          </div>
          <div className="flex-1 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {event.title}
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  {event.description}
                </p>
                {event.userName && (
                  <p className="text-xs text-slate-500 mt-1">
                    by {event.userName}
                  </p>
                )}
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap ml-4">
                {formatDateTime(event.timestamp)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
