// src/pages/AgendaPage.tsx
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
  Navigation,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import {
  getTodayHariWib,
  getTodayDateWib,
  getFirstDayOfMonthWib,
  getCurrentTimeStrWib,
  isJadwalAktif,
} from '@/utils/date';
import { haversineDistance } from '@/utils/geo';
import { offlineInsert, offlineUpdate } from '@/lib/offline/offlineClient';
import { cachedQuerySafe } from '@/lib/offline/cachedQuery';
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
  siswas?: { id: number; nama_lengkap: string } | null;
};

const HARI_ORDER: Record<string, number> = {
  Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6, Minggu: 7,
};

// ============ CACHE PENGATURAN SEKOLAH (OFFLINE) ============
const SEKOLAH_CACHE_KEY = 'smk_offline_pengaturan_sekolah_v1';
function loadCachedSekolah(): PengaturanSekolah | null {
  try {
    const raw = localStorage.getItem(SEKOLAH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as PengaturanSekolah) : null;
  } catch { return null; }
}
function saveCachedSekolah(c: PengaturanSekolah) {
  try { localStorage.setItem(SEKOLAH_CACHE_KEY, JSON.stringify(c)); } catch {}
}

// ============ HELPER GROUP JADWAL ============
export type JadwalGroup = {
  key: string;
  waktu_mulai: string;
  waktu_selesai: string;
  mapel_nama: string;
  jadwalList: JadwalKbmWithRelations[];
  kelas_list: string[];
  is_multi_kelas: boolean;
};

