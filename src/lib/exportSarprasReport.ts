// src/lib/exportSarprasReport.ts
// Generate laporan Excel multi-sheet untuk modul Sarpras.
// Sheet: Ringkasan, Aset, Peminjaman, Pemeliharaan, Penghapusan.

import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

// =============================================================================
// HELPERS
// =============================================================================

function autoWidth(rows: (string | number)[][], min = 10, max = 40): { wch: number }[] {
  if (rows.length === 0) return [];
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let w = min;
    for (const row of rows) {
      const cell = String(row[c] ?? '');
      if (cell.length > w) w = cell.length;
    }
    widths.push(Math.min(w + 2, max));
  }
  return widths.map((wch) => ({ wch }));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// =============================================================================
// SHEET BUILDERS
// =============================================================================

function buildRingkasanSheet(stats: {
  totalAset: number;
  totalUnit: number;
  nilaiTotal: number;
  kondisiBaik: number;
  rusakRingan: number;
  rusakBerat: number;
  peminjamanAktif: number;
  peminjamanTotal: number;
  pemeliharaanAktif: number;
  pemeliharaanTotal: number;
  penghapusanMenunggu: number;
  penghapusanTotal: number;
}): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['LAPORAN INVENTARIS SARANA & PRASARANA'],
    ['SMK KH. A. Wahab Muhsin Sukahideng'],
    [`Dicetak: ${new Date().toLocaleString('id-ID')}`],
    [],
    ['RINGKASAN INVENTARIS'],
    ['Metrik', 'Nilai'],
    ['Total Aset (jenis)', stats.totalAset],
    ['Total Unit (fisik)', stats.totalUnit],
    ['Nilai Total Inventaris', stats.nilaiTotal],
    [],
    ['KONDISI ASET'],
    ['Baik', stats.kondisiBaik],
    ['Rusak Ringan', stats.rusakRingan],
    ['Rusak Berat', stats.rusakBerat],
    [],
    ['AKTIVITAS OPERASIONAL'],
    ['Peminjaman Aktif', stats.peminjamanAktif],
    ['Total Peminjaman (seluruh waktu)', stats.peminjamanTotal],
    ['Pemeliharaan Aktif', stats.pemeliharaanAktif],
    ['Total Pemeliharaan', stats.pemeliharaanTotal],
    ['Penghapusan Menunggu', stats.penghapusanMenunggu],
    ['Total Penghapusan', stats.penghapusanTotal],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoWidth(rows, 20, 50);
  return ws;
}

