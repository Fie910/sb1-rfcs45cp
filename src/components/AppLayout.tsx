import { useState, type ReactNode } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import type { PageKey } from '@/config/navigation';

type LayoutProps = {
  current: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
};

export function AppLayout({ current, onNavigate, children }: LayoutProps) {
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans text-slate-300 selection:bg-indigo-500/30">
      {/* Overlay Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <Sidebar
        current={current}
        onNavigate={onNavigate}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center">
            <span className="font-extrabold text-slate-100 text-sm tracking-tight">
              SMK. KH. A. WAHAB MUHSIN
            </span>
          </div>
          <button
            onClick={signOut}
            className="p-2 -mr-2 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed top-4 right-4 z-50 lg:hidden p-2 bg-slate-800 text-slate-300 rounded-full shadow-lg border border-slate-700 hover:bg-slate-700 transition-colors"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}