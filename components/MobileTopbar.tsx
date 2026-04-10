'use client';

import { Search, User, Bell, Menu } from 'lucide-react';
import { MobileMenuButton } from './MobileSidebar';

interface MobileTopbarProps {
  onMenuClick: () => void;
}

export default function MobileTopbar({ onMenuClick }: MobileTopbarProps) {
  return (
    <header className="bg-white shadow-sm h-16 fixed top-0 left-0 right-0 z-30 lg:hidden">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Menu Button */}
        <MobileMenuButton onClick={onMenuClick} />

        {/* Title */}
        <div className="flex-1 text-center">
          <h1 className="text-lg font-bold text-gray-900">نظام ERP</h1>
          <p className="text-xs text-gray-500">مصنع البلاستيك</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 left-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
}
