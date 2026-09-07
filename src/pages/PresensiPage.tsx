import { useEffect, useState, useCallback } from 'react';
import { CalendarCheck, Loader2, Save, Check, X, AlertCircle, Clock, Sparkles, BookOpen, CalendarX, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import type {
  Kelas,
  Siswa,
  PresensiWithSiswa,
  JadwalKbmWithRelations,
  HariMinggu,
} from '@/types/database';

type Status = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';

interface HariLibur {
  id: string;
  tanggal: string;
  keterangan: string;
}

const STATUS_CONFIG: Record<
  Status,
  {
    activeBg: string;
    activeText: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    icon: typeof Check;
  }
> = {
  Hadir: {
    activeBg: 'bg-emerald-500 hover:bg-emerald-400',
    activeText: 'text-slate-950 font-extrabold shadow-lg shadow-emerald-500/25',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    icon: Check,
  },
  Sakit: {
    activeBg: 'bg-amber-500 hover:bg-amber-400',
    activeText: 'text-slate-950 font-extrabold shadow-lg shadow-amber-500/25',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/30',
    icon: AlertCircle,
  },
  Izin: {
    activeBg: 'bg-blue-500 hover:bg-blue-400',
    activeText: 'text-slate-950 font-extrabold shadow-lg shadow-blue-500/25',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-400',
    badgeBorder: 'border-blue-500/30',
    icon: AlertCircle,
  },
  Alpa: {
    activeBg: 'bg-rose-500 hover:bg-rose-400',
    activeText: 'text-slate-950 font-extrabold shadow-lg shadow-rose-500/25',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/30',
    icon: X,
  },
};

// ============================================================================
// HELPER FUNCTIONS (Di Luar Komponen PresensiPage)
// ============================================================================

function getTodayDateStrWib(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
  }).format(new Date());
}

function getHariFromDateString(dateStr: string): HariMinggu {
  const dateObj = new Date(`${dateStr}T12:00:00+07:00`);
  const hari = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(dateObj);
  
  const cleanHari = hari.replace("'", "").replace("’", "");
  return (cleanHari.charAt(0).toUpperCase() + cleanHari.slice(1)) as HariMinggu;
}

function getCurrentTimeStrWib(): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  })
    .format(new Date())
    .replace('.', ':');
}

// ============================================================================
// KOMPONEN UTAMA
// ============================================================================

