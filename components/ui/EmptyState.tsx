import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface Props { title: string; description?: string; icon?: ReactNode; action?: ReactNode }

export default function EmptyState({ title, description, icon, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
        {icon || <Inbox size={22} />}
      </div>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</p>
      {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
