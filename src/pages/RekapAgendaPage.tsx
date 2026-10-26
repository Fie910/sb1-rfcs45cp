// src/pages/RekapAgendaPage.tsx
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Loader2, NotebookPen, Calendar, Filter, FileText, BarChart3,
  Users, BookOpen, Search, AlertCircle, MessageCircle, Copy,
  Sparkles, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { SearchableSelect } from '@/components/SearchableSelect';
import { showToast } from '@/components/Toast';
import { getFirstDayOfMonthWib, getLastDayOfMonthWib } from '@/utils/date';
import {
  generateAnalisaAgenda, isAiAgendaAvailable,
  type AnalisaAgendaAi, type RecordAgendaForAi,
} from '@/lib/ai/analisaAgendaAi';
import {
  exportColoredPdf, getPersenWarna, formatTanggalPdf,
  PDF_COLORS, fetchKepalaSekolahData, type PdfColumn,
} from '@/lib/pdf/pdfColoredExport';
import type { AgendaGuruWithRelations, Guru } from '@/types/database';
import { SEKOLAH_TAGLINE_WA } from '@/constants/branding';

// =============================================================================
// TYPES
// =============================================================================
interface RekapAgendaSummaryRow {
  key: string;
  guruId: string;
  guruNama: string;
  mapelNama?: string;
  totalJP: number;
  hadirJP: number;
  asistenJP: number;
  sakitTugasJP: number;
  sakitTanpaTugasJP: number;
  izinTugasJP: number;
  izinTanpaTugasJP: number;
  dinasTugasJP: number;
  dinasTanpaTugasJP: number;
  alpaJP: number;
  terlambatJP: number;
  persentase: number;
}

interface JPBreakdown {
  totalMenit: number;
  totalJP: number;
  hadirJP: number;
  asistenJP: number;
  sakitTugasJP: number;
  sakitTanpaTugasJP: number;
  izinTugasJP: number;
  izinTanpaTugasJP: number;
  dinasTugasJP: number;
  dinasTanpaTugasJP: number;
  alpaJP: number;
  terlambatJP: number;
}

const DETAIL_HEADERS = [
  'Nama Guru', 'Mata Pelajaran', 'Tanggal', 'Kelas',
  'Status', 'JP', 'Terlambat (mnt)', 'Catatan Materi',
];

const DOA_ARAB = 'جَزَاكُمُ اللهُ خَيْرًا كَثِيْرًا';
const SALAM_PEMBUKA = 'Bismillaahi Ar-Rahmaani Ar-Rahiimi';
const SALAM_PENUTUP = 'Barakallahu fiikum';

// =============================================================================
// HELPERS
// =============================================================================
const parseTimeToMinutes = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

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
function getAnalisaAgendaFallback(persentase: number, avgSekolah: number): AnalisaAgendaAi {
  const delta = persentase - avgSekolah;
  const deltaTxt =
    delta > 3 ? `📈 ${delta.toFixed(1)}% di atas rata-rata sekolah (${avgSekolah}%)` :
    delta < -3 ? `📉 ${Math.abs(delta).toFixed(1)}% di bawah rata-rata sekolah (${avgSekolah}%)` :
    `➖ Setara dengan rata-rata sekolah (${avgSekolah}%)`;

  if (persentase >= 95) {
    return {
      ringkasan_pola: `Kehadiran mengajar nyaris sempurna. ${deltaTxt}`,
      kekuatan: 'Dedikasi tinggi terhadap amanah mendidik, konsisten sepanjang periode.',
      area_perbaikan: 'Pertahankan ritme positif ini. Jadikan teladan bagi rekan sejawat.',
      motivasi_personal:
        'Setiap langkah ke kelas dengan niat ibadah adalah amal jariyah yang mengalir pahalanya. Rasulullah ﷺ bersabda: "Barangsiapa menempuh jalan mencari ilmu, Allah mudahkan jalannya ke surga." (HR. Muslim)',
    };
  }
  if (persentase >= 85) {
    return {
      ringkasan_pola: `Kehadiran mengajar sangat baik. ${deltaTxt}`,
      kekuatan: 'Konsistensi tinggi yang langka dan berharga.',
      area_perbaikan: 'Kurangi sesi tanpa tugas saat berhalangan untuk hasil optimal.',
      motivasi_personal:
        'Menjadi guru bukan sekadar profesi, tapi jalan dakwah yang mulia. Setiap ilmu yang tersampaikan adalah investasi akherat.',
    };
  }
  if (persentase >= 75) {
    return {
      ringkasan_pola: `Kehadiran di posisi sehat. ${deltaTxt}`,
      kekuatan: 'Ritme kehadiran stabil, menunjukkan kedisiplinan.',
      area_perbaikan: 'Tingkatkan kehadiran fisik atau titipan tugas saat berhalangan.',
      motivasi_personal:
        'Rasulullah ﷺ mencintai amal yang kecil namun istiqamah. Setiap kehadiran Anda adalah bukti cinta pada ilmu dan siswa.',
    };
  }
  if (persentase >= 60) {
    return {
      ringkasan_pola: `Kehadiran cukup, perlu peningkatan. ${deltaTxt}`,
      kekuatan: 'Kemauan untuk terus melangkah sudah terlihat dari sebagian besar sesi.',
      area_perbaikan:
        'Buat target pribadi: hadir 100% bulan depan, atau selalu titipkan tugas saat berhalangan.',
      motivasi_personal:
        'Setiap kelas yang tidak kita hadiri adalah kesempatan pahala yang hilang. Kami siap membantu!',
    };
  }
  return {
    ringkasan_pola: `Kehadiran perlu perhatian khusus. ${deltaTxt}`,
    kekuatan: 'Kesempatan besar untuk transformasi positif sudah terbuka.',
    area_perbaikan:
      'Konsultasi dengan pimpinan/kepala divisi. Buat rencana perbaikan konkret.',
    motivasi_personal:
      'Amanah mendidik adalah ibadah besar. Kami percaya Anda bisa lebih baik!',
  };
}

