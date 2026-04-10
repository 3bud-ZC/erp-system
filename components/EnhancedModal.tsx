'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface EnhancedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl',
};

export default function EnhancedModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className = '' 
}: EnhancedModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative w-full ${sizeClasses[size]} mx-4 transform transition-all duration-500 scale-100`}>
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="relative p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900" style={{ direction: 'rtl' }}>{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-300 group hover:scale-110 hover:rotate-90"
              >
                <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>
            </div>
            
            {/* Decorative Line */}
            <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 animate-pulse" />
          </div>
          
          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto" style={{ direction: 'rtl' }}>
            <div className="animate-fadeIn">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