export function PresensiPage() {
  const { guru } = useAuth();
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [tanggal, setTanggal] = useState(() => getTodayDateStrWib());

  // State Hari Libur
  const [hariLibur, setHariLibur] = useState<HariLibur | null>(null);

  // Jadwal KBM Filter & State
  const [availableJadwal, setAvailableJadwal] = useState<JadwalKbmWithRelations[]>([]);
  const [selectedJadwalId, setSelectedJadwalId] = useState('');
  const [activeJadwal, setActiveJadwal] = useState<JadwalKbmWithRelations | null>(null);

  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJadwal, setLoadingJadwal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Status presensi menggunakan type Status | null (default: null)
  const [attendance, setAttendance] = useState<Record<string, Status | null>>({});
  const [keterangan, setKeterangan] = useState<Record<string, string>>({});
  const [hasExisting, setHasExisting] = useState(false);

  // 1. Cek Apakah Tanggal Terpilih Adalah Hari Libur
  useEffect(() => {
    (async () => {
      if (!tanggal) return;
      
      const { data } = await supabase
        .from('hari_liburs')
        .select('*')
        .eq('tanggal', tanggal)
        .maybeSingle();

      setHariLibur(data as HariLibur | null);
    })();
  }, [tanggal]);

  // 2. Inisialisasi Data Kelas & Jadwal Aktif
  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: kelasData } = await supabase.from('kelas').select('*').order('nama_kelas');
      const loadedKelas = (kelasData as Kelas[]) || [];
      setKelasList(loadedKelas);

      if (guru) {
        const todayWib = getTodayDateStrWib();
        const todayHari = getHariFromDateString(todayWib);
        const currentTime = getCurrentTimeStrWib();

        const { data: jadwalData } = await supabase
          .from('jadwal_kbms')
          .select('*, kelas(id, nama_kelas), mata_pelajarans(id, nama_mapel)')
          .eq('guru_id', guru.id)
          .eq('hari', todayHari);

        if (jadwalData && jadwalData.length > 0) {
          const runningSchedule = (jadwalData as JadwalKbmWithRelations[]).find((j) => {
            if (!j.waktu_mulai || !j.waktu_selesai) return false;
            const mulai = j.waktu_mulai.slice(0, 5);
            const selesai = j.waktu_selesai.slice(0, 5);
            return currentTime >= mulai && currentTime <= selesai;
          });

          if (runningSchedule) {
            setActiveJadwal(runningSchedule);
            setSelectedKelas(runningSchedule.kelas_id);
            setSelectedJadwalId(runningSchedule.id);
          }
        }
      }

      setLoading(false);
    })();
  }, [guru]);

  // 3. Load Jadwal KBM Sesuai Filter Kelas & Tanggal
  const fetchJadwalOptions = useCallback(async () => {
    if (!selectedKelas || !tanggal || hariLibur) {
      setAvailableJadwal([]);
      setSelectedJadwalId('');
      return;
    }

    setLoadingJadwal(true);
    const selectedHari = getHariFromDateString(tanggal);

    let query = supabase
      .from('jadwal_kbms')
      .select('*, kelas(id, nama_kelas), mata_pelajarans(id, nama_mapel)')
      .eq('kelas_id', selectedKelas)
      .eq('hari', selectedHari)
      .order('waktu_mulai', { ascending: true });

    if (guru) {
      query = query.eq('guru_id', guru.id);
    }

    const { data } = await query;
    const list = (data as JadwalKbmWithRelations[]) || [];
    setAvailableJadwal(list);

    setSelectedJadwalId((prevSelected) => {
      if (list.length > 0) {
        const exists = list.some((j) => j.id === prevSelected);
        return exists ? prevSelected : list[0].id;
      }
      return '';
    });

    setLoadingJadwal(false);
  }, [selectedKelas, tanggal, hariLibur, guru]);

  useEffect(() => {
    fetchJadwalOptions();
  }, [fetchJadwalOptions]);

  // 4. Load Data Siswa & Presensi Eksisting
  useEffect(() => {
    if (!selectedKelas || !selectedJadwalId || hariLibur) {
      setSiswaList([]);
      setAttendance({});
      setKeterangan({});
      setHasExisting(false);
      return;
    }

    (async () => {
      const { data: siswaData } = await supabase
        .from('siswas')
        .select('*')
        .eq('kelas_id', selectedKelas)
        .order('nama_lengkap');
      const siswas = (siswaData as Siswa[]) || [];
      setSiswaList(siswas);

      const siswaIds = siswas.map((s) => s.id);
      if (siswaIds.length > 0) {
        const { data: presensiData } = await supabase
          .from('presensis')
          .select('*, siswas(id, nama_lengkap, nisn, kelas(id, nama_kelas))')
          .in('siswa_id', siswaIds)
          .eq('tanggal', tanggal)
          .eq('jadwal_kbm_id', selectedJadwalId);

        const existing = (presensiData as PresensiWithSiswa[]) || [];

        if (existing.length > 0) {
          setHasExisting(true);
          const att: Record<string, Status | null> = {};
          const ket: Record<string, string> = {};
          existing.forEach((p) => {
            att[p.siswa_id] = (p.status as Status) ?? null;
            if (p.keterangan) ket[p.siswa_id] = p.keterangan;
          });
          setAttendance(att);
          setKeterangan(ket);
        } else {
          setHasExisting(false);
          // SET DEFAULT NULL UNTUK SEMUA SISWA
          const att: Record<string, Status | null> = {};
          siswas.forEach((s) => (att[s.id] = null));
          setAttendance(att);
          setKeterangan({});
        }
      }
    })();
  }, [selectedKelas, selectedJadwalId, tanggal, hariLibur]);

  const setStatus = (siswaId: string, status: Status) => {
    if (hariLibur) return;
    setAttendance((prev) => ({ ...prev, [siswaId]: status }));
  };

  const setKet = (siswaId: string, value: string) => {
    if (hariLibur) return;
    setKeterangan((prev) => ({ ...prev, [siswaId]: value }));
  };

  // Fitur Tandai Semua Siswa Hadir
  const handleMarkAllHadir = () => {
    if (hariLibur || siswaList.length === 0) return;
    const updatedAtt: Record<string, Status | null> = {};
    siswaList.forEach((s) => {
      updatedAtt[s.id] = 'Hadir';
    });
    setAttendance(updatedAtt);
    showToast('info', 'Semua siswa ditandai Hadir');
  };

  const handleSave = async () => {
    if (hariLibur) {
      showToast('error', 'Tidak dapat menyimpan presensi di hari libur');
      return;
    }

    if (!selectedKelas || !selectedJadwalId || siswaList.length === 0) {
      showToast('error', 'Pilih kelas dan jam pelajaran terlebih dahulu');
      return;
    }

    if (!guru) {
      showToast('error', 'Sesi login guru tidak ditemukan');
      return;
    }

    // Validasi: pastikan semua siswa sudah dipilih status kehadirannya
    const unselectedSiswa = siswaList.filter((s) => !attendance[s.id]);
    if (unselectedSiswa.length > 0) {
      showToast('error', `Masih ada ${unselectedSiswa.length} siswa yang belum diabsen`);
      return;
    }

    setSaving(true);

    if (hasExisting) {
      const updates = siswaList.map((s) => {
        const status = attendance[s.id];
        const ket = keterangan[s.id] ?? null;
        return supabase
          .from('presensis')
          .update({ 
            status, 
            keterangan: ket,
            guru_id: guru.id
          })
          .eq('siswa_id', s.id)
          .eq('tanggal', tanggal)
          .eq('jadwal_kbm_id', selectedJadwalId);
      });

      const results = await Promise.all(updates);
      const failed = results.filter((r) => r.error);
      if (failed.length > 0) {
        showToast('error', `Gagal memperbarui ${failed.length} presensi`);
      } else {
        showToast('success', 'Presensi jam pelajaran ini berhasil diperbarui');
      }
    } else {
      const rows = siswaList.map((s) => ({
        siswa_id: s.id,
        jadwal_kbm_id: selectedJadwalId,
        guru_id: guru.id,
        tanggal,
        status: attendance[s.id],
        keterangan: keterangan[s.id] ?? null,
      }));

      const { error } = await supabase.from('presensis').insert(rows);
      if (error) {
        showToast('error', 'Gagal menyimpan presensi: ' + error.message);
      } else {
        showToast('success', 'Presensi jam pelajaran ini berhasil disimpan');
        setHasExisting(true);
      }
    }

    setSaving(false);
  };

  const summary = siswaList.reduce(
    (acc, s) => {
      const status = attendance[s.id];
      if (status) {
        acc[status] = (acc[status] ?? 0) + 1;
      }
      return acc;
    },
    {} as Record<Status, number>
  );

  const unselectedCount = siswaList.filter((s) => !attendance[s.id]).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="animate-spin text-indigo-400" size={36} />
      </div>
    );
  }

  const selectedJadwalDetail = availableJadwal.find((j) => j.id === selectedJadwalId);
  const isCurrentClassActive = activeJadwal && activeJadwal.id === selectedJadwalId && !hariLibur;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* HEADER PAGE */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <CalendarCheck className="text-indigo-400" size={28} />
            Input Presensi Siswa
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Catat kehadiran siswa per kelas dan per masuk jam mata pelajaran
          </p>
        </div>
      </div>

      {/* BANNER NOTIFIKASI HARI LIBUR */}
      {hariLibur && (
        <div className="relative overflow-hidden bg-rose-950/40 border border-rose-500/30 rounded-3xl p-5 md:p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/10">
              <CalendarX size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-rose-500/20 border border-rose-500/30 text-rose-300 px-3 py-1 rounded-full">
                  Hari Libur Sekolah
                </span>
              </div>
              <p className="text-base font-bold text-slate-100 mt-1">
                {hariLibur.keterangan || 'Libur Nasional / Agenda Sekolah'}
              </p>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Input presensi siswa dikunci dan tidak dapat dilakukan pada tanggal ini.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BANNER KBM SEDANG BERLANGSUNG */}
      {isCurrentClassActive && (
        <div className="relative overflow-hidden bg-slate-900 border border-indigo-500/30 rounded-3xl p-5 md:p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
                <Sparkles size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full">
                    KBM Sedang Berlangsung
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                    <Clock size={13} className="text-indigo-400" />
                    {activeJadwal.waktu_mulai?.slice(0, 5)} - {activeJadwal.waktu_selesai?.slice(0, 5)} WIB
                  </span>
                </div>
                <p className="text-base font-bold text-slate-100 mt-1">
                  {activeJadwal.mata_pelajarans?.nama_mapel} — Kelas {activeJadwal.kelas?.nama_kelas}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls / Filter Form */}
      <div className="relative overflow-hidden bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl backdrop-blur-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tanggal */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Tanggal
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
            />
          </div>

          {/* Kelas */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Kelas
            </label>
            <select
              value={selectedKelas}
              disabled={!!hariLibur}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" className="bg-slate-900 text-slate-400">Pilih kelas...</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id} className="bg-slate-900 text-slate-100">
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          {/* Jam Pelajaran / Jadwal KBM */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <BookOpen size={16} className="text-indigo-400" />
              Mata Pelajaran / Jam Ke-
            </label>
            <select
              value={selectedJadwalId}
              onChange={(e) => setSelectedJadwalId(e.target.value)}
              disabled={!selectedKelas || loadingJadwal || !!hariLibur}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hariLibur ? (
                <option value="" className="bg-slate-900 text-slate-400">Hari libur (KBM nonaktif)</option>
              ) : !selectedKelas ? (
                <option value="" className="bg-slate-900 text-slate-400">Pilih kelas dulu...</option>
              ) : loadingJadwal ? (
                <option value="" className="bg-slate-900 text-slate-400">Memuat jadwal...</option>
              ) : availableJadwal.length === 0 ? (
                <option value="" className="bg-slate-900 text-slate-400">Tidak ada jadwal di hari {getHariFromDateString(tanggal)}</option>
              ) : (
                availableJadwal.map((j) => (
                  <option key={j.id} value={j.id} className="bg-slate-900 text-slate-100">
                    {j.mata_pelajarans?.nama_mapel} ({j.waktu_mulai?.slice(0, 5)} - {j.waktu_selesai?.slice(0, 5)})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Empty States & Form Rendering */}
      {hariLibur ? null : (!selectedKelas || !selectedJadwalId) ? (
        <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 text-center py-20 px-6 backdrop-blur-xl">
          <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <CalendarCheck size={32} />
          </div>
          <p className="text-slate-400 text-base font-medium max-w-sm mx-auto">
            {!selectedKelas
              ? 'Silakan pilih kelas terlebih dahulu untuk memulai pengisian presensi.'
              : 'Silakan pilih jam pelajaran / mata pelajaran untuk menginput presensi.'}
          </p>
        </div>
      ) : siswaList.length === 0 ? (
        <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 text-center py-20 px-6 backdrop-blur-xl">
          <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <CalendarCheck size={32} />
          </div>
          <p className="text-slate-400 text-base font-medium">
            Belum ada siswa yang terdaftar di kelas ini.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action Header & Summary Ringkasan Jumlah */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
              {(Object.keys(STATUS_CONFIG) as Status[]).map((status) => {
                const config = STATUS_CONFIG[status];
                const Icon = config.icon;
                const count = summary[status] ?? 0;
                return (
                  <div
                    key={status}
                    className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 flex items-center gap-3 shadow-lg relative overflow-hidden"
                  >
                    <div className={`w-10 h-10 ${config.badgeBg} ${config.badgeBorder} border ${config.badgeText} rounded-xl flex items-center justify-center shrink-0`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-xl font-extrabold text-slate-100 tracking-tight">{count}</p>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{status}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tombol Fitur: Mark All Present */}
            <button
              type="button"
              onClick={handleMarkAllHadir}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 hover:text-emerald-300 font-semibold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <CheckCheck size={16} />
              Set Semua Hadir
            </button>
          </div>

          {/* Alert Indikator Belum Diabsen */}
          {unselectedCount > 0 && (
            <div className="bg-amber-950/40 border border-amber-500/30 text-amber-300 text-sm rounded-2xl p-4 flex items-center gap-3 backdrop-blur-sm">
              <AlertCircle size={18} className="shrink-0 text-amber-400" />
              <span>
                Terdapat <strong>{unselectedCount} siswa</strong> yang belum diisi status kehadirannya.
              </span>
            </div>
          )}

          {/* Alert jika presensi jam pelajaran ini sudah pernah disimpan */}
          {hasExisting && unselectedCount === 0 && (
            <div className="bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-sm rounded-2xl p-4 flex items-center gap-3 backdrop-blur-sm">
              <AlertCircle size={18} className="shrink-0 text-indigo-400" />
              <span>
                Presensi untuk jam pelajaran <strong>({selectedJadwalDetail?.mata_pelajarans?.nama_mapel})</strong> pada tanggal ini sudah ada. Perubahan akan memperbarui data tersimpan.
              </span>
            </div>
          )}

          {/* TAMPILAN MOBILE: Card Layout */}
          <div className="md:hidden space-y-4">
            {siswaList.map((s) => {
              const status = attendance[s.id] ?? null;
              const isUnselected = status === null;

              return (
                <div 
                  key={s.id} 
                  className={`bg-slate-900 rounded-2xl border p-4 space-y-3 shadow-lg backdrop-blur-xl transition-all ${
                    isUnselected ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800'
                  }`}
                >
                  {/* Identitas Siswa */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-bold text-slate-100">{s.nama_lengkap}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{s.nisn || '-'}</p>
                    </div>
                    {isUnselected && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Belum Diabsen
                      </span>
                    )}
                  </div>

                  {/* Status Kehadiran */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Status Kehadiran
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(STATUS_CONFIG) as Status[]).map((st) => {
                        const config = STATUS_CONFIG[st];
                        const active = status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStatus(s.id, st)}
                            className={`py-2 px-1 rounded-xl text-xs font-extrabold border transition-all text-center cursor-pointer ${
                              active
                                ? `${config.activeBg} ${config.activeText} border-transparent`
                                : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Keterangan */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Keterangan
                    </label>
                    <input
                      type="text"
                      value={keterangan[s.id] ?? ''}
                      onChange={(e) => setKet(s.id, e.target.value)}
                      placeholder={
                        !status
                          ? 'Pilih status terlebih dahulu...'
                          : status === 'Hadir'
                          ? '-'
                          : 'Masukan alasan / keterangan...'
                      }
                      disabled={!status || status === 'Hadir'}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none disabled:bg-slate-950/40 disabled:text-slate-600 disabled:border-slate-800/40"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* TAMPILAN DESKTOP: Table Layout */}
          <div className="hidden md:block bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Siswa</th>
                    <th className="px-6 py-4 min-w-[280px]">Status Kehadiran</th>
                    <th className="px-6 py-4 min-w-[200px]">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {siswaList.map((s) => {
                    const status = attendance[s.id] ?? null;
                    const isUnselected = status === null;

                    return (
                      <tr 
                        key={s.id} 
                        className={`transition-colors ${
                          isUnselected ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-100">{s.nama_lengkap}</p>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">{s.nisn || '-'}</p>
                            </div>
                            {isUnselected && (
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full ml-auto">
                                Belum Diabsen
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {(Object.keys(STATUS_CONFIG) as Status[]).map((st) => {
                              const config = STATUS_CONFIG[st];
                              const active = status === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => setStatus(s.id, st)}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                                    active
                                      ? `${config.activeBg} ${config.activeText} border-transparent`
                                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={keterangan[s.id] ?? ''}
                            onChange={(e) => setKet(s.id, e.target.value)}
                            placeholder={
                              !status
                                ? 'Pilih status...'
                                : status === 'Hadir'
                                ? '-'
                                : 'Keterangan...'
                            }
                            disabled={!status || status === 'Hadir'}
                            className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none disabled:bg-slate-950/40 disabled:text-slate-600 disabled:border-slate-800/40"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Button Simpan */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transform hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {hasExisting ? 'Perbarui Presensi Jam Ini' : 'Simpan Presensi Jam Ini'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}