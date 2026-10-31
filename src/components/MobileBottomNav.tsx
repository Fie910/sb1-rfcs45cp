// src/components/MobileBottomNav.tsx
import { motion } from 'motion/react';
import { LayoutDashboard, CalendarCheck, FileText, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useMemo } from 'react';

type TabItem = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
};

/**
 * Bottom tab bar khusus mobile — meniru pola aplikasi native (iOS/Android).
 * Hanya tab yang user punya aksesnya yang muncul.
 */
export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { hasAccess } = useAuth();

  const tabs = useMemo<TabItem[]>(() => {
    const items: TabItem[] = [
      { path: '/', icon: LayoutDashboard, label: 'Beranda' },
    ];
    if (hasAccess('presensi')) {
      items.push({ path: '/presensi', icon: CalendarCheck, label: 'Presensi' });
    }
    if (hasAccess('surat')) {
      items.push({ path: '/surat', icon: FileText, label: 'Surat' });
    }
    items.push({ path: '/profil', icon: User, label: 'Profil' });
    return items;
  }, [hasAccess]);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 lg:hidden
                 bg-slate-900/90 backdrop-blur-xl
                 border-t border-slate-800
                 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active =
            pathname === tab.path ||
            (tab.path === '/' && pathname === '/dashboard');
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="relative flex flex-col items-center justify-center gap-0.5 px-4 py-2 min-w-[64px]"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-1 rounded-2xl bg-indigo-500/15"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                size={22}
                className={`relative z-10 transition-colors ${
                  active ? 'text-indigo-400' : 'text-slate-500'
                }`}
              />
              <span
                className={`relative z-10 text-[10px] font-medium transition-colors ${
                  active ? 'text-indigo-400' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}