// src/pages/RekapIzinPage.tsx
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Loader2, FileText, Calendar, User, Filter, Search,
  CheckCircle, Clock, AlertCircle, BarChart3,
  Users, MessageCircle, Copy, Sparkles, TrendingUp, UserPlus,
  FileCheck, Briefcase,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { SearchableSelect } from '@/components/SearchableSelect';
import { showToast } from '@/components/Toast';
import { getTodayDateWib, getFirstDayOfMonthWib } from '@/utils/date';
import {
  generateAnalisaIzin, isAiIzinAvailable,
  type AnalisaIzinAi, type RecordIzinForAi,
} from '@/lib/ai/analisaIzinAi';
import {
  exportColoredPdf, getPersenWarna, formatTanggalPdf,
  PDF_COLORS, fetchKepalaSekolahData, type PdfColumn,
} from '@/lib/pdf/pdfColoredExport';

// =============================================================================
// TYPES
// =============================================================================
interface GuruOption { id: string; nama_lengkap: string; }

interface IzinGuruJoined {
  id: number;
  tanggal_izin: string;
  kategori_izin: 'Izin' | 'Sakit' | 'Dinas';
  jenis_delegasi: 'none' | 'asistensi' | 'tugas';
  nama_asisten: string | null;
  keterangan_izin: string | null;
  titipan_tugas: string | null;
  is_full_day: boolean;
  status_penyampaian: string;
  waktu_penyampaian: string | null;
  status_penanganan: string;
  guru_izin: { id: string; nama_lengkap: string } | null;
  guru_piket: { id: string; nama_lengkap: string } | null;
  kelas: { id: number; nama_kelas: string } | null;
  mata_pelajaran: { id: number; nama_mapel: string } | null;
  jadwal_kbm: { id: number; waktu_mulai: string; waktu_selesai: string } | null;
}

interface RekapIzinRow {
  guruId: string;
  guruNama: string;
  total: number;
  asistensi: number;
  sakitTugas: number;
  sakitTanpaTugas: number;
  izinTugas: number;
  izinTanpaTugas: number;
  dinasTugas: number;
  dinasTanpaTugas: number;
  persentase: number;
}

const HEADERS = [
  'Tanggal Izin', 'Guru Izin', 'Kategori', 'Cakupan',
  'Jenis Delegasi', 'Asisten / Instruksi', 'Kelas',
  'Mata Pelajaran', 'Status Penyampaian', 'Waktu Penyampaian',
];

const DOA_ARAB = 'جَزَاكُمُ اللهُ خَيْرًا كَثِيْرًا';
const SALAM_PEMBUKA = 'Bismillaahi Ar-Rahmaani Ar-Rahiimi';
const SALAM_PENUTUP = 'Barakallahu fiikum';

// =============================================================================
// HELPER
// =============================================================================
function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  let d = input.replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}

function buildWaLink(phone: string | null | undefined, msg: string): string {
  const c = normalizePhone(phone);
  if (!c) return '';
  return `https://wa.me/${c}?text=${encodeURIComponent(msg)}`;
}

