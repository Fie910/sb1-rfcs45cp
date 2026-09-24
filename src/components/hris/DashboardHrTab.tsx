// src/components/hris/DashboardHrTab.tsx
// Tab Dashboard HR — KPI agregat kepegawaian, distribusi, & alert (manager only).

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Users, UserCheck, ShieldCheck, AlertTriangle,
  FileText, TrendingUp, RefreshCw, XCircle, Clock, Award,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import {
  getStatusKepegawaianBadge, getJenisPtkBadge,
  hitungKelengkapanProfil, hitungMasaKerja,
  formatDateShort,
  STATUS_KEPEGAWAIAN_OPTIONS, JENIS_PTK_OPTIONS,
} from './shared';

// =============================================================================
// TYPES
// =============================================================================
type GuruRow = {
  id: string;
  nip: string | null;
  nama_lengkap: string;
  email: string;
  jenis_ptk: string | null;
  status_kepegawaian: string | null;
  tanggal_bergabung: string | null;
};

type ProfilRow = {
  id: string;
  nik: string | null;
  tanggal_lahir: string | null;
  no_hp: string | null;
  alamat_ktp: string | null;
  bank_nomor_rekening: string | null;
  bpjs_kesehatan_no: string | null;
  nama_kontak_darurat: string | null;
  foto_profil_url: string | null;
};

