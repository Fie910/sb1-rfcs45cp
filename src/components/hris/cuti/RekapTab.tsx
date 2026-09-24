// src/components/hris/cuti/RekapTab.tsx
// Tab Rekap — statistik kepegawaian & export.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, BarChart3, Users, Calendar, TrendingUp, Download,
  RefreshCw, FileSpreadsheet, Award,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import {
  getStatusCutiBadge, getJenisCutiBadge,
  formatJumlahHari, formatDateShort,
} from '../shared';
import type { HrisCutiWithRelations, HrisSaldoCuti, HrisJenisCuti, Guru } from '@/types/database';

export function RekapTab() {
  const [loading, setLoading] = useState(true);
  const [cutiList, setCutiList] = useState<HrisCutiWithRelations[]>([]);
  const [saldoList, setSaldoList] = useState<HrisSaldoCuti[]>([]);
  const [jenisList, setJenisList] = useState<HrisJenisCuti[]>([]);
  const [guruList, setGuruList] = useState<(Guru & { divisi_nama?: string | null })[]>([]);

  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const startOfYear = `${filterTahun}-01-01`;
      const endOfYear = `${filterTahun}-12-31`;

      const [cutiRes, saldoRes, jenisRes, guruRes] = await Promise.all([
        supabase
          .from('v_hris_cuti_lengkap')
          .select('*')
          .gte('tanggal_mulai', startOfYear)
          .lte('tanggal_mulai', endOfYear)
          .order('tanggal_mulai', { ascending: false }),
        supabase
          .from('hris_saldo_cuti')
          .select('*')
          .eq('tahun', filterTahun),
        supabase
          .from('hris_jenis_cuti')
          .select('*')
          .eq('is_aktif', true)
          .order('urutan_tampil'),
        supabase
          .from('gurus')
          .select('id, nip, nama_lengkap, email, role, jenis_ptk, status_kepegawaian, divisi_id, divisis:divisi_id(nama_divisi)')
          .order('nama_lengkap'),
      ]);

      setCutiList((cutiRes.data as HrisCutiWithRelations[]) ?? []);
      setSaldoList((saldoRes.data as HrisSaldoCuti[]) ?? []);
      setJenisList((jenisRes.data as HrisJenisCuti[]) ?? []);
      setGuruList(
        ((guruRes.data as any[]) ?? []).map((g) => ({
          ...g,
          divisi_nama: g.divisis?.nama_divisi ?? null,
        }))
      );
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [filterTahun]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTERED
  // ==========================================================================
  const filtered = useMemo(() => {
    return cutiList.filter((c) => {
      if (filterJenis && c.jenis_id !== filterJenis) return false;
      if (filterStatus && c.status !== filterStatus) return false;
      return true;
    });
  }, [cutiList, filterJenis, filterStatus]);

  // ==========================================================================
  // STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const total = filtered.length;
    const disetujui = filtered.filter((c) => c.status === 'Disetujui');
    const ditolak = filtered.filter((c) => c.status === 'Ditolak').length;
    const menunggu = filtered.filter((c) => c.status !== 'Disetujui' && c.status !== 'Ditolak' && c.status !== 'Dibatalkan').length;

    // Per jenis
    const byJenis = new Map<string, { nama: string; warna: string; count: number; totalHari: number }>();
    disetujui.forEach((c) => {
      const key = c.jenis_id;
      const existing = byJenis.get(key) ?? {
        nama: c.jenis_nama ?? '-',
        warna: c.jenis_warna ?? 'slate',
        count: 0,
        totalHari: 0,
      };
      existing.count++;
      existing.totalHari += c.jumlah_hari;
      byJenis.set(key, existing);
    });

    // Top pegawai (by jumlah cuti disetujui)
    const byGuru = new Map<string, { nama: string; nip: string | null; count: number; totalHari: number }>();
    disetujui.forEach((c) => {
      const key = c.guru_id;
      const existing = byGuru.get(key) ?? {
        nama: c.guru_nama ?? '-',
        nip: c.guru_nip ?? null,
        count: 0,
        totalHari: 0,
      };
      existing.count++;
      existing.totalHari += c.jumlah_hari;
      byGuru.set(key, existing);
    });

    const topGuru = Array.from(byGuru.values())
      .sort((a, b) => b.totalHari - a.totalHari)
      .slice(0, 10);

    return {
      total,
      disetujui: disetujui.length,
      ditolak,
      menunggu,
      totalHariDisetujui: disetujui.reduce((s, c) => s + c.jumlah_hari, 0),
      byJenis: Array.from(byJenis.values()).sort((a, b) => b.count - a.count),
      topGuru,
    };
  }, [filtered]);

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = [
    'No Pengajuan', 'Nama', 'NIP', 'Divisi', 'Jenis', 'Mulai', 'Selesai',
    'Jumlah Hari', 'Status', 'Approved By', 'Alasan',
  ];
  const exportRows = filtered.map((c) => [
    c.nomor_pengajuan ?? '-',
    c.guru_nama ?? '-',
    c.guru_nip ?? '-',
    c.guru_divisi_nama ?? '-',
    c.jenis_nama ?? '-',
    c.tanggal_mulai,
    c.tanggal_selesai,
    c.jumlah_hari,
    c.status,
    c.approver_nama ?? '-',
    c.alasan,
  ]);

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

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <BarChart3 className="text-indigo-400" size={20} /> Rekap & Laporan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistik cuti & izin tahun {filterTahun}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <ExportImportButtons
            filename={`rekap_cuti_${filterTahun}`}
            title="Rekap Cuti & Izin"
            headers={exportHeaders}
            rows={exportRows}
            showImport={false}
          />
        </div>
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Tahun</label>
          <input
            type="number"
            min={2020}
            max={2100}
            value={filterTahun}
            onChange={(e) => setFilterTahun(Number(e.target.value) || new Date().getFullYear())}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Jenis</label>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Semua Jenis</option>
            {jenisList.map((j) => (
              <option key={j.id} value={j.id}>{j.nama}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Diajukan">Diajukan</option>
            <option value="Disetujui Atasan">Disetujui Atasan</option>
            <option value="Disetujui HR">Disetujui HR</option>
            <option value="Disetujui Kepsek">Disetujui Kepsek</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Ditolak">Ditolak</option>
            <option value="Dibatalkan">Dibatalkan</option>
          </select>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigKpi icon={FileSpreadsheet} label="Total Pengajuan" value={stats.total} color="indigo" />
        <BigKpi icon={Award} label="Disetujui" value={stats.disetujui} subtitle={`${stats.totalHariDisetujui} hari`} color="emerald" />
        <BigKpi icon={Loader2} label="Menunggu" value={stats.menunggu} color="amber" />
        <BigKpi icon={TrendingUp} label="Ditolak" value={stats.ditolak} color="rose" />
      </div>

      {/* DISTRIBUSI JENIS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
          <Calendar size={12} /> Distribusi Per Jenis
        </h3>
        {stats.byJenis.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-6">Belum ada data</p>
        ) : (
          <div className="space-y-2.5">
            {stats.byJenis.map((j) => {
              const persen = stats.disetujui > 0 ? (j.count / stats.disetujui) * 100 : 0;
              return (
                <div key={j.nama}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getJenisCutiBadge(j.warna)}`}>
                      {j.nama}
                    </span>
                    <span className="text-[11px] text-slate-300 font-bold">
                      {j.count} pengajuan · {j.totalHari} hari
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

      {/* TOP PEGAWAI */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
          <Users size={12} /> Top 10 Pegawai (Total Hari Cuti Disetujui)
        </h3>
        {stats.topGuru.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-6">Belum ada data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Pegawai</th>
                  <th className="text-center px-3 py-2">Pengajuan</th>
                  <th className="text-center px-3 py-2">Total Hari</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats.topGuru.map((g, i) => (
                  <tr key={g.nama} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-bold text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-bold text-slate-200 truncate max-w-[200px]">{g.nama}</p>
                      <p className="text-[10px] font-mono text-indigo-400">{g.nip ?? '-'}</p>
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-slate-300">{g.count}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs font-bold text-emerald-400">{g.totalHari}</span>
                      <span className="text-[10px] text-slate-500 ml-0.5">hari</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SALDO SEMUA PEGAWAI */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
          <TrendingUp size={12} /> Saldo Cuti Tahunan Semua Pegawai
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase">
              <tr>
                <th className="text-left px-3 py-2">Pegawai</th>
                <th className="text-left px-3 py-2">Divisi</th>
                <th className="text-center px-3 py-2">Awal</th>
                <th className="text-center px-3 py-2">Terpakai</th>
                <th className="text-center px-3 py-2">Sisa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {guruList.map((g) => {
                const s = saldoList.find((x) => x.guru_id === g.id);
                const awal = s?.saldo_awal ?? 12;
                const terpakai = s?.saldo_terpakai ?? 0;
                const sisa = s?.saldo_sisa ?? 12;
                return (
                  <tr key={g.id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2">
                      <p className="font-bold text-slate-200 truncate max-w-[200px]">{g.nama_lengkap}</p>
                      <p className="text-[10px] font-mono text-indigo-400">{g.nip ?? '-'}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-[11px]">
                      {g.divisi_nama ?? '-'}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-slate-300">{awal}</td>
                    <td className="px-3 py-2 text-center font-semibold text-amber-400">{terpakai}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-bold ${sisa > 5 ? 'text-emerald-400' : sisa > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {sisa}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: BigKpi
// =============================================================================
function BigKpi({ icon: Icon, label, value, subtitle, color }: {
  icon: any; label: string; value: number; subtitle?: string;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
  const cm: Record<string, string> = {
    indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };
  const c = cm[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl ${c} border flex items-center justify-center shrink-0 mb-2`}>
        <Icon size={16} />
      </div>
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className={`text-2xl font-extrabold mt-0.5 ${c.split(' ')[1]}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}