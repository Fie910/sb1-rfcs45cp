//src/pages/RekapPresensiGuruPage.tsx
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Loader2,
  UserCheck,
  Calendar,
  Filter,
  FileText,
  BarChart3,
  Users,
  BookOpen,
  MessageCircle,
  Copy,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  generateAnalisaKehadiran,
  isAiAvailable,
  type AnalisaKehadiranAi,
  type RecordForAi,
} from '@/lib/analisaKehadiranAi';
import type { Guru } from '@/types/database';
import {
  exportColoredPdf,
  getPersenWarna,
  formatTanggalPdf,
  PDF_COLORS,
  fetchKepalaSekolahData,
  type PdfColumn,
} from '@/lib/pdfColoredExport';

// =============================================================================
// TYPES
// =============================================================================
interface PresensiGuruPiketRekap {
  id: number;
  tanggal: string;
  guru_id: string;
  status: string;
  catatan: string | null;
  gurus?: { id: string; nama_lengkap: string };
  jadwal_kbmjps?: {
    id: number;
    jam_ke: number;
    kelas?: { id: number; nama_kelas: string };
    mata_pelajarans?: { id: number; nama_mapel: string };
  };
}

interface RekapSummaryRow {
  key: string;
  guruId: string;
  guruNama: string;
  mapelNama?: string;
  total: number;
  hadir: number;
  asisten: number;
  sakitTugas: number;
  sakitTanpaTugas: number;
  izinTugas: number;
  izinTanpaTugas: number;
  dinasTugas: number;
  dinasTanpaTugas: number;
  alpa: number;
  persentase: number;
}

const DETAIL_HEADERS = [
  'Nama Guru',
  'Tanggal',
  'Mata Pelajaran',
  'Jam Ke',
  'Kelas',
  'Status Kehadiran',
  'Catatan',
];

// =============================================================================
// KONSTANTA
// =============================================================================
const DOA_ARAB = 'جَزَاكُمُ اللهُ خَيْرًا كَثِيْرًا';
const SALAM_PEMBUKA = 'Bismillaahi Ar-Rahmaani Ar-Rahiimi';
const SALAM_PENUTUP = 'Barakallahu fiikum';

// =============================================================================
// HELPER — Phone & WA
// =============================================================================
function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

