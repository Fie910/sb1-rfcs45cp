// src/components/mitra/DashboardMitraTab.tsx
// Tab Dashboard Mitra — KPI, top mitra, expiry timeline, statistik.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, BarChart3, Building2, FileSignature, TrendingUp,
  AlertTriangle, Clock, Users, Briefcase, GraduationCap, RefreshCw,
  CheckCircle2, XCircle, Calendar, Star, Activity, Award, Bell,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import {
  getJenisMitraBadge, getJenisAktivitasBadge, getExpiryStatusBadge,
  getExpiryStatusLabel,
  formatTanggal, daysToExpiry,
  getRatingStars,
} from './shared';
import {
  JENIS_MITRA_OPTIONS, JENIS_AKTIVITAS_OPTIONS,
} from '@/types/database';
import type {
  MitraWithRelations, MouWithRelations, MitraAktivitasWithRelations,
} from '@/types/database';
import { checkAndSendMouReminders } from '@/lib/mitraNotifications';

export function DashboardMitraTab() {
  const [mitraList, setMitraList] = useState<MitraWithRelations[]>([]);
  const [mouList, setMouList] = useState<MouWithRelations[]>([]);
  const [aktivitasList, setAktivitasList] = useState<MitraAktivitasWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mitraRes, mouRes, aktRes] = await Promise.all([
        supabase.from('v_mitra_lengkap').select('*').order('nama'),
        supabase.from('v_mou_lengkap').select('*').order('tanggal_selesai', { ascending: true }),
        supabase
          .from('mitra_aktivitas')
          .select(`*, mitra:mitra!mitra_id(nama, kode_mitra)`)
          .order('tanggal', { ascending: false }),
      ]);

      if (mitraRes.error) throw mitraRes.error;

      setMitraList((mitraRes.data as MitraWithRelations[]) ?? []);
      setMouList((mouRes.data as MouWithRelations[]) ?? []);
      setAktivitasList(
        ((aktRes.data as any[]) ?? []).map((a) => ({
          ...a,
          mitra_nama: a.mitra?.nama ?? null,
          kode_mitra: a.mitra?.kode_mitra ?? null,
        }))
      );
    } catch (err: any) {
      showToast('error', 'Gagal memuat dashboard: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // STATS
  // ==========================================================================
  const stats = useMemo(() => {
    // Mitra
    const totalMitra = mitraList.length;
    const mitraAktif = mitraList.filter((m) => m.status === 'Aktif').length;
    const mitraNonaktif = mitraList.filter((m) => m.status === 'Nonaktif').length;
    const mitraBlacklist = mitraList.filter((m) => m.status === 'Blacklist').length;

    // MoU
    const totalMou = mouList.length;
    const mouAktif = mouList.filter((m) => m.status === 'Aktif');
    const mouExpiring30 = mouAktif.filter((m) => {
      const d = daysToExpiry(m.tanggal_selesai);
      return d >= 0 && d <= 30;
    }).length;
    const mouExpired = mouAktif.filter((m) => daysToExpiry(m.tanggal_selesai) < 0).length;

    // Aktivitas
    const totalAktivitas = aktivitasList.length;
    const totalSiswaPKL = aktivitasList
      .filter((a) => a.jenis === 'PKL')
      .reduce((s, a) => s + (a.jumlah_siswa ?? 0), 0);
    const totalSiswaRekrut = aktivitasList
      .filter((a) => a.jenis === 'Rekrutmen')
      .reduce((s, a) => s + (a.jumlah_siswa ?? 0), 0);
    const totalGuruPelatihan = aktivitasList
      .filter((a) => a.jenis === 'Pelatihan Guru')
      .reduce((s, a) => s + (a.jumlah_guru ?? 0), 0);

    // Distribusi jenis mitra
    const byJenisMitra: Record<string, number> = {};
    JENIS_MITRA_OPTIONS.forEach((j) => (byJenisMitra[j] = 0));
    mitraList.forEach((m) => {
      byJenisMitra[m.jenis_mitra] = (byJenisMitra[m.jenis_mitra] ?? 0) + 1;
    });

    // Distribusi jenis aktivitas
    const byJenisAktivitas: Record<string, number> = {};
    JENIS_AKTIVITAS_OPTIONS.forEach((j) => (byJenisAktivitas[j] = 0));
    aktivitasList.forEach((a) => {
      byJenisAktivitas[a.jenis] = (byJenisAktivitas[a.jenis] ?? 0) + 1;
    });

    // Aktivitas per tahun (5 tahun terakhir)
    const tahunMap = new Map<number, number>();
    aktivitasList.forEach((a) => {
      const y = new Date(a.tanggal).getFullYear();
      tahunMap.set(y, (tahunMap.get(y) ?? 0) + 1);
    });
    const tahunSorted = Array.from(tahunMap.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 5)
      .reverse();
    const maxTahun = Math.max(...tahunSorted.map(([, v]) => v), 1);

    return {
      totalMitra, mitraAktif, mitraNonaktif, mitraBlacklist,
      totalMou, mouAktifCount: mouAktif.length, mouExpiring30, mouExpired,
      totalAktivitas, totalSiswaPKL, totalSiswaRekrut, totalGuruPelatihan,
      byJenisMitra, byJenisAktivitas,
      tahunSorted, maxTahun,
    };
  }, [mitraList, mouList, aktivitasList]);

  // Top mitra by jumlah siswa PKL
  const topMitraByPKL = useMemo(() => {
    const map = new Map<string, { nama: string; kode: string | null; logo: string | null; total: number; count: number }>();
    aktivitasList
      .filter((a) => a.jenis === 'PKL' && a.mitra_id)
      .forEach((a) => {
        const existing = map.get(a.mitra_id) ?? {
          nama: a.mitra_nama ?? '-',
          kode: a.kode_mitra ?? null,
          logo: null,
          total: 0,
          count: 0,
        };
        existing.total += a.jumlah_siswa ?? 0;
        existing.count += 1;
        map.set(a.mitra_id, existing);
      });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [aktivitasList]);

  // Top mitra by rating
  const topMitraByRating = useMemo(() => {
    return [...mitraList]
      .filter((m) => m.status === 'Aktif')
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 5);
  }, [mitraList]);

  // Expiry timeline: MoU aktif yang akan expired dalam 90 hari
  const expiryTimeline = useMemo(() => {
    return mouList
      .filter((m) => m.status === 'Aktif')
      .map((m) => ({ ...m, days: daysToExpiry(m.tanggal_selesai) }))
      .filter((m) => m.days <= 90)
      .sort((a, b) => a.days - b.days)
      .slice(0, 10);
  }, [mouList]);

  const [checkingReminders, setCheckingReminders] = useState(false);

const handleCheckReminders = async () => {
  setCheckingReminders(true);
  try {
    const result = await checkAndSendMouReminders();
    if (result.sent > 0) {
      showToast('success', `${result.sent} reminder terkirim`);
    } else {
      showToast('info', 'Tidak ada MoU yang perlu reminder');
    }
  } finally {
    setCheckingReminders(false);
  }
};

  // Aktivitas terbaru
  const aktivitasTerbaru = useMemo(
    () => aktivitasList.slice(0, 8),
    [aktivitasList]
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <BarChart3 className="text-indigo-400" size={20} /> Dashboard Mitra
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistik mitra, MoU, dan aktivitas kerjasama
          </p>
        </div>
        <div className="flex items-center gap-2">
  <button
    onClick={handleCheckReminders}
    disabled={checkingReminders}
    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition cursor-pointer disabled:opacity-50"
  >
    {checkingReminders ? (
      <><Loader2 size={13} className="animate-spin" /> Cek...</>
    ) : (
      <><Bell size={13} /> Cek Reminder</>
    )}
  </button>
  <button
    onClick={fetchAll}
    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition cursor-pointer"
  >
    <RefreshCw size={13} /> Refresh
  </button>
</div>
      </div>

      {/* KPI UTAMA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigKpi
          icon={Building2}
          label="Total Mitra"
          value={stats.totalMitra}
          subtitle={`${stats.mitraAktif} aktif · ${stats.mitraNonaktif} nonaktif`}
          color="indigo"
        />
        <BigKpi
          icon={FileSignature}
          label="MoU Aktif"
          value={stats.mouAktifCount}
          subtitle={`dari ${stats.totalMou} total MoU`}
          color="emerald"
        />
        <BigKpi
          icon={AlertTriangle}
          label="Perlu Perhatian"
          value={stats.mouExpiring30 + stats.mouExpired}
          subtitle={`${stats.mouExpiring30} akan expired · ${stats.mouExpired} expired`}
          color="rose"
        />
        <BigKpi
          icon={Users}
          label="Siswa PKL"
          value={stats.totalSiswaPKL}
          subtitle={`${stats.totalSiswaRekrut} siswa direkrut`}
          color="teal"
        />
      </div>

      {/* KPI SEKUNDER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SmallKpi icon={Activity} label="Total Aktivitas" value={stats.totalAktivitas} color="purple" />
        <SmallKpi icon={GraduationCap} label="Guru Dilatih" value={stats.totalGuruPelatihan} color="amber" />
        <SmallKpi icon={Briefcase} label="Siswa Direkrut" value={stats.totalSiswaRekrut} color="blue" />
        <SmallKpi icon={XCircle} label="Blacklist" value={stats.mitraBlacklist} color="rose" />
      </div>

      {/* 2 KOLOM: DISTRIBUSI + EXPIRY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DISTRIBUSI JENIS MITRA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
            <Building2 size={12} /> Distribusi Jenis Mitra
          </h3>
          {stats.totalMitra === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-4">Belum ada data</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(stats.byJenisMitra)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([jenis, count]) => {
                  const persen = (count / stats.totalMitra) * 100;
                  return (
                    <div key={jenis}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getJenisMitraBadge(jenis)}`}>
                          {jenis}
                        </span>
                        <span className="text-[11px] text-slate-300 font-bold">
                          {count} <span className="text-slate-500 font-normal">({Math.round(persen)}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${persen}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* EXPIRY TIMELINE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
            <Clock size={12} /> MoU Akan Expired (90 Hari)
          </h3>
          {expiryTimeline.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-xs font-bold text-emerald-300">Semua MoU aman 🎉</p>
              <p className="text-[10px] text-slate-500 mt-1">
                Tidak ada MoU yang akan expired dalam 90 hari
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {expiryTimeline.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 border rounded-xl p-2.5 ${
                    m.days < 0
                      ? 'bg-rose-500/5 border-rose-500/20'
                      : m.days <= 7
                      ? 'bg-rose-500/5 border-rose-500/20'
                      : m.days <= 30
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    m.days < 0
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : m.days <= 7
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : m.days <= 30
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    <FileSignature size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">
                      {m.mitra_nama ?? '-'}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 truncate">
                      {m.nomor_mou}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Expired: {formatTanggal(m.tanggal_selesai)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {m.days < 0 ? (
                      <span className="text-[10px] font-bold text-rose-400 px-2 py-0.5 rounded border bg-rose-500/15 border-rose-500/30">
                        Lewat {Math.abs(m.days)}h
                      </span>
                    ) : m.days <= 7 ? (
                      <span className="text-[10px] font-bold text-rose-400 px-2 py-0.5 rounded border bg-rose-500/15 border-rose-500/30 animate-pulse">
                        {m.days}h lagi
                      </span>
                    ) : m.days <= 30 ? (
                      <span className="text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded border bg-amber-500/15 border-amber-500/30">
                        {m.days}h lagi
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded border bg-slate-800 border-slate-700">
                        {m.days}h lagi
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2 KOLOM: TOP MITRA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TOP BY PKL */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
            <Award size={12} /> Top Mitra — Siswa PKL
          </h3>
          {topMitraByPKL.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-4">
              Belum ada data PKL
            </p>
          ) : (
            <div className="space-y-2">
              {topMitraByPKL.map((m, i) => (
                <div key={m.nama} className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-extrabold text-sm ${
                    i === 0 ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400' :
                    i === 1 ? 'bg-slate-400/15 border border-slate-400/30 text-slate-300' :
                    i === 2 ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400' :
                    'bg-slate-800 border border-slate-700 text-slate-400'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{m.nama}</p>
                    <p className="text-[10px] font-mono text-slate-500">{m.kode ?? '-'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-emerald-400">{m.total}</p>
                    <p className="text-[9px] text-slate-500">siswa ({m.count} batch)</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TOP BY RATING */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
            <Star size={12} /> Mitra Rating Tertinggi
          </h3>
          {topMitraByRating.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-4">
              Belum ada data mitra
            </p>
          ) : (
            <div className="space-y-2">
              {topMitraByRating.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <span className="text-amber-400 font-extrabold text-xs">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{m.nama}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {m.bidang_industri ?? m.jenis_mitra}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-amber-400">{getRatingStars(m.rating)}</p>
                    <p className="text-[9px] text-slate-500">{m.rating}/5</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2 KOLOM: DISTRIBUSI AKTIVITAS + TREN TAHUNAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DISTRIBUSI AKTIVITAS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
            <Activity size={12} /> Distribusi Jenis Aktivitas
          </h3>
          {stats.totalAktivitas === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-4">Belum ada aktivitas</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(stats.byJenisAktivitas)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([jenis, count]) => {
                  const persen = (count / stats.totalAktivitas) * 100;
                  return (
                    <div key={jenis}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getJenisAktivitasBadge(jenis)}`}>
                          {jenis}
                        </span>
                        <span className="text-[11px] text-slate-300 font-bold">
                          {count} <span className="text-slate-500 font-normal">({Math.round(persen)}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${persen}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* TREN TAHUNAN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
            <TrendingUp size={12} /> Tren Aktivitas 5 Tahun Terakhir
          </h3>
          {stats.tahunSorted.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-4">Belum ada data</p>
          ) : (
            <div className="flex items-end gap-3 h-40 pt-2">
              {stats.tahunSorted.map(([tahun, count]) => {
                const tinggi = (count / stats.maxTahun) * 100;
                return (
                  <div key={tahun} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-400">{count}</span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all"
                        style={{ height: `${tinggi}%`, minHeight: '8px' }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      {tahun}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AKTIVITAS TERBARU */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
          <Activity size={12} /> Aktivitas Terbaru
        </h3>
        {aktivitasTerbaru.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-6">
            Belum ada aktivitas tercatat
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {aktivitasTerbaru.map((a) => (
              <div key={a.id} className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${getJenisAktivitasBadge(a.jenis)}`}>
                  <Activity size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisAktivitasBadge(a.jenis)}`}>
                      {a.jenis}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatTanggal(a.tanggal)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-200 truncate mt-0.5">{a.judul}</p>
                  {a.mitra_nama && (
                    <p className="text-[10px] text-slate-500 truncate">
                      <Building2 size={9} className="inline mr-1" />
                      {a.mitra_nama}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  {a.jumlah_siswa ? (
                    <p className="text-[10px] font-bold text-emerald-400">
                      {a.jumlah_siswa} siswa
                    </p>
                  ) : null}
                  {a.jumlah_guru ? (
                    <p className="text-[10px] font-bold text-purple-400">
                      {a.jumlah_guru} guru
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB: Big KPI
// =============================================================================
type BigKpiColor = 'indigo' | 'emerald' | 'rose' | 'teal';
const CM_BIG: Record<BigKpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
};

function BigKpi({
  icon: Icon, label, value, subtitle, color,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  subtitle?: string;
  color: BigKpiColor;
}) {
  const c = CM_BIG[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center mb-2`}>
        <Icon size={16} />
      </div>
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className={`text-2xl font-extrabold mt-0.5 ${c.text}`}>{value}</p>
      {subtitle && (
        <p className="text-[10px] text-slate-500 mt-1 truncate">{subtitle}</p>
      )}
    </div>
  );
}

// =============================================================================
// SUB: Small KPI
// =============================================================================
type SmallKpiColor = 'purple' | 'amber' | 'blue' | 'rose';
const CM_SMALL: Record<SmallKpiColor, { bg: string; text: string; border: string }> = {
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function SmallKpi({ icon: Icon, label, value, color }: {
  icon: typeof Activity; label: string; value: number; color: SmallKpiColor;
}) {
  const c = CM_SMALL[color];
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