function groupJadwalByWaktu(jadwalList: JadwalKbmWithRelations[]): JadwalGroup[] {
  const groups = new Map<string, JadwalGroup>();
  jadwalList.forEach((j) => {
    const key = `${j.waktu_mulai ?? ''}|${j.waktu_selesai ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.jadwalList.push(j);
      if (j.kelas?.nama_kelas) existing.kelas_list.push(j.kelas.nama_kelas);
      existing.is_multi_kelas = existing.jadwalList.length > 1;
    } else {
      groups.set(key, {
        key,
        waktu_mulai: j.waktu_mulai ?? '',
        waktu_selesai: j.waktu_selesai ?? '',
        mapel_nama: j.mata_pelajarans?.nama_mapel ?? '-',
        jadwalList: [j],
        kelas_list: j.kelas?.nama_kelas ? [j.kelas.nama_kelas] : [],
        is_multi_kelas: false,
      });
    }
  });
  return Array.from(groups.values()).sort((a, b) =>
    a.waktu_mulai.localeCompare(b.waktu_mulai)
  );
}

// ============ HELPER LOKAL ============
function isScheduleActive(jadwal: JadwalKbmWithRelations, todayHari: HariMinggu): boolean {
  if (!jadwal.waktu_mulai || !jadwal.waktu_selesai || !jadwal.hari) return false;
  if (jadwal.hari.trim().toLowerCase() !== todayHari.trim().toLowerCase()) return false;
  return isJadwalAktif(jadwal.waktu_mulai, jadwal.waktu_selesai);
}

function getJadwalTimeStatus(
  jadwal: JadwalKbmWithRelations,
  todayHari: HariMinggu
): 'upcoming' | 'active' | 'ended' {
  if (
    !jadwal.waktu_mulai ||
    !jadwal.waktu_selesai ||
    jadwal.hari?.trim().toLowerCase() !== todayHari.trim().toLowerCase()
  ) return 'ended';
  const now = getCurrentTimeStrWib();
  const mulai = jadwal.waktu_mulai.slice(0, 5);
  const selesai = jadwal.waktu_selesai.slice(0, 5);
  if (now < mulai) return 'upcoming';
  if (now >= mulai && now <= selesai) return 'active';
  return 'ended';
}

function calculateLateMinutes(waktuMulai: string | null): number {
  if (!waktuMulai) return 0;
  const nowWibStr = getCurrentTimeStrWib();
  const [currH, currM] = nowWibStr.split(':').map(Number);
  const [startH, startM] = waktuMulai.split(':').map(Number);
  const currentMinutes = currH * 60 + currM;
  const startMinutes = startH * 60 + startM;
  const toleransiMenit = 5;
  return Math.max(0, currentMinutes - (startMinutes + toleransiMenit));
}

function calculateAlpaJamPelajaran(menitTerlambat: number): number {
  return Math.floor(menitTerlambat / 30);
}

type GpsState = {
  status: 'idle' | 'checking' | 'success' | 'denied' | 'error' | 'out_of_range';
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
  message: string;
};

// ============================================================================
// KOMPONEN UTAMA
// ============================================================================
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
  const [activeJadwalGroup, setActiveJadwalGroup] = useState<JadwalGroup | null>(null);
  const [journalText, setJournalText] = useState('');
  const [saving, setSaving] = useState(false);

  // Baris yang baru di-queue lokal (offline) — untuk optimistic UI
  const [locallyQueued, setLocallyQueued] = useState<AgendaGuruWithRelations[]>([]);

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
    if (!guru) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Jadwal KBM milik guru (semua hari)
      const { data: fetchedJadwal } = await cachedQuerySafe<JadwalKbmWithRelations[]>(
        `jadwal_kbms:guru:${guru.id}:all`,
        async () => {
          const res = await supabase
            .from('jadwal_kbms')
            .select('*, kelas(id, nama_kelas), gurus(id, nama_lengkap), mata_pelajarans(id, nama_mapel)')
            .eq('guru_id', guru.id);
          if (res.error) throw res.error;
          return (res.data as JadwalKbmWithRelations[]) ?? [];
        },
        []
      );
      setJadwalList(fetchedJadwal);

      // 2. Agenda hari ini
      const { data: agendaToday } = await cachedQuerySafe<AgendaGuruWithRelations[]>(
        `agenda_gurus:guru:${guru.id}:tanggal:${todayDate}`,
        async () => {
          const res = await supabase
            .from('agenda_gurus')
            .select('*, jadwal_kbms(id, waktu_mulai, waktu_selesai, kelas(id, nama_kelas), mata_pelajarans(id, nama_mapel))')
            .eq('guru_id', guru.id)
            .eq('tanggal', todayDate)
            .order('created_at', { ascending: false });
          if (res.error) throw res.error;
          return (res.data as AgendaGuruWithRelations[]) ?? [];
        },
        []
      );
      setAgendaList(agendaToday);

      // 3. Riwayat agenda (recent)
      const { data: riwayatData } = await cachedQuerySafe<AgendaGuruWithRelations[]>(
        `agenda_gurus:guru:${guru.id}:riwayat`,
        async () => {
          const res = await supabase
            .from('agenda_gurus')
            .select('*, jadwal_kbms(id, waktu_mulai, waktu_selesai, kelas(id, nama_kelas), mata_pelajarans(id, nama_mapel))')
            .eq('guru_id', guru.id)
            .order('tanggal', { ascending: false })
            .order('created_at', { ascending: false });
          if (res.error) throw res.error;
          return (res.data as AgendaGuruWithRelations[]) ?? [];
        },
        []
      );
      setRiwayatList(riwayatData);

      // 4. Pengaturan sekolah (juga tetap di-cache ke localStorage oleh saveCachedSekolah)
      const { data: sekolahData } = await cachedQuerySafe<PengaturanSekolah | null>(
        'pengaturan_sekolahs:current',
        async () => {
          const res = await supabase.from('pengaturan_sekolahs').select('*').maybeSingle();
          if (res.error && res.error.code !== 'PGRST116') throw res.error;
          return (res.data as PengaturanSekolah | null) ?? null;
        },
        null
      );
      if (sekolahData) {
        setSekolahConfig(sekolahData);
        saveCachedSekolah(sekolahData);
      } else {
        const cached = loadCachedSekolah();
        if (cached) setSekolahConfig(cached);
      }

      // 5. Presensi siswa untuk jadwal guru (semua jadwal) — untuk tampilan riwayat
      const jadwalIds = fetchedJadwal.map((j) => j.id);
      if (jadwalIds.length > 0) {
        const { data: presensiData } = await cachedQuerySafe<PresensiWithSiswa[]>(
          `presensis:jadwal_guru:${guru.id}`,
          async () => {
            const res = await supabase
              .from('presensis')
              .select('*, siswas(id, nama_lengkap)')
              .in('jadwal_kbm_id', jadwalIds);
            if (res.error) throw res.error;
            return (res.data as PresensiWithSiswa[]) ?? [];
          },
          []
        );
        setPresensiList(presensiData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      const cached = loadCachedSekolah();
      if (cached) setSekolahConfig(cached);
    } finally {
      setLoading(false);
    }
  }, [guru, todayDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
  const groupedTodayJadwal = groupJadwalByWaktu(todayJadwal);

  const otherJadwal = sortedJadwalList.filter(
    (j) => j.hari?.trim().toLowerCase() !== todayHari.trim().toLowerCase()
  );

  // ============ GET AGENDA (MERGE SERVER + LOCAL QUEUE) ============
  const getAgendaForJadwal = (jadwalId: number): AgendaGuruWithRelations | null => {
    const serverRow = (agendaList || []).find((a) => a.jadwal_kbm_id === jadwalId);
    if (serverRow) return serverRow;
    const localRow = locallyQueued.find((a) => a.jadwal_kbm_id === jadwalId);
    return localRow ?? null;
  };

  // ============ GPS CHECK (dengan fallback cache) ============
  const checkGpsLocation = (): Promise<GpsState> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const r: GpsState = { status: 'error', latitude: null, longitude: null, distance: null, message: 'Browser tidak mendukung GPS' };
        setGps(r); resolve(r); return;
      }
      setGps({ status: 'checking', latitude: null, longitude: null, distance: null, message: 'Mengambil lokasi GPS...' });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const cfg = sekolahConfig ?? loadCachedSekolah();

          if (!cfg) {
            const r: GpsState = { status: 'error', latitude: lat, longitude: lon, distance: null, message: 'Pengaturan lokasi sekolah belum dikonfigurasi' };
            setGps(r); resolve(r); return;
          }

          const distance = haversineDistance(lat, lon, cfg.latitude, cfg.longitude);
          if (distance > cfg.radius_meter) {
            const r: GpsState = {
              status: 'out_of_range', latitude: lat, longitude: lon, distance,
              message: `Gagal: Anda di luar radius sekolah! (Jarak: ${distance}m, Radius: ${cfg.radius_meter}m)`,
            };
            setGps(r); resolve(r); return;
          }
          const r: GpsState = {
            status: 'success', latitude: lat, longitude: lon, distance,
            message: `Berada di dalam area sekolah (Jarak: ${distance}m)`,
          };
          setGps(r); resolve(r);
        },
        (err) => {
          let message = 'Gagal mengambil lokasi GPS';
          if (err.code === err.PERMISSION_DENIED) message = 'Akses lokasi ditolak. Izinkan GPS di browser Anda.';
          else if (err.code === err.POSITION_UNAVAILABLE) message = 'Posisi GPS tidak tersedia.';
          else if (err.code === err.TIMEOUT) message = 'Timeout mengambil lokasi GPS. Coba lagi.';
          const r: GpsState = { status: 'denied', latitude: null, longitude: null, distance: null, message };
          setGps(r); resolve(r);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  // ============ PRESENSI DIRI (OFFLINE-AWARE) ============
  const handleAbsen = async (jadwal: JadwalKbmWithRelations) => {
    if (isLibur) { showToast('error', `Hari ini libur (${ketLibur}). Pengisian agenda dinonaktifkan.`); return; }
    if (!guru) { showToast('error', 'Sesi pengguna tidak ditemukan'); return; }
    if (!isScheduleActive(jadwal, todayHari)) {
      showToast('error', 'Pengisian presensi hanya bisa dilakukan saat jam pelajaran berlangsung'); return;
    }
    const existing = getAgendaForJadwal(jadwal.id);
    if (existing && (existing.status_kehadiran === 'Hadir Mengajar' || existing.status_kehadiran === 'Terlambat')) {
      showToast('info', 'Anda sudah mengisi presensi untuk jadwal ini'); return;
    }

    const gpsResult = await checkGpsLocation();
    if (gpsResult.status !== 'success') { showToast('error', gpsResult.message); return; }

    setSaving(true);
    try {
      const isAlreadyFilled =
        existing?.menit_terlambat !== null && existing?.menit_terlambat !== undefined;
      const menitTerlambat = calculateLateMinutes(jadwal.waktu_mulai);
      const alpaJp = calculateAlpaJamPelajaran(menitTerlambat);
      const statusKehadiran = menitTerlambat > 0 ? 'Terlambat' : 'Hadir Mengajar';

      if (existing) {
        const patch: Record<string, any> = {
          latitude_guru: gpsResult.latitude,
          longitude_guru: gpsResult.longitude,
          jarak_dari_sekolah: gpsResult.distance,
        };
        if (!isAlreadyFilled) {
          patch.menit_terlambat = menitTerlambat;
          patch.alpa_jam_pelajaran = alpaJp;
          patch.status_kehadiran = statusKehadiran;
        }
        const res = await offlineUpdate('agenda_gurus', { id: existing.id }, patch, {
          userId: guru.id, label: 'Perbarui presensi mengajar',
        });
        if (res.queued) {
          setAgendaList((prev) => prev.map((a) => a.id === existing.id ? { ...a, ...patch } : a));
          showToast('success', 'Tersimpan lokal. Akan dikirim saat online.');
        } else {
          showToast('success', 'Berhasil memperbarui presensi');
          fetchData();
        }
      } else {
        const payload = {
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
          mapel_nama_snapshot: jadwal.mata_pelajarans?.nama_mapel ?? null,
          kelas_nama_snapshot: jadwal.kelas?.nama_kelas ?? null,
          waktu_mulai_snapshot: jadwal.waktu_mulai,
          waktu_selesai_snapshot: jadwal.waktu_selesai,
        };
        const res = await offlineInsert('agenda_gurus', payload, {
          userId: guru.id, label: 'Presensi mengajar',
        });
        if (res.queued) {
          const synthetic: any = {
            id: -Date.now(),
            ...payload,
            created_at: new Date().toISOString(),
          };
          setLocallyQueued((prev) => [...prev, synthetic]);
          showToast('success', 'Tersimpan lokal. Akan dikirim saat online.');
        } else {
          showToast('success',
            `Berhasil mengisi presensi ${statusKehadiran.toLowerCase()}${menitTerlambat > 0 ? ` (${menitTerlambat} menit)` : ''}`
          );
          fetchData();
        }
      }
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan presensi: ' + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  // ============ PRESENSI GRUP (KELAS GABUNGAN) ============
  const handleAbsenGroup = async (group: JadwalGroup) => {
    if (isLibur) { showToast('error', `Hari ini libur (${ketLibur}). Pengisian agenda dinonaktifkan.`); return; }
    if (!guru) { showToast('error', 'Sesi pengguna tidak ditemukan'); return; }

    const firstJadwal = group.jadwalList[0];
    if (!isScheduleActive(firstJadwal, todayHari)) {
      showToast('error', 'Pengisian presensi hanya bisa dilakukan saat jam pelajaran berlangsung'); return;
    }

    const agendas = group.jadwalList.map((j) => getAgendaForJadwal(j.id));
    const allFilled = agendas.every(
      (a) => a?.status_kehadiran === 'Hadir Mengajar' || a?.status_kehadiran === 'Terlambat'
    );
    if (allFilled) { showToast('info', 'Semua kelas di jam ini sudah diisi presensinya'); return; }

    const gpsResult = await checkGpsLocation();
    if (gpsResult.status !== 'success') { showToast('error', gpsResult.message); return; }

    setSaving(true);
    try {
      const menitTerlambat = calculateLateMinutes(firstJadwal.waktu_mulai);
      const alpaJp = calculateAlpaJamPelajaran(menitTerlambat);
      const statusKehadiran = menitTerlambat > 0 ? 'Terlambat' : 'Hadir Mengajar';
      let queuedCount = 0;
      const syntheticRows: AgendaGuruWithRelations[] = [];
      const serverPatch: Array<{ id: number; patch: any }> = [];

      for (const jadwal of group.jadwalList) {
        const existing = getAgendaForJadwal(jadwal.id);
        const isAlreadyFilled =
          existing?.menit_terlambat !== null && existing?.menit_terlambat !== undefined;

        if (existing) {
          const patch: Record<string, any> = {
            latitude_guru: gpsResult.latitude,
            longitude_guru: gpsResult.longitude,
            jarak_dari_sekolah: gpsResult.distance,
          };
          if (!isAlreadyFilled) {
            patch.menit_terlambat = menitTerlambat;
            patch.alpa_jam_pelajaran = alpaJp;
            patch.status_kehadiran = statusKehadiran;
          }
          const res = await offlineUpdate('agenda_gurus', { id: existing.id }, patch, {
            userId: guru.id, label: 'Perbarui presensi grup',
          });
          if (res.queued) {
            queuedCount++;
            serverPatch.push({ id: existing.id, patch });
          }
        } else {
          const payload = {
            guru_id: guru.id,
            jadwal_kbm_id: jadwal.id,
            tanggal: todayDate,
            status_kehadiran: statusKehadiran,
            latitude_guru: gpsResult.latitude,
            longitude_guru: gpsResult.longitude,
            jarak_dari_sekolah: gpsResult.distance,
            menit_terlambat: menitTerlambat,
            alpa_jam_pelajaran: alpaJp,
            mapel_nama_snapshot: jadwal.mata_pelajarans?.nama_mapel ?? null,
            kelas_nama_snapshot: jadwal.kelas?.nama_kelas ?? null,
            waktu_mulai_snapshot: jadwal.waktu_mulai,
            waktu_selesai_snapshot: jadwal.waktu_selesai,
          };
          const res = await offlineInsert('agenda_gurus', payload, {
            userId: guru.id, label: 'Presensi grup',
          });
          if (res.queued) {
            queuedCount++;
            syntheticRows.push({
              id: -Date.now() - jadwal.id,
              ...payload,
              created_at: new Date().toISOString(),
            } as any);
          }
        }
      }

      if (queuedCount > 0) {
        // Update UI lokal
        setLocallyQueued((prev) => [...prev, ...syntheticRows]);
        if (serverPatch.length > 0) {
          setAgendaList((prev) =>
            prev.map((a) => {
              const p = serverPatch.find((s) => s.id === a.id);
              return p ? { ...a, ...p.patch } : a;
            })
          );
        }
        showToast('success', `Tersimpan lokal (${queuedCount} baris). Akan dikirim saat online.`);
      } else {
        showToast('success',
          group.is_multi_kelas
            ? `Presensi ${group.jadwalList.length} kelas berhasil (${statusKehadiran.toLowerCase()})`
            : `Presensi berhasil (${statusKehadiran.toLowerCase()})`
        );
        fetchData();
      }
    } catch (err: any) {
      showToast('error', 'Gagal presensi: ' + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  // ============ JURNAL GRUP ============
  const openJournalGroup = async (group: JadwalGroup) => {
    if (isLibur) { showToast('error', `Hari ini libur (${ketLibur}). Pengisian agenda dinonaktifkan.`); return; }
    const firstJadwal = group.jadwalList[0];
    if (!isScheduleActive(firstJadwal, todayHari)) {
      showToast('error', 'Jurnal hanya bisa diisi saat jam pelajaran berlangsung'); return;
    }
    const gpsResult = await checkGpsLocation();
    if (gpsResult.status !== 'success') { showToast('error', gpsResult.message); return; }

    const existingAgendas = group.jadwalList.map((j) => getAgendaForJadwal(j.id));
    const existingCatatan = existingAgendas.find((a) => a?.catatan_materi)?.catatan_materi ?? '';

    setActiveJadwalGroup(group);
    setJournalText(existingCatatan);
    setJournalModal(true);
  };

  const handleSaveJournalGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLibur) { showToast('error', `Hari ini libur (${ketLibur}).`); setJournalModal(false); return; }
    if (!activeJadwalGroup || !guru) return;
    if (!journalText.trim()) { showToast('error', 'Catatan materi jurnal tidak boleh kosong'); return; }

    const firstJadwal = activeJadwalGroup.jadwalList[0];
    if (!isScheduleActive(firstJadwal, todayHari)) {
      showToast('error', 'Jam pelajaran telah berakhir, tidak dapat mengubah jurnal');
      setJournalModal(false); return;
    }
    const gpsResult = await checkGpsLocation();
    if (gpsResult.status !== 'success') { showToast('error', gpsResult.message); return; }

    setSaving(true);
    try {
      const menitTerlambat = calculateLateMinutes(firstJadwal.waktu_mulai);
      const alpaJp = calculateAlpaJamPelajaran(menitTerlambat);
      const statusKehadiran = menitTerlambat > 0 ? 'Terlambat' : 'Hadir Mengajar';
      let queuedCount = 0;
      const syntheticRows: AgendaGuruWithRelations[] = [];
      const serverPatch: Array<{ id: number; patch: any }> = [];

      for (const jadwal of activeJadwalGroup.jadwalList) {
        const existing = getAgendaForJadwal(jadwal.id);
        const isAlreadyFilled =
          existing?.menit_terlambat !== null && existing?.menit_terlambat !== undefined;

        if (existing) {
          const patch: Record<string, any> = {
            catatan_materi: journalText.trim(),
            latitude_guru: gpsResult.latitude,
            longitude_guru: gpsResult.longitude,
            jarak_dari_sekolah: gpsResult.distance,
          };
          if (!isAlreadyFilled) {
            patch.menit_terlambat = menitTerlambat;
            patch.alpa_jam_pelajaran = alpaJp;
            patch.status_kehadiran = statusKehadiran;
          }
          const res = await offlineUpdate('agenda_gurus', { id: existing.id }, patch, {
            userId: guru.id, label: 'Jurnal grup',
          });
          if (res.queued) {
            queuedCount++;
            serverPatch.push({ id: existing.id, patch });
          }
        } else {
          const payload = {
            guru_id: guru.id,
            jadwal_kbm_id: jadwal.id,
            tanggal: todayDate,
            status_kehadiran: statusKehadiran,
            catatan_materi: journalText.trim(),
            latitude_guru: gpsResult.latitude,
            longitude_guru: gpsResult.longitude,
            jarak_dari_sekolah: gpsResult.distance,
            menit_terlambat: menitTerlambat,
            alpa_jam_pelajaran: alpaJp,
            mapel_nama_snapshot: jadwal.mata_pelajarans?.nama_mapel ?? null,
            kelas_nama_snapshot: jadwal.kelas?.nama_kelas ?? null,
            waktu_mulai_snapshot: jadwal.waktu_mulai,
            waktu_selesai_snapshot: jadwal.waktu_selesai,
          };
          const res = await offlineInsert('agenda_gurus', payload, {
            userId: guru.id, label: 'Jurnal grup',
          });
          if (res.queued) {
            queuedCount++;
            syntheticRows.push({
              id: -Date.now() - jadwal.id,
              ...payload,
              created_at: new Date().toISOString(),
            } as any);
          }
        }
      }

      if (queuedCount > 0) {
        setLocallyQueued((prev) => [...prev, ...syntheticRows]);
        if (serverPatch.length > 0) {
          setAgendaList((prev) =>
            prev.map((a) => {
              const p = serverPatch.find((s) => s.id === a.id);
              return p ? { ...a, ...p.patch } : a;
            })
          );
        }
        showToast('success', `Jurnal tersimpan lokal (${queuedCount} baris). Akan dikirim saat online.`);
      } else {
        showToast('success',
          activeJadwalGroup.is_multi_kelas
            ? `Jurnal tersimpan untuk ${activeJadwalGroup.jadwalList.length} kelas`
            : 'Jurnal berhasil disimpan'
        );
        fetchData();
      }
      setJournalModal(false);
      setActiveJadwalGroup(null);
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan jurnal: ' + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  const getMapelName = (j: JadwalKbmWithRelations): string =>
    j.mata_pelajarans?.nama_mapel ?? '-';

  const filteredRiwayat = riwayatList.filter((item) => {
    const query = searchRiwayat.toLowerCase();
    const mapelName = item.jadwal_kbms?.mata_pelajarans?.nama_mapel?.toLowerCase() || '';
    const kelasName = item.jadwal_kbms?.kelas?.nama_kelas?.toLowerCase() || '';
    const materi = item.catatan_materi?.toLowerCase() || '';
    const status = item.status_kehadiran?.toLowerCase() || '';
    const tanggal = item.tanggal || '';
    const matchesSearch =
      mapelName.includes(query) || kelasName.includes(query) || materi.includes(query) ||
      status.includes(query) || tanggal.includes(query);
    const matchesDateRange =
      (!startDateFilter || tanggal >= startDateFilter) &&
      (!endDateFilter || tanggal <= endDateFilter);
    return matchesSearch && matchesDateRange;
  });

  const exportToExcel = () => {
    if (filteredRiwayat.length === 0) { showToast('info', 'Tidak ada data riwayat untuk diekspor'); return; }
    const dataToExport = filteredRiwayat.map((item, index) => {
      const presensisForAgenda = presensiList.filter(
        (p) => p.tanggal === item.tanggal && p.jadwal_kbm_id === item.jadwal_kbm_id
      );
      const tidakHadirList = presensisForAgenda.filter((p) => p.status !== 'Hadir');
      let presensiSiswaText = 'Semua Siswa Hadir';
      if (presensisForAgenda.length === 0) presensiSiswaText = 'Guru tidak mencatat presensi';
      else if (tidakHadirList.length > 0) {
        presensiSiswaText = tidakHadirList.map(
          (p) => `${p.siswas?.nama_lengkap || 'Siswa'} (${p.status}${p.keterangan ? `: ${p.keterangan}` : ''})`
        ).join(', ');
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
    if (filteredRiwayat.length === 0) { showToast('info', 'Tidak ada data riwayat untuk diekspor'); return; }
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Laporan Riwayat Agenda & Presensi Mengajar', 14, 15);
    doc.setFontSize(10);
    doc.text(
      `Nama Guru: ${guru?.nama_lengkap || '-'} | Periode: ${startDateFilter} s/d ${endDateFilter}`,
      14, 22
    );
    const tableRows = filteredRiwayat.map((item, index) => {
      const presensisForAgenda = presensiList.filter(
        (p) => p.tanggal === item.tanggal && p.jadwal_kbm_id === item.jadwal_kbm_id
      );
      const tidakHadirList = presensisForAgenda.filter((p) => p.status !== 'Hadir');
      let presensiSiswaText = 'Semua Siswa Hadir';
      if (presensisForAgenda.length === 0) presensiSiswaText = 'Guru tidak mencatat presensi';
      else if (tidakHadirList.length > 0) {
        presensiSiswaText = tidakHadirList.map(
          (p) => `${p.siswas?.nama_lengkap || 'Siswa'} (${p.status}${p.keterangan ? `: ${p.keterangan}` : ''})`
        ).join('\n');
      }
      return [
        index + 1, item.tanggal,
        `${item.jadwal_kbms?.waktu_mulai?.slice(0, 5) || ''} - ${item.jadwal_kbms?.waktu_selesai?.slice(0, 5) || ''}`,
        item.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '-',
        item.jadwal_kbms?.kelas?.nama_kelas ?? '-',
        item.status_kehadiran, presensiSiswaText, item.catatan_materi || '-',
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
      case 'Hadir': return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
      case 'Terlambat': return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
      case 'Alpa': return 'bg-red-500/15 border-red-500/30 text-red-400';
      case 'Izin': return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
      case 'Sakit': return 'bg-purple-500/15 border-purple-500/30 text-purple-400';
      default: return 'bg-slate-800 border-slate-700 text-slate-300';
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
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('hari_ini')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'hari_ini'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CalendarDays size={16} /> Agenda Hari Ini
          </button>
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History size={16} /> Riwayat Agenda Saya
          </button>
        </div>
      </div>

      {!sekolahConfig && (
        <div className="bg-amber-950/40 border border-amber-500/30 text-amber-300 rounded-2xl p-4 flex items-start gap-3 backdrop-blur-sm">
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-bold text-amber-200">Pengaturan lokasi sekolah belum dikonfigurasi</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Admin perlu mengatur titik koordinat dan radius sekolah di tabel{' '}
              <code className="bg-amber-950 px-1 py-0.5 rounded text-amber-200">pengaturan_sekolahs</code>{' '}
              sebelum fitur validasi GPS dapat digunakan.
            </p>
          </div>
        </div>
      )}

      {/* ================= TAB 1: AGENDA HARI INI ================= */}
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
                      timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                  <p className="text-slate-400 text-sm flex items-center gap-1.5 mt-0.5 font-mono">
                    <Clock size={14} className="text-indigo-400" />
                    Pukul {currentTime.toLocaleTimeString('id-ID', {
                      timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit',
                    })} WIB
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

          {/* ============ PANEL STATUS GPS + TOMBOL PERBARUI ============ */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-5 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 ${
                gps.status === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                gps.status === 'checking' ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' :
                gps.status === 'out_of_range' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                (gps.status === 'denied' || gps.status === 'error') ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' :
                'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <Navigation size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status Lokasi GPS</p>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">
                  {gps.status === 'idle' && 'Belum dicek'}
                  {gps.status === 'checking' && 'Mengambil lokasi...'}
                  {gps.status === 'success' && `Di dalam area sekolah (${gps.distance}m)`}
                  {gps.status === 'out_of_range' && `Di luar area sekolah (${gps.distance}m)`}
                  {gps.status === 'denied' && 'Akses lokasi ditolak'}
                  {gps.status === 'error' && 'Gagal mengambil lokasi'}
                </p>
                {gps.status === 'success' && gps.latitude && gps.longitude && (
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => checkGpsLocation()}
              disabled={gps.status === 'checking'}
              className="inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw size={14} className={gps.status === 'checking' ? 'animate-spin text-indigo-400' : ''} />
              {gps.status === 'checking' ? 'Mencari GPS...' : 'Perbarui Lokasi GPS'}
            </button>
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
                {groupedTodayJadwal.map((group, index) => {
                  const firstJadwal = group.jadwalList[0];
                  const active = isScheduleActive(firstJadwal, todayHari);
                  const timeStatus = getJadwalTimeStatus(firstJadwal, todayHari);

                  const agendas = group.jadwalList.map((j) => getAgendaForJadwal(j.id));
                  const allSudahAbsen = agendas.every(
                    (a) => a?.status_kehadiran === 'Hadir Mengajar' || a?.status_kehadiran === 'Terlambat'
                  );
                  const catatanMateri = agendas.find((a) => a?.catatan_materi)?.catatan_materi;

                  return (
                    <div
                      key={group.key}
                      className={`bg-slate-900 rounded-3xl border p-5 md:p-6 transition-all duration-200 backdrop-blur-xl ${
                        active && !isLibur
                          ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                          : 'border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border transition-all ${
                            active && !isLibur
                              ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/25'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}>
                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80 leading-none">Ke-</span>
                            <span className="text-xl font-extrabold leading-tight">{index + 1}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-bold text-slate-100 tracking-tight">{group.mapel_nama}</h3>
                              {group.is_multi_kelas && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  📚 Kelas Gabungan ({group.jadwalList.length} kelas)
                                </span>
                              )}
                            </div>
                            {group.is_multi_kelas ? (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {group.kelas_list.map((namaKelas, i) => (
                                  <span key={i} className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                    {namaKelas}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm font-semibold text-indigo-400 mt-0.5">
                                Kelas {group.kelas_list[0] ?? '-'}
                              </p>
                            )}
                            {group.waktu_mulai && group.waktu_selesai && (
                              <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1">
                                <Clock size={12} className="text-slate-500" />
                                {group.waktu_mulai.slice(0, 5)} - {group.waktu_selesai.slice(0, 5)} WIB
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
                          {allSudahAbsen ? (
                            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/10">
                              <CheckCircle2 size={16} />
                              <span>Presensi Selesai{group.is_multi_kelas && ` (${group.jadwalList.length} kelas)`}</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAbsenGroup(group)}
                              disabled={!active || saving || gps.status === 'checking' || isLibur}
                              className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 border ${
                                active && !isLibur
                                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 border-transparent shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95'
                                  : 'bg-slate-950/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
                              }`}
                            >
                              {active && !isLibur ? <CheckCircle2 size={16} /> : <Lock size={16} />}
                              Presensi Diri{group.is_multi_kelas && ` (${group.jadwalList.length} Kelas)`}
                            </button>
                          )}
                          <button
                            onClick={() => openJournalGroup(group)}
                            disabled={!active || saving || gps.status === 'checking' || isLibur}
                            className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 border ${
                              active && !isLibur
                                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border-transparent shadow-lg shadow-indigo-500/25 cursor-pointer active:scale-95'
                                : 'bg-slate-950/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
                            }`}
                          >
                            {active && !isLibur ? <NotebookPen size={16} /> : <Lock size={16} />}
                            {catatanMateri ? 'Edit Jurnal' : 'Isi Jurnal'}
                            {group.is_multi_kelas && ` (${group.jadwalList.length} Kelas)`}
                          </button>
                        </div>
                      </div>

                      {catatanMateri && (
                        <div className="mt-4 pt-4 border-t border-slate-800/80">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Catatan Materi{group.is_multi_kelas ? ' (sama untuk semua kelas)' : ''}:
                          </p>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 leading-relaxed">
                            {catatanMateri}
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

      {/* ================= TAB 2: RIWAYAT ================= */}
      {activeTab === 'riwayat' && (
        <div className="space-y-6">
          <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
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
              <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-2xl p-1.5 px-3">
                <Filter className="text-indigo-400 shrink-0" size={14} />
                <input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer" />
                <span className="text-slate-600 text-xs font-semibold">s/d</span>
                <input type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3 w-full xl:w-auto">
              <div className="text-xs text-slate-400 font-medium hidden lg:block">
                Total: <span className="text-indigo-400 font-bold">{filteredRiwayat.length}</span> Rekaman
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button onClick={exportToExcel}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-lg shadow-emerald-600/10">
                  <FileSpreadsheet size={16} /> Ekspor Excel
                </button>
                <button onClick={exportToPdf}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-lg shadow-red-600/10">
                  <Download size={16} /> Ekspor PDF
                </button>
              </div>
            </div>
          </div>

          {filteredRiwayat.length === 0 ? (
            <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 text-center py-16 px-6 backdrop-blur-xl">
              <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <FileText size={32} />
              </div>
              <p className="text-slate-400 text-base font-medium">
                {searchRiwayat || startDateFilter || endDateFilter
                  ? 'Tidak ada riwayat agenda yang cocok.'
                  : 'Belum ada riwayat rekaman agenda.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredRiwayat.map((item) => {
                const mapelName = item.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? item.mapel_nama_snapshot ?? '-';
                const kelasName = item.jadwal_kbms?.kelas?.nama_kelas ?? '-';
                const waktuMulai = item.jadwal_kbms?.waktu_mulai?.slice(0, 5) ?? '';
                const waktuSelesai = item.jadwal_kbms?.waktu_selesai?.slice(0, 5) ?? '';
                const presensisForAgenda = presensiList.filter(
                  (p) => p.tanggal === item.tanggal && p.jadwal_kbm_id === item.jadwal_kbm_id
                );
                const tidakHadirList = presensisForAgenda.filter((p) => p.status !== 'Hadir');

                return (
                  <div key={item.id}
                    className="bg-slate-900 rounded-3xl border border-slate-800/80 p-5 md:p-6 backdrop-blur-xl hover:border-slate-700 transition-all shadow-xl space-y-4">
                    <div className="flex items-start justify-between flex-wrap gap-3 border-b border-slate-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 text-indigo-400 flex items-center justify-center shrink-0">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-100">
                            {new Date(item.tanggal).toLocaleDateString('id-ID', {
                              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
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
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadgeStyle(item.status_kehadiran)}`}>
                        {item.status_kehadiran}
                      </span>
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
                        <Users size={14} className="text-indigo-400" /> Presensi Siswa:
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
                              <div key={p.id}
                                className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
                                <span className="font-semibold text-slate-200">{p.siswas?.nama_lengkap || 'Siswa'}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeStyle(p.status)}`}>
                                  {p.status}
                                </span>
                                {p.keterangan && (
                                  <span className="text-slate-400 text-[11px] italic">({p.keterangan})</span>
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
                        {item.catatan_materi || (
                          <span className="italic text-slate-600">Tidak ada catatan materi.</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL JURNAL ================= */}
      <Modal
        open={journalModal}
        onClose={() => { setJournalModal(false); setActiveJadwalGroup(null); }}
        title="Isi Jurnal / Agenda Materi"
        size="lg"
      >
        {activeJadwalGroup && (
          <form onSubmit={handleSaveJournalGroup} className="space-y-5">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Waktu</p>
                  <p className="font-mono font-semibold text-slate-200 mt-0.5">
                    {activeJadwalGroup.waktu_mulai?.slice(0, 5)} - {activeJadwalGroup.waktu_selesai?.slice(0, 5)} WIB
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mata Pelajaran</p>
                  <p className="font-semibold text-slate-200 mt-0.5">{activeJadwalGroup.mapel_nama}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Kelas</p>
                  {activeJadwalGroup.is_multi_kelas ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {activeJadwalGroup.kelas_list.map((k, i) => (
                        <span key={i}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                          {k}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="font-semibold text-indigo-400 mt-0.5">{activeJadwalGroup.kelas_list[0] ?? '-'}</p>
                  )}
                </div>
              </div>
              {activeJadwalGroup.is_multi_kelas && (
                <div className="mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-purple-300 flex items-center gap-1.5">
                  <span>📚</span>
                  <span>Jurnal ini akan disimpan untuk <strong>{activeJadwalGroup.jadwalList.length} kelas</strong> sekaligus.</span>
                </div>
              )}
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
                onClick={() => { setJournalModal(false); setActiveJadwalGroup(null); }}
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