// src/components/profil/ProfileHero.tsx
import { User, Briefcase, Mail } from 'lucide-react';
import type { Guru } from '@/types/database';

type Props = {
  guru: Guru | null;
};

export function ProfileHero({ guru }: Props) {
  if (!guru) return null;

  // Generate initials dari nama (misal: "Ahmad Fauzi" -> "AF")
  const initials = guru.nama_lengkap
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const roleDisplay = guru.role?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Guru';
  const divisiDisplay = guru.divisis?.nama_divisi || 'Umum';

  return (
    <div className="relative overflow-hidden bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl mb-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/10 to-slate-900" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20" />

      <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Avatar */}
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl md:text-5xl font-black shadow-xl shadow-indigo-500/20 shrink-0 border-4 border-slate-900">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 text-center md:text-left min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight truncate">
            {guru.nama_lengkap}
          </h1>
          <p className="text-sm font-mono text-indigo-300 mt-1">
            {guru.nip ? `NIP. ${guru.nip}` : 'NIP Belum diisi'}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
              <Briefcase size={12} /> {roleDisplay}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold uppercase tracking-wider">
              <User size={12} /> Divisi {divisiDisplay}
            </span>
            {guru.email && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold">
                <Mail size={12} /> {guru.email}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}