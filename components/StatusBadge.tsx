interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig = {
  pending: {
    label: 'قيد الانتظار',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    dot: 'bg-yellow-500',
  },
  completed: {
    label: 'مكتمل',
    color: 'bg-green-100 text-green-800 border-green-200',
    dot: 'bg-green-500',
  },
  cancelled: {
    label: 'ملغي',
    color: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
  },
  processing: {
    label: 'قيد المعالجة',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
  },
};

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${config.color} ${className}`}>
      <div className={`w-2 h-2 rounded-full ${config.dot} ${status === 'processing' ? 'animate-pulse' : ''}`} />
      <span>{config.label}</span>
    </div>
  );
}
