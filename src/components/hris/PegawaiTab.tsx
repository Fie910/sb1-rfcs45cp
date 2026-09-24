// src/components/hris/PegawaiTab.tsx
// Tab Data Pegawai — daftar lengkap semua guru & tendik.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, X, Users, Filter, UserCheck, Eye, Edit3,
  User, Mail, Phone, Briefcase, Calendar, TrendingUp,
  GraduationCap, ShieldCheck, AlertTriangle, Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { ModalDetailProfil } from './ModalDetailProfil';
import {
  getStatusKepegawaianBadge, getJenisPtkBadge,
  hitungKelengkapanProfil, hitungMasaKerja, formatDateShort,
  INPUT_CLASS, STATUS_KEPEGAWAIAN_OPTIONS, JENIS_PTK_OPTIONS,
} from './shared';
import type { Guru } from '@/types/database';
import { useAuth } from '@/context/AuthContext';

// =============================================================================
// TYPES
// =============================================================================
type PegawaiRow = {
  id: string;
  nip: string | null;
  nama_lengkap: string;
  email: string;
  role: string;
  jenis_ptk: string | null;
  status_kepegawaian: string | null;
  tanggal_bergabung: string | null;
  mata_pelajaran: string | null;
  // From hris_profil_pegawai
  hris_profil_pegawai: {
    nik: string | null;
    tanggal_lahir: string | null;
    no_hp: string | null;
    alamat_ktp: string | null;
    bank_nomor_rekening: string | null;
    bpjs_kesehatan_no: string | null;
    nama_kontak_darurat: string | null;
    foto_profil_url: string | null;
  }[] | null;
  // Aggregates
  total_dokumen: number;
  total_pendidikan: number;
  total_pekerjaan: number;
  total_keluarga: number;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function PegawaiTab() {
  const [list, setList] = useState<PegawaiRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterKelengkapan, setFilterKelengkapan] = useState('');

  // Modal
  const [detailTarget, setDetailTarget] = useState<PegawaiRow | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch guru + profil + doc/pendidikan/pekerjaan/keluarga count
      const [guruRes, profilRes, dokRes, pendRes, kerjaRes, kelRes] = await Promise.all([
        supabase
          .from('gurus')
          .select('id, nip, nama_lengkap, email, role, jenis_ptk, status_kepegawaian, tanggal_bergabung, mata_pelajaran')
          .order('nama_lengkap'),
        supabase.from('hris_profil_pegawai').select('*'),
        supabase.from('hris_dokumen').select('guru_id'),
        supabase.from('hris_pendidikan').select('guru_id'),
        supabase.from('hris_pekerjaan').select('guru_id'),
        supabase.from('hris_keluarga').select('guru_id'),
      ]);

      if (guruRes.error) throw guruRes.error;

      const gurus = (guruRes.data ?? []) as any[];
      const profiles = profilRes.data ?? [];

      // Build profile map (1:1 by id)
      const profilMap = new Map<string, any>();
      profiles.forEach((p: any) => profilMap.set(p.id, p));

      // Count aggregates per guru
      const countBy = (arr: any[]) => {
        const m = new Map<string, number>();
        arr.forEach((r) => m.set(r.guru_id, (m.get(r.guru_id) ?? 0) + 1));
        return m;
      };
      const dokCount = countBy(dokRes.data ?? []);
      const pendCount = countBy(pendRes.data ?? []);
      const kerjaCount = countBy(kerjaRes.data ?? []);
      const kelCount = countBy(kelRes.data ?? []);

      const rows: PegawaiRow[] = gurus.map((g) => ({
        id: g.id,
        nip: g.nip,
        nama_lengkap: g.nama_lengkap,
        email: g.email,
        role: g.role,
        jenis_ptk: g.jenis_ptk,
        status_kepegawaian: g.status_kepegawaian,
        tanggal_bergabung: g.tanggal_bergabung,
        mata_pelajaran: g.mata_pelajaran,
        hris_profil_pegawai: profilMap.has(g.id) ? [profilMap.get(g.id)] : [],
        total_dokumen: dokCount.get(g.id) ?? 0,
        total_pendidikan: pendCount.get(g.id) ?? 0,
        total_pekerjaan: kerjaCount.get(g.id) ?? 0,
        total_keluarga: kelCount.get(g.id) ?? 0,
      }));

      setList(rows);
    } catch (err: any) {
      showToast('error', 'Gagal memuat data pegawai: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ==========================================================================
  // FILTERED + STATS
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((g) => {
      if (filterStatus && g.status_kepegawaian !== filterStatus) return false;
      if (filterJenis && g.jenis_ptk !== filterJenis) return false;

      const prof = g.hris_profil_pegawai?.[0];
      const persen = hitungKelengkapanProfil(prof);

      if (filterKelengkapan === 'lengkap' && persen < 80) return false;
      if (filterKelengkapan === 'kurang' && persen >= 80) return false;
      if (filterKelengkapan === 'belum' && prof) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          g.nama_lengkap.toLowerCase().includes(q) ||
          (g.nip ?? '').toLowerCase().includes(q) ||
          g.email.toLowerCase().includes(q) ||
          (g.mata_pelajaran ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterStatus, filterJenis, filterKelengkapan, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const tetap = list.filter((g) => g.status_kepegawaian === 'Tetap').length;
    const kontrak = list.filter((g) => g.status_kepegawaian === 'Kontrak').length;
    const lainnya = total - tetap - kontrak;
    const denganProfil = list.filter((g) => g.hris_profil_pegawai?.[0]).length;
    return { total, tetap, kontrak, lainnya, denganProfil };
  }, [list]);

  const resetFilter = () => {
    setSearch(''); setFilterStatus(''); setFilterJenis(''); setFilterKelengkapan('');
  };
  const hasFilter = search || filterStatus || filterJenis || filterKelengkapan;

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = [
    'NIP', 'Nama Lengkap', 'Email', 'Jenis PTK', 'Status Kepegawaian',
    'Tanggal Bergabung', 'Masa Kerja', 'No. HP', 'Kelengkapan Profil (%)',
    'Jumlah Dokumen',
  ];
  const exportRows = filtered.map((g) => {
    const prof = g.hris_profil_pegawai?.[0];
    return [
      g.nip ?? '-',
      g.nama_lengkap,
      g.email,
      g.jenis_ptk ?? '-',
      g.status_kepegawaian ?? '-',
      g.tanggal_bergabung ?? '-',
      hitungMasaKerja(g.tanggal_bergabung),
      prof?.no_hp ?? '-',
      `${hitungKelengkapanProfil(prof)}%`,
      g.total_dokumen,
    ];
  });

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Users className="text-indigo-400" size={20} /> Data Pegawai
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} pegawai
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Users} label="Total Pegawai" value={stats.total} color="indigo" />
        <KpiCard icon={UserCheck} label="Tetap" value={stats.tetap} color="emerald" />
        <KpiCard icon={Briefcase} label="Kontrak" value={stats.kontrak} color="indigo" />
        <KpiCard icon={User} label="Lainnya" value={stats.lainnya} color="amber" />
        <KpiCard icon={ShieldCheck} label="Punya Profil" value={stats.denganProfil} color="teal" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" /> Filter & Pencarian
          </div>
          {hasFilter && (
            <button onClick={resetFilter}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIP, email..."
              className={`${INPUT_CLASS} pl-10`} />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer`}>
            <option value="">Semua Status</option>
            {STATUS_KEPEGAWAIAN_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer`}>
            <option value="">Semua Jenis PTK</option>
            {JENIS_PTK_OPTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
          <select value={filterKelengkapan} onChange={(e) => setFilterKelengkapan(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer`}>
            <option value="">Semua Kelengkapan</option>
            <option value="belum">Belum Ada Profil</option>
            <option value="kurang">Perlu Dilengkapi (&lt;80%)</option>
            <option value="lengkap">Lengkap (≥80%)</option>
          </select>
        </div>

        <div className="flex justify-end">
          <ExportImportButtons
            filename={`data_pegawai_${new Date().toISOString().slice(0, 10)}`}
            title="Data Pegawai"
            headers={exportHeaders}
            rows={exportRows}
            showImport={false}
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat data pegawai...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Users size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada pegawai cocok' : 'Belum ada data pegawai'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Pegawai</th>
                  <th className="text-left px-4 py-3">Jenis & Status</th>
                  <th className="text-left px-4 py-3">Kontak</th>
                  <th className="text-left px-4 py-3">Masa Kerja</th>
                  <th className="text-center px-4 py-3">Kelengkapan</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((g) => {
                  const prof = g.hris_profil_pegawai?.[0];
                  const persen = hitungKelengkapanProfil(prof);
                  return (
                    <tr key={g.id} className="hover:bg-slate-800/30 transition group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                            {prof?.foto_profil_url ? (
                              <img src={prof.foto_profil_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User size={16} className="text-slate-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 text-xs truncate max-w-[200px]">
                              {g.nama_lengkap}
                            </p>
                            <p className="text-[10px] font-mono text-indigo-400">
                              NIP: {g.nip ?? '-'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {g.jenis_ptk && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisPtkBadge(g.jenis_ptk)}`}>
                              {g.jenis_ptk}
                            </span>
                          )}
                          {g.status_kepegawaian && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusKepegawaianBadge(g.status_kepegawaian)}`}>
                              {g.status_kepegawaian}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <p className="flex items-center gap-1 truncate max-w-[180px]">
                            <Mail size={10} className="text-slate-500 shrink-0" />
                            {g.email}
                          </p>
                          {prof?.no_hp && (
                            <p className="flex items-center gap-1">
                              <Phone size={10} className="text-slate-500 shrink-0" />
                              {prof.no_hp}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {g.tanggal_bergabung ? (
                          <div className="text-[11px]">
                            <p className="text-slate-300 font-semibold">
                              {hitungMasaKerja(g.tanggal_bergabung)}
                            </p>
                            <p className="text-[9px] text-slate-500">
                              Sejak {formatDateShort(g.tanggal_bergabung)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <KelengkapanBar persen={persen} hasProfil={Boolean(prof)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDetailTarget(g)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold transition cursor-pointer"
                        >
                          <Eye size={11} /> Lihat
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETAIL */}
      {detailTarget && (
        <ModalDetailProfil
          open={Boolean(detailTarget)}
          onClose={() => setDetailTarget(null)}
          pegawai={detailTarget as any}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================
type KpiColor = 'indigo' | 'emerald' | 'amber' | 'teal';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Users; label: string; value: number; color: KpiColor;
}) {
  const c = CM[color];
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

function KelengkapanBar({ persen, hasProfil }: { persen: number; hasProfil: boolean }) {
  if (!hasProfil) {
    return (
      <div className="inline-flex flex-col items-center gap-1">
        <span className="text-[9px] font-bold text-slate-500 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
          Belum ada
        </span>
      </div>
    );
  }
  const color = persen >= 80 ? 'text-emerald-400' : persen >= 50 ? 'text-amber-400' : 'text-rose-400';
  const bgColor = persen >= 80 ? 'bg-emerald-500' : persen >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${bgColor} rounded-full transition-all`} style={{ width: `${persen}%` }} />
      </div>
      <span className={`text-[10px] font-bold ${color}`}>{persen}%</span>
    </div>
  );
}