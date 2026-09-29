// src/pages/DashboardPage.tsx
// Dashboard baru — sambutan + pengumuman + shortcut customizable.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { PengumumanCard, PengumumanEmpty } from '@/components/dashboard/PengumumanCard';
import { ShortcutGrid } from '@/components/dashboard/ShortcutGrid';
import { ModalKustomShortcut } from '@/components/dashboard/ModalKustomShortcut';
import {
  Megaphone, Sparkles, Loader2, Calendar, Clock, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// =============================================================================
// HELPER
// =============================================================================
function getSapaan(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

function formatTanggalPanjang(d: Date): string {
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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
export function DashboardPage() {
  const { guru } = useAuth();
  const [pengumumanList, setPengumumanList] = useState<Pengumuman[]>([]);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingShortcuts, setLoadingShortcuts] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Waktu real-time
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
      const { data, error } = await supabase
        .from('v_pengumuman_aktif')
        .select('*')
        .limit(3);

      if (error) {
        console.warn('[dashboard] pengumuman error:', error);
        return;
      }
      setPengumumanList((data as Pengumuman[]) ?? []);
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
      // 1. Cek existing shortcuts
      const { data: existing, error } = await supabase
        .from('user_dashboard_shortcuts')
        .select('page_key, urutan')
        .eq('guru_id', guru.id)
        .order('urutan');

      if (error) {
        console.warn('[dashboard] shortcuts error:', error);
        return;
      }

      // 2. Kalau belum ada → seed default via RPC
      if (!existing || existing.length === 0) {
        const { error: rpcError } = await supabase.rpc('seed_default_shortcuts', {
          p_guru_id: guru.id,
        });

        if (rpcError) {
          console.warn('[dashboard] seed error:', rpcError);
          return;
        }

        // 3. Fetch ulang setelah seed
        const { data: seeded } = await supabase
          .from('user_dashboard_shortcuts')
          .select('page_key, urutan')
          .eq('guru_id', guru.id)
          .order('urutan');

        setShortcuts((seeded as Shortcut[]) ?? []);
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
  const namaPanggilan = guru?.nama_lengkap?.split(' ')[0] ?? 'Guru';

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* ==================== SAMBUTAN ==================== */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
              {getSapaan()} 👋
            </p>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-100 truncate">
              {namaPanggilan}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={12} className="text-indigo-400" />
                {formatTanggalPanjang(now)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={12} className="text-indigo-400" />
                {formatJam(now)} WIB
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles size={20} className="text-amber-400" />
          </div>
        </div>
      </div>

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
          <div className="text-center py-8 bg-slate-900 border border-slate-800 rounded-2xl">
            <Loader2 size={20} className="animate-spin text-indigo-400 mx-auto" />
          </div>
        ) : pengumumanList.length === 0 ? (
          <PengumumanEmpty />
        ) : (
          <div className="space-y-3">
            {pengumumanList.map((p) => (
              <PengumumanCard key={p.id} item={p} />
            ))}
          </div>
        )}
      </div>

      {/* ==================== SHORTCUT ==================== */}
      <ShortcutGrid
        shortcuts={shortcuts}
        loading={loadingShortcuts}
        onEdit={() => setEditModalOpen(true)}
      />

      {/* ==================== MODAL KUSTOM ==================== */}
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