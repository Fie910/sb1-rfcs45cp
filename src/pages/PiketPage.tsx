import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Check,
  X,
  UserCheck,
  Calendar,
  BookOpen,
  Users,
  FileText,
  UserX,
  Link as LinkIcon,
  ExternalLink,
  Copy,
  Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import type {
  JadwalPiket,
  IzinGuruPiketWithRelations,
  HariMinggu,
} from '@/types/database';
import { STATUS_OPTIONS, type StatusKehadiranGuru } from '@/constants/piket';

export interface OptionStatus {
  value: StatusKehadiranGuru;
  label: string;
  badgeClass: string;
}

interface JadwalKBMJP {
  id: number;
  jam_ke: number;
  hari: HariMinggu;
  waktu_mulai: string;
  waktu_selesai: string;
  guru_id: string;
  kelas_id: number;
  mapel_id?: number;
  gurus?: { id: string; nama_lengkap?: string; nip?: string };
  kelas?: { id: number; nama_kelas?: string };
  mata_pelajarans?: { id: number; nama_mapel?: string };
}

const HARI_MAP: Record<number, HariMinggu> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

// Helper tanggal & waktu berbasis WIB (Asia/Jakarta)
function getWIBDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getHariFromDate(dateStr: string): HariMinggu {
  const date = new Date(`${dateStr}T12:00:00+07:00`);
  return HARI_MAP[date.getDay()];
}

function getTodayHariWIB(): HariMinggu {
  return getHariFromDate(getWIBDateString());
}