function buildAsetSheet(data: any[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [
      'No',
      'Kode Aset',
      'Nama Aset',
      'Kategori',
      'Lokasi',
      'Jumlah',
      'Satuan',
      'Kondisi',
      'Status',
      'Merek',
      'Model',
      'Nomor Seri',
      'Tanggal Perolehan',
      'Sumber Dana',
      'Harga Satuan',
      'Total Nilai',
      'PIC',
      'Keterangan',
    ],
  ];
  data.forEach((a, i) => {
    rows.push([
      i + 1,
      a.kode_aset ?? '-',
      a.nama_aset ?? '-',
      a.kategori?.nama ?? '-',
      a.lokasi_detail?.nama ?? a.lokasi ?? '-',
      a.jumlah ?? 0,
      a.satuan ?? '-',
      a.kondisi ?? '-',
      a.status ?? '-',
      a.merek ?? '-',
      a.model ?? '-',
      a.nomor_seri ?? '-',
      a.tanggal_perolehan ?? '-',
      a.sumber_dana ?? '-',
      a.harga_perolehan ?? 0,
      (a.harga_perolehan ?? 0) * (a.jumlah ?? 0),
      a.pic?.nama_lengkap ?? '-',
      a.keterangan ?? '-',
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoWidth(rows, 10, 35);
  return ws;
}

function buildPeminjamanSheet(data: any[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [
      'No',
      'Tanggal Pinjam',
      'Aset',
      'Kode Aset',
      'Jumlah',
      'Peminjam',
      'Keperluan',
      'Rencana Kembali',
      'Tanggal Kembali',
      'Status',
      'Kondisi Pinjam',
      'Kondisi Kembali',
      'Catatan',
    ],
  ];
  data.forEach((p, i) => {
    rows.push([
      i + 1,
      p.tanggal_pinjam ? new Date(p.tanggal_pinjam).toLocaleString('id-ID') : '-',
      p.aset?.nama_aset ?? '-',
      p.aset?.kode_aset ?? '-',
      `${p.jumlah_dipinjam ?? 1} ${p.aset?.satuan ?? ''}`.trim(),
      p.peminjam?.nama_lengkap ?? '-',
      p.keperluan ?? '-',
      p.tanggal_rencana_kembali ?? '-',
      p.tanggal_kembali ?? '-',
      p.status ?? '-',
      p.kondisi_saat_pinjam ?? '-',
      p.kondisi_saat_kembali ?? '-',
      p.catatan ?? '-',
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoWidth(rows, 10, 35);
  return ws;
}

function buildPemeliharaanSheet(data: any[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [
      'No',
      'Tanggal Mulai',
      'Tanggal Selesai',
      'Aset',
      'Kode Aset',
      'Jenis',
      'Judul',
      'Teknisi',
      'Vendor',
      'Kondisi Sebelum',
      'Kondisi Sesudah',
      'Status',
      'Biaya',
      'PIC',
      'Deskripsi',
    ],
  ];
  data.forEach((p, i) => {
    rows.push([
      i + 1,
      p.tanggal_mulai ?? '-',
      p.tanggal_selesai ?? '-',
      p.aset?.nama_aset ?? '-',
      p.aset?.kode_aset ?? '-',
      p.jenis ?? '-',
      p.judul ?? '-',
      p.teknisi ?? '-',
      p.vendor_servis ?? '-',
      p.kondisi_sebelum ?? '-',
      p.kondisi_sesudah ?? '-',
      p.status ?? '-',
      p.biaya ?? 0,
      p.pic?.nama_lengkap ?? '-',
      p.deskripsi ?? '-',
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoWidth(rows, 10, 35);
  return ws;
}

function buildPenghapusanSheet(data: any[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [
      'No',
      'Tanggal Pengajuan',
      'Aset',
      'Kode Aset',
      'Pengaju',
      'Alasan',
      'Rekomendasi',
      'Nilai Buku',
      'Status',
      'Metode',
      'Approver',
      'Tanggal Approval',
      'Catatan Approval',
    ],
  ];
  data.forEach((p, i) => {
    rows.push([
      i + 1,
      p.created_at ? new Date(p.created_at).toLocaleString('id-ID') : '-',
      p.aset?.nama_aset ?? '-',
      p.aset?.kode_aset ?? '-',
      p.pengaju?.nama_lengkap ?? '-',
      p.alasan ?? '-',
      p.rekomendasi ?? '-',
      p.nilai_buku_saat_ajukan ?? 0,
      p.status ?? '-',
      p.metode_penghapusan ?? '-',
      p.approver?.nama_lengkap ?? '-',
      p.approved_at ? new Date(p.approved_at).toLocaleString('id-ID') : '-',
      p.catatan_approval ?? '-',
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoWidth(rows, 10, 35);
  return ws;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export async function exportSarprasReport(): Promise<void> {
  // Fetch semua data paralel
  const [asetRes, peminjamanRes, pemeliharaanRes, penghapusanRes] = await Promise.all([
    supabase
      .from('inventaris_sarpras')
      .select(`
        *,
        kategori:kategori_id (id, nama),
        lokasi_detail:lokasi_id (id, nama, tipe),
        pic:pic_id (id, nama_lengkap)
      `)
      .order('kode_aset'),
    supabase
      .from('inventaris_peminjaman')
      .select(`
        *,
        aset:aset_id (id, kode_aset, nama_aset, satuan),
        peminjam:peminjam_id (id, nama_lengkap)
      `)
      .order('tanggal_pinjam', { ascending: false }),
    supabase
      .from('inventaris_pemeliharaan')
      .select(`
        *,
        aset:aset_id (id, kode_aset, nama_aset),
        pic:pic_id (id, nama_lengkap)
      `)
      .order('tanggal_mulai', { ascending: false }),
    supabase
      .from('inventaris_penghapusan')
      .select(`
        *,
        aset:aset_id (id, kode_aset, nama_aset),
        pengaju:pengaju_id (id, nama_lengkap),
        approver:approver_id (id, nama_lengkap)
      `)
      .order('created_at', { ascending: false }),
  ]);

  if (asetRes.error) throw asetRes.error;
  if (peminjamanRes.error) throw peminjamanRes.error;
  if (pemeliharaanRes.error) throw pemeliharaanRes.error;
  if (penghapusanRes.error) throw penghapusanRes.error;

  const aset = asetRes.data ?? [];
  const peminjaman = peminjamanRes.data ?? [];
  const pemeliharaan = pemeliharaanRes.data ?? [];
  const penghapusan = penghapusanRes.data ?? [];

  // Hitung stats ringkasan
  const stats = {
    totalAset: aset.length,
    totalUnit: aset.reduce((s: number, a: any) => s + (a.jumlah ?? 0), 0),
    nilaiTotal: aset.reduce(
      (s: number, a: any) => s + Number(a.harga_perolehan ?? 0) * (a.jumlah ?? 0),
      0
    ),
    kondisiBaik: aset.filter((a: any) => a.kondisi === 'Baik').length,
    rusakRingan: aset.filter((a: any) => a.kondisi === 'Rusak Ringan').length,
    rusakBerat: aset.filter((a: any) => a.kondisi === 'Rusak Berat').length,
    peminjamanAktif: peminjaman.filter((p: any) => p.status === 'Dipinjam').length,
    peminjamanTotal: peminjaman.length,
    pemeliharaanAktif: pemeliharaan.filter((p: any) =>
      ['Dijadwalkan', 'Berlangsung'].includes(p.status)
    ).length,
    pemeliharaanTotal: pemeliharaan.length,
    penghapusanMenunggu: penghapusan.filter((p: any) => p.status === 'Menunggu').length,
    penghapusanTotal: penghapusan.length,
  };

  // Build workbook
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildRingkasanSheet(stats), 'Ringkasan');
  XLSX.utils.book_append_sheet(wb, buildAsetSheet(aset), 'Aset');
  XLSX.utils.book_append_sheet(wb, buildPeminjamanSheet(peminjaman), 'Peminjaman');
  XLSX.utils.book_append_sheet(wb, buildPemeliharaanSheet(pemeliharaan), 'Pemeliharaan');
  XLSX.utils.book_append_sheet(wb, buildPenghapusanSheet(penghapusan), 'Penghapusan');

  XLSX.writeFile(wb, `Laporan_Sarpras_${todayStr()}.xlsx`);
}