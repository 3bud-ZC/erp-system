import React from 'react';
import { LucideIcon } from 'lucide-react';

interface FloatingActionProps {
  icon: LucideIcon;
  onClick: () => void;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  color?: 'blue' | 'green' | 'red' | 'purple';
}

const positionClasses = {
  'bottom-right': 'bottom-8 right-8',
  'bottom-left': 'bottom-8 left-8',
  'top-right': 'top-8 right-8',
  'top-left': 'top-8 left-8',
};

const colorClasses = {
  blue: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
  green: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800',
  red: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800',
  purple: 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800',
};

export default function FloatingAction({ 
  icon: Icon, 
  onClick, 
  label, 
  position = 'bottom-right',
  color = 'blue' 
}: FloatingActionProps) {
  return (
    <div className={`fixed ${positionClasses[position]} z-50 group`}>
      <button
        onClick={onClick}
        className={`
          relative w-14 h-14 rounded-full shadow-2xl
          flex items-center justify-center
          text-white transition-all duration-300
          transform hover:scale-110 active:scale-95
          ${colorClasses[color]}
        `}
      >
        <Icon className="w-6 h-6" />
        
        {/* Ripple Effect */}
        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
      </button>
      
      {/* Tooltip */}
      {label && (
        <div className="absolute bottom-full mb-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  );
}
