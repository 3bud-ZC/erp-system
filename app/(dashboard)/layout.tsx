'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import MobileSidebar, { MobileMenuButton } from '@/components/MobileSidebar';
import MobileTopbar from '@/components/MobileTopbar';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <div className="relative z-10">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile Sidebar */}
        <MobileSidebar 
          isOpen={isMobileSidebarOpen} 
          onClose={() => setIsMobileSidebarOpen(false)} 
        />

        {/* Main Content */}
        <div className="lg:mr-64 overflow-x-hidden">
          {/* Desktop Topbar */}
          <div className="hidden lg:block">
            <Topbar />
          </div>

          {/* Mobile Topbar */}
          <div className="lg:hidden">
            <MobileTopbar onMenuClick={() => setIsMobileSidebarOpen(true)} />
          </div>

          {/* Main Content Area */}
          <main className="lg:mt-16 lg:p-6 p-4 pt-20">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