export function PiketPage() {
  const { guru } = useAuth();

  const [piketSchedule, setPiketSchedule] = useState<JadwalPiket[]>([]);
  const [izinList, setIzinList] = useState<IzinGuruPiketWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayHari] = useState<HariMinggu>(getTodayHariWIB());

  const [detailModal, setDetailModal] = useState(false);
  const [selectedIzin, setSelectedIzin] = useState<IzinGuruPiketWithRelations | null>(null);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'presensi_jp' | 'delegasi_izin'>('presensi_jp');
  const [selectedDate, setSelectedDate] = useState<string>(getWIBDateString());
  const [selectedJamKe, setSelectedJamKe] = useState<number>(0);
  const [jadwalKbmjpList, setJadwalKbmjpList] = useState<JadwalKBMJP[]>([]);
  
  const [presensiMap, setPresensiMap] = useState<Record<number, StatusKehadiranGuru | null>>({});
  const [loadingKbm, setLoadingKbm] = useState(false);
  const [savingKbmId, setSavingKbmId] = useState<number | null>(null);

  // State Proteksi Hari Libur
  const [isHariLibur, setIsHariLibur] = useState<boolean>(false);
  const [keteranganLibur, setKeteranganLibur] = useState<string>('');

  // State untuk penanda item yang baru saja dicopy
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      let piketData: JadwalPiket[] = [];
      if (guru?.id) {
        const piketRes = await supabase
          .from('jadwal_pikets')
          .select('*')
          .eq('guru_id', guru.id);

        if (!piketRes.error) {
          piketData = (piketRes.data as JadwalPiket[]) ?? [];
        }
      }

      const izinRes = await supabase
        .from('izin_guru_pikets')
        .select(`
          *,
          gurus:guru_izin_id(id, nama_lengkap),
          kelas:kelas_id(id, nama_kelas),
          mata_pelajarans:mapel_id(id, nama_mapel),
          guru_piket:guru_piket_id(id, nama_lengkap)
        `)
        .order('created_at', { ascending: false });

      let finalIzinData: IzinGuruPiketWithRelations[] = [];
      if (izinRes.error) {
        const fallbackRes = await supabase
          .from('izin_guru_pikets')
          .select('*')
          .order('created_at', { ascending: false });
        finalIzinData = (fallbackRes.data as IzinGuruPiketWithRelations[]) ?? [];
      } else {
        finalIzinData = (izinRes.data as IzinGuruPiketWithRelations[]) ?? [];
      }

      setPiketSchedule(piketData);
      setIzinList(finalIzinData);
    } catch (err) {
      console.error('Error fetching piket data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchKbmjpData = async () => {
    setLoadingKbm(true);
    setIsHariLibur(false);
    setKeteranganLibur('');

    const targetHari = getHariFromDate(selectedDate);

    if (targetHari === 'Minggu') {
      setIsHariLibur(true);
      setKeteranganLibur('Hari Minggu (Libur Akhir Pekan)');
      setJadwalKbmjpList([]);
      setPresensiMap({});
      setLoadingKbm(false);
      return;
    }

    try {
      const { data: liburData, error: liburErr } = await supabase
        .from('hari_libur')
        .select('keterangan')
        .eq('tanggal', selectedDate)
        .maybeSingle();

      if (!liburErr && liburData) {
        setIsHariLibur(true);
        setKeteranganLibur(liburData.keterangan || 'Hari Libur Sekolah / Nasional');
        setJadwalKbmjpList([]);
        setPresensiMap({});
        setLoadingKbm(false);
        return;
      }

      let query = supabase
        .from('jadwal_kbmjps')
        .select(`
          id,
          jam_ke,
          hari,
          waktu_mulai,
          waktu_selesai,
          guru_id,
          kelas_id,
          mapel_id,
          gurus:guru_id ( id, nama_lengkap, nip ),
          kelas:kelas_id ( id, nama_kelas ),
          mata_pelajarans:mapel_id ( id, nama_mapel )
        `)
        .eq('hari', targetHari);

      if (selectedJamKe > 0) {
        query = query.eq('jam_ke', selectedJamKe);
      }

      const { data: kbmData, error: kbmErr } = await query;
      if (kbmErr) throw kbmErr;

      setJadwalKbmjpList((kbmData as unknown as JadwalKBMJP[]) || []);

      const { data: presensiData, error: presensiErr } = await supabase
        .from('presensi_guru_piket')
        .select('jadwal_kbmjp_id, status')
        .eq('tanggal', selectedDate);

      if (presensiErr) throw presensiErr;

      const map: Record<number, StatusKehadiranGuru | null> = {};
      presensiData?.forEach((item: { jadwal_kbmjp_id: number; status: StatusKehadiranGuru }) => {
        map[item.jadwal_kbmjp_id] = item.status;
      });
      setPresensiMap(map);
    } catch (err: any) {
      console.error('Error fetching KBM JP data:', err);
      showToast('error', 'Gagal memuat jadwal KBM JP: ' + err.message);
    } finally {
      setLoadingKbm(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [guru]);

  useEffect(() => {
    fetchKbmjpData();
  }, [selectedDate, selectedJamKe]);

  const handleStatusKbmChange = async (item: JadwalKBMJP, newStatus: StatusKehadiranGuru) => {
    if (isHariLibur) {
      showToast('error', 'Tidak dapat memperbarui presensi pada hari libur');
      return;
    }

    setSavingKbmId(item.id);
    setPresensiMap((prev) => ({ ...prev, [item.id]: newStatus }));

    try {
      const { error } = await supabase.from('presensi_guru_piket').upsert(
        {
          tanggal: selectedDate,
          jadwal_kbmjp_id: item.id,
          guru_id: item.guru_id,
          status: newStatus,
          piket_user_id: guru?.id || null,
        },
        { onConflict: 'tanggal,jadwal_kbmjp_id' }
      );

      if (error) throw error;
      const guruNama = item.gurus?.nama_lengkap || 'Guru';
      showToast('success', `Status presensi ${guruNama} berhasil diperbarui`);
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan presensi: ' + err.message);
      fetchKbmjpData();
    } finally {
      setSavingKbmId(null);
    }
  };

  // Function untuk Copy Text Delegasi Tugas
  const handleCopyTask = (text: string, idKey: string | number) => {
    if (!text || text === 'Tidak ada titipan tugas') {
      showToast('error', 'Tidak ada teks tugas untuk disalin');
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    showToast('success', 'Delegasi tugas berhasil disalin ke clipboard');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Function untuk Print / Export PDF Lembar Tugas (Tanpa Alasan Izin)
  const handlePrintTask = (izin: IzinGuruPiketWithRelations) => {
    const guruNama = izin.gurus?.nama_lengkap ?? (izin as any).nama_guru ?? '-';
    const guruMapel = izin.mata_pelajarans?.nama_mapel ?? (izin as any).mata_pelajaran ?? '-';
    const kelasNama = izin.kelas?.nama_kelas ?? (izin as any).nama_kelas ?? '-';
    const tugasText = izin.titipan_tugas || 'Tidak ada titipan tugas';
    const fileUrl = (izin as any).url_file || (izin as any).link_tugas || (izin as any).file_url;
    
    const tglFormatted = new Date(`${izin.tanggal_izin}T12:00:00+07:00`).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('error', 'Gagal membuka jendela cetak. Izinkan pop-up pada browser Anda.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Delegasi Tugas - ${kelasNama} - ${guruNama}</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; }
          .header p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { padding: 6px 8px; font-size: 13px; vertical-align: top; }
          .info-table td.label { font-weight: bold; width: 120px; color: #334155; }
          .task-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; min-height: 140px; font-size: 13px; white-space: pre-wrap; background: #f8fafc; color: #0f172a; line-height: 1.6; }
          .link-box { margin-top: 10px; font-size: 12px; color: #2563eb; word-break: break-all; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; text-align: center; }
          .signature { width: 40%; }
          .signature-space { height: 60px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>LEMBAR DELEGASI TUGAS SISWA</h2>
          <p>Hari / Tanggal: ${tglFormatted}</p>
        </div>
        
        <table class="info-table">
          <tr>
            <td class="label">Nama Guru</td>
            <td>: ${guruNama}</td>
            <td class="label">Kelas Target</td>
            <td>: ${kelasNama}</td>
          </tr>
          <tr>
            <td class="label">Mata Pelajaran</td>
            <td colspan="3">: ${guruMapel}</td>
          </tr>
        </table>

        <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px; color: #334155;">Instruksi / Rincian Tugas:</div>
        <div class="task-box">${tugasText}</div>

        ${fileUrl ? `<div class="link-box"><strong>Lampiran File/Tugas:</strong> ${fileUrl}</div>` : ''}

        <div class="footer">
          <div class="signature">
            <p>Ketua / Perwakilan Kelas</p>
            <div class="signature-space"></div>
            <p>( _______________________ )</p>
          </div>
          <div class="signature">
            <p>Guru Piket Bertugas</p>
            <div class="signature-space"></div>
            <p>( ${guru?.nama_lengkap || '_______________________'} )</p>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const isPiketToday = piketSchedule.some((p) => p.hari_piket === todayHari);
  const canEditPresensi = (isPiketToday || guru?.role === 'admin') && !isHariLibur;
  const todayDate = getWIBDateString();
  const todayIzinList = izinList.filter((i) => i.tanggal_izin === todayDate);
  const belumDisampaikan = todayIzinList.filter((i) => i.status_penyampaian === 'Belum Disampaikan');
  const sudahDisampaikan = todayIzinList.filter((i) => i.status_penyampaian === 'Sudah Disampaikan');

  // Ringkasan Statistik Presensi Hari Terpilih
  const totalKbm = isHariLibur ? 0 : jadwalKbmjpList.length;
  const totalHadir = isHariLibur ? 0 : Object.values(presensiMap).filter((status) => status === 'hadir').length;
  const totalIzinAbal = isHariLibur ? 0 : Object.values(presensiMap).filter(
    (status) => status && status !== 'hadir'
  ).length;
  const totalBelumDiisi = isHariLibur ? 0 : totalKbm - Object.keys(presensiMap).length;

  const openDetail = (izin: IzinGuruPiketWithRelations) => {
    setSelectedIzin(izin);
    setDetailModal(true);
  };

  const handleTogglePenyampaian = async (izin: IzinGuruPiketWithRelations) => {
    const isSudah = izin.status_penyampaian === 'Sudah Disampaikan';
    const newStatusPenyampaian = isSudah ? 'Belum Disampaikan' : 'Sudah Disampaikan';
    const newStatusPenanganan = isSudah ? 'Menunggu' : 'Selesai';
    const newWaktu = isSudah ? null : new Date().toISOString();
    const newGuruPiket = isSudah ? null : guru?.id;

    setSaving(true);
    const { error } = await supabase
      .from('izin_guru_pikets')
      .update({
        status_penyampaian: newStatusPenyampaian,
        status_penanganan: newStatusPenanganan,
        waktu_penyampaian: newWaktu,
        guru_piket_id: newGuruPiket,
      })
      .eq('id', izin.id);

    if (error) {
      showToast('error', 'Gagal memperbarui: ' + error.message);
    } else {
      showToast(
        'success',
        !isSudah
          ? 'Tugas ditandai selesai & diserahkan'
          : 'Status dikembalikan ke menunggu'
      );
      fetchData();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400" size={36} />
      </div>
    );
  }

  const renderIzinCard = (izin: IzinGuruPiketWithRelations) => {
    const isSudah = izin.status_penyampaian === 'Sudah Disampaikan';
    const guruNama = izin.gurus?.nama_lengkap ?? (izin as any).nama_guru ?? 'Guru';
    const guruMapel = izin.mata_pelajarans?.nama_mapel ?? (izin as any).mata_pelajaran ?? '-';
    const kelasNama = izin.kelas?.nama_kelas ?? (izin as any).nama_kelas ?? '-';
    const alasan = izin.keterangan_izin ?? izin.kategori_izin ?? (izin as any).alasan_izin ?? '-';
    const fileUrl = (izin as any).url_file || (izin as any).link_tugas || (izin as any).file_url;

    return (
      <div
        key={izin.id}
        className={`bg-slate-900 rounded-3xl border p-5 transition-all shadow-xl backdrop-blur-xl ${
          isSudah
            ? 'border-emerald-500/30 hover:border-emerald-500/50'
            : 'border-amber-500/30 hover:border-amber-500/50'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                isSudah
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}
            >
              {isSudah ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            </div>
            <div>
              <p className="font-bold text-slate-100">{guruNama}</p>
              <p className="text-xs text-slate-400">{guruMapel}</p>
            </div>
          </div>
          <span
            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
              isSudah
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}
          >
            {isSudah ? 'Sudah Disampaikan' : 'Belum Disampaikan'}
          </span>
        </div>

        <div className="space-y-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 min-w-20">Kelas:</span>
            <span className="text-slate-200 font-medium">{kelasNama}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 min-w-20">Mapel:</span>
            <span className="text-slate-200 font-medium">{guruMapel}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 min-w-20 pt-0.5">Alasan:</span>
            <span className="text-slate-300">{alasan}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 mt-3">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Delegasi Tugas:
              </p>
              <div className="flex items-center gap-1.5">
                {/* Tombol Cetak / PDF */}
                <button
                  type="button"
                  onClick={() => handlePrintTask(izin)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-indigo-300 bg-slate-900 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                  title="Cetak / Simpan PDF"
                >
                  <Printer size={13} />
                  <span>Cetak / PDF</span>
                </button>

                {/* Tombol Copy Text */}
                {izin.titipan_tugas && (
                  <button
                    type="button"
                    onClick={() => handleCopyTask(izin.titipan_tugas, izin.id)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-indigo-300 bg-slate-900 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    title="Salin Teks Tugas"
                  >
                    {copiedId === izin.id ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span className="text-emerald-400">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Salin Teks</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            <p className="text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
              {izin.titipan_tugas || 'Tidak ada titipan tugas'}
            </p>
          </div>

          {/* LINK FILE TUGAS / GDRIVE (JIKA ADA) */}
          {fileUrl && (
            <div className="pt-2">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3.5 py-2 rounded-xl transition-all cursor-pointer group/link"
              >
                <LinkIcon size={14} className="text-indigo-400 group-hover/link:rotate-45 transition-transform" />
                <span>Buka Link File / Tugas</span>
                <ExternalLink size={12} className="opacity-70" />
              </a>
            </div>
          )}

          {isSudah && izin.waktu_penyampaian && (
            <p className="text-xs text-emerald-400 font-medium mt-2 flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              Disampaikan: {new Date(izin.waktu_penyampaian).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => openDetail(izin)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-all cursor-pointer"
          >
            Lihat Rincian
          </button>
          <button
            onClick={() => handleTogglePenyampaian(izin)}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer ${
              isSudah
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
            }`}
          >
            {isSudah ? <X size={15} /> : <Check size={15} />}
            {isSudah ? 'Batalkan Status' : 'Tandai Selesai'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
          <ShieldCheck className="text-indigo-400" size={28} />
          Dashboard Guru Piket
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Monitoring kehadiran guru per jam pelajaran & pengelolaan delegasi tugas
        </p>
      </div>

      {/* Ringkasan Status Guru Piket */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div
          className={`rounded-3xl p-5 md:p-6 border backdrop-blur-xl shadow-xl transition-all flex flex-col justify-between gap-4 ${
            isPiketToday
              ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-emerald-500/40 shadow-emerald-500/5'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
                  isPiketToday
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                <ShieldCheck size={26} />
              </div>
              <div>
                <p className={`font-extrabold text-base ${isPiketToday ? 'text-emerald-300' : 'text-slate-200'}`}>
                  {isPiketToday ? 'Anda Bertugas Piket Hari Ini' : 'Bukan Jadwal Piket Hari Ini'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hari ini: <span className="text-slate-200 font-semibold">{todayHari}</span>, {new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl px-4 py-2.5 w-fit">
            <p className="text-xs font-bold text-slate-300">
              <span className="text-amber-400">{belumDisampaikan.length}</span> tugas belum / <span className="text-emerald-400">{sudahDisampaikan.length}</span> disampaikan
            </p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800/80 p-5 md:p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 mb-3 flex items-center gap-2">
              <CalendarDays size={18} className="text-indigo-400" />
              Jadwal Piket Saya
            </h2>
            {piketSchedule.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Belum ada jadwal piket. Hubungi administrator sekolah untuk penugasan.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {piketSchedule.map((p) => {
                  const active = p.hari_piket === todayHari;
                  return (
                    <span
                      key={p.id}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {p.hari_piket}
                      {active && ' (Hari ini)'}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ringkasan Statistik Kartu (Metric Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total KBM JP</p>
            <p className="text-xl font-extrabold text-slate-100">{totalKbm}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hadir</p>
            <p className="text-xl font-extrabold text-emerald-400">{totalHadir}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <UserX size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Izin / Halangan</p>
            <p className="text-xl font-extrabold text-amber-400">{totalIzinAbal}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Belum Diisi</p>
            <p className="text-xl font-extrabold text-slate-300">{totalBelumDiisi}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('presensi_jp')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'presensi_jp'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck size={18} />
          Presensi KBM Guru (Per JP)
        </button>
        <button
          onClick={() => setActiveTab('delegasi_izin')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'delegasi_izin'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen size={18} />
          Delegasi Tugas & Izin
          {belumDisampaikan.length > 0 && (
            <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-500/30">
              {belumDisampaikan.length}
            </span>
          )}
        </button>
      </div>

      {/* Content Tab 1: Presensi KBM per JP */}
      {activeTab === 'presensi_jp' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-2xl flex items-center justify-center">
                <UserCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">Absensi Guru Mengajar</h3>
                <p className="text-xs text-slate-400">Pilih tanggal dan jam pelajaran</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <Calendar size={15} className="text-indigo-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none cursor-pointer font-medium"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <Clock size={15} className="text-indigo-400" />
                <select
                  value={selectedJamKe}
                  onChange={(e) => setSelectedJamKe(Number(e.target.value))}
                  disabled={isHariLibur}
                  className="bg-transparent text-slate-200 outline-none cursor-pointer font-medium disabled:opacity-50"
                >
                  <option value={0} className="bg-slate-900 text-slate-200">
                    Semua Jam Ke
                  </option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((jp) => (
                    <option key={jp} value={jp} className="bg-slate-900 text-slate-200">
                      Jam Ke-{jp}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Banner Peringatan jika Hari Libur */}
          {isHariLibur ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-10 text-center space-y-3 backdrop-blur-xl shadow-xl">
              <CalendarDays className="mx-auto text-amber-400" size={48} />
              <h3 className="text-lg font-bold text-amber-300">
                KBM Diliburkan ({keteranganLibur})
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Tidak ada aktivitas jadwal Kegiatan Belajar Mengajar (KBM) pada tanggal yang dipilih. Pengisian presensi ditutup.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              {loadingKbm ? (
                <div className="flex items-center justify-center p-14 text-slate-400 gap-3">
                  <Loader2 className="animate-spin text-indigo-500" size={24} />
                  <span className="text-sm font-medium">Memuat jadwal KBM JP...</span>
                </div>
              ) : jadwalKbmjpList.length === 0 ? (
                <div className="text-center p-14 text-slate-500 text-sm">
                  Tidak ada data jadwal KBM JP ditemukan pada <span className="text-slate-300 font-semibold">{getHariFromDate(selectedDate)}</span>
                  {selectedJamKe > 0 ? `, Jam Ke-${selectedJamKe}` : ''}.
                </div>
              ) : (
                <>
                  {/* Responsive View HP / Mobile */}
                  <div className="block md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
                    {jadwalKbmjpList.map((item) => {
                      const currentStatus = presensiMap[item.id] ?? null;
                      const isSavingThis = savingKbmId === item.id;
                      const guruNama = item.gurus?.nama_lengkap || 'Guru';
                      const kelasNama = item.kelas?.nama_kelas || '-';
                      const mapelNama = item.mata_pelajarans?.nama_mapel || '-';

                      return (
                        <div key={item.id} className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                            <span className="font-extrabold text-slate-100 text-sm">{kelasNama}</span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock size={12} className="text-indigo-400" />
                              {item.waktu_mulai?.slice(0, 5)} - {item.waktu_selesai?.slice(0, 5)} (JP {item.jam_ke})
                            </span>
                          </div>

                          <div>
                            <p className="font-bold text-slate-100 text-sm">{guruNama}</p>
                            {item.gurus?.nip && <p className="text-[11px] text-slate-500">NIP: {item.gurus.nip}</p>}
                            <p className="text-xs text-indigo-300 font-medium mt-1">{mapelNama}</p>
                          </div>

                          <div className="pt-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                              Status Kehadiran Guru
                            </p>
                            <div className="flex items-center gap-2">
                              <select
                                value={currentStatus ?? ''}
                                onChange={(e) =>
                                  handleStatusKbmChange(item, e.target.value as StatusKehadiranGuru)
                                }
                                disabled={isSavingThis || !canEditPresensi}
                                className={`w-full bg-slate-900 border text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 transition-all font-semibold ${
                                  !canEditPresensi
                                    ? 'opacity-50 cursor-not-allowed border-slate-800 text-slate-500'
                                    : currentStatus === null
                                    ? 'border-amber-500/60 text-amber-400 animate-pulse cursor-pointer'
                                    : 'border-slate-800 text-slate-200 cursor-pointer'
                                }`}
                              >
                                <option value="" disabled className="bg-slate-900 text-slate-500">
                                  -- Pilih Status --
                                </option>
                                {STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {isSavingThis && <Loader2 size={16} className="animate-spin text-indigo-400 shrink-0" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop/Tablet Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider font-bold">
                          <th className="p-4">Jam & Kelas</th>
                          <th className="p-4">Guru Pengajar</th>
                          <th className="p-4">Mata Pelajaran</th>
                          <th className="p-4">Status Kehadiran Guru (Piket)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                        {jadwalKbmjpList.map((item) => {
                          const currentStatus = presensiMap[item.id] ?? null;
                          const isSavingThis = savingKbmId === item.id;
                          const guruNama = item.gurus?.nama_lengkap || 'Guru';
                          const kelasNama = item.kelas?.nama_kelas || '-';
                          const mapelNama = item.mata_pelajarans?.nama_mapel || '-';

                          return (
                            <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-slate-100">{kelasNama}</div>
                                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Clock size={12} className="text-indigo-400" />
                                  {item.waktu_mulai?.slice(0, 5)} - {item.waktu_selesai?.slice(0, 5)} (JP {item.jam_ke})
                                </div>
                              </td>
                              <td className="p-4 text-slate-200">
                                <div className="font-semibold">{guruNama}</div>
                                {item.gurus?.nip && <div className="text-xs text-slate-500">NIP: {item.gurus.nip}</div>}
                              </td>
                              <td className="p-4 text-slate-300 font-normal">{mapelNama}</td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={currentStatus ?? ''}
                                    onChange={(e) =>
                                      handleStatusKbmChange(item, e.target.value as StatusKehadiranGuru)
                                    }
                                    disabled={isSavingThis || !canEditPresensi}
                                    className={`bg-slate-950 border text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 transition-all font-semibold w-60 ${
                                      !canEditPresensi
                                        ? 'opacity-50 cursor-not-allowed border-slate-800 text-slate-500'
                                        : currentStatus === null
                                        ? 'border-amber-500/60 text-amber-400 animate-pulse cursor-pointer'
                                        : 'border-slate-800 text-slate-200 cursor-pointer'
                                    }`}
                                  >
                                    <option value="" disabled className="bg-slate-900 text-slate-500">
                                      -- Pilih Status --
                                    </option>
                                    {STATUS_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  {isSavingThis && <Loader2 size={16} className="animate-spin text-indigo-400" />}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content Tab 2: Delegasi Izin */}
      {activeTab === 'delegasi_izin' && (
        <>
          {!isPiketToday ? (
            <div className="bg-slate-900 rounded-3xl border border-slate-800/80 text-center py-20 px-4 text-slate-400 backdrop-blur-xl shadow-xl">
              <AlertCircle size={44} className="mx-auto mb-3 text-slate-600" />
              <p className="font-bold text-slate-200 text-base">Anda tidak bertugas piket hari ini.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Daftar delegasi tugas dan izin guru hanya dapat diakses pada hari penugasan piket Anda.
              </p>
            </div>
          ) : todayIzinList.length === 0 ? (
            <div className="bg-slate-900 rounded-3xl border border-slate-800/80 text-center py-20 px-4 text-slate-400 backdrop-blur-xl shadow-xl">
              <CheckCircle2 size={44} className="mx-auto mb-3 text-emerald-500/50" />
              <p className="font-bold text-slate-200 text-base">Tidak ada permohonan izin hari ini.</p>
              <p className="text-xs text-slate-400 mt-1">Seluruh pengajar hadir sesuai jadwal kegiatan belajar mengajar.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {belumDisampaikan.length > 0 && (
                <div>
                  <h2 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-amber-400" />
                    Belum Disampaikan
                    <span className="text-xs font-normal text-slate-500">({belumDisampaikan.length})</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {belumDisampaikan.map(renderIzinCard)}
                  </div>
                </div>
              )}

              {sudahDisampaikan.length > 0 && (
                <div>
                  <h2 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    Sudah Disampaikan
                    <span className="text-xs font-normal text-slate-500">({sudahDisampaikan.length})</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sudahDisampaikan.map(renderIzinCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Detail Delegasi */}
      <Modal
        open={detailModal}
        onClose={() => setDetailModal(false)}
        title="Detail Delegasi Tugas Piket"
        size="lg"
      >
        {selectedIzin && (
          <div className="space-y-5 text-slate-100">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Guru Izin</p>
                  <p className="font-bold text-slate-100 mt-0.5">
                    {selectedIzin.gurus?.nama_lengkap ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal</p>
                  <p className="font-bold text-slate-100 mt-0.5">
                    {new Date(`${selectedIzin.tanggal_izin}T12:00:00+07:00`).toLocaleDateString('id-ID', {
                      timeZone: 'Asia/Jakarta',
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Kelas</p>
                  <p className="font-bold text-slate-100 mt-0.5">
                    {selectedIzin.kelas?.nama_kelas ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Mata Pelajaran</p>
                  <p className="font-bold text-slate-100 mt-0.5">
                    {selectedIzin.mata_pelajarans?.nama_mapel ?? (selectedIzin as any).mata_pelajaran ?? '-'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Alasan Izin</p>
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 text-sm text-slate-300">
                {selectedIzin.keterangan_izin ?? selectedIzin.kategori_izin ?? (selectedIzin as any).alasan_izin ?? '-'}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Delegasi Tugas</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePrintTask(selectedIzin)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-indigo-300 bg-slate-900 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    title="Cetak / Simpan PDF"
                  >
                    <Printer size={13} />
                    <span>Cetak / PDF</span>
                  </button>

                  {selectedIzin.titipan_tugas && (
                    <button
                      type="button"
                      onClick={() => handleCopyTask(selectedIzin.titipan_tugas, `modal-${selectedIzin.id}`)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-indigo-300 bg-slate-900 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      title="Salin Teks Tugas"
                    >
                      {copiedId === `modal-${selectedIzin.id}` ? (
                        <>
                          <Check size={13} className="text-emerald-400" />
                          <span className="text-emerald-400">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Salin Teks</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {selectedIzin.titipan_tugas || 'Tidak ada titipan tugas'}
              </div>
            </div>

            {/* LINK FILE TUGAS / GDRIVE DI MODAL (JIKA ADA) */}
            {((selectedIzin as any).url_file || (selectedIzin as any).link_tugas || (selectedIzin as any).file_url) && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1.5">Link File / Tugas</p>
                <a
                  href={(selectedIzin as any).url_file || (selectedIzin as any).link_tugas || (selectedIzin as any).file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3.5 py-2 rounded-xl transition-all cursor-pointer group/link"
                >
                  <LinkIcon size={14} className="text-indigo-400 group-hover/link:rotate-45 transition-transform" />
                  <span>Buka Link File / Tugas</span>
                  <ExternalLink size={12} className="opacity-70" />
                </a>
              </div>
            )}

            {selectedIzin.waktu_penyampaian && (
              <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Disampaikan pada: {new Date(selectedIzin.waktu_penyampaian).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDetailModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  handleTogglePenyampaian(selectedIzin);
                  setDetailModal(false);
                }}
                disabled={saving}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
                  selectedIzin.status_penyampaian === 'Sudah Disampaikan'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                }`}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : selectedIzin.status_penyampaian === 'Sudah Disampaikan' ? (
                  <X size={16} />
                ) : (
                  <Check size={16} />
                )}
                {selectedIzin.status_penyampaian === 'Sudah Disampaikan'
                  ? 'Batalkan Status'
                  : 'Tandai Sudah Disampaikan'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}