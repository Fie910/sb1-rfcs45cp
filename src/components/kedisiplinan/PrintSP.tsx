// src/components/kedisiplinan/PrintSP.tsx
// Komponen cetak Surat Peringatan (SP1/SP2/SP3) format formal A4.

import React from 'react';

// =============================================================================
// TYPES
// =============================================================================

type SuratPeringatanData = {
  nomor_sp: string;
  level: 'SP1' | 'SP2' | 'SP3';
  tanggal_terbit: string;
  batas_waktu: string | null;
  alasan: string;
  total_poin_pelanggaran: number;
  total_poin_prestasi: number;
  catatan: string | null;
};

type SiswaData = {
  nisn: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  kelas: string;
};

type PenandatanganData = {
  nama: string;
  nip?: string | null;
  jabatan?: string;
};

type PrintSPProps = {
  sp: SuratPeringatanData;
  siswa: SiswaData;
  penandatangan: PenandatanganData;
  namaSekolah?: string;
  alamatSekolah?: string;
  onClose: () => void;
};

// =============================================================================
// HELPER
// =============================================================================

function formatTanggalIndo(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getLevelLabel(level: 'SP1' | 'SP2' | 'SP3'): string {
  switch (level) {
    case 'SP1': return 'SURAT PERINGATAN PERTAMA';
    case 'SP2': return 'SURAT PERINGATAN KEDUA';
    case 'SP3': return 'SURAT PERINGATAN KETIGA';
  }
}

function getLevelNumeric(level: 'SP1' | 'SP2' | 'SP3'): string {
  switch (level) {
    case 'SP1': return 'Pertama';
    case 'SP2': return 'Kedua';
    case 'SP3': return 'Ketiga';
  }
}

// =============================================================================
// KOMPONEN
// =============================================================================

export const PrintSP: React.FC<PrintSPProps> = ({
  sp,
  siswa,
  penandatangan,
  namaSekolah = 'SMK KH. A. WAHAB MUHSIN SUKAHIDENG',
  alamatSekolah = 'Jl. Raya Sukahideng, Kec. Sukahideng, Kab. Tasikmalaya, Jawa Barat',
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const poinBersih = sp.total_poin_pelanggaran - sp.total_poin_prestasi;
  const salam = siswa.jenis_kelamin === 'L' ? 'Siswa' : 'Siswi';

  return (
    <div className="fixed inset-0 bg-black/60 z-[600] overflow-y-auto p-4 flex justify-start items-start">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-[210mm] mx-auto my-8 print:my-0 print:shadow-none print:rounded-none print:max-w-none print:w-full">
        {/* TOOLBAR */}
        <div className="no-print flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Pratinjau Surat Peringatan {sp.level}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Akan dicetak pada ukuran A4. Pastikan pengaturan cetak: A4, Portrait, tanpa margin.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition cursor-pointer"
            >
              🖨️ Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {/* ============ AREA CETAK ============ */}
        <div
          id="sp-print-root"
          className="p-12 bg-white text-black"
          style={{
            fontFamily: 'Times New Roman, Times, serif',
            fontSize: '12pt',
            lineHeight: 1.5,
          }}
        >
          {/* KOP SURAT */}
          <div className="border-b-4 border-double border-black pb-3 mb-6">
            <div className="flex items-center gap-4">
              {/* Placeholder Logo */}
              <div className="w-20 h-20 rounded-full border-2 border-black flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-center leading-tight px-1">
                  LOGO<br />SEKOLAH
                </span>
              </div>

              <div className="flex-1 text-center">
                <p className="text-[10pt] tracking-wider uppercase">
                  Yayasan Pendidikan Islam
                </p>
                <h1
                  className="text-[16pt] font-bold uppercase tracking-wide leading-tight"
                  style={{ fontFamily: 'Times New Roman, serif' }}
                >
                  {namaSekolah}
                </h1>
                <p className="text-[9pt] italic mt-0.5">{alamatSekolah}</p>
                <p className="text-[9pt]">
                  Telp. (0265) XXXXXX · Email: info@smk-sukahideng.sch.id
                </p>
              </div>

              {/* Spacer agar simetris */}
              <div className="w-20 h-20 shrink-0" />
            </div>
          </div>

          {/* JUDUL */}
          <div className="text-center mb-6">
            <h2
              className="text-[14pt] font-bold uppercase underline tracking-wider"
              style={{ textDecorationThickness: '1.5px', textUnderlineOffset: '4px' }}
            >
              {getLevelLabel(sp.level)}
            </h2>
            <p className="text-[11pt] mt-1">
              Nomor: <span className="font-semibold">{sp.nomor_sp}</span>
            </p>
          </div>

          {/* PEMBUKA */}
          <div className="mb-4 text-justify">
            <p>
              Berdasarkan hasil pemantauan, evaluasi, dan pembinaan terhadap{' '}
              {salam} yang bersangkutan, dengan ini Kepala {namaSekolah}{' '}
              menyampaikan <strong>Surat Peringatan {getLevelNumeric(sp.level)}</strong>{' '}
              kepada:
            </p>
          </div>

          {/* DATA SISWA */}
          <table className="ml-8 mb-4" style={{ borderSpacing: '0 4px' }}>
            <tbody>
              <tr>
                <td className="align-top pr-4 whitespace-nowrap">Nama</td>
                <td className="align-top pr-2">:</td>
                <td className="align-top font-bold">{siswa.nama_lengkap}</td>
              </tr>
              <tr>
                <td className="align-top pr-4 whitespace-nowrap">NISN</td>
                <td className="align-top pr-2">:</td>
                <td className="align-top">{siswa.nisn}</td>
              </tr>
              <tr>
                <td className="align-top pr-4 whitespace-nowrap">Kelas</td>
                <td className="align-top pr-2">:</td>
                <td className="align-top">{siswa.kelas}</td>
              </tr>
            </tbody>
          </table>

          {/* ALASAN / PELANGGARAN */}
          <div className="mb-4 text-justify">
            <p>
              Surat peringatan ini diberikan karena yang bersangkutan telah
              melakukan pelanggaran terhadap tata tertib sekolah dengan alasan
              sebagai berikut:
            </p>
          </div>

          <div className="ml-8 mb-4 p-4 border-l-4 border-black bg-gray-50 print:bg-transparent">
            <p className="italic">"{sp.alasan}"</p>
          </div>

          {/* REKAP POIN */}
          <div className="mb-4">
            <p className="mb-2">Adapun rekapitulasi poin yang bersangkutan:</p>
            <table className="ml-8" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td className="pr-4 py-1">Total Poin Pelanggaran</td>
                  <td className="pr-2 py-1">:</td>
                  <td className="py-1 font-bold text-right" style={{ minWidth: '80px' }}>
                    {sp.total_poin_pelanggaran} poin
                  </td>
                </tr>
                <tr>
                  <td className="pr-4 py-1">Total Poin Prestasi</td>
                  <td className="pr-2 py-1">:</td>
                  <td className="py-1 font-bold text-right">
                    {sp.total_poin_prestasi} poin
                  </td>
                </tr>
                <tr className="border-t border-black">
                  <td className="pr-4 py-1 font-bold">Poin Bersih</td>
                  <td className="pr-2 py-1 font-bold">:</td>
                  <td className="py-1 font-bold text-right">{poinBersih} poin</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PERINTAH / KONSEKUENSI */}
          <div className="mb-4 text-justify">
            <p>
              Sehubungan dengan hal tersebut, kami mengharapkan:
            </p>
            <ol className="ml-8 mt-2" style={{ listStyleType: 'decimal' }}>
              <li className="mb-1.5">
                {salam} yang bersangkutan dapat memperbaiki perilaku dan tidak
                mengulangi pelanggaran yang sama maupun pelanggaran lainnya.
              </li>
              <li className="mb-1.5">
                Orang tua/wali {salam} dapat hadir di sekolah untuk berkoordinasi
                dengan pihak Bimbingan Konseling atau Kesiswaan
                {sp.batas_waktu ? (
                  <> sebelum tanggal <strong>{formatTanggalIndo(sp.batas_waktu)}</strong></>
                ) : null}.
              </li>
              <li className="mb-1.5">
                Apabila pelanggaran serupa terulang kembali, akan diterbitkan
                Surat Peringatan yang lebih tinggi tingkatannya.
              </li>
            </ol>
          </div>

          {sp.catatan && (
            <div className="mb-4 text-justify">
              <p className="font-bold mb-1">Catatan Tambahan:</p>
              <p className="italic pl-4">{sp.catatan}</p>
            </div>
          )}

          {/* PENUTUP */}
          <div className="mb-8 text-justify">
            <p>
              Demikian surat peringatan ini disampaikan. Atas perhatian dan kerja
              sama Bapak/Ibu orang tua/wali, kami sampaikan terima kasih.
            </p>
          </div>

          {/* TANDA TANGAN */}
          <div className="flex justify-between mt-12">
            {/* KIRI: Orang Tua/Wali */}
            <div className="text-center" style={{ width: '38%' }}>
              <p className="text-[11pt]">Mengetahui,</p>
              <p className="text-[11pt]">Orang Tua / Wali Siswa</p>
              <div style={{ height: '70px' }} />
              <p
                className="font-bold"
                style={{
                  borderTop: '1px solid #000',
                  paddingTop: '2px',
                  display: 'inline-block',
                  minWidth: '160px',
                }}
              >
                (..................................)
              </p>
            </div>

            {/* KANAN: Kepala Sekolah / Penandatangan */}
            <div className="text-center" style={{ width: '38%' }}>
              <p className="text-[11pt]">
                Sukahideng, {formatTanggalIndo(sp.tanggal_terbit)}
              </p>
              <p className="text-[11pt]">
                {penandatangan.jabatan || 'Kepala Sekolah'}
              </p>
              <div style={{ height: '70px' }} />
              <p
                className="font-bold"
                style={{
                  borderTop: '1px solid #000',
                  paddingTop: '2px',
                  display: 'inline-block',
                  minWidth: '160px',
                }}
              >
                {penandatangan.nama}
              </p>
              {penandatangan.nip && (
                <p className="text-[10pt] mt-0.5">NIP. {penandatangan.nip}</p>
              )}
            </div>
          </div>

          {/* TEMBUSAN */}
          <div className="mt-10 pt-3 border-t border-gray-400">
            <p className="text-[9pt] font-bold mb-1">Tembusan:</p>
            <ol className="text-[9pt] ml-4" style={{ listStyleType: 'decimal' }}>
              <li>Arsip Sekolah</li>
              <li>Wali Kelas yang bersangkutan</li>
              <li>Guru BK / Kesiswaan</li>
            </ol>
          </div>
        </div>
      </div>

      {/* PRINT STYLE */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body * {
            visibility: hidden !important;
          }

          #sp-print-root,
          #sp-print-root * {
            visibility: visible !important;
          }

          #sp-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 20mm 15mm 15mm 20mm !important;
            width: 210mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
          }

          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          #sp-print-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};