function buildWaMessage(
  guruNama: string, periodeLabel: string, stats: RekapAgendaSummaryRow,
  analisa: AnalisaAgendaAi, usedAi: boolean, namaSekolah: string
): string {
  const lines: string[] = [];
  lines.push(`• Total JP: *${stats.totalJP}*`);
  lines.push(`• Hadir: *${stats.hadirJP}* JP`);
  if (stats.asistenJP > 0) lines.push(`• Asistensi: ${stats.asistenJP} JP`);
  if (stats.sakitTugasJP > 0) lines.push(`• Sakit (+Tugas): ${stats.sakitTugasJP} JP`);
  if (stats.sakitTanpaTugasJP > 0) lines.push(`• Sakit (-Tugas): ${stats.sakitTanpaTugasJP} JP`);
  if (stats.izinTugasJP > 0) lines.push(`• Izin (+Tugas): ${stats.izinTugasJP} JP`);
  if (stats.izinTanpaTugasJP > 0) lines.push(`• Izin (-Tugas): ${stats.izinTanpaTugasJP} JP`);
  if (stats.dinasTugasJP > 0) lines.push(`• Dinas (+Tugas): ${stats.dinasTugasJP} JP`);
  if (stats.dinasTanpaTugasJP > 0) lines.push(`• Dinas (-Tugas): ${stats.dinasTanpaTugasJP} JP`);
  if (stats.alpaJP > 0) lines.push(`• Alpa: ${stats.alpaJP} JP`);
  if (stats.terlambatJP > 0) lines.push(`• Terlambat: ${stats.terlambatJP} JP`);

  const mapelLine = stats.mapelNama ? `\n📚 *Mata Pelajaran:* ${stats.mapelNama}\n` : '';
  const aiBadge = usedAi ? ' ✨' : '';

  return `*📊 REKAP KEHADIRAN MENGAJAR*${aiBadge}
_${periodeLabel}_
${mapelLine}
_${SALAM_PEMBUKA}_
Ustadz/Ustadzah *${guruNama}*

${lines.join('\n')}

━━━━━━━━━━━━━━━━━━━━
🎯 *Persentase Kehadiran Berbobot: ${stats.persentase}%*
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

${SEKOLAH_TAGLINE_WA}

*${namaSekolah}*`;
}

