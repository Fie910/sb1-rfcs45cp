// src/lib/pdf/generateRaportTahfidz.ts
// Generate PDF Raport Tahfidz per siswa per semester.
// Format A4 portrait, siap cetak + tanda tangan.

import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import {
  A4_LAYOUT,
  buildVerifyUrl,
  drawFooter,
  drawKopSurat,
  drawQrVerifikasi,
  fetchPengaturan,
  tanggalHariIni,
} from './pdfShared';
import { getSemesterDateRange, type SemesterType } from '@/lib/tahfidz/semester';
import { getHalamanSetoran } from '@/lib/tahfidz/hitungHalaman';
import type {
  TahfidzSurah,
  TahfidzHalamanDetail,
} from '@/types/database';

// =============================================================================
// HELPER LOKAL
// =============================================================================
function formatTanggalPendekRaport(d: string): string {
  if (!d) return '-';
  const date = new Date(`${d.split('T')[0]}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// =============================================================================
// TYPES
// =============================================================================
export type RaportTahfidzData = {
  siswa: {
    id: number;
    nama_lengkap: string;
    nisn: string;
    kelas_nama: string;
  };
  tahunAjaranId: number;
  tahunAjaran: string;      // "2025/2026"
  semester: SemesterType;
  verificationToken?: string; // opsional, untuk QR verify
};

// =============================================================================
// MAIN
// =============================================================================
export async function generateRaportTahfidz(
  data: RaportTahfidzData,
  surahMap: Map<number, TahfidzSurah>,
  halamanMap: TahfidzHalamanDetail[]
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { pageWidth, pageHeight, marginX, contentWidth } = A4_LAYOUT;
  const pengaturan = await fetchPengaturan(true);

  const dateRange = getSemesterDateRange(data.tahunAjaran, data.semester);

  // ==========================================================================
  // FETCH DATA
  // ==========================================================================
  // 1. Setoran semester ini
  const { data: setoranList } = await supabase
    .from('tahfidz_setoran')
    .select(`
      id, tanggal, jenis, surah_mulai, ayat_mulai, surah_selesai, ayat_selesai,
      kualitas, nilai, catatan, halaman_snapshot,
      guru:guru_tahfidz_id (nama_lengkap)
    `)
    .eq('siswa_id', data.siswa.id)
    .gte('tanggal', dateRange.start)
    .lte('tanggal', dateRange.end)
    .order('tanggal', { ascending: true });

  const setoran = setoranList ?? [];

  // 2. Target semester ini
  const { data: targetData } = await supabase
    .from('tahfidz_target')
    .select('*')
    .eq('siswa_id', data.siswa.id)
    .eq('tahun_ajaran_id', data.tahunAjaranId)
    .maybeSingle();

  // 3. Milestone tercapai
  const { data: milestoneData } = await supabase
    .from('tahfidz_milestone_tercapai')
    .select(`
      id, tanggal_tercapai,
      milestone:tahfidz_milestone (nama, poin_prestasi)
    `)
    .eq('siswa_id', data.siswa.id)
    .eq('tahun_ajaran_id', data.tahunAjaranId)
    .eq('semester', data.semester)
    .order('tanggal_tercapai', { ascending: true });

  const milestones = milestoneData ?? [];

  // 4. Ayat bermasalah (perlu ulang) — top 5
  const setoranIds = setoran.map((s) => s.id);
  let ayatBermasalah: { surah_nomor: number; ayat_nomor: number; count: number }[] = [];
  if (setoranIds.length > 0) {
    const { data: ayatData } = await supabase
      .from('tahfidz_setoran_ayat')
      .select('surah_nomor, ayat_nomor, kualitas')
      .in('setoran_id', setoranIds)
      .eq('kualitas', 'Perlu Ulang');

    const map = new Map<string, number>();
    (ayatData ?? []).forEach((a: any) => {
      const key = `${a.surah_nomor}:${a.ayat_nomor}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    ayatBermasalah = Array.from(map.entries())
      .map(([key, count]) => {
        const [s, a] = key.split(':').map(Number);
        return { surah_nomor: s, ayat_nomor: a, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // ==========================================================================
  // HITUNG STATISTIK
  // ==========================================================================
  const totalSetoran = setoran.length;
  const totalTahfidz = setoran.filter((s) => s.jenis === 'Tahfidz').length;
  const totalMurojaah = setoran.filter((s) => s.jenis === 'Murojaah').length;
  const totalHalaman = setoran.reduce(
    (sum, s) => sum + getHalamanSetoran(s as any, surahMap, halamanMap),
    0
  );
  const nilaiArr = setoran
    .map((s) => s.nilai)
    .filter((n): n is number => n !== null && n !== undefined);
  const rataNilai =
    nilaiArr.length > 0 ? nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length : 0;

  const totalPoinMilestone = milestones.reduce(
    (sum, m: any) => sum + (m.milestone?.poin_prestasi ?? 0),
    0
  );

  const targetHalaman = targetData?.target_halaman ?? 0;
  const persenCapaian = targetHalaman > 0 ? (totalHalaman / targetHalaman) * 100 : 0;

  // ==========================================================================
  // 1. KOP SURAT
  // ==========================================================================
  let y = await drawKopSurat(doc, pengaturan);

  // ==========================================================================
  // 2. JUDUL
  // ==========================================================================
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RAPORT TAHFIDZ AL-QURAN', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Tahun Ajaran ${data.tahunAjaran} · Semester ${data.semester}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  // ==========================================================================
  // 3. INFO SISWA
  // ==========================================================================
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('A. IDENTITAS SISWA', marginX, y);
  y += 6;

  const labelW = 45;
  const identitas: [string, string][] = [
    ['Nama Lengkap', data.siswa.nama_lengkap],
    ['NISN', data.siswa.nisn],
    ['Kelas', data.siswa.kelas_nama],
    ['Periode', `${formatTanggalPendekRaport(dateRange.start)} s/d ${formatTanggalPendekRaport(dateRange.end)}`],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  identitas.forEach(([label, value]) => {
    doc.text(label, marginX + 5, y);
    doc.text(':', marginX + labelW, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, marginX + labelW + 4, y);
    doc.setFont('helvetica', 'normal');
    y += 5.5;
  });

  // ==========================================================================
  // 4. STATISTIK
  // ==========================================================================
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('B. STATISTIK CAPAIAN', marginX, y);
  y += 6;

  // Grid 2x2 stat boxes
  const statBoxW = (contentWidth - 6) / 2;
  const statBoxH = 16;
  const statBoxGap = 3;

  const statBoxes = [
    { label: 'Total Setoran', value: `${totalSetoran}` },
    { label: 'Total Halaman', value: totalHalaman.toFixed(2) },
    { label: 'Rata-rata Nilai', value: rataNilai > 0 ? rataNilai.toFixed(1) : '—' },
    { label: 'Poin Prestasi', value: `${totalPoinMilestone}` },
  ];

  statBoxes.forEach((box, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const x = marginX + col * (statBoxW + statBoxGap);
    const boxY = y + row * (statBoxH + statBoxGap);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, boxY, statBoxW, statBoxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(box.label, x + statBoxW / 2, boxY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(box.value, x + statBoxW / 2, boxY + 12.5, { align: 'center' });
  });

  y += 2 * (statBoxH + statBoxGap) + 2;
  doc.setTextColor(0);

  // Breakdown: Tahfidz vs Murojaah
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Setoran: ${totalTahfidz} Tahfidz · ${totalMurojaah} Murojaah`,
    marginX + 5,
    y
  );
  y += 6;
  doc.setTextColor(0);

  // ==========================================================================
  // 5. TARGET & CAPAIAN
  // ==========================================================================
  if (targetData) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('C. TARGET & CAPAIAN', marginX, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Target range
    if (targetData.surah_mulai && targetData.ayat_mulai) {
      const surahAwal = surahMap.get(targetData.surah_mulai);
      const surahAkhir = surahMap.get(targetData.surah_selesai);
      doc.text('Target Range', marginX + 5, y);
      doc.text(':', marginX + labelW, y);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `${surahAwal?.nama_latin ?? '?'} : ${targetData.ayat_mulai} → ${surahAkhir?.nama_latin ?? '?'} : ${targetData.ayat_selesai}`,
        marginX + labelW + 4,
        y
      );
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    }

    // Target halaman
    if (targetHalaman > 0) {
      doc.text('Target Halaman', marginX + 5, y);
      doc.text(':', marginX + labelW, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`${targetHalaman} halaman`, marginX + labelW + 4, y);
      doc.setFont('helvetica', 'normal');
      y += 5.5;

      doc.text('Realisasi', marginX + 5, y);
      doc.text(':', marginX + labelW, y);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `${totalHalaman.toFixed(2)} halaman (${persenCapaian.toFixed(1)}%)`,
        marginX + labelW + 4,
        y
      );
      doc.setFont('helvetica', 'normal');
      y += 5.5;

      // Progress bar
      const barW = contentWidth - 10;
      const barH = 5;
      const barY = y;

      // Background
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(marginX + 5, barY, barW, barH, 1, 1, 'F');

      // Fill
      const fillW = (Math.min(100, persenCapaian) / 100) * barW;
      if (persenCapaian >= 100) {
        doc.setFillColor(16, 185, 129); // emerald
      } else if (persenCapaian >= 70) {
        doc.setFillColor(20, 184, 166); // teal
      } else if (persenCapaian >= 40) {
        doc.setFillColor(245, 158, 11); // amber
      } else {
        doc.setFillColor(239, 68, 68); // rose
      }
      doc.roundedRect(marginX + 5, barY, fillW, barH, 1, 1, 'F');

      y += barH + 4;
    }
  }

  // ==========================================================================
  // 6. DAFTAR SETORAN
  // ==========================================================================
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    targetData ? 'D. DAFTAR SETORAN' : 'C. DAFTAR SETORAN',
    marginX,
    y
  );
  y += 6;

  if (setoran.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('(Belum ada setoran pada periode ini)', marginX + 5, y);
    doc.setTextColor(0);
    y += 6;
  } else {
    // Table header
    const colX = [marginX + 3, marginX + 12, marginX + 30, marginX + 110, marginX + 145];
    const colLabels = ['No', 'Tanggal', 'Hafalan', 'Kualitas', 'Nilai'];
    const colWidths = [8, 18, 78, 35, 20];

    doc.setFillColor(241, 245, 249);
    doc.rect(marginX + 2, y - 3, contentWidth - 4, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    colLabels.forEach((lbl, i) => doc.text(lbl, colX[i], y));
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    setoran.forEach((s, idx) => {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
        // Re-draw header
        doc.setFillColor(241, 245, 249);
        doc.rect(marginX + 2, y - 3, contentWidth - 4, 5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        colLabels.forEach((lbl, i) => doc.text(lbl, colX[i], y));
        y += 5;
        doc.setFont('helvetica', 'normal');
      }

      // Range hafalan
      const surahAwal = surahMap.get(s.surah_mulai);
      const surahAkhir = surahMap.get(s.surah_selesai);
      const hafalan =
        s.surah_mulai === s.surah_selesai
          ? `${surahAwal?.nama_latin ?? '?'} : ${s.ayat_mulai}-${s.ayat_selesai}`
          : `${surahAwal?.nama_latin ?? '?'}:${s.ayat_mulai} → ${surahAkhir?.nama_latin ?? '?'}:${s.ayat_selesai}`;

      doc.text(`${idx + 1}`, colX[0], y);
      doc.text(formatTanggalPendekRaport(s.tanggal), colX[1], y);

      const hafalanTrimmed =
        hafalan.length > 45 ? hafalan.slice(0, 42) + '...' : hafalan;
      doc.text(hafalanTrimmed, colX[2], y);

      doc.text(s.kualitas ?? '-', colX[3], y);
      doc.text(s.nilai ? `${s.nilai}` : '-', colX[4], y);

      y += 4.5;

      // Line separator
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.1);
      doc.line(marginX + 2, y - 2, pageWidth - marginX - 2, y - 2);
    });

    doc.setTextColor(0);
    y += 3;
  }

  // ==========================================================================
  // 7. MILESTONE TERCAPAI
  // ==========================================================================
  if (milestones.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const labelMilestone = targetData ? 'E. MILESTONE TERCAPAI' : 'D. MILESTONE TERCAPAI';
    doc.text(labelMilestone, marginX, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    milestones.forEach((m: any, idx) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      const tgl = formatTanggalPendekRaport(m.tanggal_tercapai);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `${idx + 1}. ${m.milestone?.nama ?? '—'}`,
        marginX + 5,
        y
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Tercapai: ${tgl} · +${m.milestone?.poin_prestasi ?? 0} poin`,
        marginX + 10,
        y + 3.5
      );
      doc.setFontSize(9);
      doc.setTextColor(0);
      y += 8;
    });

    // Total poin
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      `Total Poin Prestasi: ${totalPoinMilestone} poin`,
      marginX + 5,
      y
    );
    y += 6;
  }

  // ==========================================================================
  // 8. AYAT BERMASALAH
  // ==========================================================================
  if (ayatBermasalah.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const labelBermasalah = 'F. REKOMENDASI LATIHAN';
    doc.text(labelBermasalah, marginX, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Ayat-ayat berikut paling sering perlu diulang:',
      marginX + 5,
      y
    );
    y += 5;
    doc.setTextColor(0);

    ayatBermasalah.forEach((a, idx) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      const surah = surahMap.get(a.surah_nomor);
      doc.text(
        `${idx + 1}. ${surah?.nama_latin ?? '?'} : ${a.ayat_nomor} — ${a.count}x perlu ulang`,
        marginX + 5,
        y
      );
      y += 5;
    });
    y += 3;
  }

  // ==========================================================================
  // 9. TANDA TANGAN + QR
  // ==========================================================================
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 30;
  }
  y += 10;

  const rightX = pageWidth - marginX - 60;

  // ✅ Deklarasi guruNama DI ATAS sebelum dipakai
  const guruTahfidz = (setoran.find((s: any) => {
    const g = s.guru;
    if (!g) return false;
    if (Array.isArray(g)) return g[0]?.nama_lengkap;
    return g?.nama_lengkap;
  })?.guru as any);
  const guruNama =
    (Array.isArray(guruTahfidz)
      ? guruTahfidz[0]?.nama_lengkap
      : guruTahfidz?.nama_lengkap) ?? '.......................';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  doc.text(`Sukahideng, ${tanggalHariIni()}`, rightX, y);

  y += 5;
  doc.text('Guru Tahfidz,', marginX, y);
  doc.text('Kepala Sekolah,', rightX, y);

  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(guruNama, marginX, y);
  doc.text(pengaturan.nama_kepsek ?? '-', rightX, y);

  // QR Verifikasi (opsional)
  if (data.verificationToken) {
    const qrSize = 25;
    const verifyUrl = buildVerifyUrl('surat', data.verificationToken, null);
    await drawQrVerifikasi(doc, verifyUrl, marginX, y - 30, qrSize, [
      'Scan untuk verifikasi',
      'keaslian raport',
    ]);
  }

  // ==========================================================================
  // 10. FOOTER
  // ==========================================================================
  drawFooter(
    doc,
    pengaturan,
    A4_LAYOUT,
    `Raport Tahfidz ${data.semester} ${data.tahunAjaran} - ${data.siswa.nama_lengkap}.`
  );

  // ==========================================================================
  // SAVE
  // ==========================================================================
  const safeNama = data.siswa.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const fileName = `Raport_Tahfidz_${safeNama}_${data.semester}_${data.tahunAjaran.replace('/', '-')}.pdf`;
  doc.save(fileName);
}