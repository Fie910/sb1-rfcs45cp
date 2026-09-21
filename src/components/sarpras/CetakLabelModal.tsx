// src/components/sarpras/CetakLabelModal.tsx
// Modal preview & cetak label aset dengan QR code.
// Mendukung 3 ukuran preset, print via browser dialog.

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, QrCode } from 'lucide-react';
import type { InventarisSarprasWithRelations } from '@/types/database';

// =============================================================================
// PRESET UKURAN
// =============================================================================

type UkuranLabel = 'kecil' | 'sedang' | 'besar';

type Preset = {
  label: string;
  cols: number;
  qrSize: number;
  cellHeight: string;
  fontTitle: string;
  fontCode: string;
  fontKategori: string;
};

const LABEL_PRESETS: Record<UkuranLabel, Preset> = {
  kecil: {
    label: 'Kecil — 24 label/halaman',
    cols: 4,
    qrSize: 52,
    cellHeight: '62mm',
    fontTitle: '7pt',
    fontCode: '6pt',
    fontKategori: '5.5pt',
  },
  sedang: {
    label: 'Sedang — 12 label/halaman',
    cols: 3,
    qrSize: 75,
    cellHeight: '68mm',
    fontTitle: '9pt',
    fontCode: '8pt',
    fontKategori: '7pt',
  },
  besar: {
    label: 'Besar — 6 label/halaman',
    cols: 2,
    qrSize: 100,
    cellHeight: '70mm',
    fontTitle: '11pt',
    fontCode: '10pt',
    fontKategori: '8.5pt',
  },
};

// =============================================================================
// PROPS
// =============================================================================

type CetakLabelModalProps = {
  open: boolean;
  onClose: () => void;
  asetList: InventarisSarprasWithRelations[];
};

// =============================================================================
// KOMPONEN
// =============================================================================

export function CetakLabelModal({ open, onClose, asetList }: CetakLabelModalProps) {
  const [ukuran, setUkuran] = useState<UkuranLabel>('sedang');
  const [showQR, setShowQR] = useState(true);
  const [showKategori, setShowKategori] = useState(true);

  if (!open) return null;

  const preset = LABEL_PRESETS[ukuran];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[600] flex flex-col bg-slate-950/95 backdrop-blur-md">
      {/* ===================== TOOLBAR (no-print) ===================== */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <QrCode size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Cetak Label Aset</h3>
            <p className="text-[11px] text-slate-400">
              {asetList.length} label akan dicetak · {preset.label}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Pilih ukuran */}
          <select
            value={ukuran}
            onChange={(e) => setUkuran(e.target.value as UkuranLabel)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-indigo-500"
          >
            {(Object.keys(LABEL_PRESETS) as UkuranLabel[]).map((key) => (
              <option key={key} value={key}>
                {LABEL_PRESETS[key].label}
              </option>
            ))}
          </select>

          {/* Toggle QR */}
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs cursor-pointer hover:border-indigo-500/40 transition-colors">
            <input
              type="checkbox"
              checked={showQR}
              onChange={(e) => setShowQR(e.target.checked)}
              className="accent-indigo-500 cursor-pointer"
            />
            QR
          </label>

          {/* Toggle Kategori */}
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs cursor-pointer hover:border-indigo-500/40 transition-colors">
            <input
              type="checkbox"
              checked={showKategori}
              onChange={(e) => setShowKategori(e.target.checked)}
              className="accent-indigo-500 cursor-pointer"
            />
            Kategori
          </label>

          <div className="w-px h-6 bg-slate-700 mx-1" />

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X size={18} />
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            <Printer size={15} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {/* ===================== PREVIEW + PRINT AREA ===================== */}
      <div className="flex-1 overflow-auto bg-slate-800 p-4 md:p-6">
        <div
          id="label-print-root"
          className="bg-white mx-auto shadow-2xl"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '5mm',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${preset.cols}, 1fr)`,
              gap: '2mm',
            }}
          >
            {asetList.map((a) => (
              <div
                key={a.id}
                style={{
                  border: '1px dashed #cbd5e1',
                  borderRadius: '2mm',
                  padding: '2.5mm',
                  height: preset.cellHeight,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.5mm',
                  color: '#0f172a',
                  background: '#ffffff',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              >
                {showQR && (
                  <QRCodeSVG
                    value={`${window.location.origin}/scan/${a.qr_token}`}
                    size={preset.qrSize}
                    level="M"
                    marginSize={0}
                  />
                )}

                <div
                  style={{
                    textAlign: 'center',
                    width: '100%',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      fontSize: preset.fontTitle,
                      fontWeight: 'bold',
                      lineHeight: 1.15,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      color: '#0f172a',
                    }}
                  >
                    {a.nama_aset}
                  </div>

                  <div
                    style={{
                      fontSize: preset.fontCode,
                      fontFamily: 'ui-monospace, "Courier New", monospace',
                      color: '#4338ca',
                      marginTop: '0.8mm',
                      fontWeight: 600,
                      letterSpacing: '0.3px',
                    }}
                  >
                    {a.kode_aset}
                  </div>

                  {showKategori && a.kategori && (
                    <div
                      style={{
                        fontSize: preset.fontKategori,
                        color: '#64748b',
                        marginTop: '0.5mm',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.kategori.nama}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===================== PRINT CSS ===================== */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }

          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Sembunyikan seluruh body */
          body * {
            visibility: hidden !important;
          }

          /* Tampilkan hanya area label */
          #label-print-root,
          #label-print-root * {
            visibility: visible !important;
          }

          #label-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 5mm !important;
            box-shadow: none !important;
            background: #ffffff !important;
            width: 200mm !important;
            min-height: 287mm !important;
            box-sizing: border-box !important;
          }

          /* Sembunyikan toolbar & overlay */
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          /* Pastikan warna terbawa saat print */
          #label-print-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}