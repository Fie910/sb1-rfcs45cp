// src/hooks/useBadgeCounts.ts
// Aggregator badge counts dari tabel notifikasi + disposisi_surat.
// Auto-mark-as-read berdasarkan path halaman aktif.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { PageKey } from '@/config/navigation';

type BadgeMap = Partial<Record<PageKey, number>>;

// Map path → tipe notifikasi yang harus di-mark-read saat dikunjungi
const PATH_TO_NOTIF_TIPE: Record<string, string[]> = {
  '/kalender_akademik': ['kalender', 'kegiatan'],
  '/buku_tamu': ['buku_tamu'],
  '/saran_pengaduan': ['saran_pengaduan'],
  '/todo': ['tugas'],
  '/rapat': ['rapat_baru', 'rapat_update', 'rapat_cancel'],
  // disposisi_surat tidak pakai tabel notifikasi — auto-clear di halaman
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
};

export function useBadgeCounts(guruId: string | null, guruNama: string | null) {
  const location = useLocation();
  const [badges, setBadges] = useState<BadgeMap>({});

  // ===========================================================================
  // FETCH COUNTS
  // ===========================================================================
  const fetchCounts = async () => {
    if (!guruId) return;

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

    // Aggregate notif per tipe → PageKey
    const counts: BadgeMap = {};
    (notifRes.data ?? []).forEach((n: any) => {
      const key = TIPE_TO_PAGE[n.tipe];
      if (!key) return;
      counts[key] = (counts[key] ?? 0) + 1;
    });

    // Disposisi
    if (dispRes.count && dispRes.count > 0) {
      counts.tugas_disposisi = dispRes.count;
    }

    setBadges(counts);
  };

  // ===========================================================================
  // AUTO-MARK-READ berdasarkan path aktif
  // ===========================================================================
  const markReadByPath = async (path: string) => {
    if (!guruId) return;

    // Cari prefix yang cocok (mis: /buku_tamu atau /buku_tamu/isi)
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

    // Refresh counts
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