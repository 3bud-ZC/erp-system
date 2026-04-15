'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface NotificationToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-600',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    iconColor: 'text-yellow-600',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600',
  },
};

export default function NotificationToast({ 
  message, 
  type = 'info', 
  duration = 5000,
  onClose 
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const config = typeConfig[type];
  const Icon = config.icon;

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  useEffect(() => {
    // Entrance animation
    setIsVisible(true);
    
    // Auto-dismiss
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        max-w-md w-full mx-4
        transform transition-all duration-300 ease-out
        ${isExiting ? 'translate-y-[-100%] opacity-0' : 'translate-y-0 opacity-100'}
      `}
    >
      <div className={`
        relative overflow-hidden rounded-xl border shadow-lg
        ${config.bgColor} ${config.borderColor}
        ${config.textColor}
      `}>
        <div className="flex items-center gap-3 p-4">
          <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor}`} />
          <p className="text-sm font-medium flex-1">{message}</p>
          <button
            onClick={handleClose}
            className={`p-1 rounded-lg hover:bg-black/10 transition-colors ${config.iconColor}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-black/10">
          <div 
            className="h-full bg-black/20 transition-all duration-100 ease-linear"
            style={{
              width: '100%',
              animation: `shrink ${duration}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Add this to your global CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
`;
document.head.appendChild(style);
