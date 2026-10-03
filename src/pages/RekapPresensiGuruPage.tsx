//src/pages/RekapPresensiGuruPage.tsx
import { useEffect, useState, useMemo, useCallback } from 'react';
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
  Award,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { Guru } from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
interface PresensiGuruPiketRekap {
  id: number;
  tanggal: string;
  guru_id: string;
  status: string;
  catatan: string | null;
  gurus?: {
    id: string;
    nama_lengkap: string;
  };
  jadwal_kbmjps?: {
    id: number;
    jam_ke: number;
    kelas?: {
      id: number;
      nama_kelas: string;
    };
    mata_pelajarans?: {
      id: number;
      nama_mapel: string;
    };
  };
}

interface RekapSummaryRow {
  key: string;
  guruId: string;
  guruNama: string;
  mapelNama?: string;
  total: number;
  hadir: number;
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
// KONSTANTA DOA & MOTIVASI
// =============================================================================
const DOA_ARAB = 'جَزَاكُمُ اللهُ خَيْرًا كَثِيْرًا';
const DOA_LATIN = 'Jazaakumullahu khayran katsiran';
const DOA_ARTI = '"Semoga Allah membalas kalian dengan kebaikan yang banyak"';
const SALAM_PEMBUKA = 'Bismillaahi Ar-Rahmaani Ar-Rahiimi';
const SALAM_PENUTUP = 'Barakallahu fiikum';

// =============================================================================
// HELPER — Normalisasi Nomor HP & Build WA Link
// =============================================================================
function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
}

