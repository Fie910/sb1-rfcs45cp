// src/components/PrintDisposisi.tsx
import React from 'react';
import { useSchoolBranding } from '@/hooks/useSchoolBranding';
import { SEKOLAH_TAGLINE } from '@/constants/branding';

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
  penerima_disposisi: string;
  isi_disposisi: string;
  catatan?: string | null;
  status: string;
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
  const { logo_url } = useSchoolBranding();

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
    <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto p-4 flex justify-center items-start backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 my-8 print:my-0 print:shadow-none print:w-full print:p-0">
        {/* Tombol Aksi */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 mb-6 print:hidden">
          <h2 className="text-lg font-bold text-gray-800">Pratinjau Cetak Lembar Disposisi</h2>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 font-medium">
              Tutup
            </button>
            <button onClick={handlePrint} className="px-4 py-2 bg-[#0F2952] text-white rounded-md hover:bg-blue-900 font-medium shadow-lg">
              🖨️ Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {/* --- AREA LEMBAR DISPOSISI --- */}
        <div className="relative p-8 border border-gray-300 font-serif text-gray-900 print:p-4 print:border-none overflow-hidden">
          
          {/* ✅ WATERMARK MENGGUNAKAN TAG IMG (LEBIH KUAT SAAT PRINT) */}
          {logo_url && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.1] print:opacity-[0.15]">
              <img 
                src={logo_url} 
                alt="Watermark" 
                className="w-[60%] max-w-[400px] object-contain grayscale-[20%]" 
              />
            </div>
          )}

          <div className="relative z-10">
            {/* Kop Surat */}
            <div className="text-center border-b-4 border-double border-[#0F2952] pb-4 mb-4">
              <h3 className="text-xl font-bold uppercase tracking-wide text-[#0F2952]">{namaSekolah}</h3>
              <p className="text-sm font-sans text-gray-600">LEMBAR DISPOSISI SURAT MASUK</p>
            </div>

            {/* Table Ringkasan Surat (Latar dibersihkan agar transparan) */}
            <table className="w-full text-sm border-collapse border border-[#0F2952] mb-4 relative z-10">
              <tbody>
                <tr className="border-b border-[#0F2952]">
                  <td className="p-2 font-bold w-1/4 border-r border-[#0F2952] text-[#0F2952]">Surat Dari</td>
                  <td className="p-2 w-1/4 border-r border-[#0F2952]">{surat.asal_surat}</td>
                  <td className="p-2 font-bold w-1/4 border-r border-[#0F2952] text-[#0F2952]">No. Surat</td>
                  <td className="p-2 w-1/4">{surat.no_surat}</td>
                </tr>
                <tr className="border-b border-[#0F2952]">
                  <td className="p-2 font-bold border-r border-[#0F2952] text-[#0F2952]">Tgl. Surat</td>
                  <td className="p-2 border-r border-[#0F2952]">{surat.tanggal_surat}</td>
                  <td className="p-2 font-bold border-r border-[#0F2952] text-[#0F2952]">Sifat Surat</td>
                  <td className="p-2 font-bold">{surat.sifat}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-[#0F2952] text-[#0F2952]">Perihal</td>
                  <td colSpan={3} className="p-2">{surat.perihal}</td>
                </tr>
              </tbody>
            </table>

            {/* Isi Instruksi Disposisi */}
            <table className="w-full text-sm border-collapse border border-[#0F2952] mb-8 relative z-10">
              <thead>
                <tr className="bg-[#0F2952] text-white text-left print:bg-[#0F2952] print:text-white">
                  <th className="p-2 border-r border-[#0F2952] w-1/2">Diteruskan Kepada (Disposisi)</th>
                  <th className="p-2">Petunjuk / Instruksi Kepala Sekolah</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border-r border-[#0F2952] align-top font-semibold">
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
                <p className="text-sm">Sukahideng, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="text-sm mt-1">Kepala Sekolah,</p>
                <div className="h-20"></div>
                <p className="font-bold border-b border-gray-400 inline-block px-4 text-[#0F2952]">________________________</p>
                <p className="text-xs text-gray-600 mt-1">NIP. ........................................</p>
              </div>
            </div>

            {/* Footer Tagline */}
            <div className="mt-12 pt-2 border-t border-gray-300 text-center">
              <p className="text-[10px] italic text-[#0F2952] font-serif">
                — {SEKOLAH_TAGLINE} —
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Style Print */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .print\\:border-none, .print\\:border-none * { visibility: visible; }
          div.fixed {
            position: absolute;
            left: 0;
            top: 0;
            background: white !important;
            padding: 0 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};