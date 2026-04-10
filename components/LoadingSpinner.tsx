export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      <div className={`absolute inset-0 border-2 border-blue-200 rounded-full animate-pulse`} />
      <div className={`absolute inset-0 border-2 border-transparent border-t-blue-600 rounded-full animate-spin`} />
    </div>
  );
}
