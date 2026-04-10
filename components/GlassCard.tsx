import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  blur?: 'sm' | 'md' | 'lg';
  opacity?: number;
}

const blurClasses = {
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
};

export default function GlassCard({ 
  children, 
  className = '', 
  blur = 'md',
  opacity = 80
}: GlassCardProps) {
  return (
    <div
      className={`
        relative rounded-2xl border border-white/20
        bg-white/10 shadow-xl
        ${blurClasses[blur]}
        ${className}
      `}
      style={{ backgroundColor: `rgba(255, 255, 255, ${opacity / 100})` }}
    >
      {/* Glass Effect Overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