function buildWaLink(phone: string | null | undefined, message: string): string {
  const clean = normalizePhone(phone);
  if (!clean) return '';
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

// =============================================================================
// HELPER — Analisa Fallback (threshold)
// =============================================================================
function getAnalisaFallback(persentase: number, avgSekolah: number): AnalisaKehadiranAi {
  const delta = persentase - avgSekolah;
  const deltaTxt =
    delta > 3
      ? `📈 ${delta.toFixed(1)}% di atas rata-rata sekolah (${avgSekolah}%)`
      : delta < -3
      ? `📉 ${Math.abs(delta).toFixed(1)}% di bawah rata-rata sekolah (${avgSekolah}%)`
      : `➖ Setara dengan rata-rata sekolah (${avgSekolah}%)`;

  if (persentase >= 95) {
    return {
      ringkasan_karakter: `Kehadiran nyaris sempurna. ${deltaTxt}`,
      kekuatan: 'Dedikasi tinggi terhadap amanah mendidik, konsisten sepanjang periode.',
      area_perbaikan: 'Pertahankan ritme positif ini. Jadikan teladan bagi rekan sejawat.',
      motivasi_personal:
        'Setiap langkah ke kelas dengan niat ibadah adalah amal jariyah yang mengalir pahalanya. Rasulullah ﷺ bersabda: "Barangsiapa menempuh jalan mencari ilmu, Allah mudahkan jalannya ke surga." (HR. Muslim)',
    };
  }
  if (persentase >= 90) {
    return {
      ringkasan_karakter: `Kehadiran sangat baik. ${deltaTxt}`,
      kekuatan: 'Konsistensi tinggi yang langka dan berharga.',
      area_perbaikan: 'Kurangi sesi tanpa tugas saat berhalangan untuk hasil optimal.',
      motivasi_personal:
        'Menjadi guru bukan sekadar profesi, tapi jalan dakwah yang mulia. Setiap ilmu yang tersampaikan adalah investasi akherat.',
    };
  }
  if (persentase >= 85) {
    return {
      ringkasan_karakter: `Kehadiran di posisi sehat. ${deltaTxt}`,
      kekuatan: 'Ritme kehadiran stabil, menunjukkan kedisiplinan.',
      area_perbaikan: 'Tingkatkan kehadiran fisik atau titipan tugas saat berhalangan.',
      motivasi_personal:
        'Rasulullah ﷺ mencintai amal yang kecil namun istiqamah. Setiap kehadiran Anda adalah bukti cinta pada ilmu dan siswa.',
    };
  }
  if (persentase >= 75) {
    return {
      ringkasan_karakter: `Kehadiran baik dengan beberapa catatan. ${deltaTxt}`,
      kekuatan: 'Punya fondasi kuat untuk naik ke level berikutnya.',
      area_perbaikan:
        'Identifikasi penyebab sesi yang tidak dihadiri, dan atasi secara sistematis.',
      motivasi_personal:
        'Setiap guru punya tantangan tersendiri. Yang penting bukan sempurna, tapi selalu memperbaiki diri.',
    };
  }
  if (persentase >= 60) {
    return {
      ringkasan_karakter: `Kehadiran cukup, perlu peningkatan. ${deltaTxt}`,
      kekuatan:
        'Kemauan untuk terus melangkah sudah terlihat dari sebagian besar sesi terpenuhi.',
      area_perbaikan:
        'Buat target pribadi: hadir 100% bulan depan, atau selalu titipkan tugas saat berhalangan.',
      motivasi_personal:
        'Setiap kelas yang tidak kita hadiri adalah kesempatan pahala yang hilang, dan siswa yang menunggu ilmu kita. Kami siap membantu!',
    };
  }
  return {
    ringkasan_karakter: `Kehadiran perlu perhatian khusus. ${deltaTxt}`,
    kekuatan: 'Kesempatan besar untuk transformasi positif sudah terbuka.',
    area_perbaikan:
      'Konsultasi dengan pimpinan/kepala divisi tentang kendala yang dihadapi. Buat rencana perbaikan konkret.',
    motivasi_personal:
      'Amanah mendidik adalah ibadah besar. Setiap jam pelajaran yang dijalani dengan niat baik, insyaallah bernilai di sisi Allah. Kami percaya Anda bisa lebih baik!',
  };
}

// =============================================================================
// HELPER — Build Pesan WhatsApp
// =============================================================================
function buildWaMessage(
  guruNama: string,
  periodeLabel: string,
  stats: RekapSummaryRow,
  analisa: AnalisaKehadiranAi,
  usedAi: boolean,
  namaSekolah: string
): string {
  const statsLines: string[] = [];
  statsLines.push(`• Total JP: *${stats.total}*`);
  statsLines.push(`• Hadir: *${stats.hadir}* JP`);
  if (stats.asisten > 0) statsLines.push(`• Asisten Guru: ${stats.asisten} JP`);
  if (stats.sakitTugas > 0) statsLines.push(`• Sakit (+Tugas): ${stats.sakitTugas} JP`);
  if (stats.sakitTanpaTugas > 0)
    statsLines.push(`• Sakit (-Tugas): ${stats.sakitTanpaTugas} JP`);
  if (stats.izinTugas > 0) statsLines.push(`• Izin (+Tugas): ${stats.izinTugas} JP`);
  if (stats.izinTanpaTugas > 0)
    statsLines.push(`• Izin (-Tugas): ${stats.izinTanpaTugas} JP`);
  if (stats.dinasTugas > 0) statsLines.push(`• Dinas (+Tugas): ${stats.dinasTugas} JP`);
  if (stats.dinasTanpaTugas > 0)
    statsLines.push(`• Dinas (-Tugas): ${stats.dinasTanpaTugas} JP`);
  if (stats.alpa > 0) statsLines.push(`• Alpa: ${stats.alpa} JP`);

  const mapelLine = stats.mapelNama
    ? `\n📚 *Mata Pelajaran:* ${stats.mapelNama}\n`
    : '';

  const aiBadge = usedAi ? ' ✨' : '';

  return `*📊 REKAP KEHADIRAN MENGAJAR*${aiBadge}
_${periodeLabel}_
${mapelLine}
_${SALAM_PEMBUKA}_
Ustadz/Ustadzah *${guruNama}*

${statsLines.join('\n')}

━━━━━━━━━━━━━━━━━━━━
🎯 *Persentase Kehadiran: ${stats.persentase}%*
━━━━━━━━━━━━━━━━━━━━

🔍 _${analisa.ringkasan_karakter}_

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
// KOMPONEN UTAMA
// =============================================================================
export function RekapPresensiGuruPage() {
  const [activeTab, setActiveTab] = useState<'detail' | 'rekap'>('detail');
  const [rekapGroupBy, setRekapGroupBy] = useState<'guru' | 'guru_mapel'>('guru');

  const [list, setList] = useState<PresensiGuruPiketRekap[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [guruPhoneMap, setGuruPhoneMap] = useState<Map<string, string | null>>(new Map());
  const [namaSekolah, setNamaSekolah] = useState<string>(
    'SMK KH. A. Wahab Muhsin Sukahideng'
  );
  const [loading, setLoading] = useState(true);
  const [filterGuru, setFilterGuru] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );

  const [aiLoadingKey, setAiLoadingKey] = useState<string | null>(null);
  const aiCacheRef = useRef<Map<string, AnalisaKehadiranAi>>(new Map());

  // Reset cache kalau periode berubah
  useEffect(() => {
    aiCacheRef.current.clear();
  }, [startDate, endDate, rekapGroupBy]);

  // ==========================================================================
  // FETCH INITIAL
  // ==========================================================================
  useEffect(() => {
    (async () => {
      const [guruRes, profilRes, sekolahRes] = await Promise.all([
        supabase.from('gurus').select('*').order('nama_lengkap', { ascending: true }),
        supabase.from('hris_profil_pegawai').select('id, no_hp, no_hp_darurat'),
        supabase
          .from('pengaturan_sekolahs')
          .select('nama_sekolah')
          .limit(1)
          .maybeSingle(),
      ]);

      setGurus((guruRes.data as Guru[]) || []);

      const map = new Map<string, string | null>();
      (profilRes.data || []).forEach((p: any) => {
        map.set(p.id, p.no_hp || p.no_hp_darurat || null);
      });
      setGuruPhoneMap(map);

      if (sekolahRes.data?.nama_sekolah) {
        setNamaSekolah(sekolahRes.data.nama_sekolah);
      }

      fetchData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================================
  // FETCH DATA
  // ==========================================================================
  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('presensi_guru_piket')
      .select(`
        id, tanggal, status, catatan, guru_id,
        gurus:guru_id (id, nama_lengkap),
        jadwal_kbmjps:jadwal_kbmjp_id (
          id, jam_ke,
          kelas:kelas_id (id, nama_kelas),
          mata_pelajarans:mapel_id (id, nama_mapel)
        )
      `)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false });

    if (filterGuru) query = query.eq('guru_id', filterGuru);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching presensi piket rekap:', error);
      setList([]);
    } else {
      setList((data as unknown as PresensiGuruPiketRekap[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGuru, startDate, endDate]);

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  const guruMap = useMemo(
    () => new Map(gurus.map((g) => [g.id, g.nama_lengkap])),
    [gurus]
  );

  const formatStatus = (statusStr: string) => {
    if (!statusStr) return '-';
    return statusStr
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusBadge = (statusStr: string) => {
    const status = (statusStr || '').toLowerCase();
    if (status === 'hadir')
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (status === 'asisten')
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    if (status.startsWith('sakit'))
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (status.startsWith('izin'))
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (status.startsWith('dinas'))
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (status === 'alpa' || status === 'tanpa_keterangan')
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  // ==========================================================================
  // DETAIL ROWS
  // ==========================================================================
  const detailRows = list.map((a) => [
    a.gurus?.nama_lengkap ?? guruMap.get(a.guru_id) ?? '-',
    a.tanggal,
    a.jadwal_kbmjps?.mata_pelajarans?.nama_mapel ?? '-',
    a.jadwal_kbmjps?.jam_ke ? `Jam Ke-${a.jadwal_kbmjps.jam_ke}` : '-',
    a.jadwal_kbmjps?.kelas?.nama_kelas ?? '-',
    formatStatus(a.status),
    a.catatan ?? '-',
  ]);

  // ==========================================================================
  // AGREGASI REKAP
  // ==========================================================================
  const rekapSummary = useMemo(() => {
    const map = new Map<string, RekapSummaryRow>();

    list.forEach((item) => {
      const guruNama =
        item.gurus?.nama_lengkap ??
        guruMap.get(item.guru_id) ??
        'Guru Tanpa Nama';
      const mapelNama =
        item.jadwal_kbmjps?.mata_pelajarans?.nama_mapel ??
        'Mata Pelajaran Tidak Ada';

      const key =
        rekapGroupBy === 'guru' ? item.guru_id : `${item.guru_id}_${mapelNama}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          guruId: item.guru_id,
          guruNama,
          mapelNama: rekapGroupBy === 'guru_mapel' ? mapelNama : undefined,
          total: 0,
          hadir: 0,
          asisten: 0,
          sakitTugas: 0,
          sakitTanpaTugas: 0,
          izinTugas: 0,
          izinTanpaTugas: 0,
          dinasTugas: 0,
          dinasTanpaTugas: 0,
          alpa: 0,
          persentase: 0,
        });
      }

      const row = map.get(key)!;
      row.total += 1;

      const st = (item.status || '').toLowerCase();
      const cat = (item.catatan || '').toLowerCase();
      const hasTugas =
        cat.includes('tugas') &&
        !cat.includes('tanpa tugas') &&
        !cat.includes('tidak ada tugas');

      switch (st) {
        case 'hadir':
          row.hadir += 1;
          break;
        case 'asisten':
        case 'asisten_guru':
          row.asisten += 1;
          break;
        case 'sakit_tugas':
          row.sakitTugas += 1;
          break;
        case 'sakit_tanpa_tugas':
          row.sakitTanpaTugas += 1;
          break;
        case 'izin_tugas':
          row.izinTugas += 1;
          break;
        case 'izin_tanpa_tugas':
          row.izinTanpaTugas += 1;
          break;
        case 'dinas_tugas':
          row.dinasTugas += 1;
          break;
        case 'dinas_tanpa_tugas':
          row.dinasTanpaTugas += 1;
          break;
        case 'alpa':
        case 'tanpa_keterangan':
          row.alpa += 1;
          break;
        case 'sakit':
          if (hasTugas) row.sakitTugas += 1;
          else row.sakitTanpaTugas += 1;
          break;
        case 'izin':
          if (hasTugas) row.izinTugas += 1;
          else row.izinTanpaTugas += 1;
          break;
        case 'dinas':
        case 'dinas_luar':
          if (hasTugas) row.dinasTugas += 1;
          else row.dinasTanpaTugas += 1;
          break;
        default:
          break;
      }
    });

    const results = Array.from(map.values()).map((row) => {
      const nilaiKehadiran =
        row.hadir * 1 +
        row.asisten * 0.85 +
        row.sakitTugas * 0.25 +
        row.izinTugas * 0.25 +
        row.dinasTanpaTugas * 0.5 +
        row.dinasTugas * 1;

      row.persentase =
        row.total > 0 ? Math.round((nilaiKehadiran / row.total) * 100) : 0;
      return row;
    });

    return results.sort((a, b) => a.guruNama.localeCompare(b.guruNama));
  }, [list, rekapGroupBy, guruMap]);

  // ==========================================================================
  // RATA-RATA SEKOLAH
  // ==========================================================================
  const avgSekolah = useMemo(() => {
    if (rekapSummary.length === 0) return 0;
    const totalPersen = rekapSummary.reduce((s, r) => s + r.persentase, 0);
    return Math.round((totalPersen / rekapSummary.length) * 10) / 10;
  }, [rekapSummary]);

  // ==========================================================================
  // PERIODE LABEL
  // ==========================================================================
  const periodeLabel = useMemo(() => {
    const fmt = (d: string) => {
      const date = new Date(`${d}T12:00:00+07:00`);
      return date.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    };
    return `${fmt(startDate)} — ${fmt(endDate)}`;
  }, [startDate, endDate]);

  // ==========================================================================
  // HANDLER — SEND WA
  // ==========================================================================
  const handleSendWa = useCallback(
    async (row: RekapSummaryRow) => {
      const phone = guruPhoneMap.get(row.guruId);
      if (!phone) {
        showToast(
          'error',
          `Nomor HP ${row.guruNama} tidak ditemukan. Lengkapi di HRIS → Profil Pegawai.`
        );
        return;
      }

      const guruRecords = list.filter((r) => r.guru_id === row.guruId);
      const recordsForAi: RecordForAi[] = guruRecords.map((r) => ({
        tanggal: r.tanggal,
        mapel: r.jadwal_kbmjps?.mata_pelajarans?.nama_mapel ?? '-',
        kelas: r.jadwal_kbmjps?.kelas?.nama_kelas ?? '-',
        status: r.status,
        catatan: r.catatan,
      }));

      const cacheKey = `${row.guruId}_${startDate}_${endDate}_${rekapGroupBy}`;
      let analisa: AnalisaKehadiranAi;
      let usedAi = false;

      const cached = aiCacheRef.current.get(cacheKey);
      if (cached) {
        analisa = cached;
        usedAi = true;
      } else if (isAiAvailable() && recordsForAi.length > 0) {
        setAiLoadingKey(row.key);
        try {
          analisa = await generateAnalisaKehadiran(
            row.guruNama,
            periodeLabel,
            recordsForAi,
            {
              total: row.total,
              hadir: row.hadir,
              asisten: row.asisten,
              sakitTugas: row.sakitTugas,
              izinTugas: row.izinTugas,
              dinasTugas: row.dinasTugas,
              persentase: row.persentase,
            },
            avgSekolah
          );
          aiCacheRef.current.set(cacheKey, analisa);
          usedAi = true;
        } catch (err: any) {
          console.warn('[RekapPresensiGuru] AI gagal, fallback:', err);
          showToast('info', 'AI tidak tersedia saat ini, memakai analisa standar');
          analisa = getAnalisaFallback(row.persentase, avgSekolah);
        } finally {
          setAiLoadingKey(null);
        }
      } else {
        analisa = getAnalisaFallback(row.persentase, avgSekolah);
      }

      const message = buildWaMessage(
        row.guruNama,
        periodeLabel,
        row,
        analisa,
        usedAi,
        namaSekolah
      );
      const link = buildWaLink(phone, message);
      if (!link) {
        showToast('error', 'Nomor HP tidak valid');
        return;
      }
      window.open(link, '_blank', 'noopener,noreferrer');
    },
    [
      guruPhoneMap,
      list,
      periodeLabel,
      avgSekolah,
      namaSekolah,
      startDate,
      endDate,
      rekapGroupBy,
    ]
  );

  // ==========================================================================
  // HANDLER — COPY MESSAGE
  // ==========================================================================
  const handleCopyMessage = useCallback(
    async (row: RekapSummaryRow) => {
      const cacheKey = `${row.guruId}_${startDate}_${endDate}_${rekapGroupBy}`;
      const cached = aiCacheRef.current.get(cacheKey);
      const analisa = cached ?? getAnalisaFallback(row.persentase, avgSekolah);
      const usedAi = Boolean(cached);

      const message = buildWaMessage(
        row.guruNama,
        periodeLabel,
        row,
        analisa,
        usedAi,
        namaSekolah
      );

      try {
        await navigator.clipboard.writeText(message);
        showToast('success', `Pesan untuk ${row.guruNama} disalin`);
      } catch {
        showToast('error', 'Gagal menyalin pesan');
      }
    },
    [periodeLabel, avgSekolah, namaSekolah, startDate, endDate, rekapGroupBy]
  );

  // ==========================================================================
  // HANDLER — EXPORT PDF
  // ==========================================================================
  const handleExportPdf = () => {
    if (rekapSummary.length === 0) {
      showToast('error', 'Tidak ada data rekapitulasi untuk diekspor.');
      return;
    }

    const periodeText = `Periode: ${formatTanggalPdf(startDate)} — ${formatTanggalPdf(endDate)}`;

    const baseColumns: PdfColumn[] = [
      { header: 'Nama Guru', halign: 'left', width: 50, bold: true },
      { header: 'Total JP', halign: 'center', width: 16 },
      { header: 'Hadir', halign: 'center', width: 15, bold: true, textColor: PDF_COLORS.emerald },
      { header: 'Asisten', halign: 'center', width: 16, bold: true, textColor: PDF_COLORS.teal },
      { header: 'Sakit (+Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.blue },
      { header: 'Sakit (-Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.slate500 },
      { header: 'Izin (+Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.amber },
      { header: 'Izin (-Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.slate500 },
      { header: 'Dinas (+Tugas)', halign: 'center', width: 22, textColor: PDF_COLORS.purple },
      { header: 'Dinas (-Tugas)', halign: 'center', width: 22, textColor: PDF_COLORS.slate500 },
      { header: 'Alpa', halign: 'center', width: 14, bold: true, textColor: PDF_COLORS.rose },
      {
        header: '% Kehadiran',
        halign: 'center',
        width: 'auto',
        bold: true,
        colorize: (v) => {
          const pct = parseInt(String(v).replace('%', ''), 10);
          if (isNaN(pct)) return null;
          return getPersenWarna(pct);
        },
      },
    ];

    // Kalau groupBy = guru_mapel, sisipkan kolom "Mata Pelajaran" setelah "Nama Guru"
    const columns: PdfColumn[] =
      rekapGroupBy === 'guru_mapel'
        ? [
            baseColumns[0],
            { header: 'Mata Pelajaran', halign: 'left', width: 35 },
            ...baseColumns.slice(1),
          ]
        : baseColumns;

    const rows = rekapSummary.map((r) => {
      const base: Record<string, any> = {
        'Nama Guru': r.guruNama,
        'Total JP': r.total,
        Hadir: r.hadir,
        Asisten: r.asisten,
        'Sakit (+Tugas)': r.sakitTugas,
        'Sakit (-Tugas)': r.sakitTanpaTugas,
        'Izin (+Tugas)': r.izinTugas,
        'Izin (-Tugas)': r.izinTanpaTugas,
        'Dinas (+Tugas)': r.dinasTugas,
        'Dinas (-Tugas)': r.dinasTanpaTugas,
        Alpa: r.alpa,
        '% Kehadiran': `${r.persentase}%`,
      };

      if (rekapGroupBy === 'guru_mapel') {
        base['Mata Pelajaran'] = r.mapelNama ?? '-';
      }

      return base;
    });

    exportColoredPdf({
      filename: `Rekap_Kehadiran_Guru_${rekapGroupBy}_${startDate}_sd_${endDate}.pdf`,
      title: 'LAPORAN REKAPITULASI KEHADIRAN GURU',
      subtitle: `${periodeText}${avgSekolah > 0 ? ` · Rata-rata Sekolah: ${avgSekolah}%` : ''}`,
      columns,
      rows,
      orientation: 'l',
      footerNote: 'Rekap Presensi Guru (Piket)',
    });

    showToast('success', 'File PDF berwarna berhasil diunduh');
  };

  // ==========================================================================
  // EXPORT HEADERS (untuk Excel)
  // ==========================================================================
  const rekapHeaders =
    rekapGroupBy === 'guru_mapel'
      ? [
          'Nama Guru',
          'Mata Pelajaran',
          'Total JP',
          'Hadir',
          'Asisten',
          'Sakit (+Tugas)',
          'Sakit (-Tugas)',
          'Izin (+Tugas)',
          'Izin (-Tugas)',
          'Dinas (+Tugas)',
          'Dinas (-Tugas)',
          'Alpa',
          '% Kehadiran (Berbobot)',
        ]
      : [
          'Nama Guru',
          'Total JP',
          'Hadir',
          'Asisten',
          'Sakit (+Tugas)',
          'Sakit (-Tugas)',
          'Izin (+Tugas)',
          'Izin (-Tugas)',
          'Dinas (+Tugas)',
          'Dinas (-Tugas)',
          'Alpa',
          '% Kehadiran (Berbobot)',
        ];

  const rekapRows = rekapSummary.map((r) => [
    r.guruNama,
    ...(rekapGroupBy === 'guru_mapel' ? [r.mapelNama ?? '-'] : []),
    r.total,
    r.hadir,
    r.asisten,
    r.sakitTugas,
    r.sakitTanpaTugas,
    r.izinTugas,
    r.izinTanpaTugas,
    r.dinasTugas,
    r.dinasTanpaTugas,
    r.alpa,
    `${r.persentase}%`,
  ]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
          <UserCheck className="text-indigo-400" size={28} />
          Rekap Presensi Guru (Piket)
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Rekapitulasi riwayat & statistik kehadiran guru per jam pelajaran dari Guru Piket
        </p>
      </div>

      {/* Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter size={14} className="text-indigo-400" /> Filter Guru
            </label>
            <SearchableSelect
              options={gurus.map((g) => ({
                value: g.id,
                label: g.nama_lengkap,
                hint: g.nip ? `NIP: ${g.nip}` : undefined,
              }))}
              value={filterGuru}
              onChange={setFilterGuru}
              placeholder="Semua Guru"
              searchPlaceholder="Cari nama atau NIP..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" /> Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all font-medium cursor-pointer"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" /> Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all font-medium cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('detail')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'detail'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileText size={18} />
          Detail Record ({list.length})
        </button>
        <button
          onClick={() => setActiveTab('rekap')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'rekap'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 size={18} />
          Rekapitulasi Persentase
        </button>
      </div>

      {/* Tab Detail */}
      {activeTab === 'detail' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-wrap gap-4 bg-slate-950/40">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText size={20} className="text-indigo-400" />
              Data Presensi Guru ({list.length} Record)
            </h2>
            <ExportImportButtons
              filename="rekap_presensi_guru_piket"
              title="Rekap Presensi Guru (Piket)"
              headers={DETAIL_HEADERS}
              rows={detailRows}
              showImport={false}
            />
          </div>

          <div className="max-h-[600px] overflow-auto relative">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  {DETAIL_HEADERS.map((h, idx) => (
                    <th
                      key={h}
                      className={`p-4 whitespace-nowrap sticky top-0 bg-slate-950 ${
                        idx === 0
                          ? 'left-0 z-30 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]'
                          : 'z-20'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                {loading ? (
                  <tr>
                    <td
                      colSpan={DETAIL_HEADERS.length}
                      className="text-center py-16"
                    >
                      <Loader2
                        className="animate-spin text-indigo-400 mx-auto mb-2"
                        size={28}
                      />
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td
                      colSpan={DETAIL_HEADERS.length}
                      className="text-center py-16 text-slate-500"
                    >
                      <UserCheck size={40} className="mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-slate-400">
                        Tidak ada data presensi guru piket.
                      </p>
                    </td>
                  </tr>
                ) : (
                  list.map((a) => {
                    const guruNama =
                      a.gurus?.nama_lengkap ?? guruMap.get(a.guru_id) ?? '-';
                    const mapelNama =
                      a.jadwal_kbmjps?.mata_pelajarans?.nama_mapel ?? '-';
                    const jamKe = a.jadwal_kbmjps?.jam_ke
                      ? `Jam Ke-${a.jadwal_kbmjps.jam_ke}`
                      : '-';
                    const kelasNama =
                      a.jadwal_kbmjps?.kelas?.nama_kelas ?? '-';

                    return (
                      <tr
                        key={a.id}
                        className="group hover:bg-slate-800/30 transition-colors text-slate-200"
                      >
                        <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                          {guruNama}
                        </td>
                        <td className="p-4 whitespace-nowrap font-medium text-slate-300">
                          {a.tanggal}
                        </td>
                        <td className="p-4 whitespace-nowrap text-indigo-300 font-semibold">
                          {mapelNama}
                        </td>
                        <td className="p-4 whitespace-nowrap text-slate-400">
                          {jamKe}
                        </td>
                        <td className="p-4 whitespace-nowrap text-slate-300">
                          {kelasNama}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${getStatusBadge(
                              a.status
                            )}`}
                          >
                            {formatStatus(a.status)}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 text-xs max-w-xs truncate">
                          {a.catatan ?? '-'}
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

      {/* Tab Rekap */}
      {activeTab === 'rekap' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-wrap gap-4 bg-slate-950/40">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-400" />
                Statistik Kehadiran Guru
              </h2>

              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
                <button
                  onClick={() => setRekapGroupBy('guru')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    rekapGroupBy === 'guru'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users size={13} />
                  Per Guru
                </button>
                <button
                  onClick={() => setRekapGroupBy('guru_mapel')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    rekapGroupBy === 'guru_mapel'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen size={13} />
                  Per Guru & Mapel
                </button>
              </div>

              {avgSekolah > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <TrendingUp size={13} />
                  Rata-rata Sekolah: {avgSekolah}%
                </div>
              )}

              {isAiAvailable() && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold">
                  <Sparkles size={13} />
                  AI Aktif
                </div>
              )}
            </div>

            <button
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 transition cursor-pointer"
            >
              <FileText size={14} /> Ekspor PDF
            </button>
          </div>

          {/* Legenda */}
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40">
            <details className="text-xs group">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1.5 select-none">
                <span className="text-indigo-400 group-open:rotate-90 transition-transform inline-block">
                  ▶
                </span>
                ℹ️ Cara perhitungan persentase berbobot & fitur AI + WhatsApp
              </summary>
              <div className="mt-3 ml-5 text-slate-500 leading-relaxed space-y-2">
                <p className="text-slate-400">
                  Sistem memberi bobot lebih tinggi kepada guru yang tetap berkontribusi:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-emerald-400 font-extrabold text-sm">1</span>
                    <span className="text-[11px] text-slate-300">Hadir</span>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-purple-400 font-extrabold text-sm">1</span>
                    <span className="text-[11px] text-slate-300">Dinas (+Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-teal-500/5 border border-teal-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-teal-400 font-extrabold text-sm">0.85</span>
                    <span className="text-[11px] text-slate-300">Asisten Guru</span>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-purple-300 font-extrabold text-sm">0.5</span>
                    <span className="text-[11px] text-slate-300">Dinas (-Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-blue-400 font-extrabold text-sm">0.25</span>
                    <span className="text-[11px] text-slate-300">Sakit (+Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-amber-400 font-extrabold text-sm">0.25</span>
                    <span className="text-[11px] text-slate-300">Izin (+Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-rose-400 font-extrabold text-sm">0</span>
                    <span className="text-[11px] text-slate-300">
                      Sakit/Izin (-Tugas), Alpa
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-2">
                  Persentase = (Σ Nilai Berbobot ÷ Total Record) × 100%
                </p>
                <div className="mt-3 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-[11px] text-purple-300 flex items-start gap-1.5 font-bold">
                    <Sparkles size={12} className="mt-0.5 shrink-0" />
                    Fitur AI Personal
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Saat klik <strong>WA</strong>, sistem akan meminta AI Gemini
                    menganalisa seluruh riwayat kehadiran personal guru (tanggal, mapel,
                    kelas, catatan) dan menghasilkan feedback yang{' '}
                    <em>personal & kontekstual</em>, bukan template. Hasil di-cache per
                    guru+periode untuk hemat quota.
                  </p>
                </div>
              </div>
            </details>
          </div>

          <div className="max-h-[600px] overflow-auto relative">
            <table className="w-full text-left border-collapse min-w-[1400px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  <th className="p-4 whitespace-nowrap sticky top-0 left-0 z-30 bg-slate-950 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    Nama Guru
                  </th>
                  {rekapGroupBy === 'guru_mapel' && (
                    <th className="p-4 whitespace-nowrap sticky top-0 z-20 bg-slate-950">
                      Mata Pelajaran
                    </th>
                  )}
                  <th className="p-4 whitespace-nowrap text-center sticky top-0 z-20 bg-slate-950">
                    Total JP
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-emerald-400 sticky top-0 z-20 bg-slate-950">
                    Hadir
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-teal-400 sticky top-0 z-20 bg-slate-950">
                    Asisten
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-blue-400 sticky top-0 z-20 bg-slate-950">
                    Sakit (+Tugas)
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-sky-400 sticky top-0 z-20 bg-slate-950">
                    Sakit (-Tugas)
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-amber-400 sticky top-0 z-20 bg-slate-950">
                    Izin (+Tugas)
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-amber-300 sticky top-0 z-20 bg-slate-950">
                    Izin (-Tugas)
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-purple-400 sticky top-0 z-20 bg-slate-950">
                    Dinas (+Tugas)
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-purple-300 sticky top-0 z-20 bg-slate-950">
                    Dinas (-Tugas)
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-rose-400 sticky top-0 z-20 bg-slate-950">
                    Alpa
                  </th>
                  <th className="p-4 whitespace-nowrap text-center sticky top-0 z-20 bg-slate-950">
                    % Kehadiran
                  </th>
                  <th className="p-4 whitespace-nowrap text-center text-indigo-400 sticky top-0 z-20 bg-slate-950">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                {loading ? (
                  <tr>
                    <td
                      colSpan={rekapHeaders.length + 1}
                      className="text-center py-16"
                    >
                      <Loader2
                        className="animate-spin text-indigo-400 mx-auto mb-2"
                        size={28}
                      />
                    </td>
                  </tr>
                ) : rekapSummary.length === 0 ? (
                  <tr>
                    <td
                      colSpan={rekapHeaders.length + 1}
                      className="text-center py-16 text-slate-500"
                    >
                      <BarChart3 size={40} className="mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-slate-400">
                        Tidak ada data rekapitulasi.
                      </p>
                    </td>
                  </tr>
                ) : (
                  rekapSummary.map((r) => {
                    const hasPhone = Boolean(guruPhoneMap.get(r.guruId));
                    const isAiLoading = aiLoadingKey === r.key;
                    return (
                      <tr
                        key={r.key}
                        className="group hover:bg-slate-800/30 transition-colors text-slate-200"
                      >
                        <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                          {r.guruNama}
                        </td>
                        {rekapGroupBy === 'guru_mapel' && (
                          <td className="p-4 whitespace-nowrap text-indigo-300 font-semibold">
                            {r.mapelNama ?? '-'}
                          </td>
                        )}
                        <td className="p-4 whitespace-nowrap text-center font-semibold text-slate-300">
                          {r.total}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center font-bold text-emerald-400">
                          {r.hadir}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center font-semibold text-teal-400">
                          {r.asisten}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center text-blue-400 font-semibold">
                          {r.sakitTugas}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center text-sky-400 font-semibold">
                          {r.sakitTanpaTugas}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center text-amber-400 font-semibold">
                          {r.izinTugas}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center text-amber-300 font-semibold">
                          {r.izinTanpaTugas}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center text-purple-400 font-semibold">
                          {r.dinasTugas}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center text-purple-300 font-semibold">
                          {r.dinasTanpaTugas}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center text-rose-400 font-semibold">
                          {r.alpa}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  r.persentase >= 85
                                    ? 'bg-emerald-500'
                                    : r.persentase >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${r.persentase}%` }}
                              />
                            </div>
                            <span
                              className={`font-extrabold text-xs ${
                                r.persentase >= 85
                                  ? 'text-emerald-400'
                                  : r.persentase >= 70
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {r.persentase}%
                            </span>
                          </div>
                        </td>

                        {/* Kolom Aksi */}
                        <td className="p-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleSendWa(r)}
                              disabled={!hasPhone || isAiLoading}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                !hasPhone
                                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                                  : isAiLoading
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 cursor-wait'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              }`}
                              title={
                                !hasPhone
                                  ? 'Nomor HP tidak tersedia'
                                  : isAiLoading
                                  ? 'AI sedang menganalisa...'
                                  : 'Kirim WA dengan analisa AI personal'
                              }
                            >
                              {isAiLoading ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  AI...
                                </>
                              ) : (
                                <>
                                  <MessageCircle size={12} />
                                  WA
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleCopyMessage(r)}
                              disabled={isAiLoading}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                              title="Copy pesan"
                            >
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