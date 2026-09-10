// src/components/PrintDisposisi.tsx
import React from 'react';

interface SuratData {
  no_surat: string;
  asal_surat: string;
  tanggal_surat: string;
  perihal: string;
  sifat: 'Biasa' | 'Penting' | 'Rahasia' | 'Sangat Segera';
}

interface DisposisiData {
  id: string;
  tanggal_disposisi: string;
  penerima_disposisi: string; // Disesuaikan dengan kolom database
  isi_disposisi: string;
  catatan?: string;
  status: string;
  // Fallback opsional jika data surat tergabung dalam objek disposisi
  surat?: SuratData; 
}

interface PrintDisposisiProps {
  surat?: SuratData;
  disposisi: DisposisiData;
  namaSekolah?: string;
  onClose: () => void;
}

export const PrintDisposisi: React.FC<PrintDisposisiProps> = ({
  surat: propSurat,
  disposisi,
  namaSekolah = "SMK KH. A. WAHAB MUHSIN",
  onClose
}) => {
  // Mengambil data surat dari prop terpisah atau dari relasi objek disposisi
  const surat = propSurat || disposisi.surat || {
    no_surat: '-',
    asal_surat: '-',
    tanggal_surat: '-',
    perihal: disposisi.catatan || '-',
    sifat: 'Biasa'
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4 flex justify-center items-start">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 my-8 print:my-0 print:shadow-none print:w-full print:p-0">
        {/* Tombol Aksi (Tidak Ikut Tercetak) */}
        <div className="flex justify-between items-center pb-4 border-b mb-6 print:hidden">
          <h2 className="text-lg font-bold text-gray-800">Pratinjau Cetak Lembar Disposisi</h2>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              🖨️ Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {/* --- AREA LEMBAR DISPOSISI YANG DICETAK --- */}
        <div className="p-8 border border-gray-300 font-serif text-black print:p-4 print:border-none">
          {/* Kop Surat */}
          <div className="text-center border-b-4 border-double border-black pb-4 mb-4">
            <h3 className="text-xl font-bold uppercase tracking-wide">{namaSekolah}</h3>
            <p className="text-sm font-sans text-gray-700">LEMBAR DISPOSISI SURAT MASUK</p>
          </div>

          {/* Table Ringkasan Surat */}
          <table className="w-full text-sm border-collapse border border-black mb-4">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-2 font-bold w-1/4 border-r border-black bg-gray-50 print:bg-transparent">Surat Dari</td>
                <td className="p-2 w-1/4 border-r border-black">{surat.asal_surat}</td>
                <td className="p-2 font-bold w-1/4 border-r border-black bg-gray-50 print:bg-transparent">No. Surat</td>
                <td className="p-2 w-1/4">{surat.no_surat}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2 font-bold border-r border-black bg-gray-50 print:bg-transparent">Tgl. Surat</td>
                <td className="p-2 border-r border-black">{surat.tanggal_surat}</td>
                <td className="p-2 font-bold border-r border-black bg-gray-50 print:bg-transparent">Sifat Surat</td>
                <td className="p-2 font-bold">{surat.sifat}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold border-r border-black bg-gray-50 print:bg-transparent">Perihal</td>
                <td colSpan={3} className="p-2">{surat.perihal}</td>
              </tr>
            </tbody>
          </table>

{/* Isi Instruksi Disposisi */}
<table className="w-full text-sm border-collapse border border-black mb-6">
  <thead>
    <tr className="bg-gray-100 border-b border-black text-left print:bg-transparent">
      <th className="p-2 border-r border-black w-1/2">Diteruskan Kepada (Disposisi)</th>
      <th className="p-2">Petunjuk / Instruksi Kepala Sekolah</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="p-3 border-r border-black align-top font-semibold">
        📌 {disposisi.penerima_disposisi}
        <div className="text-xs font-normal text-gray-500 mt-1">
          Tgl Disposisi: {disposisi.tanggal_disposisi}
        </div>
      </td>
      <td className="p-3 align-top min-h-[120px]">
        <p className="whitespace-pre-line">{disposisi.isi_disposisi}</p>
      </td>
    </tr>
  </tbody>
</table>

          {/* Kolom Tanda Tangan */}
          <div className="flex justify-end mt-8 pt-4">
            <div className="text-center w-60">
              <p className="text-sm">Kepala Sekolah,</p>
              <div className="h-20"></div> {/* Space TTD */}
              <p className="font-bold border-b border-black inline-block px-4">________________________</p>
              <p className="text-xs text-gray-600 mt-1">NIP. ........................................</p>
            </div>
          </div>
        </div>
      </div>

      {/* Style CSS Khusus Print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          /* Hanya tampilkan area cetak */
          .print\\:border-none, .print\\:border-none * {
            visibility: visible;
          }
          div.fixed {
            position: absolute;
            left: 0;
            top: 0;
            background: white !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};