/** Fallback analisa kalau AI gagal */
function getAnalisaIzinFallback(persentase: number, avgSekolah: number): AnalisaIzinAi {
  const delta = persentase - avgSekolah;
  const deltaTxt =
    delta > 3 ? `📈 ${delta.toFixed(1)}% di atas rata-rata sekolah (${avgSekolah}%)` :
    delta < -3 ? `📉 ${Math.abs(delta).toFixed(1)}% di bawah rata-rata sekolah (${avgSekolah}%)` :
    `➖ Setara dengan rata-rata sekolah (${avgSekolah}%)`;

  if (persentase >= 90) {
    return {
      ringkasan_pola: `Pola izin sangat bertanggung jawab. ${deltaTxt}`,
      kekuatan: 'Konsisten mendelegasikan tugas meski sedang berhalangan — teladan bagi rekan.',
      area_perbaikan: 'Pertahankan ritme ini. Berbagi praktik baik ke rekan sejawat.',
      motivasi_personal:
        'Setiap tugas yang Anda siapkan meski sedang sakit adalah amanah yang terjaga. Rasulullah ﷺ bersabda: "Setiap kalian adalah pemimpin, dan setiap pemimpin akan dimintai pertanggungjawaban." (HR. Bukhari)',
    };
  }
  if (persentase >= 75) {
    return {
      ringkasan_pola: `Pola izin baik dengan sedikit catatan. ${deltaTxt}`,
      kekuatan: 'Sebagian besar izin disertai delegasi — menunjukkan tanggung jawab.',
      area_perbaikan: 'Tingkatkan lagi: selalu siapkan tugas bahkan untuk izin mendadak.',
      motivasi_personal:
        'Yang terpenting bukan tidak pernah berhalangan, tapi selalu berusaha menjaga amanah saat berhalangan. Terus tingkatkan!',
    };
  }
  if (persentase >= 50) {
    return {
      ringkasan_pola: `Pola izin perlu ditingkatkan. ${deltaTxt}`,
      kekuatan: 'Sudah ada kemauan mendelegasikan di sebagian izin.',
      area_perbaikan:
        'Buat template tugas sederhana yang siap pakai, agar bisa langsung titipkan saat berhalangan.',
      motivasi_personal:
        'Setiap kelas yang kosong tanpa tugas adalah kesempatan belajar siswa yang hilang. Kami yakin Anda bisa lebih baik!',
    };
  }
  return {
    ringkasan_pola: `Sebagian besar izin tanpa delegasi tugas. ${deltaTxt}`,
    kekuatan: 'Kesempatan besar untuk transformasi positif sudah terbuka.',
    area_perbaikan:
      'Konsultasi dengan pimpinan/kepala divisi. Buat rencana perbaikan konkret untuk periode berikutnya.',
    motivasi_personal:
      'Amanah mendidik adalah ibadah besar. Setiap izin tanpa tugas berarti siswa menunggu tanpa panduan. Kami percaya Anda bisa berubah lebih baik!',
  };
}

/** Bangun pesan WA rekap izin */
function buildWaMessage(
  guruNama: string,
  periodeLabel: string,
  stats: RekapIzinRow,
  analisa: AnalisaIzinAi,
  usedAi: boolean,
  namaSekolah: string
): string {
  const lines: string[] = [];
  lines.push(`• Total Izin: *${stats.total}*`);
  if (stats.asistensi > 0) lines.push(`• Asistensi: ${stats.asistensi}`);
  if (stats.sakitTugas > 0) lines.push(`• Sakit (+Tugas): ${stats.sakitTugas}`);
  if (stats.sakitTanpaTugas > 0) lines.push(`• Sakit (-Tugas): ${stats.sakitTanpaTugas}`);
  if (stats.izinTugas > 0) lines.push(`• Izin (+Tugas): ${stats.izinTugas}`);
  if (stats.izinTanpaTugas > 0) lines.push(`• Izin (-Tugas): ${stats.izinTanpaTugas}`);
  if (stats.dinasTugas > 0) lines.push(`• Dinas (+Tugas): ${stats.dinasTugas}`);
  if (stats.dinasTanpaTugas > 0) lines.push(`• Dinas (-Tugas): ${stats.dinasTanpaTugas}`);

  const aiBadge = usedAi ? ' ✨' : '';

  return `*📊 REKAP IZIN & DELEGASI TUGAS*${aiBadge}
_${periodeLabel}_

_${SALAM_PEMBUKA}_
Ustadz/Ustadzah *${guruNama}*

${lines.join('\n')}

━━━━━━━━━━━━━━━━━━━━
🎯 *Persentase Kepatuhan Delegasi: ${stats.persentase}%*
━━━━━━━━━━━━━━━━━━━━

🔍 _${analisa.ringkasan_pola}_

✨ *Kekuatan:*
${analisa.kekuatan}

🎯 *Area Perbaikan:*
${analisa.area_perbaikan}

━━━━━━━━━━━━━━━━━━━━

💡 ${analisa.motivasi_personal}

━━━━━━━━━━━━━━━━━━━━

🤲 ${DOA_ARAB}

_${SALAM_PENUTUP},_

*${namaSekolah}*`;
}

