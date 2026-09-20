// src/lib/depreciation.ts
// Kalkulasi penyusutan aset dengan metode garis lurus (straight-line).
//
// Rumus:
//   Penyusutan per bulan = (Harga Perolehan - Nilai Residu) / Umur Ekonomis (bulan)
//   Nilai Buku = Harga Perolehan - (Penyusutan per bulan × bulan berjalan)

export type DepresiasiResult = {
  /** Total penyusutan per bulan (Rp) */
  penyusutanPerBulan: number;
  /** Akumulasi penyusutan sejak perolehan (Rp) */
  akumulasiPenyusutan: number;
  /** Nilai buku saat ini (Rp) */
  nilaiBuku: number;
  /** Umur pakai dalam bulan (yang sudah berjalan) */
  bulanBerjalan: number;
  /** Persentase penyusutan dari harga perolehan (%) */
  persenSusut: number;
  /** Apakah aset sudah fully depreciated */
  fullyDepreciated: boolean;
};

/**
 * Hitung penyusutan aset dengan metode garis lurus.
 *
 * @param hargaPerolehan - Harga beli aset (Rp)
 * @param tanggalPerolehan - Tanggal perolehan (YYYY-MM-DD)
 * @param umurEkonomisBulan - Umur ekonomis dalam bulan (mis. 60 = 5 tahun)
 * @param nilaiResidu - Nilai residu / sisa (Rp). Default 0.
 */
export function hitungPenyusutan(
  hargaPerolehan: number | null,
  tanggalPerolehan: string | null,
  umurEkonomisBulan: number | null,
  nilaiResidu: number | null = 0
): DepresiasiResult | null {
  // Kalau data tidak lengkap, return null
  if (
    !hargaPerolehan ||
    hargaPerolehan <= 0 ||
    !tanggalPerolehan ||
    !umurEkonomisBulan ||
    umurEkonomisBulan <= 0
  ) {
    return null;
  }

  const residu = nilaiResidu ?? 0;
  const nilaiDisusutkan = Math.max(0, hargaPerolehan - residu);
  const penyusutanPerBulan = nilaiDisusutkan / umurEkonomisBulan;

  // Hitung bulan berjalan sejak tanggal perolehan
  const tglPerolehan = new Date(`${tanggalPerolehan}T00:00:00+07:00`);
  const sekarang = new Date();
  const bulanBerjalan = Math.max(
    0,
    (sekarang.getFullYear() - tglPerolehan.getFullYear()) * 12 +
      (sekarang.getMonth() - tglPerolehan.getMonth())
  );

  const bulanEfektif = Math.min(bulanBerjalan, umurEkonomisBulan);
  const akumulasiPenyusutan = Math.min(
    penyusutanPerBulan * bulanEfektif,
    nilaiDisusutkan
  );
  const nilaiBuku = hargaPerolehan - akumulasiPenyusutan;
  const persenSusut = (akumulasiPenyusutan / hargaPerolehan) * 100;

  return {
    penyusutanPerBulan,
    akumulasiPenyusutan,
    nilaiBuku,
    bulanBerjalan,
    persenSusut,
    fullyDepreciated: bulanBerjalan >= umurEkonomisBulan,
  };
}

/** Format bulan ke "X tahun Y bulan" */
export function formatUmurBulan(bulan: number | null): string {
  if (!bulan || bulan <= 0) return '-';
  const tahun = Math.floor(bulan / 12);
  const sisaBulan = bulan % 12;
  if (tahun === 0) return `${sisaBulan} bulan`;
  if (sisaBulan === 0) return `${tahun} tahun`;
  return `${tahun} thn ${sisaBulan} bln`;
}