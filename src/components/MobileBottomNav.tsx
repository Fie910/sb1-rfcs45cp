// src/components/MobileBottomNav.tsx
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  CalendarDays,
  CalendarCheck,
  ListTodo,
  User,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useMemo } from 'react';

type TabItem = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
  accessKey?: string;
};

/**
 * Daftar tab default — urutan inilah yang muncul di bottom nav.
 * Kalau nanti mau ubah, cukup ubah di array ini.
 */
const ALL_TABS: TabItem[] = [
  { path: '/',          icon: LayoutDashboard, label: 'Beranda'  },
  { path: '/agenda',    icon: CalendarDays,    label: 'Agenda',   accessKey: 'agenda'   },
  { path: '/presensi',  icon: CalendarCheck,   label: 'Presensi', accessKey: 'presensi' },
  { path: '/todo',      icon: ListTodo,        label: 'Tugas',    accessKey: 'todo'     },
  { path: '/profil',    icon: User,            label: 'Profil'   },
];

/**
 * Bottom tab bar khusus mobile — meniru pola aplikasi native (iOS/Android).
 * Tab yang muncul otomatis disaring sesuai hak akses (RBAC) user.
 */
export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { hasAccess } = useAuth();

  // Filter tab yang user berhak akses saja
  const tabs = useMemo(
    () =>
      ALL_TABS.filter(
        (t) => !t.accessKey || hasAccess(t.accessKey as any),
      ),
    [hasAccess],
  );

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
              className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-2 flex-1 min-w-0"
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
                className={`relative z-10 text-[10px] font-medium transition-colors truncate ${
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