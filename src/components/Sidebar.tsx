import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NAVIGATION_CONFIG, type PageKey } from '@/config/navigation';

interface SidebarProps {
  current: PageKey;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  badgeCounts?: Partial<Record<PageKey, number>>;
}

const getRoleBadgeStyle = (roleStr: string): string => {
  const customStyles: Record<string, string> = {
    admin: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    guru: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
    guru_piket: 'bg-teal-500/15 text-teal-400 border border-teal-500/20',
  };

  return customStyles[roleStr] || 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
};

export function Sidebar({ current, sidebarOpen, setSidebarOpen, badgeCounts }: SidebarProps) {
  const { guru, role, namaRole, signOut, hasAccess } = useAuth();

  return (
    <aside
      className={`fixed lg:sticky top-0 left-0 h-screen h-dvh w-72 bg-slate-900 border-r border-slate-800 z-40 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Header Sidebar */}
      <div className="px-6 py-6 flex items-center gap-3.5 border-b border-slate-800">
        <div className="w-11 h-11 bg-indigo-500/15 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400 font-bold text-xl shadow-sm">
          WM
        </div>
        <div>
          <h1 className="text-slate-100 font-extrabold text-[13px] tracking-tight leading-snug">
            SMK KH. A. WAHAB
            <br /> MUHSIN
          </h1>
          <p className="text-slate-500 text-[11px] font-medium mt-0.5 uppercase tracking-wider">
            SISFO Pemuliaan Murid
          </p>
        </div>
      </div>

      {/* Navigasi Utama Filter Otomatis Hak Akses Database */}
      <nav className="flex-1 px-4 py-5 space-y-6 overflow-y-auto custom-scrollbar">
        {NAVIGATION_CONFIG.map((group) => {
          const visibleItems = group.items.filter((item) => hasAccess(item.key));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.groupTitle} className="space-y-1.5">
              <h2 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {group.groupTitle}
              </h2>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = current === item.key;
                const count = badgeCounts?.[item.key] ?? 0;

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] transition-all duration-200 ${
                      active
                        ? 'bg-indigo-500/15 text-indigo-300 font-semibold shadow-sm border border-indigo-500/10'
                        : 'text-slate-400 font-medium hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Icon
                        size={18}
                        strokeWidth={active ? 2.5 : 2}
                        className={active ? 'text-indigo-400' : 'text-slate-500'}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {/* Lencana Notifikasi */}
                    {count > 0 && (
                      <span
                        className={`ml-2 px-2 py-0.5 text-[11px] font-bold rounded-full transition-all shrink-0 ${
                          active
                            ? 'bg-indigo-500 text-white'
                            : 'bg-rose-500 text-white animate-pulse'
                        }`}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer Sidebar (Profil & Logout) */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 shadow-sm mb-3">
          <p className="text-sm font-semibold text-slate-200 truncate">
            {guru?.nama_lengkap ?? 'Guru'}
          </p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{guru?.email}</p>
          <div className="flex items-center gap-2 mt-3">
            {role && (
              <span
                className={`text-[10px] tracking-wide font-bold px-2 py-1 rounded-md ${getRoleBadgeStyle(
                  role
                )}`}
              >
                {namaRole || role}
              </span>
            )}
            {guru?.mata_pelajaran && (
              <span
                className="text-xs text-slate-500 truncate max-w-[100px] font-medium"
                title={guru.mata_pelajaran}
              >
                {guru.mata_pelajaran}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
        >
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}