type DokRow = {
  id: string;
  guru_id: string;
  kategori: string;
  nama_dokumen: string;
  tanggal_expired: string | null;
  is_verified: boolean;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function DashboardHrTab() {
  const [loading, setLoading] = useState(true);

  const [gurus, setGurus] = useState<GuruRow[]>([]);
  const [profiles, setProfiles] = useState<ProfilRow[]>([]);
  const [docs, setDocs] = useState<DokRow[]>([]);
  const [counts, setCounts] = useState({
    pendidikan: 0,
    pekerjaan: 0,
    keluarga: 0,
  });

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [g, p, d, pe, pk, kl] = await Promise.all([
        supabase
          .from('gurus')
          .select('id, nip, nama_lengkap, email, jenis_ptk, status_kepegawaian, tanggal_bergabung')
          .order('nama_lengkap'),
        supabase.from('hris_profil_pegawai').select('*'),
        supabase
          .from('hris_dokumen')
          .select('id, guru_id, kategori, nama_dokumen, tanggal_expired, is_verified'),
        supabase.from('hris_pendidikan').select('guru_id'),
        supabase.from('hris_pekerjaan').select('guru_id'),
        supabase.from('hris_keluarga').select('guru_id'),
      ]);
      if (g.error) throw g.error;

      setGurus((g.data as GuruRow[]) ?? []);
      setProfiles((p.data as ProfilRow[]) ?? []);
      setDocs((d.data as DokRow[]) ?? []);
      setCounts({
        pendidikan: (pe.data ?? []).length,
        pekerjaan: (pk.data ?? []).length,
        keluarga: (kl.data ?? []).length,
      });
    } catch (err: any) {
      showToast('error', 'Gagal memuat dashboard: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // DERIVED DATA
  // ==========================================================================
  const profilMap = useMemo(() => {
    const m = new Map<string, ProfilRow>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const docsByGuru = useMemo(() => {
    const m = new Map<string, DokRow[]>();
    docs.forEach((d) => {
      const arr = m.get(d.guru_id) ?? [];
      arr.push(d);
      m.set(d.guru_id, arr);
    });
    return m;
  }, [docs]);

  // Helper hitung expiry
  const hitungExpiry = (tanggal: string | null): 'expired' | 'soon' | 'valid' | 'na' => {
    if (!tanggal) return 'na';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(`${tanggal.split('T')[0]}T00:00:00+07:00`);
    const diff = Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'expired';
    if (diff <= 90) return 'soon';
    return 'valid';
  };

  // Stats
  const stats = useMemo(() => {
    const total = gurus.length;

    // Distribusi status kepegawaian
    const byStatus: Record<string, number> = {};
    STATUS_KEPEGAWAIAN_OPTIONS.forEach((s) => (byStatus[s] = 0));
    gurus.forEach((g) => {
      if (g.status_kepegawaian) {
        byStatus[g.status_kepegawaian] = (byStatus[g.status_kepegawaian] ?? 0) + 1;
      }
    });

    // Distribusi jenis PTK
    const byJenis: Record<string, number> = {};
    JENIS_PTK_OPTIONS.forEach((j) => (byJenis[j] = 0));
    gurus.forEach((g) => {
      if (g.jenis_ptk) {
        byJenis[g.jenis_ptk] = (byJenis[g.jenis_ptk] ?? 0) + 1;
      }
    });

    // Kelengkapan profil
    let profilLengkap = 0;   // ≥80%
    let profilKurang = 0;    // <80%
    let profilKosong = 0;    // belum ada
    gurus.forEach((g) => {
      const prof = profilMap.get(g.id);
      if (!prof) { profilKosong++; return; }
      const persen = hitungKelengkapanProfil(prof);
      if (persen >= 80) profilLengkap++;
      else profilKurang++;
    });

    // Dokumen
    let dokTotal = 0, dokVerified = 0, dokExpired = 0, dokSoon = 0;
    docs.forEach((d) => {
      dokTotal++;
      if (d.is_verified) dokVerified++;
      const e = hitungExpiry(d.tanggal_expired);
      if (e === 'expired') dokExpired++;
      else if (e === 'soon') dokSoon++;
    });

    // Pegawai belum punya kontak darurat
    let tanpaKontakDarurat = 0;
    gurus.forEach((g) => {
      const prof = profilMap.get(g.id);
      if (!prof?.nama_kontak_darurat) tanpaKontakDarurat++;
    });

    return {
      total,
      byStatus,
      byJenis,
      profilLengkap,
      profilKurang,
      profilKosong,
      dokTotal,
      dokVerified,
      dokExpired,
      dokSoon,
      tanpaKontakDarurat,
    };
  }, [gurus, profilMap, docs]);

  // Pegawai yang butuh perhatian (top 10)
  const perluPerhatian = useMemo(() => {
    const arr = gurus.map((g) => {
      const prof = profilMap.get(g.id);
      const d = docsByGuru.get(g.id) ?? [];
      const persen = hitungKelengkapanProfil(prof);
      const dokExpired = d.filter((x) => hitungExpiry(x.tanggal_expired) === 'expired').length;
      const dokSoon = d.filter((x) => hitungExpiry(x.tanggal_expired) === 'soon').length;
      const reasons: string[] = [];
      if (!prof) reasons.push('Belum isi profil');
      else if (persen < 50) reasons.push(`Profil ${persen}%`);
      if (dokExpired > 0) reasons.push(`${dokExpired} dok expired`);
      if (dokSoon > 0) reasons.push(`${dokSoon} dok akan expired`);
      if (!prof?.nama_kontak_darurat && prof) reasons.push('Tanpa kontak darurat');

      const skor =
        (prof ? 0 : 100) + (100 - persen) + dokExpired * 20 + dokSoon * 5;

      return { guru: g, persen, alasan: reasons, skor };
    })
      .filter((x) => x.alasan.length > 0)
      .sort((a, b) => b.skor - a.skor)
      .slice(0, 10);

    return arr;
  }, [gurus, profilMap, docsByGuru]);

  // Top dokumen expired (list 5)
  const topDokExpired = useMemo(() => {
    const list = docs
      .filter((d) => hitungExpiry(d.tanggal_expired) === 'expired')
      .sort((a, b) =>
        (a.tanggal_expired ?? '').localeCompare(b.tanggal_expired ?? '')
      )
      .slice(0, 5)
      .map((d) => {
        const guru = gurus.find((g) => g.id === d.guru_id);
        return { ...d, guruNama: guru?.nama_lengkap ?? 'Unknown' };
      });
    return list;
  }, [docs, gurus]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  const persenLengkap =
    stats.total > 0 ? Math.round((stats.profilLengkap / stats.total) * 100) : 0;
  const persenVerified =
    stats.dokTotal > 0 ? Math.round((stats.dokVerified / stats.dokTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ============================ HEADER ============================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-lg shadow-purple-500/10">
            <TrendingUp size={22} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-100 tracking-tight">
              Dashboard HR
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Statistik kepegawaian, kelengkapan profil, dan expiry tracker
            </p>
          </div>
        </div>
        <button
          onClick={fetchAll}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition cursor-pointer shrink-0"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ============================ KPI CARDS ============================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigKpi
          icon={Users}
          label="Total Pegawai"
          value={stats.total}
          subtitle={`${Object.entries(stats.byStatus)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(' · ')}`}
          color="indigo"
        />
        <BigKpi
          icon={ShieldCheck}
          label="Profil Lengkap"
          value={`${persenLengkap}%`}
          subtitle={`${stats.profilLengkap} dari ${stats.total} pegawai`}
          color="emerald"
        />
        <BigKpi
          icon={FileText}
          label="Dokumen Terverifikasi"
          value={`${persenVerified}%`}
          subtitle={`${stats.dokVerified} dari ${stats.dokTotal} dokumen`}
          color="teal"
        />
        <BigKpi
          icon={AlertTriangle}
          label="Perlu Perhatian"
          value={stats.dokExpired + stats.dokSoon}
          subtitle={`${stats.dokExpired} expired · ${stats.dokSoon} akan expired`}
          color="rose"
        />
      </div>

      {/* ============================ DISTRIBUSI (2 kolom) ============================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Kepegawaian */}
        <DistributionCard
          title="Status Kepegawaian"
          icon={UserCheck}
          data={STATUS_KEPEGAWAIAN_OPTIONS.map((s) => ({
            label: s,
            value: stats.byStatus[s] ?? 0,
            badge: getStatusKepegawaianBadge(s),
          }))}
          total={stats.total}
        />

        {/* Jenis PTK */}
        <DistributionCard
          title="Jenis PTK"
          icon={Award}
          data={JENIS_PTK_OPTIONS.map((j) => ({
            label: j,
            value: stats.byJenis[j] ?? 0,
            badge: getJenisPtkBadge(j),
          }))}
          total={stats.total}
        />
      </div>

      {/* ============================ ALERT: DOKUMEN EXPIRED ============================ */}
      {topDokExpired.length > 0 && (
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle size={14} className="text-rose-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Dokumen Expired Terbaru ({stats.dokExpired})
            </h3>
          </div>
          <div className="space-y-2">
            {topDokExpired.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-rose-500/15 text-rose-400 border-rose-500/30">
                  <FileText size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {d.nama_dokumen}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {d.guruNama} · {d.kategori} · Expired:{' '}
                    {formatDateShort(d.tanggal_expired)}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-rose-500/15 text-rose-400 border-rose-500/30 shrink-0">
                  Expired
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================ PEGAWAI PERLU PERHATIAN ============================ */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Pegawai yang Perlu Perhatian
          </h3>
          <span className="text-[10px] text-slate-500 ml-1">
            ({perluPerhatian.length} item)
          </span>
        </div>

        {perluPerhatian.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
            <ShieldCheck size={28} className="mx-auto text-emerald-400 mb-2" />
            <p className="text-xs font-bold text-emerald-300">
              Semua pegawai sudah lengkap 🎉
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Tidak ada data yang perlu perhatian
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Pegawai</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-center px-3 py-2">Profil</th>
                  <th className="text-left px-3 py-2">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {perluPerhatian.map((item) => (
                  <tr
                    key={item.guru.id}
                    className="hover:bg-slate-800/30 transition"
                  >
                    <td className="px-3 py-2">
                      <p className="font-bold text-slate-200 truncate max-w-[180px]">
                        {item.guru.nama_lengkap}
                      </p>
                      <p className="text-[10px] font-mono text-indigo-400">
                        NIP: {item.guru.nip ?? '-'}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {item.guru.jenis_ptk && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisPtkBadge(
                              item.guru.jenis_ptk
                            )}`}
                          >
                            {item.guru.jenis_ptk}
                          </span>
                        )}
                        {item.guru.status_kepegawaian && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusKepegawaianBadge(
                              item.guru.status_kepegawaian
                            )}`}
                          >
                            {item.guru.status_kepegawaian}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`text-[11px] font-bold ${
                          item.persen >= 80
                            ? 'text-emerald-400'
                            : item.persen >= 50
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {item.persen}%
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {item.alasan.map((a, i) => (
                          <span
                            key={i}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================ MINI STATS ============================ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MiniStat
          icon={Award}
          label="Total Riwayat Pendidikan"
          value={counts.pendidikan}
        />
        <MiniStat
          icon={TrendingUp}
          label="Total Riwayat Pekerjaan"
          value={counts.pekerjaan}
        />
        <MiniStat
          icon={Users}
          label="Total Data Keluarga"
          value={counts.keluarga}
        />
      </div>
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================
type BigKpiColor = 'indigo' | 'emerald' | 'teal' | 'rose';
const CM_BIG: Record<
  BigKpiColor,
  { bg: string; text: string; border: string }
> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function BigKpi({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  subtitle?: string;
  color: BigKpiColor;
}) {
  const c = CM_BIG[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div
          className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}
        >
          <Icon size={16} />
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className={`text-2xl font-extrabold mt-0.5 ${c.text}`}>{value}</p>
      {subtitle && (
        <p className="text-[10px] text-slate-500 mt-1 truncate">{subtitle}</p>
      )}
    </div>
  );
}

function DistributionCard({
  title,
  icon: Icon,
  data,
  total,
}: {
  title: string;
  icon: typeof Users;
  data: { label: string; value: number; badge: string }[];
  total: number;
}) {
  const visible = data.filter((d) => d.value > 0);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-indigo-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
          {title}
        </h3>
      </div>
      {visible.length === 0 ? (
        <p className="text-[11px] text-slate-500 text-center py-4">
          Belum ada data
        </p>
      ) : (
        <div className="space-y-2.5">
          {visible.map((d) => {
            const persen = total > 0 ? (d.value / total) * 100 : 0;
            return (
              <div key={d.label}>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${d.badge}`}
                  >
                    {d.label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-300">
                    {d.value} <span className="text-slate-500 font-normal">({Math.round(persen)}%)</span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${persen}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className="text-base font-extrabold text-slate-200">{value}</p>
      </div>
    </div>
  );
}