function buildWaLink(phone: string | null | undefined, message: string): string {
  const clean = normalizePhone(phone);
  if (!clean) return '';
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

// =============================================================================
// HELPER — Analisa & Motivasi Berbasis Persentase
// =============================================================================
function getAnalisaDanMotivasi(persentase: number, avgSekolah: number) {
  const delta = persentase - avgSekolah;
  const deltaTxt =
    delta > 3
      ? `📈 *${delta.toFixed(1)}% di atas rata-rata sekolah* (${avgSekolah}%)`
      : delta < -3
      ? `📉 *${Math.abs(delta).toFixed(1)}% di bawah rata-rata sekolah* (${avgSekolah}%)`
      : `➖ *Setara dengan rata-rata sekolah* (${avgSekolah}%)`;

  if (persentase >= 95) {
    return {
      analisa: `${deltaTxt}\n\n✨ Luar biasa! Kehadiran Anda *nyaris sempurna*. Ini bukti dedikasi tinggi terhadap amanah mendidik.`,
      motivasi: `Setiap kali Anda masuk kelas dengan niat ibadah, Allah mencatatnya sebagai amal jariyah yang mengalir pahalanya sampai hari kiamat. Rasulullah ﷺ bersabda:\n\n_"Barangsiapa menempuh suatu jalan untuk mencari ilmu, maka Allah akan memudahkan jalannya menuju surga."_ (HR. Muslim)\n\nTeruslah istiqamah, Ustadz/Ustadzah!`,
      emoji: '🌟',
      tier: 'LUAR BIASA',
    };
  }

  if (persentase >= 90) {
    return {
      analisa: `${deltaTxt}\n\n🌟 Sangat baik! Kehadiran Anda *di atas standar harapan*. Konsistensi ini langka dan berharga.`,
      motivasi: `Menjadi guru bukan sekadar profesi, tapi *jalan dakwah* yang mulia. Setiap ilmu yang tersampaikan, setiap akhlak yang diteladankan, adalah investasi akherat. Jazaakallahu khairan atas kesungguhan Anda!`,
      emoji: '💎',
      tier: 'SANGAT BAIK',
    };
  }

  if (persentase >= 85) {
    return {
      analisa: `${deltaTxt}\n\n✅ Baik sekali! Kehadiran Anda di posisi yang sehat. Pertahankan ritme positif ini.`,
      motivasi: `Konsistensi adalah kunci keberkahan. Rasulullah ﷺ mencintai amal yang *kecil namun istiqamah*. Setiap kehadiran Anda adalah bukti cinta pada ilmu dan siswa. Barakallahu fiik!`,
      emoji: '🎯',
      tier: 'BAIK SEKALI',
    };
  }

  if (persentase >= 75) {
    return {
      analisa: `${deltaTxt}\n\n👍 Baik. Ada beberapa sesi yang perlu ditingkatkan. Anda punya fondasi kuat untuk naik ke level berikutnya.`,
      motivasi: `Setiap guru punya tantangan tersendiri. Yang penting bukan sempurna, tapi *selalu memperbaiki diri*. Niatkan setiap langkah ke kelas sebagai ibadah, dan rasakan keberkahan ilmunya.`,
      emoji: '📚',
      tier: 'BAIK',
    };
  }

  if (persentase >= 60) {
    return {
      analisa: `${deltaTxt}\n\n⚠️ Cukup baik, namun ada beberapa sesi yang alpa/tanpa tugas. Mari kita tingkatkan bersama.`,
      motivasi: `Setiap kelas yang tidak kita hadiri adalah *kesempatan pahala yang hilang*, dan siswa yang menunggu ilmu kita. Yuk, buat target pribadi: hadir 100% bulan depan. Kami siap membantu!`,
      emoji: '🌱',
      tier: 'CUKUP',
    };
  }

  return {
    analisa: `${deltaTxt}\n\n⚠️ Perlu perhatian khusus. Ada beberapa sesi alpa/tanpa keterangan yang signifikan.`,
    motivasi: `Bukan tentang menghakimi, tapi mengingatkan: *amanah mendidik adalah ibadah besar*. Setiap jam pelajaran yang dijalani dengan niat baik, insyaallah bernilai di sisi Allah. Kami percaya Anda bisa lebih baik!`,
    emoji: '🤝',
    tier: 'PERLU PERHATIAN',
  };
}

// =============================================================================
// HELPER — Build Pesan WhatsApp
// =============================================================================
function buildWaMessage(
  guruNama: string,
  periodeLabel: string,
  stats: RekapSummaryRow,
  avgSekolah: number,
  namaSekolah: string
): string {
  const { analisa, motivasi, emoji, tier } = getAnalisaDanMotivasi(
    stats.persentase,
    avgSekolah
  );

  const statsLines: string[] = [];
  statsLines.push(`• Total JP: *${stats.total}*`);
  statsLines.push(`• Hadir: *${stats.hadir}* JP`);
  if (stats.sakitTugas > 0) statsLines.push(`• Sakit (+Tugas): ${stats.sakitTugas} JP`);
  if (stats.sakitTanpaTugas > 0) statsLines.push(`• Sakit (-Tugas): ${stats.sakitTanpaTugas} JP`);
  if (stats.izinTugas > 0) statsLines.push(`• Izin (+Tugas): ${stats.izinTugas} JP`);
  if (stats.izinTanpaTugas > 0) statsLines.push(`• Izin (-Tugas): ${stats.izinTanpaTugas} JP`);
  if (stats.dinasTugas > 0) statsLines.push(`• Dinas (+Tugas): ${stats.dinasTugas} JP`);
  if (stats.dinasTanpaTugas > 0) statsLines.push(`• Dinas (-Tugas): ${stats.dinasTanpaTugas} JP`);
  if (stats.alpa > 0) statsLines.push(`• Alpa: ${stats.alpa} JP`);

  const mapelLine = stats.mapelNama
    ? `\n📚 *Mata Pelajaran:* ${stats.mapelNama}\n`
    : '';

  return `*📊 REKAP KEHADIRAN MENGAJAR*
_${periodeLabel}_
${mapelLine}
_${SALAM_PEMBUKA}_
Ustadz/Ustadzah *${guruNama}*

${statsLines.join('\n')}

━━━━━━━━━━━━━━━━━━━━
🎯 *Persentase Kehadiran: ${stats.persentase}%*
━━━━━━━━━━━━━━━━━━━━

${emoji} *${tier}:*
${analisa}

━━━━━━━━━━━━━━━━━━━━

💡 ${motivasi}

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
  const [namaSekolah, setNamaSekolah] = useState<string>('SMK KH. A. Wahab Muhsin Sukahideng');
  const [loading, setLoading] = useState(true);
  const [filterGuru, setFilterGuru] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // ==========================================================================
  // FETCH INITIAL — guru + profil (no HP) + pengaturan sekolah
  // ==========================================================================
  useEffect(() => {
    (async () => {
      const [guruRes, profilRes, sekolahRes] = await Promise.all([
        supabase.from('gurus').select('*').order('nama_lengkap', { ascending: true }),
        supabase
          .from('hris_profil_pegawai')
          .select('id, no_hp, no_hp_darurat'),
        supabase.from('pengaturan_sekolahs').select('nama_sekolah').limit(1).maybeSingle(),
      ]);

      setGurus((guruRes.data as Guru[]) || []);

      // Map guru_id → nomor HP (prioritas no_hp, fallback no_hp_darurat)
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
  // FETCH DATA REKAP
  // ==========================================================================
  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('presensi_guru_piket')
      .select(`
        id,
        tanggal,
        status,
        catatan,
        guru_id,
        gurus:guru_id (id, nama_lengkap),
        jadwal_kbmjps:jadwal_kbmjp_id (
          id,
          jam_ke,
          kelas:kelas_id (id, nama_kelas),
          mata_pelajarans:mapel_id (id, nama_mapel)
        )
      `)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false });

    if (filterGuru) {
      query = query.eq('guru_id', filterGuru);
    }

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
  // HELPER LOKAL
  // ==========================================================================
  const guruMap = useMemo(() => new Map(gurus.map((g) => [g.id, g.nama_lengkap])), [gurus]);

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
    if (status === 'hadir') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (status.startsWith('sakit')) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (status.startsWith('izin')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (status.startsWith('dinas')) return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (status === 'alpa' || status === 'tanpa_keterangan')
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  // ==========================================================================
  // DETAIL ROWS (untuk export)
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
        item.gurus?.nama_lengkap ?? guruMap.get(item.guru_id) ?? 'Guru Tanpa Nama';
      const mapelNama =
        item.jadwal_kbmjps?.mata_pelajarans?.nama_mapel ?? 'Mata Pelajaran Tidak Ada';

      const key = rekapGroupBy === 'guru' ? item.guru_id : `${item.guru_id}_${mapelNama}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          guruId: item.guru_id,
          guruNama,
          mapelNama: rekapGroupBy === 'guru_mapel' ? mapelNama : undefined,
          total: 0,
          hadir: 0,
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
        cat.includes('tugas') && !cat.includes('tanpa tugas') && !cat.includes('tidak ada tugas');

      switch (st) {
        case 'hadir': row.hadir += 1; break;
        case 'sakit_tugas': row.sakitTugas += 1; break;
        case 'sakit_tanpa_tugas': row.sakitTanpaTugas += 1; break;
        case 'izin_tugas': row.izinTugas += 1; break;
        case 'izin_tanpa_tugas': row.izinTanpaTugas += 1; break;
        case 'dinas_tugas': row.dinasTugas += 1; break;
        case 'dinas_tanpa_tugas': row.dinasTanpaTugas += 1; break;
        case 'alpa':
        case 'tanpa_keterangan': row.alpa += 1; break;
        case 'sakit':
          if (hasTugas) row.sakitTugas += 1; else row.sakitTanpaTugas += 1;
          break;
        case 'izin':
          if (hasTugas) row.izinTugas += 1; else row.izinTanpaTugas += 1;
          break;
        case 'dinas':
        case 'dinas_luar':
          if (hasTugas) row.dinasTugas += 1; else row.dinasTanpaTugas += 1;
          break;
        default: break;
      }
    });

    const results = Array.from(map.values()).map((row) => {
      const nilaiKehadiran =
        row.hadir * 1 +
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
  // RATA-RATA SEKOLAH (untuk analisa komparatif)
  // ==========================================================================
  const avgSekolah = useMemo(() => {
    if (rekapSummary.length === 0) return 0;
    const totalPersen = rekapSummary.reduce((s, r) => s + r.persentase, 0);
    return Math.round((totalPersen / rekapSummary.length) * 10) / 10;
  }, [rekapSummary]);

  // ==========================================================================
  // HEADER LABEL PERIODE (untuk pesan WA)
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
  // HANDLER — Kirim WA per Guru
  // ==========================================================================
  const handleSendWa = useCallback(
    (row: RekapSummaryRow) => {
      const phone = guruPhoneMap.get(row.guruId);
      if (!phone) {
        showToast(
          'error',
          `Nomor HP ${row.guruNama} tidak ditemukan. Lengkapi di menu HRIS → Profil Pegawai.`
        );
        return;
      }

      const message = buildWaMessage(row.guruNama, periodeLabel, row, avgSekolah, namaSekolah);
      const link = buildWaLink(phone, message);
      if (!link) {
        showToast('error', 'Nomor HP tidak valid');
        return;
      }
      window.open(link, '_blank', 'noopener,noreferrer');
    },
    [guruPhoneMap, periodeLabel, avgSekolah, namaSekolah]
  );

  // ==========================================================================
  // HANDLER — Copy Pesan (kalau nomor HP tidak ada)
  // ==========================================================================
  const handleCopyMessage = useCallback(
    async (row: RekapSummaryRow) => {
      const message = buildWaMessage(row.guruNama, periodeLabel, row, avgSekolah, namaSekolah);
      try {
        await navigator.clipboard.writeText(message);
        showToast('success', `Pesan untuk ${row.guruNama} disalin ke clipboard`);
      } catch {
        showToast('error', 'Gagal menyalin pesan');
      }
    },
    [periodeLabel, avgSekolah, namaSekolah]
  );

  // ==========================================================================
  // EXPORT ROWS — Tambah kolom Aksi di akhir (tidak diexport, tapi ok)
  // ==========================================================================
  const rekapHeaders =
    rekapGroupBy === 'guru_mapel'
      ? [
          'Nama Guru', 'Mata Pelajaran', 'Total JP', 'Hadir',
          'Sakit (+Tugas)', 'Sakit (-Tugas)', 'Izin (+Tugas)', 'Izin (-Tugas)',
          'Dinas (+Tugas)', 'Dinas (-Tugas)', 'Alpa', '% Kehadiran (Berbobot)',
        ]
      : [
          'Nama Guru', 'Total JP', 'Hadir',
          'Sakit (+Tugas)', 'Sakit (-Tugas)', 'Izin (+Tugas)', 'Izin (-Tugas)',
          'Dinas (+Tugas)', 'Dinas (-Tugas)', 'Alpa', '% Kehadiran (Berbobot)',
        ];

  const rekapRows = rekapSummary.map((r) => [
    r.guruNama,
    ...(rekapGroupBy === 'guru_mapel' ? [r.mapelNama ?? '-'] : []),
    r.total,
    r.hadir,
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

      {/* Filter Card */}
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

      {/* Navigation Tabs */}
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

      {/* Tab 1: Detail Record */}
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
                    <td colSpan={DETAIL_HEADERS.length} className="text-center py-16">
                      <Loader2 className="animate-spin text-indigo-400 mx-auto mb-2" size={28} />
                      <span className="text-xs text-slate-400">Memuat data rekap presensi...</span>
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={DETAIL_HEADERS.length} className="text-center py-16 text-slate-500">
                      <UserCheck size={40} className="mx-auto mb-2 opacity-40 text-slate-600" />
                      <p className="font-semibold text-slate-400">
                        Tidak ada data presensi guru piket ditemukan.
                      </p>
                    </td>
                  </tr>
                ) : (
                  list.map((a) => {
                    const guruNama = a.gurus?.nama_lengkap ?? guruMap.get(a.guru_id) ?? '-';
                    const mapelNama = a.jadwal_kbmjps?.mata_pelajarans?.nama_mapel ?? '-';
                    const jamKe = a.jadwal_kbmjps?.jam_ke
                      ? `Jam Ke-${a.jadwal_kbmjps.jam_ke}`
                      : '-';
                    const kelasNama = a.jadwal_kbmjps?.kelas?.nama_kelas ?? '-';

                    return (
                      <tr
                        key={a.id}
                        className="group hover:bg-slate-800/30 transition-colors text-slate-200"
                      >
                        <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)] transition-colors">
                          {guruNama}
                        </td>
                        <td className="p-4 whitespace-nowrap font-medium text-slate-300">
                          {a.tanggal}
                        </td>
                        <td className="p-4 whitespace-nowrap text-indigo-300 font-semibold">
                          {mapelNama}
                        </td>
                        <td className="p-4 whitespace-nowrap text-slate-400">{jamKe}</td>
                        <td className="p-4 whitespace-nowrap text-slate-300">{kelasNama}</td>
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

      {/* Tab 2: Rekapitulasi Persentase */}
      {activeTab === 'rekap' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-0">
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

              {/* ✅ Info rata-rata sekolah */}
              {avgSekolah > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <TrendingUp size={13} />
                  Rata-rata Sekolah: {avgSekolah}%
                </div>
              )}
            </div>

            <ExportImportButtons
              filename={`rekap_persentase_kehadiran_${rekapGroupBy}`}
              title="Rekapitulasi Persentase Kehadiran Guru"
              headers={rekapHeaders}
              rows={rekapRows}
              showImport={false}
            />
          </div>

          {/* ✅ Legenda Bobot */}
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40">
            <details className="text-xs group">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1.5 select-none">
                <span className="text-indigo-400 group-open:rotate-90 transition-transform inline-block">▶</span>
                ℹ️ Cara perhitungan persentase kehadiran (berbobot) & fitur WhatsApp
              </summary>
              <div className="mt-3 ml-5 text-slate-500 leading-relaxed space-y-2">
                <p className="text-slate-400">
                  Sistem memberi bobot lebih tinggi kepada guru yang tetap berkontribusi meski tidak hadir fisik (memberi tugas):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-emerald-400 font-extrabold text-sm">1</span>
                    <span className="text-[11px] text-slate-300">Hadir</span>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-purple-400 font-extrabold text-sm">1</span>
                    <span className="text-[11px] text-slate-300">Dinas (+Tugas)</span>
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
                    <span className="text-[11px] text-slate-300">Sakit/Izin (-Tugas), Alpa</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-2">
                  Persentase = (Σ Nilai Berbobot ÷ Total Record) × 100%
                </p>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-2">
                  <MessageCircle size={12} />
                  Tombol <strong>WA</strong> di kolom Aksi untuk mengirim rekap + analisa + motivasi + doa ke guru.
                </p>
              </div>
            </details>
          </div>

          <div className="max-h-[600px] overflow-auto relative">
            <table className="w-full text-left border-collapse min-w-[1300px]">
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
                    <td colSpan={rekapHeaders.length + 1} className="text-center py-16">
                      <Loader2 className="animate-spin text-indigo-400 mx-auto mb-2" size={28} />
                      <span className="text-xs text-slate-400">
                        Mengalkulasi statistik kehadiran...
                      </span>
                    </td>
                  </tr>
                ) : rekapSummary.length === 0 ? (
                  <tr>
                    <td
                      colSpan={rekapHeaders.length + 1}
                      className="text-center py-16 text-slate-500"
                    >
                      <BarChart3 size={40} className="mx-auto mb-2 opacity-40 text-slate-600" />
                      <p className="font-semibold text-slate-400">
                        Tidak ada rekapitulasi data tersedia.
                      </p>
                    </td>
                  </tr>
                ) : (
                  rekapSummary.map((r) => {
                    const hasPhone = Boolean(guruPhoneMap.get(r.guruId));
                    return (
                      <tr
                        key={r.key}
                        className="group hover:bg-slate-800/30 transition-colors text-slate-200"
                      >
                        <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)] transition-colors">
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

                        {/* ✅ Kolom Aksi: WA + Copy */}
                        <td className="p-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleSendWa(r)}
                              disabled={!hasPhone}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                hasPhone
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                              }`}
                              title={
                                hasPhone
                                  ? 'Kirim rekap via WhatsApp'
                                  : 'Nomor HP tidak tersedia di profil HRIS'
                              }
                            >
                              <MessageCircle size={12} />
                              WA
                            </button>
                            <button
                              onClick={() => handleCopyMessage(r)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition cursor-pointer"
                              title="Copy pesan ke clipboard"
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