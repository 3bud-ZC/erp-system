'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useState } from 'react';

interface WorkspaceProps {
  children: ReactNode;
}

export function Workspace({ children }: WorkspaceProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      {/* RTL: sidebar is on the right, so content gets margin-right */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'mr-16' : 'mr-64'
        }`}
      >
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
