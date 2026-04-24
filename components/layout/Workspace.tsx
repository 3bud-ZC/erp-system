'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface WorkspaceProps {
  children: ReactNode;
}

export function Workspace({ children }: WorkspaceProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

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
        <main className="p-6">
          {/* key re-mounts this div on every route change → triggers fade-in */}
          <div key={pathname} style={{ animation: 'erpPageIn 0.16s ease-out both' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Scoped keyframe — no globals.css modification needed */}
      <style>{`
        @keyframes erpPageIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
