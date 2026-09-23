// src/components/perpustakaan/PrintKartuAnggota.tsx
// Cetak kartu anggota perpustakaan (ukuran KTP 85.6 × 54 mm) dengan QR code.

import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, CreditCard } from 'lucide-react';
import type { PerpusAnggotaWithRelations } from '@/types/database';

type PrintKartuAnggotaProps = {
  open: boolean;
  onClose: () => void;
  anggotaList: PerpusAnggotaWithRelations[];
  namaSekolah?: string;
};

export function PrintKartuAnggota({
  open,
  onClose,
  anggotaList,
  namaSekolah = 'SMK KH. A. Wahab Muhsin Sukahideng',
}: PrintKartuAnggotaProps) {
  if (!open) return null;

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[600] flex flex-col bg-slate-950/95 backdrop-blur-md">
      {/* TOOLBAR */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <CreditCard size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Cetak Kartu Anggota</h3>
            <p className="text-[11px] text-slate-400">
              {anggotaList.length} kartu · ukuran KTP (85.6 × 54 mm)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer">
            <X size={18} />
          </button>
          <button onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer">
            <Printer size={15} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {/* PREVIEW */}
      <div className="flex-1 overflow-auto bg-slate-800 p-4 md:p-6">
        <div id="kartu-print-root"
          className="bg-white mx-auto shadow-2xl"
          style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 85.6mm)',
            gridAutoRows: '54mm',
            gap: '5mm',
            justifyContent: 'center',
          }}>
            {anggotaList.map((a) => (
              <div key={a.id} style={{
                width: '85.6mm',
                height: '54mm',
                borderRadius: '3mm',
                border: '1px solid #cbd5e1',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                position: 'relative',
                boxSizing: 'border-box',
              }}>
                {/* HEADER */}
                <div style={{
                  background: 'linear-gradient(90deg, #155254 0%, #1e7a7d 100%)',
                  color: '#ffffff',
                  padding: '2mm 3mm',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2mm',
                }}>
                  <div style={{
                    width: '7mm', height: '7mm',
                    borderRadius: '50%',
                    background: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '3.5mm', fontWeight: 'bold', color: '#155254',
                  }}>
                    P
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '2.8mm', fontWeight: 700, lineHeight: 1 }}>
                      KARTU PERPUSTAKAAN
                    </div>
                    <div style={{ fontSize: '2mm', marginTop: '0.3mm', opacity: 0.85 }}>
                      {namaSekolah}
                    </div>
                  </div>
                </div>

                {/* BODY */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2mm 3mm',
                  gap: '3mm',
                }}>
                  {/* QR CODE */}
                  <div style={{
                    width: '22mm', height: '22mm',
                    background: '#ffffff',
                    border: '0.3mm solid #e2e8f0',
                    borderRadius: '1.5mm',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1mm',
                    boxSizing: 'border-box',
                  }}>
                    <QRCodeSVG
                      value={a.kode_anggota}
                      size={72}
                      level="M"
                      marginSize={0}
                    />
                  </div>

                  {/* INFO */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '2mm',
                      color: '#64748b',
                      fontWeight: 700,
                      letterSpacing: '0.3px',
                      marginBottom: '0.5mm',
                    }}>
                      {a.tipe.toUpperCase()}
                    </div>
                    <div style={{
                      fontSize: '3.2mm',
                      fontWeight: 800,
                      color: '#0f172a',
                      lineHeight: 1.15,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {a.nama_lengkap}
                    </div>

                    {a.siswa?.kelas?.nama_kelas && (
                      <div style={{
                        fontSize: '2.2mm',
                        color: '#475569',
                        marginTop: '0.8mm',
                        fontWeight: 600,
                      }}>
                        Kelas {a.siswa.kelas.nama_kelas}
                      </div>
                    )}
                    {a.guru?.nip && (
                      <div style={{
                        fontSize: '2.2mm',
                        color: '#475569',
                        marginTop: '0.8mm',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}>
                        NIP. {a.guru.nip}
                      </div>
                    )}

                    <div style={{
                      fontSize: '2mm',
                      color: '#6366f1',
                      marginTop: '1.5mm',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      letterSpacing: '0.5px',
                    }}>
                      {a.kode_anggota}
                    </div>
                  </div>
                </div>

                {/* FOOTER */}
                <div style={{
                  background: '#155254',
                  color: '#ffffff',
                  padding: '1mm 3mm',
                  fontSize: '1.7mm',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: 0.9,
                }}>
                  <span>Kartu ini milik perpustakaan sekolah</span>
                  <span>{namaSekolah.split(' ').slice(0, 3).join(' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRINT STYLE */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * { visibility: hidden !important; }
          #kartu-print-root,
          #kartu-print-root * { visibility: visible !important; }
          #kartu-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 10mm !important;
            width: 210mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
          #kartu-print-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}