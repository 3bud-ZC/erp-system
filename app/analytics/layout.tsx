import AnalyticsSidebar from '@/components/ui/AnalyticsSidebar';
import CommandPalette from '@/components/ui/CommandPalette';
import TopBar from '@/components/ui/TopBar';
import { AppProviders } from '@/components/providers/AppProviders';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors" dir="rtl">
        <div className="flex flex-col lg:flex-row">
          <AnalyticsSidebar />
          <main className="flex-1 flex flex-col">
            <TopBar />
            <div className="flex-1 p-6 lg:p-8 max-w-[1600px] mx-auto w-full">{children}</div>
          </main>
        </div>
        <CommandPalette />
      </div>
    </AppProviders>
  );
}
