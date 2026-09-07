import { useEffect, useState, useCallback } from 'react';
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Calendar,
  Navigation,
  RefreshCw,
  ShieldAlert,
  FileText,
  History,
  BarChart3,
  UserCheck,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import type {
  PengaturanSekolah,
  JadwalPiketPenyambutan,
  KehadiranPiketPenyambutan,
  IzinGuruPiket,
} from '@/types/database';

// Fungsi menghitung jarak antara 2 titik koordinat (rumus Haversine dalam meter)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper untuk mendapatkan tanggal format YYYY-MM-DD berbasis WIB
function getWibDateString(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

export function KehadiranPiketPenyambutanPage() {
  const { guru } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'presensi' | 'riwayat'>('presensi');

  // Clock state
  const [now, setNow] = useState<Date>(new Date());

  // Update jam realtime tiap detik
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // PENYESUAIAN WAKTU WIB: Menggunakan zona Asia/Jakarta secara eksplisit
  const todayStr = getWibDateString(now);
  const dayNameIndo = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    timeZone: 'Asia/Jakarta',
  });

  // Format tanggal awal bulan berjalan berbasis WIB (YYYY-MM-01)
  const defaultStartDate = `${todayStr.slice(0, 7)}-01`;

  // State Filter Tanggal Riwayat
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Data State
  const [pengaturan, setPengaturan] = useState<PengaturanSekolah | null>(null);
  const [jadwalHariIni, setJadwalHariIni] = useState<JadwalPiketPenyambutan | null>(null);
  const [kehadiranHariIni, setKehadiranHariIni] = useState<KehadiranPiketPenyambutan | null>(null);
  const [izinHariIni, setIzinHariIni] = useState<IzinGuruPiket | null>(null);
  const [riwayatList, setRiwayatList] = useState<KehadiranPiketPenyambutan[]>([]);

  // Geolocation State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // PENYESUAIAN WAKTU WIB: Menghitung jam & menit lokal Asia/Jakarta
  const wibTimeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const hoursWib = Number(wibTimeParts.find((p) => p.type === 'hour')?.value ?? 0);
  const minutesWib = Number(wibTimeParts.find((p) => p.type === 'minute')?.value ?? 0);

  const currentMinutes = hoursWib * 60 + minutesWib;
  const startWindowMinutes = 6 * 60 + 30; // 06:30 WIB
  const lateThresholdMinutes = 7 * 60;     // 07:00 WIB
  const endWindowMinutes = 7 * 60 + 20;   // 07:20 WIB

  const isBeforeStart = currentMinutes < startWindowMinutes;
  const isInTimeWindow = currentMinutes >= startWindowMinutes && currentMinutes <= endWindowMinutes;
  const isLate = currentMinutes > lateThresholdMinutes;
  const minutesLate = isLate ? currentMinutes - lateThresholdMinutes : 0;

  // Status waktu presensi
  let statusWaktuTitle = 'Sesi Selesai';
  let statusWaktuDesc = 'Tutup pukul 07.20 WIB';

  if (isInTimeWindow) {
    if (isLate) {
      statusWaktuTitle = 'Terlambat (> 07.00 WIB)';
      statusWaktuDesc = `Keterlambatan: ${minutesLate} menit`;
    } else {
      statusWaktuTitle = 'Tepat Waktu (06.30 - 07.00)';
      statusWaktuDesc = 'Sesi presensi aktif';
    }
  } else if (isBeforeStart) {
    statusWaktuTitle = 'Belum Dibuka';
    statusWaktuDesc = 'Buka pukul 06.30 WIB';
  }

  // Dapatkan koordinat lokasi pengguna dari Geolocation API
  const getCurrentLocation = useCallback((schoolLat?: number, schoolLng?: number) => {
    if (!navigator.geolocation) {
      setGeoError('Perangkat Anda tidak mendukung fitur lokasi GPS');
      return;
    }

    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });

        const targetLat = schoolLat ?? pengaturan?.latitude;
        const targetLng = schoolLng ?? pengaturan?.longitude;

        if (targetLat !== undefined && targetLng !== undefined) {
          const dist = calculateDistance(lat, lng, Number(targetLat), Number(targetLng));
          setDistance(Math.round(dist));
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError('Akses lokasi ditolak. Harap izinkan GPS pada browser/perangkat Anda.');
            break;
          case err.POSITION_UNAVAILABLE:
            setGeoError('Informasi lokasi tidak tersedia.');
            break;
          case err.TIMEOUT:
            setGeoError('Waktu permintaan lokasi habis.');
            break;
          default:
            setGeoError('Gagal mendapatkan lokasi.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [pengaturan?.latitude, pengaturan?.longitude]);

  // Fetch Data Presensi Hari Ini & Pengaturan
  const fetchDataHariIni = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);

    try {
      const [pengaturanRes, jadwalRes, kehadiranRes, izinRes] = await Promise.all([
        supabase.from('pengaturan_sekolahs').select('*').limit(1).single(),
        supabase
          .from('jadwal_piket_penyambutans')
          .select('*')
          .eq('guru_id', guru.id)
          .eq('hari', dayNameIndo)
          .maybeSingle(),
        supabase
          .from('kehadiran_pikets_penyambutan')
          .select('*')
          .eq('guru_id', guru.id)
          .eq('tanggal', todayStr)
          .maybeSingle(),
        supabase
          .from('izin_guru_pikets')
          .select('*')
          .eq('guru_izin_id', guru.id)
          .eq('tanggal_izin', todayStr)
          .maybeSingle(),
      ]);

      if (pengaturanRes.data) {
        setPengaturan(pengaturanRes.data as PengaturanSekolah);
        getCurrentLocation(
          Number(pengaturanRes.data.latitude),
          Number(pengaturanRes.data.longitude)
        );
      }

      setJadwalHariIni((jadwalRes.data as JadwalPiketPenyambutan) ?? null);
      setKehadiranHariIni((kehadiranRes.data as KehadiranPiketPenyambutan) ?? null);
      setIzinHariIni((izinRes.data as IzinGuruPiket) ?? null);
    } catch (err) {
      console.error('Error fetching presensi data:', err);
      showToast('error', 'Gagal memuat data presensi piket');
    } finally {
      setLoading(false);
    }
  }, [guru?.id, dayNameIndo, todayStr, getCurrentLocation]);

  // Fetch Data Riwayat Berdasarkan Filter Tanggal
  const fetchRiwayat = useCallback(async () => {
    if (!guru?.id) return;
    setLoadingRiwayat(true);

    try {
      const { data, error } = await supabase
        .from('kehadiran_pikets_penyambutan')
        .select('*')
        .eq('guru_id', guru.id)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setRiwayatList((data as KehadiranPiketPenyambutan[]) ?? []);
    } catch (err) {
      console.error('Error fetching riwayat data:', err);
      showToast('error', 'Gagal memuat riwayat presensi');
    } finally {
      setLoadingRiwayat(false);
    }
  }, [guru?.id, startDate, endDate]);

  useEffect(() => {
    fetchDataHariIni();
  }, [fetchDataHariIni]);

  useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  // Eksekusi Presensi
  const handlePresensi = async () => {
    if (!guru?.id || !jadwalHariIni) {
      showToast('error', 'Anda tidak memiliki jadwal piket penyambutan hari ini.');
      return;
    }

    if (!isInTimeWindow) {
      showToast('error', 'Presensi hanya dapat dilakukan pada pukul 06.30 s.d. 07.20 WIB.');
      return;
    }

    if (!userCoords || distance === null) {
      showToast('error', 'Lokasi GPS belum terdeteksi. Silakan perbarui lokasi Anda.');
      return;
    }

    const maxRadius = pengaturan?.radius_meter ?? 100;
    if (distance > maxRadius) {
      showToast('error', `Anda berada di luar lokasi sekolah (Jarak: ${distance}m, Maksimal: ${maxRadius}m).`);
      return;
    }

    setSubmitting(true);

    const catatanText = isLate ? `Terlambat ${minutesLate} menit` : null;

    const payload = {
      guru_id: guru.id,
      jadwal_piket_penyambutan_id: jadwalHariIni.id,
      tanggal: todayStr,
      status: 'Hadir',
      waktu_absen: new Date().toISOString(),
      catatan: catatanText,
      latitude: userCoords.lat,
      longitude: userCoords.lng,
    };

    const { error } = await supabase
      .from('kehadiran_pikets_penyambutan')
      .upsert(payload, { onConflict: 'guru_id,tanggal' });

    if (error) {
      showToast('error', 'Gagal mencatat presensi: ' + error.message);
    } else {
      showToast('success', 'Berhasil melakukan presensi piket penyambutan!');
      fetchDataHariIni();
      fetchRiwayat();
    }
    setSubmitting(false);
  };

  const handleResetFilter = () => {
    setStartDate(defaultStartDate);
    setEndDate(todayStr);
  };

  const isWithinRadius =
    distance !== null && distance <= (pengaturan?.radius_meter ?? 100);

  // Kalkulasi Rekapitulasi Rentang Tanggal Terpilih
  const totalKehadiran = riwayatList.length;
  const totalHadir = riwayatList.filter((r) => r.status === 'Hadir').length;
  const totalTerlambat = riwayatList.filter(
    (r) => r.status === 'Hadir' && r.catatan && r.catatan.toLowerCase().includes('terlambat')
  ).length;
  const totalTepatWaktu = totalHadir - totalTerlambat;
  const totalIzinSakit = riwayatList.filter(
    (r) => r.status === 'Izin' || r.status === 'Sakit'
  ).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-24">
        <Loader2 className="animate-spin text-indigo-400 mb-3" size={36} />
        <p className="text-slate-400 text-xs font-medium">Memuat data presensi mandiri...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* HEADER DAN JAM UTAMA */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full inline-block mb-3">
              Presensi Mandiri Piket Penyambutan
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">
              {guru?.nama_lengkap ?? 'Guru Piket'}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1 flex items-center gap-2">
              <Calendar size={14} className="text-indigo-400" />
              {now.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'Asia/Jakarta',
              })}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center min-w-[200px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Waktu Server (WIB)
            </span>
            <div className="font-mono text-3xl font-black text-indigo-400 tracking-wider">
              {now.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Asia/Jakarta',
              })}
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-1">
              Jadwal Presensi: 06.30 - 07.20 WIB
            </span>
          </div>
        </div>
      </div>

      {/* NAVIGASI TAB */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('presensi')}
          className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'presensi'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock size={16} /> Presensi Hari Ini
        </button>
        <button
          onClick={() => setActiveTab('riwayat')}
          className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'riwayat'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History size={16} /> Riwayat & Rekapitulasi
        </button>
      </div>

      {/* KONTEN TAB 1: PRESENSI HARI INI */}
      {activeTab === 'presensi' && (
        <div className="space-y-6">
          {/* INFORMASI RINGKAS STATUS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Jadwal Hari Ini</span>
                <Calendar size={18} className={jadwalHariIni ? 'text-indigo-400' : 'text-slate-600'} />
              </div>
              <p className="text-slate-100 font-bold text-base">
                {jadwalHariIni ? 'Bertugas Hari Ini' : 'Tidak Ada Jadwal'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {jadwalHariIni ? `Piket Penyambutan (${dayNameIndo})` : 'Anda tidak dijadwalkan piket hari ini'}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Status Waktu</span>
                <Clock size={18} className={isInTimeWindow ? 'text-emerald-400' : 'text-amber-400'} />
              </div>
              <p className="text-slate-100 font-bold text-base">{statusWaktuTitle}</p>
              <p className="text-slate-500 text-xs mt-1">{statusWaktuDesc}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Jarak Lokasi</span>
                <MapPin size={18} className={isWithinRadius ? 'text-emerald-400' : 'text-rose-400'} />
              </div>
              <p className="text-slate-100 font-bold text-base">
                {locating ? (
                  <span className="text-slate-400 flex items-center gap-1.5 text-xs">
                    <Loader2 size={14} className="animate-spin" /> Mendeteksi...
                  </span>
                ) : distance !== null ? (
                  `${distance} Meter`
                ) : (
                  'Belum Terdeteksi'
                )}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {distance !== null
                  ? isWithinRadius
                    ? `Di dalam radius sekolah (Maks. ${pengaturan?.radius_meter ?? 100}m)`
                    : `Di luar radius sekolah (Maks. ${pengaturan?.radius_meter ?? 100}m)`
                  : 'Membutuhkan akses izin GPS'}
              </p>
            </div>
          </div>

          {/* DETEKSI LOKASI & DETAIL PENGATURAN */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Navigation size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">
                    {pengaturan?.nama_sekolah ?? 'Lokasi Sekolah'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Radius Absen: {pengaturan?.radius_meter ?? 100} meter
                  </p>
                </div>
              </div>

              <button
                onClick={() => getCurrentLocation()}
                disabled={locating}
                className="inline-flex items-center gap-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={locating ? 'animate-spin text-indigo-400' : ''} />
                {locating ? 'Mencari GPS...' : 'Perbarui Lokasi GPS'}
              </button>
            </div>

            {geoError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs font-medium">
                <AlertTriangle size={18} className="shrink-0" />
                <span>{geoError}</span>
              </div>
            )}

            {userCoords && (
              <div className="text-xs text-slate-400 font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 flex items-center justify-between flex-wrap gap-2">
                <span>
                  Koordinat Anda: <strong className="text-slate-200">{userCoords.lat.toFixed(6)}, {userCoords.lng.toFixed(6)}</strong>
                </span>
                <span
                  className={`font-bold px-2.5 py-0.5 rounded-full border ${
                    isWithinRadius
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {isWithinRadius ? 'Dalam Area Sekolah' : 'Di Luar Area Sekolah'}
                </span>
              </div>
            )}
          </div>

          {/* UTAMA: STATUS / FORM TOMBOL PRESENSI */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl">
            {kehadiranHariIni ? (
              <div className="text-center py-6 space-y-4">
                <div
                  className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border shadow-xl ${
                    kehadiranHariIni.status === 'Hadir'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
                      : kehadiranHariIni.status === 'Izin' || kehadiranHariIni.status === 'Sakit'
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-400 shadow-purple-500/10'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-rose-500/10'
                  }`}
                >
                  {kehadiranHariIni.status === 'Hadir' ? (
                    <CheckCircle2 size={36} />
                  ) : kehadiranHariIni.status === 'Izin' || kehadiranHariIni.status === 'Sakit' ? (
                    <FileText size={36} />
                  ) : (
                    <XCircle size={36} />
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-extrabold text-slate-100">
                    Presensi Tercatat: <span className="text-indigo-400">{kehadiranHariIni.status}</span>
                  </h2>
                  {kehadiranHariIni.waktu_absen && (
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Waktu Absen:{' '}
                      {new Date(kehadiranHariIni.waktu_absen).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZone: 'Asia/Jakarta',
                      })}{' '}
                      WIB
                    </p>
                  )}
                </div>

                {kehadiranHariIni.catatan && (
                  <div className="max-w-md mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300">
                    <span className="text-slate-500 font-bold block mb-1 uppercase tracking-wider text-[10px]">
                      Catatan Kehadiran:
                    </span>
                    {kehadiranHariIni.catatan}
                  </div>
                )}
              </div>
            ) : izinHariIni ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto shadow-xl shadow-purple-500/10">
                  <FileText size={36} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-100">
                    Status Disetujui: <span className="text-purple-400">{izinHariIni.kategori_izin}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Anda telah mengajukan {izinHariIni.kategori_izin.toLowerCase()} untuk hari ini.
                  </p>
                </div>
                {izinHariIni.keterangan_izin && (
                  <div className="max-w-md mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300">
                    <span className="text-slate-500 font-bold block mb-1 uppercase tracking-wider text-[10px]">
                      Keterangan Izin:
                    </span>
                    {izinHariIni.keterangan_izin}
                  </div>
                )}
              </div>
            ) : !jadwalHariIni ? (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <ShieldAlert size={40} className="mx-auto text-slate-600" />
                <p className="text-base font-semibold text-slate-300">
                  Anda Tidak Punya Jadwal Piket Penyambutan Hari Ini ({dayNameIndo})
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Presensi piket penyambutan hanya dapat dilakukan oleh guru piket yang memiliki jadwal tugas aktif pada hari ini.
                </p>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-100">Siap Melakukan Presensi Piket?</h3>
                  <p className="text-xs text-slate-400 max-w-lg mx-auto">
                    Pastikan Anda sudah berada di area sekolah dan waktu berada dalam rentang 06.30 s.d. 07.20 WIB.
                  </p>
                </div>

                {isLate && isInTimeWindow && (
                  <div className="max-w-md mx-auto p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400 text-xs font-semibold flex items-center justify-center gap-2">
                    <AlertTriangle size={16} />
                    <span>Anda terlambat {minutesLate} menit dari batas waktu 07.00 WIB.</span>
                  </div>
                )}

                <button
                  onClick={handlePresensi}
                  disabled={submitting || !isInTimeWindow || !isWithinRadius || locating}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm px-8 py-4 rounded-2xl shadow-xl shadow-emerald-600/25 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Menyimpan Presensi...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Kirim Presensi Kehadiran</span>
                    </>
                  )}
                </button>

                {(!isInTimeWindow || !isWithinRadius) && (
                  <div className="text-xs text-slate-500 space-y-1">
                    {!isInTimeWindow && (
                      <p>• Presensi ditutup saat ini (Hanya aktif pukul 06.30 - 07.20 WIB).</p>
                    )}
                    {!isWithinRadius && distance !== null && (
                      <p>• Dekati area sekolah terlebih dahulu (Jarak Anda: {distance}m dari sekolah).</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* KONTEN TAB 2: RIWAYAT & REKAPITULASI */}
      {activeTab === 'riwayat' && (
        <div className="space-y-6">
          {/* PANEL FILTER TANGGAL */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-200 font-bold text-xs md:text-sm">
              <Filter size={18} className="text-indigo-400 shrink-0" />
              <span>Filter Rentang Tanggal</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <button
                onClick={handleResetFilter}
                title="Reset ke bulan berjalan"
                className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Bulan Ini</span>
              </button>
            </div>
          </div>

          {/* REKAPITULASI STATISTIK PERIODE TERPILIH */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Tepat Waktu</span>
                <UserCheck size={16} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400">{totalTepatWaktu}</p>
              <span className="text-[10px] text-slate-500">Sesuai jam jadwal</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Terlambat</span>
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400">{totalTerlambat}</p>
              <span className="text-[10px] text-slate-500">Di atas 07.00 WIB</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Izin / Sakit</span>
                <FileText size={16} className="text-purple-400" />
              </div>
              <p className="text-2xl font-black text-purple-400">{totalIzinSakit}</p>
              <span className="text-[10px] text-slate-500">Pengajuan izin</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Tugas</span>
                <BarChart3 size={16} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-indigo-400">{totalKehadiran}</p>
              <span className="text-[10px] text-slate-500">Periode ini</span>
            </div>
          </div>

          {/* TABEL DAFTAR RIWAYAT */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm md:text-base font-bold text-slate-100 flex items-center gap-2">
                  <History size={18} className="text-indigo-400" />
                  Catatan Riwayat Presensi
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Periode: {startDate} s.d. {endDate}
                </p>
              </div>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                Total: {totalKehadiran} data
              </span>
            </div>

            {loadingRiwayat ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-400" />
                <span>Memuat data riwayat...</span>
              </div>
            ) : riwayatList.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Tidak ada riwayat catatan presensi pada rentang tanggal yang dipilih.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-3">Tanggal</th>
                      <th className="py-3 px-3">Waktu Absen</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Catatan / Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {riwayatList.map((item) => {
                      const isItemLate =
                        item.status === 'Hadir' &&
                        item.catatan &&
                        item.catatan.toLowerCase().includes('terlambat');

                      // PENYESUAIAN WAKTU WIB: Format string "YYYY-MM-DD" tanpa konversi UTC
                      const [year, month, day] = item.tanggal.split('-').map(Number);
                      const displayTanggal = new Date(year, month - 1, day).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-3 font-medium text-slate-200">
                            {displayTanggal}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-slate-400">
                            {item.waktu_absen
                              ? new Date(item.waktu_absen).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Jakarta',
                                }) + ' WIB'
                              : '-'}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                item.status === 'Hadir'
                                  ? isItemLate
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                  : item.status === 'Izin' || item.status === 'Sakit'
                                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              }`}
                            >
                              {item.status === 'Hadir' && !isItemLate && <CheckCircle2 size={12} />}
                              {isItemLate && <AlertTriangle size={12} />}
                              {item.status} {isItemLate ? '(Terlambat)' : ''}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-slate-400 font-mono">
                            {item.catatan ?? '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default KehadiranPiketPenyambutanPage;