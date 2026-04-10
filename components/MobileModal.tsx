'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
};

export default function MobileModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className = '' 
}: MobileModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`
        relative w-full ${sizeClasses[size]} transform transition-all duration-300
        ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      `}>
        <div className="bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-10 p-4 border-b border-gray-100 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {/* Drag Handle */}
            <div className="flex justify-center mt-3">
              <div className="w-12 h-1 bg-gray-300 rounded-full" />
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
