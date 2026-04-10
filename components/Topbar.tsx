'use client';

import { Search, User, Bell } from 'lucide-react';

export default function Topbar() {
  return (
    <header className="bg-white/80 backdrop-blur-2xl shadow-2xl h-16 fixed top-0 left-64 right-0 z-10 border-b border-white/20">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex-1 max-w-xl">
          <div className="relative group">
            <input
              type="text"
              placeholder="بحث..."
              className="w-full pr-10 pl-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 group-hover:bg-white/70 group-hover:shadow-xl backdrop-blur-sm"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus:text-blue-500 transition-all duration-300 group-hover:scale-110" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2.5 hover:bg-white/20 rounded-xl relative transition-all duration-300 hover:scale-110 hover:rotate-12 backdrop-blur-sm">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
          </button>
          <div className="flex items-center gap-3 pr-4 border-r border-white/20 hover:border-white/30 transition-colors duration-300">
            <div className="text-left">
              <span className="text-sm font-semibold text-gray-900">مستخدم</span>
              <p className="text-xs text-gray-500/80">مدير النظام</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 hover:rotate-3">
              <User className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
