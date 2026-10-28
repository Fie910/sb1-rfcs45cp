// src/hooks/useBadgeCounts.ts
// Aggregator badge counts dari tabel notifikasi + disposisi_surat.
// Auto-mark-as-read berdasarkan path halaman aktif.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { cachedQuerySafe } from '@/lib/offline/cachedQuery'; // ✅ Tambah Import
import type { PageKey } from '@/config/navigation';

type BadgeMap = Partial<Record<PageKey, number>>;

// Map path → tipe notifikasi yang harus di-mark-read saat dikunjungi
const PATH_TO_NOTIF_TIPE: Record<string, string[]> = {
  '/kalender_akademik': ['kalender', 'kegiatan'],
  '/buku_tamu': ['buku_tamu'],
  '/saran_pengaduan': ['saran_pengaduan'],
  '/todo': ['tugas'],
  '/rapat': ['rapat_baru', 'rapat_update', 'rapat_cancel', 'notulensi_final'],
};

// Map tipe notifikasi → PageKey (untuk badge)
const TIPE_TO_PAGE: Record<string, PageKey> = {
  kalender: 'kalender_akademik',
  kegiatan: 'kalender_akademik',
  buku_tamu: 'buku_tamu',
  saran_pengaduan: 'saran_pengaduan',
  tugas: 'todo',
  rapat_baru: 'rapat',
  rapat_update: 'rapat',
  rapat_cancel: 'rapat',
  notulensi_final: 'rapat',
};

export function useBadgeCounts(guruId: string | null, guruNama: string | null) {
  const location = useLocation();
  const [badges, setBadges] = useState<BadgeMap>({});

  // ===========================================================================
  // FETCH COUNTS (OFFLINE-AWARE)
  // ===========================================================================
  const fetchCounts = async () => {
    if (!guruId) return;

    try {
      const { data: counts } = await cachedQuerySafe<BadgeMap>(
        `badge_counts:${guruId}`,
        async () => {
          const [notifRes, dispRes] = await Promise.all([
            supabase
              .from('notifikasi')
              .select('tipe')
              .eq('guru_id', guruId)
              .eq('is_read', false),
            guruNama
              ? supabase
                  .from('disposisi_surat')
                  .select('id', { count: 'exact', head: true })
                  .eq('penerima_disposisi', guruNama)
                  .neq('status', 'SELESAI')
              : Promise.resolve({ count: 0 } as any),
          ]);

          if (notifRes.error) throw notifRes.error;

          const newCounts: BadgeMap = {};
          (notifRes.data ?? []).forEach((n: any) => {
            const key = TIPE_TO_PAGE[n.tipe];
            if (!key) return;
            newCounts[key] = (newCounts[key] ?? 0) + 1;
          });

          if (dispRes.count && dispRes.count > 0) {
            newCounts.tugas_disposisi = dispRes.count;
          }

          return newCounts;
        },
        {} // Fallback jika offline dan belum ada cache
      );
      setBadges(counts);
    } catch (err) {
      console.warn('[useBadgeCounts] fetch error:', err);
    }
  };

  // ===========================================================================
  // AUTO-MARK-READ berdasarkan path aktif
  // ===========================================================================
  const markReadByPath = async (path: string) => {
    if (!guruId || !navigator.onLine) return; // ✅ Skip jika offline

    const match = Object.entries(PATH_TO_NOTIF_TIPE).find(([prefix]) =>
      path.startsWith(prefix)
    );
    if (!match) return;

    const tipeList = match[1];
    await supabase
      .from('notifikasi')
      .update({ is_read: true })
      .eq('guru_id', guruId)
      .in('tipe', tipeList)
      .eq('is_read', false);

    fetchCounts();
  };

  // ===========================================================================
  // EFFECTS
  // ===========================================================================
  useEffect(() => {
    fetchCounts();
  }, [guruId, guruNama]);

  // Auto-mark read saat path berubah
  useEffect(() => {
    markReadByPath(location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, guruId]);

  // Real-time subscribe notifikasi
  useEffect(() => {
    if (!guruId) return;

    const channel = supabase
      .channel('badge-notif-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifikasi',
          filter: `guru_id=eq.${guruId}`,
        },
        () => fetchCounts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disposisi_surat' },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guruId]);

  return badges;
}