// src/components/tahfidz/LeaderboardMilestoneSection.tsx
// Leaderboard milestone — Top 10 siswa dengan milestone terbanyak per semester.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trophy, Crown, Medal, Loader2, RefreshCw, Users, Award, ChevronRight,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { getSemesterDateRange, type SemesterType } from '@/lib/tahfidz/semester';

// =============================================================================
// TYPES
// =============================================================================

type LeaderboardRow = {
  siswa_id: number;
  nama_lengkap: string;
  nisn: string;
  kelas_nama: string;
  jumlah_milestone: number;
  total_poin: number;
  milestone_terakhir: string | null;
};

type MilestoneDetail = {
  milestone_id: string;
  nama: string;
  poin: number;
  tanggal_tercapai: string;
};

// =============================================================================
// COMPONENT
// =============================================================================
export function LeaderboardMilestoneSection() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [list, setList] = useState<LeaderboardRow[]>([]);
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<any>(null);

  // Modal detail
  const [detailSiswa, setDetailSiswa] = useState<LeaderboardRow | null>(null);
  const [detailMilestones, setDetailMilestones] = useState<MilestoneDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ===========================================================================
  // FETCH
  // ===========================================================================
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Ambil tahun ajaran aktif
      const { data: tahunAktif } = await supabase
        .from('tahun_ajarans')
        .select('id, tahun, semester')
        .eq('is_aktif', true)
        .maybeSingle();

      setTahunAjaranAktif(tahunAktif);
      if (!tahunAktif) {
        setList([]);
        return;
      }

      // 2. Ambil milestone tercapai semester ini + join
      const { data, error } = await supabase
        .from('tahfidz_milestone_tercapai')
        .select(`
          siswa_id,
          tanggal_tercapai,
          milestone:tahfidz_milestone (
            id, nama, poin_prestasi
          ),
          siswa:siswas (
            id, nama_lengkap, nisn,
            kelas:kelas_id (nama_kelas)
          )
        `)
        .eq('tahun_ajaran_id', tahunAktif.id)
        .eq('semester', tahunAktif.semester)
        .order('tanggal_tercapai', { ascending: false });

      if (error) throw error;

      // 3. Aggregate per siswa
      const map = new Map<
        number,
        {
          siswa_id: number;
          nama_lengkap: string;
          nisn: string;
          kelas_nama: string;
          jumlah_milestone: number;
          total_poin: number;
          milestone_terakhir: string | null;
        }
      >();

      (data ?? []).forEach((row: any) => {
        if (!row.siswa) return;
        const key = row.siswa.id;
        const existing = map.get(key) ?? {
          siswa_id: row.siswa.id,
          nama_lengkap: row.siswa.nama_lengkap,
          nisn: row.siswa.nisn,
          kelas_nama: row.siswa.kelas?.nama_kelas ?? '-',
          jumlah_milestone: 0,
          total_poin: 0,
          milestone_terakhir: null,
        };

        existing.jumlah_milestone += 1;
        existing.total_poin += row.milestone?.poin_prestasi ?? 0;

        if (
          !existing.milestone_terakhir ||
          row.tanggal_tercapai > existing.milestone_terakhir
        ) {
          existing.milestone_terakhir = row.tanggal_tercapai;
        }

        map.set(key, existing);
      });

      // 4. Sort by jumlah milestone desc, lalu poin desc
      const sorted = Array.from(map.values()).sort((a, b) => {
        if (b.jumlah_milestone !== a.jumlah_milestone) {
          return b.jumlah_milestone - a.jumlah_milestone;
        }
        return b.total_poin - a.total_poin;
      });

      setList(sorted);
    } catch (err: any) {
      console.warn('[LeaderboardMilestone] Error:', err);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // ===========================================================================
  // FETCH DETAIL
  // ===========================================================================
  useEffect(() => {
    if (!detailSiswa || !tahunAjaranAktif) {
      setDetailMilestones([]);
      return;
    }

    (async () => {
      setDetailLoading(true);
      try {
        const { data } = await supabase
          .from('tahfidz_milestone_tercapai')
          .select(`
            milestone_id,
            tanggal_tercapai,
            milestone:tahfidz_milestone (id, nama, poin_prestasi)
          `)
          .eq('siswa_id', detailSiswa.siswa_id)
          .eq('tahun_ajaran_id', tahunAjaranAktif.id)
          .eq('semester', tahunAjaranAktif.semester)
          .order('tanggal_tercapai', { ascending: false });

        const mapped: MilestoneDetail[] = (data ?? []).map((m: any) => ({
          milestone_id: m.milestone_id,
          nama: m.milestone?.nama ?? '—',
          poin: m.milestone?.poin_prestasi ?? 0,
          tanggal_tercapai: m.tanggal_tercapai,
        }));

        setDetailMilestones(mapped);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [detailSiswa, tahunAjaranAktif]);

  // ===========================================================================
  // STATS
  // ===========================================================================
  const stats = useMemo(() => {
    const totalSiswa = list.length;
    const totalMilestone = list.reduce((s, r) => s + r.jumlah_milestone, 0);
    const totalPoin = list.reduce((s, r) => s + r.total_poin, 0);
    return { totalSiswa, totalMilestone, totalPoin };
  }, [list]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={14} className="text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">Leaderboard Milestone</h3>
        </div>
        <div className="text-center py-8">
          <Loader2 size={24} className="animate-spin text-amber-400 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Trophy size={14} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Leaderboard Milestone
              </h3>
              <p className="text-[10px] text-slate-500">
                Top {Math.min(list.length, 10)} siswa dengan milestone terbanyak
                {tahunAjaranAktif && (
                  <span className="ml-1 text-slate-400">
                    · {tahunAjaranAktif.semester} {tahunAjaranAktif.tahun}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Stats kecil */}
        {list.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Users size={10} /> {stats.totalSiswa} siswa
            </span>
            <span className="flex items-center gap-1">
              <Trophy size={10} /> {stats.totalMilestone} milestone
            </span>
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Award size={10} /> {stats.totalPoin} poin
            </span>
          </div>
        )}

        {/* Content */}
        {list.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
            <Trophy size={28} className="mx-auto text-slate-700 mb-2" />
            <p className="text-xs text-slate-500">
              {!tahunAjaranAktif
                ? 'Tidak ada tahun ajaran aktif'
                : 'Belum ada siswa yang mencapai milestone semester ini'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {list.slice(0, 10).map((s, idx) => (
              <button
                key={s.siswa_id}
                onClick={() => setDetailSiswa(s)}
                className="w-full text-left flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 hover:border-amber-500/40 transition cursor-pointer group"
              >
                {/* Rank */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-extrabold text-xs ${
                    idx === 0
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : idx === 1
                      ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40'
                      : idx === 2
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {idx === 0 ? (
                    <Crown size={16} />
                  ) : idx < 3 ? (
                    <Medal size={14} />
                  ) : (
                    `#${idx + 1}`
                  )}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/30 flex items-center justify-center text-amber-300 font-extrabold shrink-0 text-xs">
                  {s.nama_lengkap.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-300 transition">
                    {s.nama_lengkap}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {s.kelas_nama} · {s.nisn}
                  </p>
                </div>

                {/* Stats */}
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-amber-400">
                      {s.jumlah_milestone}
                    </p>
                    <p className="text-[9px] text-slate-500 uppercase">milestone</p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-slate-600 group-hover:text-amber-400 transition"
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Info total poin */}
        {list.length > 0 && list[0] && (
          <div className="mt-3 pt-3 border-t border-slate-800/60 text-[10px] text-slate-500 text-center">
            🏆 Champion: <strong className="text-amber-400">{list[0].nama_lengkap}</strong> dengan{' '}
            <strong className="text-amber-400">{list[0].jumlah_milestone} milestone</strong> ·{' '}
            <strong className="text-amber-400">{list[0].total_poin} poin</strong>
          </div>
        )}
      </div>

      {/* Modal Detail */}
      <Modal
        open={!!detailSiswa}
        onClose={() => setDetailSiswa(null)}
        title="Detail Milestone Siswa"
        size="md"
      >
        {detailSiswa && (
          <div className="space-y-4">
            {/* Info Siswa */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-extrabold text-lg shrink-0">
                {detailSiswa.nama_lengkap.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-300 truncate">
                  {detailSiswa.nama_lengkap}
                </p>
                <p className="text-[10px] text-amber-400/70">
                  {detailSiswa.kelas_nama} · {detailSiswa.nisn}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-extrabold text-amber-400">
                  {detailSiswa.jumlah_milestone}
                </p>
                <p className="text-[9px] text-amber-400/70 uppercase">milestone</p>
              </div>
            </div>

            {/* List Milestone */}
            <div>
              <p className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-400" />
                Daftar Milestone ({detailMilestones.length})
              </p>

              {detailLoading ? (
                <div className="text-center py-8">
                  <Loader2 size={20} className="animate-spin text-amber-400 mx-auto" />
                </div>
              ) : detailMilestones.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Tidak ada data
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                  {detailMilestones.map((m, idx) => (
                    <div
                      key={`${m.milestone_id}-${idx}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60"
                    >
                      <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-sm shrink-0">
                        <Trophy size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-200 truncate">
                          {m.nama}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Tercapai: {new Date(m.tanggal_tercapai).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-amber-400 shrink-0">
                        +{m.poin}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setDetailSiswa(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}