// =============================================================================
// COMPONENT
// =============================================================================
export function RekapIzinPage() {
  const [activeTab, setActiveTab] = useState<'detail' | 'rekap'>('detail');
  const [list, setList] = useState<IzinGuruJoined[]>([]);
  const [gurus, setGurus] = useState<GuruOption[]>([]);
  const [guruPhoneMap, setGuruPhoneMap] = useState<Map<string, string | null>>(new Map());
  const [namaSekolah, setNamaSekolah] = useState<string>('');
  const [kepalaSekolah, setKepalaSekolah] = useState<{ nama: string; nip: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const [tanggalMulai, setTanggalMulai] = useState<string>(getFirstDayOfMonthWib());
  const [tanggalSelesai, setTanggalSelesai] = useState<string>(getTodayDateWib());
  const [filterGuru, setFilterGuru] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [aiLoadingKey, setAiLoadingKey] = useState<string | null>(null);
  const aiCacheRef = useRef<Map<string, AnalisaIzinAi>>(new Map());

  // Reset cache kalau periode berubah
  useEffect(() => {
    aiCacheRef.current.clear();
  }, [tanggalMulai, tanggalSelesai]);

  // ==========================================================================
  // FETCH INITIAL
  // ==========================================================================
  useEffect(() => {
    (async () => {
      const [guruRes, profilRes, sekolahRes] = await Promise.all([
        supabase.from('gurus').select('id, nama_lengkap').order('nama_lengkap', { ascending: true }),
        supabase.from('hris_profil_pegawai').select('id, no_hp, no_hp_darurat'),
        supabase.from('pengaturan_sekolahs').select('nama_sekolah').limit(1).maybeSingle(),
      ]);

      setGurus((guruRes.data as GuruOption[]) || []);

      const map = new Map<string, string | null>();
      (profilRes.data || []).forEach((p: any) => {
        map.set(p.id, p.no_hp || p.no_hp_darurat || null);
      });
      setGuruPhoneMap(map);

      if (sekolahRes.data?.nama_sekolah) setNamaSekolah(sekolahRes.data.nama_sekolah);

      try {
        const ks = await fetchKepalaSekolahData();
        setKepalaSekolah(ks);
      } catch (err) {
        console.warn('Gagal fetch kepala sekolah:', err);
      }
    })();
  }, []);

  // ==========================================================================
  // FETCH DATA IZIN
  // ==========================================================================
  const fetchData = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('izin_guru_pikets')
      .select(`
        *,
        guru_izin:gurus!izin_guru_pikets_guru_izin_id_fkey(id, nama_lengkap),
        guru_piket:gurus!izin_guru_pikets_guru_piket_id_fkey(id, nama_lengkap),
        kelas:kelas_id(id, nama_kelas),
        mata_pelajaran:mata_pelajarans!izin_guru_pikets_mapel_id_fkey(id, nama_mapel),
        jadwal_kbm:jadwal_kbm_id(id, waktu_mulai, waktu_selesai)
      `)
      .order('tanggal_izin', { ascending: false });

    if (tanggalMulai) query = query.gte('tanggal_izin', tanggalMulai);
    if (tanggalSelesai) query = query.lte('tanggal_izin', tanggalSelesai);
    if (filterGuru) query = query.eq('guru_izin_id', filterGuru);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching rekap izin:', error.message);
      setList([]);
    } else {
      setList((data as unknown as IzinGuruJoined[]) || []);
    }
    setLoading(false);
  }, [tanggalMulai, tanggalSelesai, filterGuru]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ==========================================================================
  // FILTERED LIST
  // ==========================================================================
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((item) => {
      const nama = item.guru_izin?.nama_lengkap?.toLowerCase() || '';
      const kelas = item.kelas?.nama_kelas?.toLowerCase() || '';
      const mapel = item.mata_pelajaran?.nama_mapel?.toLowerCase() || '';
      const tugas = item.titipan_tugas?.toLowerCase() || '';
      const asisten = item.nama_asisten?.toLowerCase() || '';
      return nama.includes(q) || kelas.includes(q) || mapel.includes(q)
        || tugas.includes(q) || asisten.includes(q);
    });
  }, [list, searchQuery]);

  // ==========================================================================
  // AGREGASI REKAP PER GURU
  // ==========================================================================
  const rekapSummary = useMemo<RekapIzinRow[]>(() => {
    const map = new Map<string, RekapIzinRow>();

    filteredList.forEach((item) => {
      const guruId = item.guru_izin?.id ?? 'unknown';
      const guruNama = item.guru_izin?.nama_lengkap ?? 'Guru Tanpa Nama';

      if (!map.has(guruId)) {
        map.set(guruId, {
          guruId, guruNama, total: 0,
          asistensi: 0,
          sakitTugas: 0, sakitTanpaTugas: 0,
          izinTugas: 0, izinTanpaTugas: 0,
          dinasTugas: 0, dinasTanpaTugas: 0,
          persentase: 0,
        });
      }

      const row = map.get(guruId)!;
      row.total += 1;

      const kategori = item.kategori_izin;
      const delegasi = item.jenis_delegasi;

      if (delegasi === 'asistensi') {
        row.asistensi += 1;
      } else if (delegasi === 'tugas') {
        if (kategori === 'Sakit') row.sakitTugas += 1;
        else if (kategori === 'Izin') row.izinTugas += 1;
        else if (kategori === 'Dinas') row.dinasTugas += 1;
      } else {
        // delegasi = 'none'
        if (kategori === 'Sakit') row.sakitTanpaTugas += 1;
        else if (kategori === 'Izin') row.izinTanpaTugas += 1;
        else if (kategori === 'Dinas') row.dinasTanpaTugas += 1;
      }
    });

    // Hitung persentase dengan bobot
    const results = Array.from(map.values()).map((row) => {
      const skor =
        row.asistensi * 1.0 +
        row.sakitTugas * 1.0 +
        row.izinTugas * 1.0 +
        row.dinasTugas * 1.0 +
        row.dinasTanpaTugas * 0.6 +
        row.sakitTanpaTugas * 0.2 +
        row.izinTanpaTugas * 0.2;

      row.persentase = row.total > 0 ? Math.round((skor / row.total) * 100) : 0;
      return row;
    });

    return results.sort((a, b) => a.guruNama.localeCompare(b.guruNama));
  }, [filteredList]);

  // Rata-rata sekolah
  const avgSekolah = useMemo(() => {
    if (rekapSummary.length === 0) return 0;
    const total = rekapSummary.reduce((s, r) => s + r.persentase, 0);
    return Math.round((total / rekapSummary.length) * 10) / 10;
  }, [rekapSummary]);

  const periodeLabel = useMemo(() => {
    const fmt = (d: string) => {
      const date = new Date(`${d}T12:00:00+07:00`);
      return date.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric',
      });
    };
    return `${fmt(tanggalMulai)} — ${fmt(tanggalSelesai)}`;
  }, [tanggalMulai, tanggalSelesai]);

  // ==========================================================================
  // HANDLER WA
  // ==========================================================================
  const handleSendWa = useCallback(async (row: RekapIzinRow) => {
    const phone = guruPhoneMap.get(row.guruId);
    if (!phone) {
      showToast('error', `Nomor HP ${row.guruNama} tidak ditemukan. Lengkapi di HRIS.`);
      return;
    }

    const recordsForAi: RecordIzinForAi[] = filteredList
      .filter((r) => r.guru_izin?.id === row.guruId)
      .map((r) => ({
        tanggal: r.tanggal_izin,
        kategori: r.kategori_izin,
        delegasi: r.jenis_delegasi,
        keterangan: r.keterangan_izin,
      }));

    const cacheKey = `${row.guruId}_${tanggalMulai}_${tanggalSelesai}`;
    let analisa: AnalisaIzinAi;
    let usedAi = false;

    const cached = aiCacheRef.current.get(cacheKey);
    if (cached) {
      analisa = cached;
      usedAi = true;
    } else if (isAiIzinAvailable() && recordsForAi.length > 0) {
      setAiLoadingKey(row.guruId);
      try {
        analisa = await generateAnalisaIzin(
          row.guruNama, periodeLabel, recordsForAi,
          {
            total: row.total,
            asistensi: row.asistensi,
            sakitTugas: row.sakitTugas,
            sakitTanpaTugas: row.sakitTanpaTugas,
            izinTugas: row.izinTugas,
            izinTanpaTugas: row.izinTanpaTugas,
            dinasTugas: row.dinasTugas,
            dinasTanpaTugas: row.dinasTanpaTugas,
            persentase: row.persentase,
          },
          avgSekolah
        );
        aiCacheRef.current.set(cacheKey, analisa);
        usedAi = true;
      } catch (err) {
        console.warn('[RekapIzin] AI gagal:', err);
        showToast('info', 'AI tidak tersedia, memakai analisa standar');
        analisa = getAnalisaIzinFallback(row.persentase, avgSekolah);
      } finally {
        setAiLoadingKey(null);
      }
    } else {
      analisa = getAnalisaIzinFallback(row.persentase, avgSekolah);
    }

    const msg = buildWaMessage(row.guruNama, periodeLabel, row, analisa, usedAi, namaSekolah || 'Sekolah');
    const link = buildWaLink(phone, msg);
    if (!link) {
      showToast('error', 'Nomor HP tidak valid');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  }, [guruPhoneMap, filteredList, periodeLabel, avgSekolah, namaSekolah, tanggalMulai, tanggalSelesai]);

  // ==========================================================================
  // HANDLER COPY
  // ==========================================================================
  const handleCopyMessage = useCallback(async (row: RekapIzinRow) => {
    const cacheKey = `${row.guruId}_${tanggalMulai}_${tanggalSelesai}`;
    const cached = aiCacheRef.current.get(cacheKey);
    const analisa = cached ?? getAnalisaIzinFallback(row.persentase, avgSekolah);
    const usedAi = Boolean(cached);

    const msg = buildWaMessage(row.guruNama, periodeLabel, row, analisa, usedAi, namaSekolah || 'Sekolah');
    try {
      await navigator.clipboard.writeText(msg);
      showToast('success', `Pesan untuk ${row.guruNama} disalin`);
    } catch {
      showToast('error', 'Gagal menyalin pesan');
    }
  }, [periodeLabel, avgSekolah, namaSekolah, tanggalMulai, tanggalSelesai]);

  // ==========================================================================
  // HANDLER PDF
  // ==========================================================================
  const handleExportPdf = () => {
    if (rekapSummary.length === 0) {
      showToast('error', 'Tidak ada data rekapitulasi untuk diekspor.');
      return;
    }

    const periodeText = `Periode: ${formatTanggalPdf(tanggalMulai)} — ${formatTanggalPdf(tanggalSelesai)}`;

    const columns: PdfColumn[] = [
      { header: 'Nama Guru', halign: 'left', width: 45, bold: true },
      { header: 'Total Izin', halign: 'center', width: 16 },
      { header: 'Asistensi', halign: 'center', width: 18, bold: true, textColor: PDF_COLORS.teal },
      { header: 'Sakit (+Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.blue },
      { header: 'Sakit (-Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.slate500 },
      { header: 'Izin (+Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.amber },
      { header: 'Izin (-Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.slate500 },
      { header: 'Dinas (+Tugas)', halign: 'center', width: 22, textColor: PDF_COLORS.purple },
      { header: 'Dinas (-Tugas)', halign: 'center', width: 22, textColor: PDF_COLORS.slate500 },
      {
        header: '% Kepatuhan',
        halign: 'center',
        width: 'auto',
        bold: true,
        colorize: (v: any) => {
          const pct = parseInt(String(v).replace('%', ''), 10);
          if (isNaN(pct)) return null;
          return getPersenWarna(pct);
        },
      },
    ];

    const rows = rekapSummary.map((r) => ({
      'Nama Guru': r.guruNama,
      'Total Izin': r.total,
      Asistensi: r.asistensi,
      'Sakit (+Tugas)': r.sakitTugas,
      'Sakit (-Tugas)': r.sakitTanpaTugas,
      'Izin (+Tugas)': r.izinTugas,
      'Izin (-Tugas)': r.izinTanpaTugas,
      'Dinas (+Tugas)': r.dinasTugas,
      'Dinas (-Tugas)': r.dinasTanpaTugas,
      '% Kepatuhan': `${r.persentase}%`,
    }));

    exportColoredPdf({
      filename: `Rekap_Izin_Guru_${tanggalMulai}_sd_${tanggalSelesai}.pdf`,
      title: 'LAPORAN REKAPITULASI IZIN & DELEGASI TUGAS GURU',
      subtitle: `${periodeText}${avgSekolah > 0 ? ` · Rata-rata Sekolah: ${avgSekolah}%` : ''}`,
      columns,
      rows,
      orientation: 'l',
      footerNote: 'Rekap Izin Guru v2',
      signature: kepalaSekolah
        ? { nama: kepalaSekolah.nama, nip: kepalaSekolah.nip, kota: 'Tasikmalaya' }
        : undefined,
    });

    showToast('success', 'File PDF berhasil diunduh');
  };

  // ==========================================================================
  // EXPORT EXCEL (DETAIL)
  // ==========================================================================
  const detailRows = useMemo(() => {
    return filteredList.map((i) => {
      const delegasiText =
        i.jenis_delegasi === 'asistensi'
          ? `Asistensi: ${i.nama_asisten ?? '-'}`
          : i.jenis_delegasi === 'tugas'
          ? `Tugas: ${i.titipan_tugas ?? '-'}`
          : '-';

      return [
        i.tanggal_izin,
        i.guru_izin?.nama_lengkap ?? '-',
        i.kategori_izin ?? '-',
        i.is_full_day ? 'Full Hari' : 'Per Sesi',
        i.jenis_delegasi === 'none' ? '-' : i.jenis_delegasi,
        delegasiText,
        i.kelas?.nama_kelas ?? '-',
        i.mata_pelajaran?.nama_mapel ?? '-',
        i.status_penyampaian ?? '-',
        i.waktu_penyampaian
          ? new Date(i.waktu_penyampaian).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
          : '-',
      ];
    });
  }, [filteredList]);

  // Statistik ringkas
  const totalIzin = filteredList.length;
  const totalSakit = filteredList.filter((i) => i.kategori_izin === 'Sakit').length;
  const totalDinas = filteredList.filter((i) => i.kategori_izin === 'Dinas').length;
  const totalSudah = filteredList.filter((i) => i.status_penyampaian === 'Sudah Disampaikan').length;

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 min-h-screen text-slate-100">
      {/* HEADER */}
      <div className="border-b border-slate-800/80 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3 text-white">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg">
              <FileText size={26} />
            </div>
            Rekap Izin Guru & Titipan Tugas
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Riwayat izin guru, piket, delegasi tugas & analisa AI personal
          </p>
        </div>

        <ExportImportButtons
          filename="rekap_izin_guru"
          title="Rekap Izin Guru & Titipan Tugas"
          headers={HEADERS}
          rows={detailRows}
          showImport={false}
        />
      </div>

      {/* STATISTIK */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20"><FileText size={22} /></div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total Permohonan</p>
            <p className="text-xl font-black text-slate-100">{totalIzin}</p>
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20"><AlertCircle size={22} /></div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Kategori Sakit</p>
            <p className="text-xl font-black text-slate-100">{totalSakit}</p>
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20"><Briefcase size={22} /></div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Kategori Dinas</p>
            <p className="text-xl font-black text-slate-100">{totalDinas}</p>
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20"><CheckCircle size={22} /></div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Tugas Tersampaikan</p>
            <p className="text-xl font-black text-slate-100">{totalSudah}</p>
          </div>
        </div>
      </div>

      {/* FILTER */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
          <Filter size={15} className="text-indigo-400" /> Filter Data Izin
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} /> Tanggal Mulai
            </label>
            <input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} /> Tanggal Selesai
            </label>
            <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <User size={13} /> Filter Guru
            </label>
            <SearchableSelect
              options={gurus.map((g) => ({ value: g.id, label: g.nama_lengkap }))}
              value={filterGuru}
              onChange={setFilterGuru}
              placeholder="Semua Guru"
              searchPlaceholder="Cari nama guru..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Search size={13} /> Cari Kata Kunci
            </label>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari guru / kelas / tugas..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80" />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button onClick={() => setActiveTab('detail')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'detail' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}>
          <FileText size={18} />
          Detail Record ({filteredList.length})
        </button>
        <button onClick={() => setActiveTab('rekap')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'rekap' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}>
          <BarChart3 size={18} />
          Rekapitulasi per Guru ({rekapSummary.length})
        </button>
      </div>

      {/* TAB DETAIL */}
      {activeTab === 'detail' && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
          <div className="max-h-[600px] overflow-auto relative">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/90 text-[11px] font-bold text-slate-400 uppercase backdrop-blur-md">
                  <th className="py-4 px-5 sticky top-0 left-0 z-30 bg-slate-950/95 min-w-[120px] shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Tanggal</th>
                  <th className="py-4 px-5 sticky top-0 left-[120px] z-30 bg-slate-950/95 min-w-[180px] shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Guru</th>
                  <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Kategori</th>
                  <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Cakupan</th>
                  <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Delegasi</th>
                  <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Asisten / Instruksi</th>
                  <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Kelas</th>
                  <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Mapel</th>
                  <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Status</th>
                  <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Waktu Sampai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs text-slate-300">
                {loading ? (
                  <tr><td colSpan={HEADERS.length} className="text-center py-20 text-slate-400">
                    <Loader2 className="animate-spin text-indigo-400 mx-auto" size={28} />
                  </td></tr>
                ) : filteredList.length === 0 ? (
                  <tr><td colSpan={HEADERS.length} className="text-center py-16 text-slate-400">
                    <FileText size={36} className="mx-auto mb-2 text-slate-600" />
                    <p className="font-bold text-slate-200 text-xs">Tidak ada data izin guru.</p>
                  </td></tr>
                ) : (
                  filteredList.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5 font-medium text-slate-300 sticky left-0 z-10 bg-slate-900/95 backdrop-blur-md">{i.tanggal_izin}</td>
                      <td className="py-3.5 px-5 font-bold text-slate-100 sticky left-[120px] z-10 bg-slate-900/95 backdrop-blur-md">{i.guru_izin?.nama_lengkap ?? '-'}</td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          i.kategori_izin === 'Sakit' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          i.kategori_izin === 'Dinas' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          'bg-violet-500/10 text-violet-400 border-violet-500/30'
                        }`}>{i.kategori_izin}</span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-300 text-[11px]">
                        {i.is_full_day ? 'Full Hari' : 'Per Sesi'}
                        {i.jadwal_kbm && !i.is_full_day && (
                          <span className="block text-[10px] text-slate-500">
                            {i.jadwal_kbm.waktu_mulai?.slice(0, 5)}-{i.jadwal_kbm.waktu_selesai?.slice(0, 5)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        {i.jenis_delegasi === 'none' ? (
                          <span className="text-slate-500 text-[11px]">-</span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            i.jenis_delegasi === 'asistensi'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                          }`}>{i.jenis_delegasi}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 max-w-xs truncate text-[11px]"
                        title={i.jenis_delegasi === 'asistensi' ? i.nama_asisten ?? '' : i.titipan_tugas ?? ''}>
                        {i.jenis_delegasi === 'asistensi' ? i.nama_asisten ?? '-' :
                         i.jenis_delegasi === 'tugas' ? i.titipan_tugas ?? '-' : '-'}
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">{i.kelas?.nama_kelas ?? '-'}</td>
                      <td className="py-3.5 px-5 text-slate-300">{i.mata_pelajaran?.nama_mapel ?? '-'}</td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          i.status_penyampaian === 'Sudah Disampaikan'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {i.status_penyampaian === 'Sudah Disampaikan' ? <CheckCircle size={11} /> : <Clock size={11} />}
                          {i.status_penyampaian || 'Belum Disampaikan'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 whitespace-nowrap text-[11px]">
                        {i.waktu_penyampaian
                          ? new Date(i.waktu_penyampaian).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB REKAP */}
      {activeTab === 'rekap' && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-wrap gap-4 bg-slate-950/40">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-400" />
                Statistik Izin & Delegasi
              </h2>
              {avgSekolah > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <TrendingUp size={13} /> Rata-rata Sekolah: {avgSekolah}%
                </div>
              )}
              {isAiIzinAvailable() && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold">
                  <Sparkles size={13} /> AI Aktif
                </div>
              )}
            </div>
            <button onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg transition cursor-pointer">
              <FileText size={14} /> Ekspor PDF
            </button>
          </div>

          {/* Legenda bobot */}
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40">
            <details className="text-xs group">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1.5 select-none">
                <span className="text-indigo-400 group-open:rotate-90 transition-transform inline-block">▶</span>
                ℹ️ Cara perhitungan % Kepatuhan Delegasi
              </summary>
              <div className="mt-3 ml-5 text-slate-500 leading-relaxed space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-teal-500/5 border border-teal-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-teal-400 font-extrabold text-sm">1.0</span>
                    <span className="text-[11px] text-slate-300">Asistensi</span>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-purple-400 font-extrabold text-sm">1.0</span>
                    <span className="text-[11px] text-slate-300">Dinas (+Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-blue-400 font-extrabold text-sm">1.0</span>
                    <span className="text-[11px] text-slate-300">Sakit/Izin (+Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-purple-300 font-extrabold text-sm">0.6</span>
                    <span className="text-[11px] text-slate-300">Dinas (-Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-rose-400 font-extrabold text-sm">0.2</span>
                    <span className="text-[11px] text-slate-300">Sakit/Izin (-Tugas)</span>
                  </div>
                </div>
                <p className="text-[11px] italic mt-2">
                  % Kepatuhan = (Σ Nilai Berbobot ÷ Total Izin) × 100%
                </p>
              </div>
            </details>
          </div>

          <div className="max-h-[600px] overflow-auto relative">
            <table className="w-full text-left border-collapse min-w-[1400px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  <th className="p-4 whitespace-nowrap sticky top-0 left-0 z-30 bg-slate-950 border-r border-slate-800/80">Nama Guru</th>
                  <th className="p-4 whitespace-nowrap text-center sticky top-0 z-20 bg-slate-950">Total Izin</th>
                  <th className="p-4 whitespace-nowrap text-center text-teal-400 sticky top-0 z-20 bg-slate-950">Asistensi</th>
                  <th className="p-4 whitespace-nowrap text-center text-blue-400 sticky top-0 z-20 bg-slate-950">Sakit (+Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-sky-400 sticky top-0 z-20 bg-slate-950">Sakit (-Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-amber-400 sticky top-0 z-20 bg-slate-950">Izin (+Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-amber-300 sticky top-0 z-20 bg-slate-950">Izin (-Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-purple-400 sticky top-0 z-20 bg-slate-950">Dinas (+Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-purple-300 sticky top-0 z-20 bg-slate-950">Dinas (-Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center sticky top-0 z-20 bg-slate-950">% Kepatuhan</th>
                  <th className="p-4 whitespace-nowrap text-center text-indigo-400 sticky top-0 z-20 bg-slate-950">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                {loading ? (
                  <tr><td colSpan={11} className="text-center py-16">
                    <Loader2 className="animate-spin text-indigo-400 mx-auto" size={28} />
                  </td></tr>
                ) : rekapSummary.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-16 text-slate-500">
                    <BarChart3 size={40} className="mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-400">Tidak ada data rekapitulasi.</p>
                  </td></tr>
                ) : (
                  rekapSummary.map((r) => {
                    const hasPhone = Boolean(guruPhoneMap.get(r.guruId));
                    const isAiLoading = aiLoadingKey === r.guruId;
                    return (
                      <tr key={r.guruId} className="group hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80">
                          {r.guruNama}
                        </td>
                        <td className="p-4 text-center font-semibold text-slate-300">{r.total}</td>
                        <td className="p-4 text-center font-bold text-teal-400">{r.asistensi}</td>
                        <td className="p-4 text-center text-blue-400 font-semibold">{r.sakitTugas}</td>
                        <td className="p-4 text-center text-sky-400 font-semibold">{r.sakitTanpaTugas}</td>
                        <td className="p-4 text-center text-amber-400 font-semibold">{r.izinTugas}</td>
                        <td className="p-4 text-center text-amber-300 font-semibold">{r.izinTanpaTugas}</td>
                        <td className="p-4 text-center text-purple-400 font-semibold">{r.dinasTugas}</td>
                        <td className="p-4 text-center text-purple-300 font-semibold">{r.dinasTanpaTugas}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                              <div className={`h-full rounded-full ${
                                r.persentase >= 85 ? 'bg-emerald-500' :
                                r.persentase >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                              }`} style={{ width: `${r.persentase}%` }} />
                            </div>
                            <span className={`font-extrabold text-xs ${
                              r.persentase >= 85 ? 'text-emerald-400' :
                              r.persentase >= 70 ? 'text-amber-400' : 'text-rose-400'
                            }`}>{r.persentase}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button onClick={() => handleSendWa(r)} disabled={!hasPhone || isAiLoading}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                !hasPhone ? 'bg-slate-800 text-slate-500 border-slate-700 opacity-60 cursor-not-allowed' :
                                isAiLoading ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 cursor-wait' :
                                'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              }`}
                              title={!hasPhone ? 'Nomor HP tidak tersedia' : isAiLoading ? 'AI menganalisa...' : 'Kirim WA dengan analisa AI'}>
                              {isAiLoading ? (
                                <><Loader2 size={12} className="animate-spin" /> AI...</>
                              ) : (
                                <><MessageCircle size={12} /> WA</>
                              )}
                            </button>
                            <button onClick={() => handleCopyMessage(r)} disabled={isAiLoading}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                              title="Copy pesan">
                              <Copy size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}