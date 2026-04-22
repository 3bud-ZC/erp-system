/**
 * ERP System Layout
 * Main layout for the ERP production frontend
 */

import React from 'react';
import { ERPHeader } from '@/components/erp/layout/ERPHeader';
import { ERPSidebar } from '@/components/erp/layout/ERPSidebar';

export default function ERPLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <ERPHeader />
      
      <div className="flex">
        {/* Sidebar */}
        <ERPSidebar />
        
        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
