export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] rounded-md ${className}`} style={{ animation: 'shimmer 1.5s infinite', ...style }} />;
}

export function KPISkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
        <Skeleton className="w-11 h-11 !rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-4 w-14" />
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <Skeleton className="h-3 w-40 mb-4" />
      <div className="flex items-end gap-2" style={{ height: height - 60 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${30 + ((i * 13) % 60)}%` } as any} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100"><Skeleton className="h-3 w-40" /></div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
