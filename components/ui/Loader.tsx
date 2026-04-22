export default function Loader({ label = 'جاري التحميل...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

export function InlineLoader() {
  return <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin inline-block" />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-7 bg-gray-200 rounded w-2/3" />
    </div>
  );
}
