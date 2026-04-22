'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Factory, Bell, User, Menu, LogOut, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBreadcrumb } from '@/lib/erp-frontend-core/module-registry';

export function ERPHeader() {
  const pathname = usePathname();
  const breadcrumb = getBreadcrumb(pathname);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Logo and Breadcrumb */}
        <div className="flex items-center gap-4">
          <Link href="/erp/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">نظام ERP</span>
          </Link>
          
          {/* Breadcrumb */}
          {breadcrumb && (
            <nav className="hidden md:flex items-center gap-2 text-sm text-gray-500 mr-4">
              <span>/</span>
              <span className="font-medium text-gray-900">{breadcrumb.module.nameAr}</span>
              {breadcrumb.subModule && (
                <>
                  <span>/</span>
                  <span>{breadcrumb.subModule.nameAr}</span>
                </>
              )}
            </nav>
          )}
        </div>

        {/* Search */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="البحث في النظام..."
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </Button>

          {/* User Menu */}
          <div className="flex items-center gap-3 pl-4 border-r border-gray-200">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">مدير النظام</p>
              <p className="text-xs text-gray-500">admin@erp.com</p>
            </div>
            <Button variant="ghost" size="icon">
              <User className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