// =============================================================================
// COMPONENT
// =============================================================================
export function RekapAgendaPage() {
  const [activeTab, setActiveTab] = useState<'detail' | 'rekap'>('detail');
  const [rekapGroupBy, setRekapGroupBy] = useState<'guru' | 'guru_mapel'>('guru');

  const [list, setList] = useState<AgendaGuruWithRelations[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [guruPhoneMap, setGuruPhoneMap] = useState<Map<string, string | null>>(new Map());
  const [namaSekolah, setNamaSekolah] = useState<string>('');
  const [kepalaSekolah, setKepalaSekolah] = useState<{ nama: string; nip: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [startDate, setStartDate] = usePersistedState('rekap_agenda_start', getFirstDayOfMonthWib());
  const [endDate, setEndDate] = usePersistedState('rekap_agenda_end', getLastDayOfMonthWib());
  const [filterGuru, setFilterGuru] = usePersistedState('rekap_agenda_filter_guru', '');
  const [filterMapel, setFilterMapel] = usePersistedState('rekap_agenda_filter_mapel', '');

  const [aiLoadingKey, setAiLoadingKey] = useState<string | null>(null);
  const aiCacheRef = useRef<Map<string, AnalisaAgendaAi>>(new Map());

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
        supabase.from('pengaturan_sekolahs').select('nama_sekolah').limit(1).maybeSingle(),
      ]);

      setGurus((guruRes.data as Guru[]) || []);

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
  // FETCH DATA AGENDA
  // ==========================================================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      let query = supabase
        .from('agenda_gurus')
        .select(`
          *,
          gurus (id, nama_lengkap),
          jadwal_kbms (
            id, waktu_mulai, waktu_selesai,
            kelas (id, nama_kelas),
            mata_pelajarans (id, nama_mapel)
          )
        `);

      if (startDate) query = query.gte('tanggal', startDate);
      if (endDate) query = query.lte('tanggal', endDate);
      if (filterGuru) query = query.eq('guru_id', filterGuru);
      query = query.order('tanggal', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching agenda:', error);
        setErrorMessage(error.message);
        setList([]);
      } else {
        let filtered = (data as unknown as AgendaGuruWithRelations[]) || [];
        if (filterMapel.trim() !== '') {
          filtered = filtered.filter((a) => {
            const m = a.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '';
            return m.toLowerCase().includes(filterMapel.toLowerCase());
          });
        }
        setList(filtered);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filterGuru, filterMapel, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const guruMap = useMemo(() => new Map(gurus.map((g) => [g.id, g.nama_lengkap])), [gurus]);

  // ==========================================================================
  // CALCULATE JP — handle all 10 statuses
  // ==========================================================================
  const calculateAgendaJP = (item: AgendaGuruWithRelations): JPBreakdown => {
    const kbm = item.jadwal_kbms;
    let totalMenit = 0;
    if (kbm?.waktu_mulai && kbm?.waktu_selesai) {
      totalMenit = Math.max(0, parseTimeToMinutes(kbm.waktu_selesai) - parseTimeToMinutes(kbm.waktu_mulai));
    }
    if (totalMenit <= 0) totalMenit = 30;

    const jpFromMenit = Math.round(totalMenit / 30);
    const status = (item.status_kehadiran || '').toLowerCase().trim();
    const menitTerlambat = item.menit_terlambat || 0;
    const baseAlpaJP = item.alpa_jam_pelajaran || 0;
    const terlambatJP = Math.round(menitTerlambat / 30);

    const r: JPBreakdown = {
      totalMenit, totalJP: 0,
      hadirJP: 0, asistenJP: 0,
      sakitTugasJP: 0, sakitTanpaTugasJP: 0,
      izinTugasJP: 0, izinTanpaTugasJP: 0,
      dinasTugasJP: 0, dinasTanpaTugasJP: 0,
      alpaJP: 0, terlambatJP,
    };

    // Handle new statuses FIRST
    if (status === 'sakit+tugas') r.sakitTugasJP = jpFromMenit;
    else if (status === 'izin+tugas') r.izinTugasJP = jpFromMenit;
    else if (status === 'dinas+tugas') r.dinasTugasJP = jpFromMenit;
    else if (status === 'asistensi') r.asistenJP = jpFromMenit;
    else if (status === 'sakit') r.sakitTanpaTugasJP = jpFromMenit;
    else if (status === 'izin') r.izinTanpaTugasJP = jpFromMenit;
    else if (status === 'dinas') r.dinasTanpaTugasJP = jpFromMenit;
    else if (status === 'alpa') r.alpaJP = baseAlpaJP > 0 ? baseAlpaJP : jpFromMenit;
    else if (status === 'terlambat' || status === 'hadir mengajar' || status === 'hadir' || status === '') {
      const sisa = Math.max(0, totalMenit - menitTerlambat);
      r.hadirJP = Math.ceil(sisa / 30);
      r.alpaJP = baseAlpaJP;
    }
    // Fallback legacy / unknown
    else if (status.includes('sakit')) {
      if (status.includes('tugas')) r.sakitTugasJP = jpFromMenit;
      else r.sakitTanpaTugasJP = jpFromMenit;
    } else if (status.includes('izin')) {
      if (status.includes('tugas')) r.izinTugasJP = jpFromMenit;
      else r.izinTanpaTugasJP = jpFromMenit;
    } else if (status.includes('dinas')) {
      if (status.includes('tugas')) r.dinasTugasJP = jpFromMenit;
      else r.dinasTanpaTugasJP = jpFromMenit;
    } else {
      r.alpaJP = jpFromMenit;
    }

    r.totalJP = r.hadirJP + r.asistenJP +
      r.sakitTugasJP + r.sakitTanpaTugasJP +
      r.izinTugasJP + r.izinTanpaTugasJP +
      r.dinasTugasJP + r.dinasTanpaTugasJP +
      r.alpaJP;

    if (r.totalJP === 0) r.totalJP = jpFromMenit;
    return r;
  };

  // ==========================================================================
  // DETAIL ROWS
  // ==========================================================================
  const detailRows = list.map((a) => {
    const guruNama = a.gurus?.nama_lengkap ?? guruMap.get(a.guru_id) ?? '-';
    const mapelNama = a.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '-';
    const kelasNama = a.jadwal_kbms?.kelas?.nama_kelas ?? '-';
    const jp = calculateAgendaJP(a);
    return [
      guruNama, mapelNama, a.tanggal, kelasNama,
      a.status_kehadiran, jp.totalJP, jp.terlambatJP > 0 ? `${jp.terlambatJP * 30}mnt` : '-',
      a.catatan_materi ?? '-',
    ];
  });

  // ==========================================================================
  // REKAP SUMMARY
  // ==========================================================================
  const rekapSummary = useMemo(() => {
    const map = new Map<string, RekapAgendaSummaryRow>();

    list.forEach((item) => {
      const guruId = item.guru_id;
      const guruNama = item.gurus?.nama_lengkap ?? guruMap.get(guruId) ?? 'Guru Tanpa Nama';
      const mapelNama = item.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? 'Tanpa Mapel';
      const key = rekapGroupBy === 'guru' ? guruId : `${guruId}_${mapelNama}`;
      const jp = calculateAgendaJP(item);

      if (!map.has(key)) {
        map.set(key, {
          key, guruId, guruNama,
          mapelNama: rekapGroupBy === 'guru_mapel' ? mapelNama : undefined,
          totalJP: 0, hadirJP: 0, asistenJP: 0,
          sakitTugasJP: 0, sakitTanpaTugasJP: 0,
          izinTugasJP: 0, izinTanpaTugasJP: 0,
          dinasTugasJP: 0, dinasTanpaTugasJP: 0,
          alpaJP: 0, terlambatJP: 0, persentase: 0,
        });
      }

      const row = map.get(key)!;
      row.totalJP += jp.totalJP;
      row.hadirJP += jp.hadirJP;
      row.asistenJP += jp.asistenJP;
      row.sakitTugasJP += jp.sakitTugasJP;
      row.sakitTanpaTugasJP += jp.sakitTanpaTugasJP;
      row.izinTugasJP += jp.izinTugasJP;
      row.izinTanpaTugasJP += jp.izinTanpaTugasJP;
      row.dinasTugasJP += jp.dinasTugasJP;
      row.dinasTanpaTugasJP += jp.dinasTanpaTugasJP;
      row.alpaJP += jp.alpaJP;
      row.terlambatJP += jp.terlambatJP;
    });

    // Hitung persentase berbobot
    const results = Array.from(map.values()).map((row) => {
      const nilaiKehadiran =
        row.hadirJP * 1.0 +
        row.asistenJP * 0.85 +
        row.dinasTugasJP * 1.0 +
        row.dinasTanpaTugasJP * 0.5 +
        row.sakitTugasJP * 0.25 +
        row.izinTugasJP * 0.25;

      row.persentase = row.totalJP > 0 ? Math.round((nilaiKehadiran / row.totalJP) * 100) : 0;
      return row;
    });

    return results.sort((a, b) => a.guruNama.localeCompare(b.guruNama));
  }, [list, rekapGroupBy, guruMap]);

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
    return `${fmt(startDate)} — ${fmt(endDate)}`;
  }, [startDate, endDate]);

  // ==========================================================================
  // HANDLER WA
  // ==========================================================================
  const handleSendWa = useCallback(async (row: RekapAgendaSummaryRow) => {
    const phone = guruPhoneMap.get(row.guruId);
    if (!phone) {
      showToast('error', `Nomor HP ${row.guruNama} tidak ditemukan. Lengkapi di HRIS.`);
      return;
    }

    const guruRecords = list.filter((r) => r.guru_id === row.guruId);
    const recordsForAi: RecordAgendaForAi[] = guruRecords.map((r) => {
      const jp = calculateAgendaJP(r);
      return {
        tanggal: r.tanggal,
        mapel: r.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '-',
        kelas: r.jadwal_kbms?.kelas?.nama_kelas ?? '-',
        status: r.status_kehadiran,
        jp: jp.totalJP,
      };
    });

    const cacheKey = `${row.guruId}_${startDate}_${endDate}_${rekapGroupBy}`;
    let analisa: AnalisaAgendaAi;
    let usedAi = false;

    const cached = aiCacheRef.current.get(cacheKey);
    if (cached) {
      analisa = cached;
      usedAi = true;
    } else if (isAiAgendaAvailable() && recordsForAi.length > 0) {
      setAiLoadingKey(row.key);
      try {
        analisa = await generateAnalisaAgenda(
          row.guruNama, periodeLabel, recordsForAi,
          {
            totalJP: row.totalJP,
            hadirJP: row.hadirJP,
            asistenJP: row.asistenJP,
            sakitTugasJP: row.sakitTugasJP,
            sakitTanpaTugasJP: row.sakitTanpaTugasJP,
            izinTugasJP: row.izinTugasJP,
            izinTanpaTugasJP: row.izinTanpaTugasJP,
            dinasTugasJP: row.dinasTugasJP,
            dinasTanpaTugasJP: row.dinasTanpaTugasJP,
            alpaJP: row.alpaJP,
            terlambatJP: row.terlambatJP,
            persentase: row.persentase,
          },
          avgSekolah
        );
        aiCacheRef.current.set(cacheKey, analisa);
        usedAi = true;
      } catch (err) {
        console.warn('[RekapAgenda] AI gagal:', err);
        showToast('info', 'AI tidak tersedia, memakai analisa standar');
        analisa = getAnalisaAgendaFallback(row.persentase, avgSekolah);
      } finally {
        setAiLoadingKey(null);
      }
    } else {
      analisa = getAnalisaAgendaFallback(row.persentase, avgSekolah);
    }

    const msg = buildWaMessage(row.guruNama, periodeLabel, row, analisa, usedAi, namaSekolah || 'Sekolah');
    const link = buildWaLink(phone, msg);
    if (!link) {
      showToast('error', 'Nomor HP tidak valid');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  }, [guruPhoneMap, list, periodeLabel, avgSekolah, namaSekolah, startDate, endDate, rekapGroupBy]);

  // ==========================================================================
  // HANDLER COPY
  // ==========================================================================
  const handleCopyMessage = useCallback(async (row: RekapAgendaSummaryRow) => {
    const cacheKey = `${row.guruId}_${startDate}_${endDate}_${rekapGroupBy}`;
    const cached = aiCacheRef.current.get(cacheKey);
    const analisa = cached ?? getAnalisaAgendaFallback(row.persentase, avgSekolah);
    const usedAi = Boolean(cached);

    const msg = buildWaMessage(row.guruNama, periodeLabel, row, analisa, usedAi, namaSekolah || 'Sekolah');
    try {
      await navigator.clipboard.writeText(msg);
      showToast('success', `Pesan untuk ${row.guruNama} disalin`);
    } catch {
      showToast('error', 'Gagal menyalin pesan');
    }
  }, [periodeLabel, avgSekolah, namaSekolah, startDate, endDate, rekapGroupBy]);

  // ==========================================================================
  // HANDLER PDF
  // ==========================================================================
  const handleExportPdf = () => {
    if (rekapSummary.length === 0) {
      showToast('error', 'Tidak ada data rekapitulasi untuk diekspor.');
      return;
    }

    const periodeText = `Periode: ${formatTanggalPdf(startDate)} — ${formatTanggalPdf(endDate)}`;

    const baseColumns: PdfColumn[] = [
      { header: 'Nama Guru', halign: 'left', width: 45, bold: true },
      { header: 'Total JP', halign: 'center', width: 16 },
      { header: 'Hadir', halign: 'center', width: 14, bold: true, textColor: PDF_COLORS.emerald },
      { header: 'Asisten', halign: 'center', width: 16, bold: true, textColor: PDF_COLORS.teal },
      { header: 'Sakit (+Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.blue },
      { header: 'Sakit (-Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.slate500 },
      { header: 'Izin (+Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.amber },
      { header: 'Izin (-Tugas)', halign: 'center', width: 20, textColor: PDF_COLORS.slate500 },
      { header: 'Dinas (+Tugas)', halign: 'center', width: 22, textColor: PDF_COLORS.purple },
      { header: 'Dinas (-Tugas)', halign: 'center', width: 22, textColor: PDF_COLORS.slate500 },
      { header: 'Alpa', halign: 'center', width: 14, bold: true, textColor: PDF_COLORS.rose },
      { header: 'Terlambat', halign: 'center', width: 18, textColor: PDF_COLORS.slate500 },
      {
        header: '% Kehadiran',
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

    const columns: PdfColumn[] = rekapGroupBy === 'guru_mapel'
      ? [baseColumns[0], { header: 'Mata Pelajaran', halign: 'left', width: 35 }, ...baseColumns.slice(1)]
      : baseColumns;

    const rows = rekapSummary.map((r) => {
      const base: Record<string, any> = {
        'Nama Guru': r.guruNama,
        'Total JP': r.totalJP,
        Hadir: r.hadirJP,
        Asisten: r.asistenJP,
        'Sakit (+Tugas)': r.sakitTugasJP,
        'Sakit (-Tugas)': r.sakitTanpaTugasJP,
        'Izin (+Tugas)': r.izinTugasJP,
        'Izin (-Tugas)': r.izinTanpaTugasJP,
        'Dinas (+Tugas)': r.dinasTugasJP,
        'Dinas (-Tugas)': r.dinasTanpaTugasJP,
        Alpa: r.alpaJP,
        Terlambat: r.terlambatJP,
        '% Kehadiran': `${r.persentase}%`,
      };
      if (rekapGroupBy === 'guru_mapel') base['Mata Pelajaran'] = r.mapelNama ?? '-';
      return base;
    });

    exportColoredPdf({
      filename: `Rekap_Agenda_Guru_${rekapGroupBy}_${startDate}_sd_${endDate}.pdf`,
      title: 'LAPORAN REKAPITULASI KEHADIRAN MENGAJAR GURU',
      subtitle: `${periodeText}${avgSekolah > 0 ? ` · Rata-rata Sekolah: ${avgSekolah}%` : ''}`,
      columns,
      rows,
      orientation: 'l',
      footerNote: 'Rekap Agenda Guru v2',
      signature: kepalaSekolah
        ? { nama: kepalaSekolah.nama, nip: kepalaSekolah.nip, kota: 'Tasikmalaya' }
        : undefined,
    });

    showToast('success', 'File PDF berwarna berhasil diunduh');
  };

  // ==========================================================================
  // EXPORT EXCEL REKAP
  // ==========================================================================
  const rekapHeaders = rekapGroupBy === 'guru_mapel'
    ? ['Nama Guru', 'Mata Pelajaran', 'Total JP', 'Hadir', 'Asisten',
       'Sakit (+T)', 'Sakit (-T)', 'Izin (+T)', 'Izin (-T)',
       'Dinas (+T)', 'Dinas (-T)', 'Alpa', 'Terlambat', '% Kehadiran']
    : ['Nama Guru', 'Total JP', 'Hadir', 'Asisten',
       'Sakit (+T)', 'Sakit (-T)', 'Izin (+T)', 'Izin (-T)',
       'Dinas (+T)', 'Dinas (-T)', 'Alpa', 'Terlambat', '% Kehadiran'];

  const rekapRows = rekapSummary.map((r) => [
    r.guruNama,
    ...(rekapGroupBy === 'guru_mapel' ? [r.mapelNama ?? '-'] : []),
    r.totalJP, r.hadirJP, r.asistenJP,
    r.sakitTugasJP, r.sakitTanpaTugasJP,
    r.izinTugasJP, r.izinTanpaTugasJP,
    r.dinasTugasJP, r.dinasTanpaTugasJP,
    r.alpaJP, r.terlambatJP,
    `${r.persentase}%`,
  ]);

  // ==========================================================================
  // STATUS BADGE COLOR
  // ==========================================================================
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'hadir mengajar' || s === 'hadir') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (s === 'asistensi') return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    if (s === 'terlambat') return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    if (s === 'sakit+tugas') return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (s === 'sakit') return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    if (s === 'izin+tugas') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (s === 'izin') return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    if (s === 'dinas+tugas') return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (s === 'dinas') return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
    if (s === 'alpa' || s === 'tanpa_keterangan') return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const formatStatus = (str: string) => {
    if (!str) return '-';
    return str.replace(/_/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
          <NotebookPen className="text-indigo-400" size={28} />
          Rekap Agenda Guru
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Rekapitulasi kehadiran mengajar, catatan materi, delegasi tugas & analisa AI personal
        </p>
      </div>

      {errorMessage && (
        <div className="bg-rose-950/50 border border-rose-800 text-rose-300 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle size={20} className="text-rose-400 shrink-0" />
          <div>
            <p className="font-bold">Gagal mengambil data dari server:</p>
            <p className="text-xs text-rose-400/80">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter size={14} className="text-indigo-400" /> Filter Guru
            </label>
            <SearchableSelect
              options={gurus.map((g) => ({ value: g.id, label: g.nama_lengkap, hint: g.nip ? `NIP: ${g.nip}` : undefined }))}
              value={filterGuru} onChange={setFilterGuru}
              placeholder="Semua Guru" searchPlaceholder="Cari nama atau NIP..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search size={14} className="text-indigo-400" /> Mata Pelajaran
            </label>
            <input type="text" value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}
              placeholder="Cari mata pelajaran..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all font-medium"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" /> Dari Tanggal
            </label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all cursor-pointer"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" /> Sampai Tanggal
            </label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button onClick={() => setActiveTab('detail')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'detail' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}>
          <FileText size={18} />
          Detail Record ({list.length})
        </button>
        <button onClick={() => setActiveTab('rekap')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'rekap' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}>
          <BarChart3 size={18} />
          Rekapitulasi ({rekapSummary.length})
        </button>
      </div>

      {/* TAB DETAIL */}
      {activeTab === 'detail' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-wrap gap-4 bg-slate-950/40">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText size={20} className="text-indigo-400" />
              Data Agenda ({list.length} Record)
            </h2>
            <ExportImportButtons
              filename="rekap_agenda_guru" title="Rekap Agenda Guru"
              headers={DETAIL_HEADERS} rows={detailRows} showImport={false}
            />
          </div>

          <div className="max-h-[600px] overflow-auto relative">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  {DETAIL_HEADERS.map((h, idx) => (
                    <th key={h} className={`p-4 whitespace-nowrap sticky top-0 bg-slate-950 ${
                      idx === 0 ? 'left-0 z-30 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]' :
                      idx >= 5 ? 'text-center z-20' : 'z-20'
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                {loading ? (
                  <tr><td colSpan={DETAIL_HEADERS.length} className="text-center py-16">
                    <Loader2 className="animate-spin text-indigo-400 mx-auto mb-2" size={28} />
                  </td></tr>
                ) : list.length === 0 ? (
                  <tr><td colSpan={DETAIL_HEADERS.length} className="text-center py-16 text-slate-500">
                    <NotebookPen size={40} className="mx-auto mb-2 opacity-40 text-slate-600" />
                    <p className="font-semibold text-slate-400">Tidak ada data agenda.</p>
                  </td></tr>
                ) : list.map((a) => {
                  const guruNama = a.gurus?.nama_lengkap ?? guruMap.get(a.guru_id) ?? '-';
                  const mapelNama = a.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '-';
                  const kelasNama = a.jadwal_kbms?.kelas?.nama_kelas ?? '-';
                  const jp = calculateAgendaJP(a);
                  return (
                    <tr key={a.id} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80">
                        {guruNama}
                      </td>
                      <td className="p-4 whitespace-nowrap text-indigo-300 font-semibold">{mapelNama}</td>
                      <td className="p-4 whitespace-nowrap font-medium text-slate-300">{a.tanggal}</td>
                      <td className="p-4 whitespace-nowrap text-slate-300">{kelasNama}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${getStatusBadge(a.status_kehadiran)}`}>
                          {formatStatus(a.status_kehadiran)}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-center font-bold text-slate-200">{jp.totalJP}</td>
                      <td className="p-4 whitespace-nowrap text-center font-semibold text-orange-400">
                        {jp.terlambatJP > 0 ? `${jp.terlambatJP * 30}mnt` : '-'}
                      </td>
                      <td className="p-4 text-slate-400 text-xs max-w-xs truncate" title={a.catatan_materi ?? ''}>
                        {a.catatan_materi ?? '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB REKAP */}
      {activeTab === 'rekap' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-wrap gap-4 bg-slate-950/40">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-400" />
                Statistik Kehadiran Mengajar
              </h2>

              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
                <button onClick={() => setRekapGroupBy('guru')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    rekapGroupBy === 'guru' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}>
                  <Users size={13} /> Per Guru
                </button>
                <button onClick={() => setRekapGroupBy('guru_mapel')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    rekapGroupBy === 'guru_mapel' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}>
                  <BookOpen size={13} /> Per Guru & Mapel
                </button>
              </div>

              {avgSekolah > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <TrendingUp size={13} /> Rata-rata Sekolah: {avgSekolah}%
                </div>
              )}

              {isAiAgendaAvailable() && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold">
                  <Sparkles size={13} /> AI Aktif
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleExportPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg transition cursor-pointer">
                <FileText size={14} /> Ekspor PDF
              </button>
              <ExportImportButtons
                filename={`rekap_agenda_${rekapGroupBy}`}
                title="Rekapitulasi Kehadiran Mengajar"
                headers={rekapHeaders} rows={rekapRows} showImport={false}
              />
            </div>
          </div>

          {/* Legenda bobot */}
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40">
            <details className="text-xs group">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1.5 select-none">
                <span className="text-indigo-400 group-open:rotate-90 transition-transform inline-block">▶</span>
                ℹ️ Cara perhitungan % Kehadiran Berbobot & fitur AI + WhatsApp
              </summary>
              <div className="mt-3 ml-5 text-slate-500 leading-relaxed space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-emerald-400 font-extrabold text-sm">1.0</span>
                    <span className="text-[11px] text-slate-300">Hadir Mengajar</span>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-purple-400 font-extrabold text-sm">1.0</span>
                    <span className="text-[11px] text-slate-300">Dinas (+Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-teal-500/5 border border-teal-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-teal-400 font-extrabold text-sm">0.85</span>
                    <span className="text-[11px] text-slate-300">Asistensi</span>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-purple-300 font-extrabold text-sm">0.5</span>
                    <span className="text-[11px] text-slate-300">Dinas (-Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-blue-400 font-extrabold text-sm">0.25</span>
                    <span className="text-[11px] text-slate-300">Sakit/Izin (+Tugas)</span>
                  </div>
                  <div className="flex items-center gap-2 bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-rose-400 font-extrabold text-sm">0</span>
                    <span className="text-[11px] text-slate-300">Sakit/Izin (-Tugas), Alpa</span>
                  </div>
                </div>
                <p className="text-[11px] italic mt-2">
                  % Kehadiran = (Σ Nilai Berbobot ÷ Total JP) × 100%
                </p>
              </div>
            </details>
          </div>

          <div className="max-h-[600px] overflow-auto relative">
            <table className="w-full text-left border-collapse min-w-[1500px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  <th className="p-4 whitespace-nowrap sticky top-0 left-0 z-30 bg-slate-950 border-r border-slate-800/80">Nama Guru</th>
                  {rekapGroupBy === 'guru_mapel' && (
                    <th className="p-4 whitespace-nowrap sticky top-0 z-20 bg-slate-950">Mata Pelajaran</th>
                  )}
                  <th className="p-4 whitespace-nowrap text-center sticky top-0 z-20 bg-slate-950">Total JP</th>
                  <th className="p-4 whitespace-nowrap text-center text-emerald-400 sticky top-0 z-20 bg-slate-950">Hadir</th>
                  <th className="p-4 whitespace-nowrap text-center text-teal-400 sticky top-0 z-20 bg-slate-950">Asistensi</th>
                  <th className="p-4 whitespace-nowrap text-center text-blue-400 sticky top-0 z-20 bg-slate-950">Sakit (+T)</th>
                  <th className="p-4 whitespace-nowrap text-center text-sky-400 sticky top-0 z-20 bg-slate-950">Sakit (-T)</th>
                  <th className="p-4 whitespace-nowrap text-center text-amber-400 sticky top-0 z-20 bg-slate-950">Izin (+T)</th>
                  <th className="p-4 whitespace-nowrap text-center text-amber-300 sticky top-0 z-20 bg-slate-950">Izin (-T)</th>
                  <th className="p-4 whitespace-nowrap text-center text-purple-400 sticky top-0 z-20 bg-slate-950">Dinas (+T)</th>
                  <th className="p-4 whitespace-nowrap text-center text-purple-300 sticky top-0 z-20 bg-slate-950">Dinas (-T)</th>
                  <th className="p-4 whitespace-nowrap text-center text-rose-400 sticky top-0 z-20 bg-slate-950">Alpa</th>
                  <th className="p-4 whitespace-nowrap text-center text-orange-400 sticky top-0 z-20 bg-slate-950">Terlambat</th>
                  <th className="p-4 whitespace-nowrap text-center sticky top-0 z-20 bg-slate-950">% Kehadiran</th>
                  <th className="p-4 whitespace-nowrap text-center text-indigo-400 sticky top-0 z-20 bg-slate-950">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                {loading ? (
                  <tr><td colSpan={rekapHeaders.length + 1} className="text-center py-16">
                    <Loader2 className="animate-spin text-indigo-400 mx-auto mb-2" size={28} />
                  </td></tr>
                ) : rekapSummary.length === 0 ? (
                  <tr><td colSpan={rekapHeaders.length + 1} className="text-center py-16 text-slate-500">
                    <BarChart3 size={40} className="mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-400">Tidak ada data rekapitulasi.</p>
                  </td></tr>
                ) : rekapSummary.map((r) => {
                  const hasPhone = Boolean(guruPhoneMap.get(r.guruId));
                  const isAiLoading = aiLoadingKey === r.key;
                  return (
                    <tr key={r.key} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80">
                        {r.guruNama}
                      </td>
                      {rekapGroupBy === 'guru_mapel' && (
                        <td className="p-4 whitespace-nowrap text-indigo-300 font-semibold">{r.mapelNama ?? '-'}</td>
                      )}
                      <td className="p-4 whitespace-nowrap text-center font-semibold text-slate-300">{r.totalJP}</td>
                      <td className="p-4 whitespace-nowrap text-center font-bold text-emerald-400">{r.hadirJP}</td>
                      <td className="p-4 whitespace-nowrap text-center font-semibold text-teal-400">{r.asistenJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-blue-400 font-semibold">{r.sakitTugasJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-sky-400 font-semibold">{r.sakitTanpaTugasJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-amber-400 font-semibold">{r.izinTugasJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-amber-300 font-semibold">{r.izinTanpaTugasJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-purple-400 font-semibold">{r.dinasTugasJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-purple-300 font-semibold">{r.dinasTanpaTugasJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-rose-400 font-semibold">{r.alpaJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-orange-400 font-semibold">{r.terlambatJP}</td>
                      <td className="p-4 whitespace-nowrap text-center">
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
                      <td className="p-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => handleSendWa(r)} disabled={!hasPhone || isAiLoading}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              !hasPhone ? 'bg-slate-800 text-slate-500 border-slate-700 opacity-60 cursor-not-allowed' :
                              isAiLoading ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 cursor-wait' :
                              'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            }`}
                            title={!hasPhone ? 'Nomor HP tidak tersedia' : isAiLoading ? 'AI menganalisa...' : 'Kirim WA dengan analisa AI'}>
                            {isAiLoading ? <><Loader2 size={12} className="animate-spin" /> AI...</> : <><MessageCircle size={12} /> WA</>}
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
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}