// src/hooks/useKehadiranGuru.ts
// Hook untuk menghitung ringkasan kehadiran guru dari tabel agenda_gurus.
//
// Formula (1 JP = 30 menit):
//   JP sesi = (waktu_selesai - waktu_mulai) / 30
//
//   Hadir Mengajar  → hadir_jp += JP sesi
//   Terlambat       → hadir_jp += ceil((durasi - menit_terlambat) / 30)
//                     alpa_jp  += alpa_jam_pelajaran (dari kolom)
//   Alpa            → alpa_jp  += JP sesi
//   Izin            → izin_jp  += JP sesi
//   Sakit           → sakit_jp += JP sesi
//
// Rate = hadir_jp / (hadir_jp + alpa_jp + izin_jp + sakit_jp) * 100
// Terlambat tidak masuk rate (info saja).

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getTodayDateWib } from '@/lib/date';
import type { KehadiranStats, AgendaGuruKehadiranRow } from '@/types/database';

// =============================================================================
// HELPERS
// =============================================================================
const JP_MENIT = 30;

function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const parts = t.split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

function emptyStats(): KehadiranStats {
  return {
    hadir_jp: 0,
    alpa_jp: 0,
    izin_jp: 0,
    sakit_jp: 0,
    total_jp: 0,
    rate: 0,
    total_menit_terlambat: 0,
    total_terlambat_jp: 0,
    total_sesi: 0,
    total_sesi_terlambat: 0,
  };
}

function currentMonthStr(): string {
  const today = getTodayDateWib();
  return today.slice(0, 7); // 'YYYY-MM'
}

function getDateRange(monthStr: string): { start: string; end: string } {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthNumStr);
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;

  const today = getTodayDateWib();
  const todayMonth = today.slice(0, 7);

  // Kalau bulan ini → sampai hari ini
  if (monthStr === todayMonth) {
    return { start: firstDay, end: today };
  }

  // Kalau bukan bulan ini → sampai akhir bulan
  const lastDay = new Date(year, month, 0).getDate();
  const endDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start: firstDay, end: endDay };
}

// =============================================================================
// CORE COMPUTE
// =============================================================================
function computeStats(rows: AgendaGuruKehadiranRow[]): KehadiranStats {
  const stats = emptyStats();

  for (const row of rows) {
    const jadwal = row.jadwal_kbms;
    if (!jadwal?.waktu_mulai || !jadwal?.waktu_selesai) continue;

    const menitMulai = timeToMinutes(jadwal.waktu_mulai);
    const menitSelesai = timeToMinutes(jadwal.waktu_selesai);
    const durasi = menitSelesai - menitMulai;
    if (durasi <= 0) continue;

    const jpSesi = durasi / JP_MENIT;
    const menitTelat = row.menit_terlambat ?? 0;
    const alpaJam = row.alpa_jam_pelajaran ?? 0;

    stats.total_sesi += 1;

    switch (row.status_kehadiran) {
      case 'Hadir Mengajar': {
        stats.hadir_jp += Math.round(jpSesi);
        break;
      }
      case 'Terlambat': {
        stats.total_sesi_terlambat += 1;
        stats.total_menit_terlambat += menitTelat;
        // Hadir = sisa waktu setelah dikurangi keterlambatan, dibulatkan KE ATAS
        const sisaMenit = Math.max(0, durasi - menitTelat);
        stats.hadir_jp += Math.ceil(sisaMenit / JP_MENIT);
        // Alpa dari kolom (yang sudah di-generate floor(menit_telat/30))
        stats.alpa_jp += alpaJam;
        break;
      }
      case 'Alpa': {
        // Pakai alpa_jam_pelajaran dari kolom kalau > 0, else durasi/30
        stats.alpa_jp += alpaJam > 0 ? alpaJam : Math.round(jpSesi);
        break;
      }
      case 'Izin': {
        stats.izin_jp += Math.round(jpSesi);
        break;
      }
      case 'Sakit': {
        stats.sakit_jp += Math.round(jpSesi);
        break;
      }
      default:
        break;
    }
  }

  stats.total_jp =
    stats.hadir_jp + stats.alpa_jp + stats.izin_jp + stats.sakit_jp;

  stats.rate =
    stats.total_jp > 0
      ? Math.round((stats.hadir_jp / stats.total_jp) * 100)
      : 0;

  stats.total_terlambat_jp = stats.total_menit_terlambat / JP_MENIT;

  return stats;
}

// =============================================================================
// HOOK
// =============================================================================
export function useKehadiranGuru() {
  const { guru } = useAuth();

  const [stats, setStats] = useState<KehadiranStats>(emptyStats());
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<string>(currentMonthStr());
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!guru?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { start, end } = getDateRange(filterMonth);

        const { data, error } = await supabase
          .from('agenda_gurus')
          .select(`
            id,
            tanggal,
            status_kehadiran,
            menit_terlambat,
            alpa_jam_pelajaran,
            jadwal_kbms(id, waktu_mulai, waktu_selesai)
          `)
          .eq('guru_id', guru.id)
          .gte('tanggal', start)
          .lte('tanggal', end);

        if (error) throw error;

        const rows = (data as unknown as AgendaGuruKehadiranRow[]) ?? [];
        if (!cancelled) {
          setStats(computeStats(rows));
        }
      } catch (err) {
        console.warn('[useKehadiranGuru] fetch error:', err);
        if (!cancelled) setStats(emptyStats());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guru?.id, filterMonth, refreshKey]);

  return {
    stats,
    loading,
    filterMonth,
    setFilterMonth,
    refresh,
  };
}

// =============================================================================
// OPTIONS — dropdown bulan (12 bulan ke belakang)
// =============================================================================
export function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      month: 'long',
      year: 'numeric',
    });
    options.push({ value, label });
  }
  return options;
}