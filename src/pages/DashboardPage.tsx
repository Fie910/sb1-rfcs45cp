// src/pages/DashboardPage.tsx
// Dashboard baru — header compact + pengumuman carousel + shortcut customizable.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { PageKey } from '@/config/navigation';
import { supabase } from '@/lib/supabase';
import { PengumumanEmpty } from '@/components/dashboard/PengumumanCard';
import { PengumumanCarousel } from '@/components/dashboard/PengumumanCarousel';
import { ModalDetailPengumuman } from '@/components/dashboard/ModalDetailPengumuman';
import { ShortcutGrid } from '@/components/dashboard/ShortcutGrid';
import { ModalKustomShortcut } from '@/components/dashboard/ModalKustomShortcut';
import {
  Megaphone, Loader2, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
//import { TimeOfDayIcon } from '@/components/TimeOfDayIcon';
import { SkeletonCard } from '@/components/Skeleton';
import { Tagline } from '@/components/Tagline';
import { TimeOfDayHero } from '@/components/TimeOfDayHero';
import { cachedQuerySafe } from '@/lib/offline/cachedQuery';

// =============================================================================
// KONSTANTA SEKOLAH
// =============================================================================
const SCHOOL_SLOGAN = 'Merawat Fitrah, Mengukir Karya';
const SCHOOL_GREETING = 'Allãh Yubãrik Fïkum';

// =============================================================================
// HELPER
// =============================================================================
function formatTanggalCompact(d: Date): string {
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatJam(d: Date): string {
  return d.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =============================================================================
// TYPES
// =============================================================================
type Pengumuman = {
  id: number;
  judul: string;
  isi: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  gambar_url?: string | null;
  url?: string | null;
  prioritas?: string | null;
};

type Shortcut = {
  page_key: string;
  urutan: number;
};

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================
export function DashboardPage({
  badgeCounts,
}: {
  badgeCounts?: Partial<Record<PageKey, number>>;
}) {
  const { guru } = useAuth();

  const [pengumumanList, setPengumumanList] = useState<Pengumuman[]>([]);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingShortcuts, setLoadingShortcuts] = useState(true);

  const [detailPengumuman, setDetailPengumuman] = useState<Pengumuman | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Waktu real-time (update tiap menit)
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ==========================================================================
  // FETCH PENGUMUMAN
  // ==========================================================================
    const fetchPengumuman = useCallback(async () => {
    try {
      const { data } = await cachedQuerySafe<any[]>(
        'dashboard_pengumuman_aktif',
        async () => {
          const { data, error } = await supabase
            .from('v_pengumuman_aktif')
            .select('*')
            .order('tanggal_mulai', { ascending: false });
          if (error) throw error;
          return data ?? [];
        },
        [] // Fallback jika kosong
      );
      setPengumumanList(data as Pengumuman[]);
    } catch (err) {
      console.warn('[dashboard] pengumuman fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================================
  // FETCH SHORTCUTS (+ seed kalau belum ada)
  // ==========================================================================
    const fetchShortcuts = useCallback(async () => {
    if (!guru?.id) return;
    setLoadingShortcuts(true);

    try {
      const { data: existing } = await cachedQuerySafe<Shortcut[]>(
        `dashboard_shortcuts:${guru.id}`,
        async () => {
          const { data, error } = await supabase
            .from('user_dashboard_shortcuts')
            .select('page_key, urutan')
            .eq('guru_id', guru.id)
            .order('urutan');
          if (error) throw error;
          return data ?? [];
        },
        []
      );

      if (!existing || existing.length === 0) {
        // Jika belum ada shortcut, coba seed (hanya jika online)
        if (navigator.onLine) {
          const { error: rpcError } = await supabase.rpc('seed_default_shortcuts', {
            p_guru_id: guru.id,
          });
          if (!rpcError) {
            const { data: seeded } = await supabase
              .from('user_dashboard_shortcuts')
              .select('page_key, urutan')
              .eq('guru_id', guru.id)
              .order('urutan');
            setShortcuts((seeded as Shortcut[]) ?? []);
          }
        }
      } else {
        setShortcuts(existing as Shortcut[]);
      }
    } catch (err) {
      console.warn('[dashboard] shortcuts fetch:', err);
    } finally {
      setLoadingShortcuts(false);
    }
  }, [guru?.id]);

  useEffect(() => {
    fetchPengumuman();
    fetchShortcuts();
  }, [fetchPengumuman, fetchShortcuts]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  //const namaPanggilan = guru?.nama_lengkap?.split(' ')[0] ?? 'Guru';
  const namaPanggilan = guru?.nama_lengkap ?? 'Guru';
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      
      {/* ==================== HEADER COMPACT ==================== */}     
<TimeOfDayHero
  trailing={
    <div className="text-right">
      <p className="text-[10px] md:text-[11px] font-bold text-slate-200 drop-shadow-md">
        {formatTanggalCompact(now)}
      </p>
      <p className="text-[10px] text-slate-300/80 mt-0.5 drop-shadow-md">
        {formatJam(now)} WIB
      </p>
    </div>
  }
>
  <p className="text-[10px] italic text-amber-300/90 tracking-wide truncate drop-shadow-md">
    <Tagline variant="inline" separator="rub" />
  </p>
  <p className="text-sm md:text-base font-extrabold text-white truncate mt-0.5 drop-shadow-lg">
    {SCHOOL_GREETING}
  </p>
  
</TimeOfDayHero>

      {/* ==================== PENGUMUMAN ==================== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Megaphone size={14} />
            </div>
            <h2 className="text-sm font-bold text-slate-100">
              Pengumuman
              {pengumumanList.length > 0 && (
                <span className="text-slate-500 font-normal">
                  {' '}({pengumumanList.length})
                </span>
              )}
            </h2>
          </div>
          <Link
            to="/pengumuman"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition"
          >
            Lihat Semua <ArrowRight size={11} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
        ) : pengumumanList.length === 0 ? (
          <PengumumanEmpty />
        ) : (
          <PengumumanCarousel
            items={pengumumanList}
            onItemClick={(item) => setDetailPengumuman(item)}
          />
        )}
      </div>

      {/* ==================== SHORTCUT ==================== */}
<ShortcutGrid
  shortcuts={shortcuts}
  loading={loadingShortcuts}
  onEdit={() => setEditModalOpen(true)}
  badgeCounts={badgeCounts}
/>

      {/* ==================== MODAL DETAIL PENGUMUMAN ==================== */}
      <ModalDetailPengumuman
        open={!!detailPengumuman}
        onClose={() => setDetailPengumuman(null)}
        pengumuman={detailPengumuman}
      />

      {/* ==================== MODAL KUSTOM SHORTCUT ==================== */}
            <ModalKustomShortcut
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSaved={fetchShortcuts}
        currentShortcuts={shortcuts}
        guruId={guru?.id ?? ''}
      />
    </div>
  );
}