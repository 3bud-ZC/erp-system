import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 rounded-2xl p-6 flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-3">
        <AlertTriangle size={18} />
      </div>
      <p className="text-sm font-medium text-red-800 dark:text-red-300">{message || 'حدث خطأ أثناء تحميل البيانات'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
        >
          <RotateCcw size={12} /> إعادة المحاولة
        </button>
      )}
    </div>
  );
}
