// src/components/bk/ProfilSiswaBKTab.tsx
// Tab Profil Siswa BK — timeline lengkap pendampingan 1 siswa.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, User, Heart, MessageSquare, UserCheck,
  ClipboardList, Calendar, Clock, Loader2, X,
  AlertCircle, CheckCircle2, Lock, Shield, BookOpen,
  Sparkles, History, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import {
  getBidangBadge, getStatusKonselingBadge, getStatusCurhatBadge,
  getStatusRujukanBadge, getUrgensiBadge, formatDateShort, formatDateTimeWib,
} from './shared';
import type { Siswa, Kelas } from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================

type TimelineItem = {
  id: string;
  tipe: 'konseling' | 'curhat' | 'rujukan' | 'asesmen';
  tanggal: string;
  timestamp: string;
  icon: typeof Heart;
  color: string;
  bg: string;
  border: string;
  title: string;
  subtitle: string;
  detail?: string;
  badge?: { text: string; style: string };
  extra?: { label: string; value: string }[];
};

type SiswaWithKelas = Siswa & {
  kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null;
};

// =============================================================================
// KOMPONEN
// =============================================================================

export function ProfilSiswaBKTab() {
  const [siswaList, setSiswaList] = useState<SiswaWithKelas[]>([]);
  const [selectedSiswaId, setSelectedSiswaId] = useState('');
  const [loadingSiswa, setLoadingSiswa] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [summary, setSummary] = useState({
    konseling: 0,
    curhat: 0,
    rujukan: 0,
    asesmen: 0,
  });

  // ==========================================================================
  // FETCH DAFTAR SISWA
  // ==========================================================================
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('siswas')
          .select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id, status, created_at, kelas:kelas_id (id, nama_kelas)')
          .eq('status', 'AKTIF')
          .order('nama_lengkap');

        if (error) throw error;
        setSiswaList((data as unknown as SiswaWithKelas[]) || []);
      } catch (err: any) {
        showToast('error', 'Gagal memuat siswa: ' + (err.message || 'Error'));
      } finally {
        setLoadingSiswa(false);
      }
    })();
  }, []);

  // ==========================================================================
  // FETCH TIMELINE
  // ==========================================================================
  const fetchTimeline = useCallback(async (siswaId: string) => {
    setLoadingTimeline(true);
    try {
      const sid = Number(siswaId);

      const [konselingRes, curhatRes, rujukanRes, asesmenRes] = await Promise.all([
        supabase
          .from('bk_konseling')
          .select('*, guru_bk:guru_bk_id (id, nama_lengkap), kategori:kategori_id (id, nama, bidang)')
          .eq('siswa_id', sid)
          .order('tanggal', { ascending: false }),
        supabase
          .from('bk_curhat')
          .select('*, guru_bk:guru_bk_id (id, nama_lengkap), kategori:kategori_id (id, nama, bidang)')
          .eq('siswa_id', sid)
          .order('created_at', { ascending: false }),
        supabase
          .from('bk_rujukan')
          .select('*, pengrujuk:pengrujuk_id (id, nama_lengkap), guru_bk:guru_bk_id (id, nama_lengkap)')
          .eq('siswa_id', sid)
          .order('tanggal_rujuk', { ascending: false }),
        supabase
          .from('bk_asesmen')
          .select('*, guru_bk:guru_bk_id (id, nama_lengkap)')
          .eq('siswa_id', sid)
          .order('tanggal', { ascending: false }),
      ]);

      const items: TimelineItem[] = [];

      // Konseling
      (konselingRes.data ?? []).forEach((k: any) => {
        items.push({
          id: `konseling-${k.id}`,
          tipe: 'konseling',
          tanggal: k.tanggal,
          timestamp: `${k.tanggal}T${k.waktu_mulai ?? '00:00'}:00+07:00`,
          icon: MessageSquare,
          color: 'text-purple-400',
          bg: 'bg-purple-500/15',
          border: 'border-purple-500/30',
          title: k.topik,
          subtitle: `${k.tipe} · ${k.guru_bk?.nama_lengkap ?? '-'}`,
          detail: k.hasil ?? k.catatan_materi ?? k.deskripsi ?? undefined,
          badge: { text: k.status, style: getStatusKonselingBadge(k.status) },
          extra: [
            { label: 'Kode Sesi', value: k.kode_sesi ?? '-' },
            ...(k.kategori ? [{ label: 'Kategori', value: k.kategori.nama }] : []),
            ...(k.tindak_lanjut ? [{ label: 'Tindak Lanjut', value: k.tindak_lanjut }] : []),
          ],
        });
      });

      // Curhat
      (curhatRes.data ?? []).forEach((c: any) => {
        items.push({
          id: `curhat-${c.id}`,
          tipe: 'curhat',
          tanggal: c.created_at.split('T')[0],
          timestamp: c.created_at,
          icon: Heart,
          color: 'text-rose-400',
          bg: 'bg-rose-500/15',
          border: 'border-rose-500/30',
          title: 'Curhat Siswa',
          subtitle: c.is_anonim ? 'Anonim' : 'Terbuka',
          detail: c.pesan,
          badge: { text: c.status, style: getStatusCurhatBadge(c.status) },
          extra: [
            { label: 'Urgensi', value: c.tingkat_urgensi },
            ...(c.balasan ? [{ label: 'Balasan BK', value: c.balasan }] : []),
          ],
        });
      });

      // Rujukan
      (rujukanRes.data ?? []).forEach((r: any) => {
        items.push({
          id: `rujukan-${r.id}`,
          tipe: 'rujukan',
          tanggal: r.tanggal_rujuk,
          timestamp: `${r.tanggal_rujuk}T00:00:00+07:00`,
          icon: UserCheck,
          color: 'text-indigo-400',
          bg: 'bg-indigo-500/15',
          border: 'border-indigo-500/30',
          title: 'Rujukan Masalah',
          subtitle: `Dari: ${r.sumber} — ${r.pengrujuk?.nama_lengkap ?? '-'}`,
          detail: r.alasan,
          badge: { text: r.status, style: getStatusRujukanBadge(r.status) },
          extra: [
            { label: 'Prioritas', value: r.prioritas },
            ...(r.deskripsi ? [{ label: 'Deskripsi', value: r.deskripsi }] : []),
            ...(r.catatan_penanganan ? [{ label: 'Catatan Penanganan', value: r.catatan_penanganan }] : []),
          ],
        });
      });

      // Asesmen
      (asesmenRes.data ?? []).forEach((a: any) => {
        const jawaban = (a.jawaban as Record<string, string>) ?? {};
        const detailJawaban = Object.entries(jawaban)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' · ');

        items.push({
          id: `asesmen-${a.id}`,
          tipe: 'asesmen',
          tanggal: a.tanggal,
          timestamp: `${a.tanggal}T00:00:00+07:00`,
          icon: ClipboardList,
          color: 'text-amber-400',
          bg: 'bg-amber-500/15',
          border: 'border-amber-500/30',
          title: `Asesmen: ${a.jenis}`,
          subtitle: a.guru_bk?.nama_lengkap ?? '-',
          detail: detailJawaban || a.rekomendasi || undefined,
          extra: a.rekomendasi
            ? [{ label: 'Rekomendasi', value: a.rekomendasi }]
            : undefined,
        });
      });

      // Sort descending by timestamp
      items.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setTimeline(items);
      setSummary({
        konseling: konselingRes.data?.length ?? 0,
        curhat: curhatRes.data?.length ?? 0,
        rujukan: rujukanRes.data?.length ?? 0,
        asesmen: asesmenRes.data?.length ?? 0,
      });
    } catch (err: any) {
      console.error('Timeline error:', err);
      showToast('error', 'Gagal memuat timeline: ' + (err.message || 'Error'));
      setTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSiswaId) {
      fetchTimeline(selectedSiswaId);
    } else {
      setTimeline([]);
      setSummary({ konseling: 0, curhat: 0, rujukan: 0, asesmen: 0 });
    }
  }, [selectedSiswaId, fetchTimeline]);

  const selectedSiswa = useMemo(
    () => siswaList.find((s) => String(s.id) === selectedSiswaId),
    [siswaList, selectedSiswaId]
  );

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = ['Tanggal', 'Tipe', 'Judul', 'Keterangan', 'Status'];
  const exportRows = timeline.map((t) => [
    t.tanggal,
    t.tipe.charAt(0).toUpperCase() + t.tipe.slice(1),
    t.title,
    t.subtitle,
    t.badge?.text ?? '-',
  ]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div>
        <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
          <History className="text-purple-400" size={20} /> Profil & Rekam Jejak Siswa
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Timeline lengkap pendampingan BK: konseling, curhat, rujukan, dan asesmen
        </p>
      </div>

      {/* SISWA PICKER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Pilih Siswa
        </label>
        {loadingSiswa ? (
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Loader2 size={14} className="animate-spin" /> Memuat daftar siswa...
          </div>
        ) : (
          <SearchableSelect
            options={siswaList.map((s) => ({
              value: String(s.id),
              label: s.nama_lengkap,
              hint: `${s.kelas?.nama_kelas ?? '-'} · NISN: ${s.nisn}`,
            }))}
            value={selectedSiswaId}
            onChange={setSelectedSiswaId}
            placeholder="Pilih siswa untuk melihat profil lengkap..."
            searchPlaceholder="Cari nama / NISN..."
            emptyMessage="Siswa tidak ditemukan"
          />
        )}
      </div>

      {/* PROFILE CARD + SUMMARY */}
      {selectedSiswa && (
        <>
          {/* Header Profil */}
          <div className="bg-gradient-to-br from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/10">
                <User size={28} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                  Profil BK
                </p>
                <h3 className="text-xl font-extrabold text-slate-100 tracking-tight truncate">
                  {selectedSiswa.nama_lengkap}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span className="font-mono">NISN: {selectedSiswa.nisn}</span>
                  {selectedSiswa.kelas && (
                    <span className="flex items-center gap-1">
                      <BookOpen size={11} className="text-indigo-400" />
                      {selectedSiswa.kelas.nama_kelas}
                    </span>
                  )}
                  <span>
                    {selectedSiswa.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              icon={MessageSquare}
              label="Sesi Konseling"
              value={summary.konseling}
              color="purple"
            />
            <SummaryCard
              icon={Heart}
              label="Curhat"
              value={summary.curhat}
              color="rose"
            />
            <SummaryCard
              icon={UserCheck}
              label="Rujukan"
              value={summary.rujukan}
              color="indigo"
            />
            <SummaryCard
              icon={ClipboardList}
              label="Asesmen"
              value={summary.asesmen}
              color="amber"
            />
          </div>

          {/* Timeline Header + Export */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp size={16} className="text-purple-400" />
              Timeline Pendampingan ({timeline.length})
            </h4>
            {timeline.length > 0 && (
              <ExportImportButtons
                filename={`profil_bk_${selectedSiswa.nisn}_${new Date().toISOString().slice(0, 10)}`}
                title={`Profil BK — ${selectedSiswa.nama_lengkap}`}
                headers={exportHeaders}
                rows={exportRows}
                showImport={false}
              />
            )}
          </div>

          {/* Timeline */}
          {loadingTimeline ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <Loader2 className="animate-spin mx-auto mb-2 text-purple-400" size={28} />
              Memuat timeline...
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
              <Sparkles size={36} className="mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-300">
                Belum ada catatan pendampingan
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Siswa ini belum pernah tercatat dalam konseling, curhat, rujukan,
                atau asesmen.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-800 ml-4 space-y-4 pl-6">
              {timeline.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="relative">
                    {/* Timeline dot */}
                    <div
                      className={`absolute -left-[35px] top-1.5 w-6 h-6 rounded-full ${item.bg} ${item.border} border-2 flex items-center justify-center ${item.color}`}
                    >
                      <Icon size={11} />
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-all">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-100 truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {item.subtitle}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {item.badge && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${item.badge.style}`}
                            >
                              {item.badge.text}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail */}
                      {item.detail && (
                        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 mt-2">
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-3">
                            {item.detail}
                          </p>
                        </div>
                      )}

                      {/* Extra fields */}
                      {item.extra && item.extra.length > 0 && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 space-y-1.5">
                          {item.extra.map((e) => (
                            <div
                              key={e.label}
                              className="flex items-start justify-between gap-3 text-[11px]"
                            >
                              <span className="text-slate-500 font-semibold shrink-0">
                                {e.label}:
                              </span>
                              <span className="text-slate-300 text-right truncate max-w-[60%]">
                                {e.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800/40">
                        <Calendar size={10} />
                        {formatDateShort(item.tanggal)}
                        <Clock size={10} className="ml-2" />
                        {formatDateTimeWib(item.timestamp).split(',')[1]?.trim() ?? '-'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Empty state — belum pilih siswa */}
      {!selectedSiswa && !loadingSiswa && (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
          <User size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            Belum ada siswa terpilih
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Pilih siswa di atas untuk melihat profil dan timeline lengkap
            pendampingan BK-nya.
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUMMARY CARD
// =============================================================================
type SumColor = 'purple' | 'rose' | 'indigo' | 'amber';

const COLOR_MAP: Record<SumColor, { bg: string; text: string; border: string }> = {
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
};

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: typeof Heart; label: string; value: number; color: SumColor;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-base font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}