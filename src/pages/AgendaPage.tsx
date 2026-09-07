// AgendaPage.tsx
import { useEffect, useState, useCallback } from 'react';
import {
  BookHeart,
  Loader2,
  CheckCircle2,
  Clock,
  CalendarDays,
  NotebookPen,
  Save,
  Lock,
  AlertTriangle,
  History,
  Search,
  Calendar,
  FileText,
  AlertCircle,
  UserX,
  UserCheck,
  Users,
  FileSpreadsheet,
  Download,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import type {
  JadwalKbmWithRelations,
  AgendaGuruWithRelations,
  HariMinggu,
  PengaturanSekolah,
} from '@/types/database';

type PresensiWithSiswa = {
  id: number;
  siswa_id: number;
  tanggal: string;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
  keterangan: string | null;
  jadwal_kbm_id: number | null;
  siswas?: {
    id: number;
    nama_lengkap: string;
  } | null;
};

const HARI_ORDER: Record<string, number> = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
  Minggu: 7,
};

function getTodayHariWib(): HariMinggu {
  const hari = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  const cleanHari = hari.replace("'", "").replace("’", "");
  return (cleanHari.charAt(0).toUpperCase() + cleanHari.slice(1)) as HariMinggu;
}

function getTodayDateWib(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function getFirstDayOfMonthWib(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}-01`;
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

function isScheduleActive(jadwal: JadwalKbmWithRelations, todayHari: HariMinggu): boolean {
  if (!jadwal.waktu_mulai || !jadwal.waktu_selesai || !jadwal.hari) return false;
  if (jadwal.hari.trim().toLowerCase() !== todayHari.trim().toLowerCase()) return false;
  const now = getCurrentTimeStrWib();
  const mulai = jadwal.waktu_mulai.slice(0, 5);
  const selesai = jadwal.waktu_selesai.slice(0, 5);
  return now >= mulai && now <= selesai;
}

function getJadwalTimeStatus(jadwal: JadwalKbmWithRelations, todayHari: HariMinggu): 'upcoming' | 'active' | 'ended' {
  if (!jadwal.waktu_mulai || !jadwal.waktu_selesai || jadwal.hari?.trim().toLowerCase() !== todayHari.trim().toLowerCase()) {
    return 'ended';
  }
  const now = getCurrentTimeStrWib();
  const mulai = jadwal.waktu_mulai.slice(0, 5);
  const selesai = jadwal.waktu_selesai.slice(0, 5);
  if (now < mulai) return 'upcoming';
  if (now >= mulai && now <= selesai) return 'active';
  return 'ended';
}

function calculateLateMinutes(waktuMulai: string | null): number {
  if (!waktuMulai) return 0;
  const nowWibStr = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  const [currH, currM] = nowWibStr.replace('.', ':').split(':').map(Number);
  const [startH, startM] = waktuMulai.split(':').map(Number);
  const currentMinutes = currH * 60 + currM;
  const startMinutes = startH * 60 + startM;

  const toleransiMenit = 5;
  return Math.max(0, currentMinutes - (startMinutes + toleransiMenit));
}

function calculateAlpaJamPelajaran(menitTerlambat: number): number {
  return Math.floor(menitTerlambat / 30);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

type GpsState = {
  status: 'idle' | 'checking' | 'success' | 'denied' | 'error' | 'out_of_range';
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
  message: string;
};

export function AgendaPage() {
  const { guru } = useAuth();
  const [activeTab, setActiveTab] = useState<'hari_ini' | 'riwayat'>('hari_ini');

  const [jadwalList, setJadwalList] = useState<JadwalKbmWithRelations[]>([]);
  const [agendaList, setAgendaList] = useState<AgendaGuruWithRelations[]>([]);
  const [riwayatList, setRiwayatList] = useState<AgendaGuruWithRelations[]>([]);
  const [presensiList, setPresensiList] = useState<PresensiWithSiswa[]>([]);
  const [sekolahConfig, setSekolahConfig] = useState<PengaturanSekolah | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [journalModal, setJournalModal] = useState(false);
  const [activeJadwal, setActiveJadwal] = useState<JadwalKbmWithRelations | null>(null);
  const [journalText, setJournalText] = useState('');
  const [saving, setSaving] = useState(false);
  
  // State Filter Riwayat
  const [searchRiwayat, setSearchRiwayat] = useState('');
  const [startDateFilter, setStartDateFilter] = useState<string>(getFirstDayOfMonthWib());
  const [endDateFilter, setEndDateFilter] = useState<string>(getTodayDateWib());

  const [gps, setGps] = useState<GpsState>({
    status: 'idle',
    latitude: null,
    longitude: null,
    distance: null,
    message: '',
  });

  const [isLibur, setIsLibur] = useState(false);
  const [ketLibur, setKetLibur] = useState('');

  const todayHari = getTodayHariWib();
  const todayDate = getTodayDateWib();

  useEffect(() => {
    const checkHariLibur = async () => {
      const today = getTodayDateWib();
      const { data } = await supabase
        .from('hari_liburs')
        .select('keterangan')
        .eq('tanggal', today)
        .maybeSingle();

      if (data) {
        setIsLibur(true);
        setKetLibur(data.keterangan);
      }
    };
    checkHariLibur();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    if (!guru) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [jadwalRes, agendaRes, riwayatRes, sekolahRes] = await Promise.all([
        supabase
          .from('jadwal_kbms')
          .select('*, kelas(id, nama_kelas), gurus(id, nama_lengkap), mata_pelajarans(id, nama_mapel)')
          .eq('guru_id', guru.id),
        supabase
          .from('agenda_gurus')
          .select('*, jadwal_kbms(id, waktu_mulai, waktu_selesai, kelas(id, nama_kelas), mata_pelajarans(id, nama_mapel))')
          .eq('guru_id', guru.id)
          .eq('tanggal', todayDate)
          .order('created_at', { ascending: false }),
        supabase
          .from('agenda_gurus')
          .select('*, jadwal_kbms(id, waktu_mulai, waktu_selesai, kelas(id, nama_kelas), mata_pelajarans(id, nama_mapel))')
          .eq('guru_id', guru.id)
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('pengaturan_sekolahs')
          .select('*')
          .maybeSingle(),
      ]);

      if (jadwalRes.error) console.error('Jadwal Error:', jadwalRes.error);
      if (agendaRes.error) console.error('Agenda Today Error:', agendaRes.error);
      if (riwayatRes.error) console.error('Riwayat Error:', riwayatRes.error);

      const fetchedJadwal = (jadwalRes.data as JadwalKbmWithRelations[]) || [];
      setJadwalList(fetchedJadwal);
      setAgendaList((agendaRes.data as AgendaGuruWithRelations[]) || []);
      setRiwayatList((riwayatRes.data as AgendaGuruWithRelations[]) || []);
      setSekolahConfig((sekolahRes.data as PengaturanSekolah) || null);

      const jadwalIds = fetchedJadwal.map((j) => j.id);
      if (jadwalIds.length > 0) {
        const { data: presensiData, error: presensiError } = await supabase
          .from('presensis')
          .select('*, siswas(id, nama_lengkap)')
          .in('jadwal_kbm_id', jadwalIds);

        if (presensiError) {
          console.error('Presensi Siswa Error:', presensiError);
        } else {
          setPresensiList((presensiData as PresensiWithSiswa[]) || []);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      showToast('error', 'Gagal memuat data agenda');
    } finally {
      setLoading(false);
    }
  }, [guru, todayDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedJadwalList = [...jadwalList].sort((a, b) => {
    const orderA = HARI_ORDER[a.hari?.trim() ?? ''] ?? 99;
    const orderB = HARI_ORDER[b.hari?.trim() ?? ''] ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    const waktuA = a.waktu_mulai || '';
    const waktuB = b.waktu_mulai || '';
    if (waktuA !== waktuB) return waktuA.localeCompare(waktuB);

    const mapelA = a.mata_pelajarans?.nama_mapel || '';
    const mapelB = b.mata_pelajarans?.nama_mapel || '';
    return mapelA.localeCompare(mapelB);
  });

  const todayJadwal = sortedJadwalList.filter(
    (j) => j.hari?.trim().toLowerCase() === todayHari.trim().toLowerCase()
  );

  const otherJadwal = sortedJadwalList.filter(
    (j) => j.hari?.trim().toLowerCase() !== todayHari.trim().toLowerCase()
  );

  const getAgendaForJadwal = (jadwalId: string): AgendaGuruWithRelations | null => {
    return (agendaList || []).find((a) => a.jadwal_kbm_id === jadwalId) ?? null;
  };

  const checkGpsLocation = (): Promise<GpsState> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({
          status: 'error',
          latitude: null,
          longitude: null,
          distance: null,
          message: 'Browser tidak mendukung GPS',
        });
        return;
      }
      setGps({
        status: 'checking',
        latitude: null,
        longitude: null,
        distance: null,
        message: 'Mengambil lokasi GPS...',
      });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          if (!sekolahConfig) {
            const result: GpsState = {
              status: 'error',
              latitude: lat,
              longitude: lon,
              distance: null,
              message: 'Pengaturan lokasi sekolah belum dikonfigurasi',
            };
            setGps(result);
            resolve(result);
            return;
          }
          const distance = haversineDistance(
            lat,
            lon,
            sekolahConfig.latitude,
            sekolahConfig.longitude
          );
          if (distance > sekolahConfig.radius_meter) {
            const result: GpsState = {
              status: 'out_of_range',
              latitude: lat,
              longitude: lon,
              distance,
              message: `Gagal presensi: Anda berada di luar radius area sekolah! (Jarak: ${distance}m, Radius: ${sekolahConfig.radius_meter}m)`,
            };
            setGps(result);
            resolve(result);
            return;
          }
          const result: GpsState = {
            status: 'success',
            latitude: lat,
            longitude: lon,
            distance,
            message: `Berada di dalam area sekolah (Jarak: ${distance}m dari pusat)`,
          };
          setGps(result);
          resolve(result);
        },
        (err) => {
          let message = 'Gagal mengambil lokasi GPS';
          if (err.code === err.PERMISSION_DENIED) {
            message = 'Akses lokasi ditolak. Mohon izinkan akses GPS di browser Anda.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = 'Posisi GPS tidak tersedia.';
          } else if (err.code === err.TIMEOUT) {
            message = 'Timeout mengambil lokasi GPS. Coba lagi.';
          }
          const result: GpsState = {
            status: 'denied',
            latitude: null,
            longitude: null,
            distance: null,
            message,
          };
          setGps(result);
          resolve(result);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const handleAbsen = async (jadwal: JadwalKbmWithRelations) => {
    if (isLibur) {
      showToast('error', `Hari ini libur (${ketLibur}). Pengisian agenda dinonaktifkan.`);
      return;
    }

    if (!guru) {
      showToast('error', 'Sesi pengguna tidak ditemukan');
      return;
    }

    if (!isScheduleActive(jadwal, todayHari)) {
      showToast('error', 'Pengisian presensi hanya bisa dilakukan saat jam pelajaran berlangsung');
      return;
    }
    const existing = getAgendaForJadwal(jadwal.id);
    if (existing && (existing.status_kehadiran === 'Hadir Mengajar' || existing.status_kehadiran === 'Terlambat')) {
      showToast('info', 'Anda sudah mengisi presensi untuk jadwal ini');
      return;
    }
    const gpsResult = await checkGpsLocation();
    if (gpsResult.status !== 'success') {
      showToast('error', gpsResult.message);
      return;
    }

    setSaving(true);

    const isAlreadyFilled = existing?.menit_terlambat !== null && existing?.menit_terlambat !== undefined;

    if (existing) {
      const updatePayload: Record<string, any> = {
        latitude_guru: gpsResult.latitude,
        longitude_guru: gpsResult.longitude,
        jarak_dari_sekolah: gpsResult.distance,
      };

      if (!isAlreadyFilled) {
        const menitTerlambat = calculateLateMinutes(jadwal.waktu_mulai);
        const alpaJp = calculateAlpaJamPelajaran(menitTerlambat);
        const statusKehadiran = menitTerlambat > 0 ? 'Terlambat' : 'Hadir Mengajar';

        updatePayload.menit_terlambat = menitTerlambat;
        updatePayload.alpa_jam_pelajaran = alpaJp;
        updatePayload.status_kehadiran = statusKehadiran;
      }

      const { error } = await supabase
        .from('agenda_gurus')
        .update(updatePayload)
        .eq('id', existing.id);

      if (error) {
        showToast('error', 'Gagal mengisi presensi: ' + error.message);
      } else {
        showToast('success', 'Berhasil memperbarui presensi');
        fetchData();
      }
    } else {
      const menitTerlambat = calculateLateMinutes(jadwal.waktu_mulai);
      const alpaJp = calculateAlpaJamPelajaran(menitTerlambat);
      const statusKehadiran = menitTerlambat > 0 ? 'Terlambat' : 'Hadir Mengajar';

      const { error } = await supabase.from('agenda_gurus').insert({
        guru_id: guru.id,
        jadwal_kbm_id: jadwal.id,
        tanggal: todayDate,
        status_kehadiran: statusKehadiran,
        catatan_materi: null,
        latitude_guru: gpsResult.latitude,
        longitude_guru: gpsResult.longitude,
        jarak_dari_sekolah: gpsResult.distance,
        menit_terlambat: menitTerlambat,
        alpa_jam_pelajaran: alpaJp,
      });

      if (error) {
        showToast('error', 'Gagal mengisi presensi: ' + error.message);
      } else {
        showToast('success', `Berhasil mengisi presensi ${statusKehadiran.toLowerCase()}${menitTerlambat > 0 ? ` (${menitTerlambat} menit)` : ''}`);
        fetchData();
      }
    }
    setSaving(false);
  };

  const openJournal = async (jadwal: JadwalKbmWithRelations) => {
    if (isLibur) {
      showToast('error', `Hari ini libur (${ketLibur}). Pengisian agenda dinonaktifkan.`);
      return;
    }

    if (!isScheduleActive(jadwal, todayHari)) {
      showToast('error', 'Jurnal hanya bisa diisi saat jam pelajaran berlangsung');
      return;
    }
    const gpsResult = await checkGpsLocation();
    if (gpsResult.status !== 'success') {
      showToast('error', gpsResult.message);
      return;
    }
    setActiveJadwal(jadwal);
    const existing = getAgendaForJadwal(jadwal.id);
    setJournalText(existing?.catatan_materi ?? '');
    setJournalModal(true);
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLibur) {
      showToast('error', `Hari ini libur (${ketLibur}). Pengisian agenda dinonaktifkan.`);
      setJournalModal(false);
      return;
    }

    if (!activeJadwal || !guru) return;
    if (!journalText.trim()) {
      showToast('error', 'Catatan materi jurnal tidak boleh kosong');
      return;
    }
    if (!isScheduleActive(activeJadwal, todayHari)) {
      showToast('error', 'Jam pelajaran telah berakhir, tidak dapat mengubah jurnal');
      setJournalModal(false);
      return;
    }
    const gpsResult = await checkGpsLocation();
    if (gpsResult.status !== 'success') {
      showToast('error', gpsResult.message);
      return;
    }
    setSaving(true);
    const existing = getAgendaForJadwal(activeJadwal.id);

    const isAlreadyFilled = existing?.menit_terlambat !== null && existing?.menit_terlambat !== undefined;

    if (existing) {
      const updatePayload: Record<string, any> = {
        catatan_materi: journalText.trim(),
        latitude_guru: gpsResult.latitude,
        longitude_guru: gpsResult.longitude,
        jarak_dari_sekolah: gpsResult.distance,
      };

      if (!isAlreadyFilled) {
        const menitTerlambat = calculateLateMinutes(activeJadwal.waktu_mulai);
        const alpaJp = calculateAlpaJamPelajaran(menitTerlambat);
        const statusKehadiran = menitTerlambat > 0 ? 'Terlambat' : 'Hadir Mengajar';

        updatePayload.menit_terlambat = menitTerlambat;
        updatePayload.alpa_jam_pelajaran = alpaJp;
        updatePayload.status_kehadiran = statusKehadiran;
      }

      const { error } = await supabase
        .from('agenda_gurus')
        .update(updatePayload)
        .eq('id', existing.id);

      if (error) {
        showToast('error', 'Gagal menyimpan jurnal: ' + error.message);
      } else {
        showToast('success', 'Jurnal berhasil disimpan');
        setJournalModal(false);
        fetchData();
      }
    } else {
      const menitTerlambat = calculateLateMinutes(activeJadwal.waktu_mulai);
      const alpaJp = calculateAlpaJamPelajaran(menitTerlambat);
      const statusKehadiran = menitTerlambat > 0 ? 'Terlambat' : 'Hadir Mengajar';

      const { error } = await supabase.from('agenda_gurus').insert({
        guru_id: guru.id,
        jadwal_kbm_id: activeJadwal.id,
        tanggal: todayDate,
        status_kehadiran: statusKehadiran,
        catatan_materi: journalText.trim(),
        latitude_guru: gpsResult.latitude,
        longitude_guru: gpsResult.longitude,
        jarak_dari_sekolah: gpsResult.distance,
        menit_terlambat: menitTerlambat,
        alpa_jam_pelajaran: alpaJp,
      });

      if (error) {
        showToast('error', 'Gagal menyimpan jurnal: ' + error.message);
      } else {
        showToast('success', 'Jurnal berhasil disimpan');
        setJournalModal(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const getMapelName = (j: JadwalKbmWithRelations): string => {
    return j.mata_pelajarans?.nama_mapel ?? '-';
  };

  const filteredRiwayat = riwayatList.filter((item) => {
    const query = searchRiwayat.toLowerCase();
    const mapelName = item.jadwal_kbms?.mata_pelajarans?.nama_mapel?.toLowerCase() || '';
    const kelasName = item.jadwal_kbms?.kelas?.nama_kelas?.toLowerCase() || '';
    const materi = item.catatan_materi?.toLowerCase() || '';
    const status = item.status_kehadiran?.toLowerCase() || '';
    const tanggal = item.tanggal || '';

    const matchesSearch =
      mapelName.includes(query) ||
      kelasName.includes(query) ||
      materi.includes(query) ||
      status.includes(query) ||
      tanggal.includes(query);

    const matchesDateRange =
      (!startDateFilter || tanggal >= startDateFilter) &&
      (!endDateFilter || tanggal <= endDateFilter);

    return matchesSearch && matchesDateRange;
  });

  const exportToExcel = () => {
    if (filteredRiwayat.length === 0) {
      showToast('info', 'Tidak ada data riwayat untuk diekspor');
      return;
    }

    const dataToExport = filteredRiwayat.map((item, index) => {
      const presensisForAgenda = presensiList.filter(
        (p) => p.tanggal === item.tanggal && p.jadwal_kbm_id === item.jadwal_kbm_id
      );
      const tidakHadirList = presensisForAgenda.filter((p) => p.status !== 'Hadir');

      let presensiSiswaText = 'Semua Siswa Hadir';
      if (presensisForAgenda.length === 0) {
        presensiSiswaText = 'Guru tidak mencatat presensi';
      } else if (tidakHadirList.length > 0) {
        presensiSiswaText = tidakHadirList
          .map((p) => `${p.siswas?.nama_lengkap || 'Siswa'} (${p.status}${p.keterangan ? `: ${p.keterangan}` : ''})`)
          .join(', ');
      }

      return {
        No: index + 1,
        Tanggal: item.tanggal,
        Waktu: `${item.jadwal_kbms?.waktu_mulai?.slice(0, 5) || ''} - ${item.jadwal_kbms?.waktu_selesai?.slice(0, 5) || ''} WIB`,
        'Mata Pelajaran': item.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '-',
        Kelas: item.jadwal_kbms?.kelas?.nama_kelas ?? '-',
        'Status Guru': item.status_kehadiran,
        Keterlambatan: item.menit_terlambat > 0 ? `${item.menit_terlambat} Menit (Alpa ${item.alpa_jam_pelajaran} JP)` : '-',
        'Presensi Siswa': presensiSiswaText,
        'Catatan Materi': item.catatan_materi || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Agenda');
    XLSX.writeFile(workbook, `Riwayat_Agenda_Guru_${startDateFilter}_sd_${endDateFilter}.xlsx`);
    showToast('success', 'Berhasil mengunduh berkas Excel');
  };

  const exportToPdf = () => {
    if (filteredRiwayat.length === 0) {
      showToast('info', 'Tidak ada data riwayat untuk diekspor');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(16);
    doc.text('Laporan Riwayat Agenda & Presensi Mengajar', 14, 15);
    doc.setFontSize(10);
    doc.text(`Nama Guru: ${guru?.nama_lengkap || '-'} | Periode: ${startDateFilter} s/d ${endDateFilter}`, 14, 22);

    const tableRows = filteredRiwayat.map((item, index) => {
      const presensisForAgenda = presensiList.filter(
        (p) => p.tanggal === item.tanggal && p.jadwal_kbm_id === item.jadwal_kbm_id
      );
      const tidakHadirList = presensisForAgenda.filter((p) => p.status !== 'Hadir');

      let presensiSiswaText = 'Semua Siswa Hadir';
      if (presensisForAgenda.length === 0) {
        presensiSiswaText = 'Guru tidak mencatat presensi';
      } else if (tidakHadirList.length > 0) {
        presensiSiswaText = tidakHadirList
          .map((p) => `${p.siswas?.nama_lengkap || 'Siswa'} (${p.status}${p.keterangan ? `: ${p.keterangan}` : ''})`)
          .join('\n');
      }

      return [
        index + 1,
        item.tanggal,
        `${item.jadwal_kbms?.waktu_mulai?.slice(0, 5) || ''} - ${item.jadwal_kbms?.waktu_selesai?.slice(0, 5) || ''}`,
        item.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '-',
        item.jadwal_kbms?.kelas?.nama_kelas ?? '-',
        item.status_kehadiran,
        presensiSiswaText,
        item.catatan_materi || '-',
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [['No', 'Tanggal', 'Waktu', 'Mata Pelajaran', 'Kelas', 'Status Guru', 'Presensi Siswa', 'Catatan Materi']],
      body: tableRows,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`Riwayat_Agenda_Guru_${startDateFilter}_sd_${endDateFilter}.pdf`);
    showToast('success', 'Berhasil mengunduh berkas PDF');
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Hadir Mengajar':
      case 'Hadir':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
      case 'Terlambat':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
      case 'Alpa':
        return 'bg-red-500/15 border-red-500/30 text-red-400';
      case 'Izin':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
      case 'Sakit':
        return 'bg-purple-500/15 border-purple-500/30 text-purple-400';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="animate-spin text-indigo-400" size={36} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER PAGE */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <BookHeart className="text-indigo-400" size={28} />
            Agenda & Presensi Guru
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Pengisian presensi diri, jurnal mengajar, dan riwayat rekam agenda KBM Anda
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('hari_ini')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'hari_ini'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CalendarDays size={16} />
            Agenda Hari Ini
          </button>
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History size={16} />
            Riwayat Agenda Saya
          </button>
        </div>
      </div>

      {!sekolahConfig && (
        <div className="bg-amber-950/40 border border-amber-500/30 text-amber-300 rounded-2xl p-4 flex items-start gap-3 backdrop-blur-sm">
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-bold text-amber-200">
              Pengaturan lokasi sekolah belum dikonfigurasi
            </p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Admin perlu mengatur titik koordinat dan radius sekolah di tabel <code className="bg-amber-950 px-1 py-0.5 rounded text-amber-200">pengaturan_sekolahs</code> sebelum fitur validasi GPS dapat digunakan.
            </p>
          </div>
        </div>
      )}

      {/* TAB 1: AGENDA HARI INI */}
      {activeTab === 'hari_ini' && (
        <div className="space-y-8">
          {isLibur && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <p className="font-bold">Hari Ini Libur: {ketLibur}</p>
              <p className="text-xs text-amber-400/80 mt-1">Pengisian agenda KBM dinonaktifkan untuk hari ini.</p>
            </div>
          )}

          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
                  <CalendarDays size={24} />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-100 tracking-tight">
                    {currentTime.toLocaleDateString('id-ID', {
                      timeZone: 'Asia/Jakarta',
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-slate-400 text-sm flex items-center gap-1.5 mt-0.5 font-mono">
                    <Clock size={14} className="text-indigo-400" />
                    Pukul {currentTime.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB
                  </p>
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl px-5 py-2.5 backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Hari ini: <span className="text-indigo-400">{todayHari}</span>
                </p>
                <p className="text-sm font-extrabold text-slate-200 mt-0.5">
                  {todayJadwal.length} Jadwal Mengajar
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Clock size={20} className="text-indigo-400" />
              Jadwal Mengajar Hari Ini
            </h2>

            {todayJadwal.length === 0 ? (
              <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 text-center py-16 px-6 backdrop-blur-xl">
                <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <BookHeart size={32} />
                </div>
                <p className="text-slate-400 text-base font-medium">
                  Tidak ada jadwal mengajar hari ini ({todayHari}).
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayJadwal.map((j, index) => {
                  const active = isScheduleActive(j, todayHari);
                  const timeStatus = getJadwalTimeStatus(j, todayHari);
                  const agenda = getAgendaForJadwal(j.id);
                  const sudahAbsen = agenda?.status_kehadiran === 'Hadir Mengajar' || agenda?.status_kehadiran === 'Terlambat';

                  return (
                    <div
                      key={j.id}
                      className={`bg-slate-900 rounded-3xl border p-5 md:p-6 transition-all duration-200 backdrop-blur-xl ${
                        active && !isLibur
                          ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                          : 'border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border transition-all ${
                              active && !isLibur
                                ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/25'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80 leading-none">Ke-</span>
                            <span className="text-xl font-extrabold leading-tight">{index + 1}</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-100 tracking-tight">
                              {getMapelName(j)}
                            </h3>
                            <p className="text-sm font-semibold text-indigo-400 mt-0.5">
                              Kelas {j.kelas?.nama_kelas ?? '-'}
                            </p>
                            {j.waktu_mulai && j.waktu_selesai && (
                              <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1">
                                <Clock size={12} className="text-slate-500" />
                                {j.waktu_mulai.slice(0, 5)} - {j.waktu_selesai.slice(0, 5)} WIB
                              </p>
                            )}

                            {timeStatus === 'active' && !isLibur && (
                              <span className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-bold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-full">
                                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                                Sedang Berlangsung
                              </span>
                            )}
                            {timeStatus === 'upcoming' && !isLibur && (
                              <span className="inline-flex items-center gap-1 mt-2.5 text-xs font-medium text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">
                                Belum Waktunya
                              </span>
                            )}
                            {(timeStatus === 'ended' || isLibur) && !active && (
                              <span className="inline-flex items-center gap-1 mt-2.5 text-xs font-medium text-slate-500 bg-slate-950/60 border border-slate-800/60 px-3 py-1 rounded-full">
                                {isLibur ? 'Libur' : 'Pelajaran Selesai'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                          {sudahAbsen ? (
                            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/10">
                              <CheckCircle2 size={16} />
                              <span>Sudah Mengisi Presensi ({agenda?.status_kehadiran})</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAbsen(j)}
                              disabled={!active || saving || gps.status === 'checking' || isLibur}
                              className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 border ${
                                active && !isLibur
                                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 border-transparent shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95'
                                  : 'bg-slate-950/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
                              }`}
                            >
                              {active && !isLibur ? <CheckCircle2 size={16} /> : <Lock size={16} />}
                              Presensi Diri
                            </button>
                          )}

                          <button
                            onClick={() => openJournal(j)}
                            disabled={!active || saving || gps.status === 'checking' || isLibur}
                            className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 border ${
                              active && !isLibur
                                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border-transparent shadow-lg shadow-indigo-500/25 cursor-pointer active:scale-95'
                                : 'bg-slate-950/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
                            }`}
                          >
                            {active && !isLibur ? <NotebookPen size={16} /> : <Lock size={16} />}
                            {agenda?.catatan_materi ? 'Edit Jurnal' : 'Isi Jurnal'}
                          </button>
                        </div>
                      </div>

                      {agenda?.catatan_materi && (
                        <div className="mt-4 pt-4 border-t border-slate-800/80">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Catatan Materi:</p>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 leading-relaxed">
                            {agenda.catatan_materi}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {otherJadwal.length > 0 && (
            <div className="space-y-4 pt-4">
              <h2 className="text-lg font-bold text-slate-100">Jadwal Hari Lain</h2>
              <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Hari</th>
                        <th className="px-6 py-4">Waktu</th>
                        <th className="px-6 py-4">Mata Pelajaran</th>
                        <th className="px-6 py-4">Kelas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {otherJadwal.map((j) => (
                        <tr key={j.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 text-slate-200 font-semibold">{j.hari}</td>
                          <td className="px-6 py-4 text-slate-400 font-mono">
                            {j.waktu_mulai?.slice(0, 5)} - {j.waktu_selesai?.slice(0, 5)} WIB
                          </td>
                          <td className="px-6 py-4 text-slate-300">{getMapelName(j)}</td>
                          <td className="px-6 py-4 text-indigo-400 font-medium">{j.kelas?.nama_kelas ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RIWAYAT AGENDA SAYA */}
      {activeTab === 'riwayat' && (
        <div className="space-y-6">
          {/* FILTER BAR & EXPORT BUTTONS */}
          <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              {/* SEARCH INPUT */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={searchRiwayat}
                  onChange={(e) => setSearchRiwayat(e.target.value)}
                  placeholder="Cari materi, kelas..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                />
              </div>

              {/* FILTER PERIODE TANGGAL */}
              <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-2xl p-1.5 px-3">
                <Filter className="text-indigo-400 shrink-0" size={14} />
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                />
                <span className="text-slate-600 text-xs font-semibold">s/d</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3 w-full xl:w-auto">
              <div className="text-xs text-slate-400 font-medium hidden lg:block">
                Total: <span className="text-indigo-400 font-bold">{filteredRiwayat.length}</span> Rekaman
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={exportToExcel}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-lg shadow-emerald-600/10"
                >
                  <FileSpreadsheet size={16} />
                  Ekspor Excel
                </button>
                <button
                  onClick={exportToPdf}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-lg shadow-red-600/10"
                >
                  <Download size={16} />
                  Ekspor PDF
                </button>
              </div>
            </div>
          </div>

          {/* DAFTAR RIWAYAT */}
          {filteredRiwayat.length === 0 ? (
            <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 text-center py-16 px-6 backdrop-blur-xl">
              <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <FileText size={32} />
              </div>
              <p className="text-slate-400 text-base font-medium">
                {searchRiwayat || startDateFilter || endDateFilter
                  ? 'Tidak ada riwayat agenda yang cocok dengan kata kunci/periode tanggal yang dipilih.'
                  : 'Belum ada riwayat rekaman agenda.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredRiwayat.map((item) => {
                const mapelName = item.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '-';
                const kelasName = item.jadwal_kbms?.kelas?.nama_kelas ?? '-';
                const waktuMulai = item.jadwal_kbms?.waktu_mulai?.slice(0, 5) ?? '';
                const waktuSelesai = item.jadwal_kbms?.waktu_selesai?.slice(0, 5) ?? '';

                const presensisForAgenda = presensiList.filter(
                  (p) => p.tanggal === item.tanggal && p.jadwal_kbm_id === item.jadwal_kbm_id
                );

                const tidakHadirList = presensisForAgenda.filter((p) => p.status !== 'Hadir');

                return (
                  <div
                    key={item.id}
                    className="bg-slate-900 rounded-3xl border border-slate-800/80 p-5 md:p-6 backdrop-blur-xl hover:border-slate-700 transition-all shadow-xl space-y-4"
                  >
                    <div className="flex items-start justify-between flex-wrap gap-3 border-b border-slate-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 text-indigo-400 flex items-center justify-center shrink-0">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-100">
                            {new Date(item.tanggal).toLocaleDateString('id-ID', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                          {waktuMulai && waktuSelesai && (
                            <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                              <Clock size={12} className="text-slate-500" />
                              {waktuMulai} - {waktuSelesai} WIB
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadgeStyle(
                            item.status_kehadiran
                          )}`}
                        >
                          {item.status_kehadiran}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5">
                      <div>
                        <span className="text-slate-500 uppercase tracking-wider font-bold">Mata Pelajaran: </span>
                        <span className="text-slate-200 font-semibold">{mapelName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase tracking-wider font-bold">Kelas: </span>
                        <span className="text-indigo-400 font-semibold">{kelasName}</span>
                      </div>
                      {item.menit_terlambat > 0 && (
                        <div className="col-span-full flex items-center gap-1.5 text-amber-400 font-medium pt-1">
                          <AlertCircle size={14} />
                          <span>Terlambat {item.menit_terlambat} Menit (Alpa {item.alpa_jam_pelajaran} JP)</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Users size={14} className="text-indigo-400" />
                        Presensi Siswa:
                      </p>

                      {presensisForAgenda.length === 0 ? (
                        <div className="text-xs text-amber-400/90 italic bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>Guru tidak mencatat presensi</span>
                        </div>
                      ) : tidakHadirList.length === 0 ? (
                        <div className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-center gap-2">
                          <UserCheck size={16} className="shrink-0" />
                          <span>Semua siswa hadir</span>
                        </div>
                      ) : (
                        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <UserX size={13} className="text-red-400" />
                            Siswa Tidak Hadir ({tidakHadirList.length}):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {tidakHadirList.map((p) => (
                              <div
                                key={p.id}
                                className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 shadow-sm"
                              >
                                <span className="font-semibold text-slate-200">
                                  {p.siswas?.nama_lengkap || 'Siswa'}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeStyle(
                                    p.status
                                  )}`}
                                >
                                  {p.status}
                                </span>
                                {p.keterangan && (
                                  <span className="text-slate-400 text-[11px] italic">
                                    ({p.keterangan})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Catatan Materi / Jurnal:
                      </p>
                      <p className="text-slate-300 text-xs md:text-sm whitespace-pre-wrap bg-slate-950 border border-slate-800/80 rounded-2xl p-4 leading-relaxed">
                        {item.catatan_materi || <span className="italic text-slate-600">Tidak ada catatan materi.</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL JURNAL */}
      <Modal
        open={journalModal}
        onClose={() => setJournalModal(false)}
        title="Isi Jurnal / Agenda Materi"
        size="lg"
      >
        {activeJadwal && (
          <form onSubmit={handleSaveJournal} className="space-y-5">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Waktu</p>
                  <p className="font-mono font-semibold text-slate-200 mt-0.5">
                    {activeJadwal.waktu_mulai?.slice(0, 5)} - {activeJadwal.waktu_selesai?.slice(0, 5)} WIB
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mata Pelajaran</p>
                  <p className="font-semibold text-slate-200 mt-0.5">{getMapelName(activeJadwal)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Kelas</p>
                  <p className="font-semibold text-indigo-400 mt-0.5">{activeJadwal.kelas?.nama_kelas ?? '-'}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Catatan Materi / Jurnal Mengajar
              </label>
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                rows={7}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none text-sm leading-relaxed"
                placeholder="Tuliskan materi yang diajarkan, kegiatan kelas, dan catatan penting..."
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setJournalModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || gps.status !== 'success' || isLibur}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Simpan Jurnal
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}