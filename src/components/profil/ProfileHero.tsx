// src/components/profil/ProfileHero.tsx
import { useState } from 'react';
import { User, Briefcase, Mail, Camera } from 'lucide-react';
import type { Guru } from '@/types/database';
import { PRESETS, PresetAvatar, PresetAvatarById } from './MuslimAvatarPresets';
import { AvatarPickerModal } from './AvatarPickerModal';
import { useAuth } from '@/context/AuthContext';

type Props = {
  guru: Guru | null;
};

// =============================================================================
// SKELETON
// =============================================================================
function ProfileHeroSkeleton() {
  return (
    <div className="relative overflow-hidden bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl mb-6">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/10 to-slate-900" />
      <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl skeleton-block shrink-0" />
        <div className="flex-1 text-center md:text-left min-w-0 w-full space-y-3">
          <div className="h-8 w-64 max-w-full skeleton-block rounded-lg mx-auto md:mx-0" />
          <div className="h-4 w-40 skeleton-block rounded mx-auto md:mx-0" />
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4">
            <div className="h-7 w-32 skeleton-block rounded-full" />
            <div className="h-7 w-28 skeleton-block rounded-full" />
            <div className="h-7 w-44 skeleton-block rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================
export function ProfileHero({ guru }: Props) {
  const { refreshGuru } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Semua hooks di atas — early return di akhir (rules-of-hooks aman)
  if (!guru) return <ProfileHeroSkeleton />;

  const initials = guru.nama_lengkap
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const roleDisplay =
    guru.role?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) ||
    'Guru';
  const divisiDisplay = guru.divisis?.nama_divisi || 'Umum';

  const hasCustomAvatar = Boolean(guru.avatar_url || guru.avatar_preset);

  return (
    <>
      <div className="relative overflow-hidden bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl mb-6">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/10 to-slate-900" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20" />

        <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* ============ AVATAR (klik untuk ubah) ============ */}
          <button
            onClick={() => setPickerOpen(true)}
            className="group relative shrink-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/40 rounded-3xl"
            title="Klik untuk ubah avatar"
          >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl overflow-hidden border-4 border-slate-900 shadow-xl shadow-indigo-500/20 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl md:text-5xl font-black">
              {guru.avatar_url ? (
                <img
                  src={guru.avatar_url}
                  alt={guru.nama_lengkap}
                  className="w-full h-full object-cover"
                />
              ) : guru.avatar_preset ? (
                <PresetAvatarById
                  presetId={guru.avatar_preset}
                  className="w-full h-full"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 rounded-3xl bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-1">
                <Camera size={24} className="text-white" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                  Ubah
                </span>
              </div>
            </div>

            {/* Small badge indicator */}
            <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-500 border-4 border-slate-900 flex items-center justify-center shadow-lg pointer-events-none">
              <Camera size={12} className="text-white" />
            </span>
          </button>

          {/* ============ INFO ============ */}
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

      {/* ============ MODAL PICKER ============ */}
      <AvatarPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        guruId={guru.id}
        currentPreset={guru.avatar_preset}
        currentUrl={guru.avatar_url}
        onSaved={async () => {
          await refreshGuru();
        }}
      />
    </>
  );
}