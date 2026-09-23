// src/components/perpustakaan/CetakLabelBukuModal.tsx
// Modal cetak label QR buku (A4 grid, 3 ukuran preset).

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, QrCode } from 'lucide-react';
import type { PerpusBukuWithRelations } from '@/types/database';

// =============================================================================
// PRESET
// =============================================================================
type UkuranLabel = 'kecil' | 'sedang' | 'besar';

type Preset = {
  label: string;
  cols: number;
  qrSize: number;
  cellHeight: string;
  fontTitle: string;
  fontCode: string;
  fontAuthor: string;
};

const LABEL_PRESETS: Record<UkuranLabel, Preset> = {
  kecil: {
    label: 'Kecil — 24 label/halaman',
    cols: 4,
    qrSize: 50,
    cellHeight: '62mm',
    fontTitle: '7pt',
    fontCode: '6pt',
    fontAuthor: '5.5pt',
  },
  sedang: {
    label: 'Sedang — 12 label/halaman',
    cols: 3,
    qrSize: 72,
    cellHeight: '68mm',
    fontTitle: '9pt',
    fontCode: '8pt',
    fontAuthor: '7pt',
  },
  besar: {
    label: 'Besar — 6 label/halaman',
    cols: 2,
    qrSize: 96,
    cellHeight: '70mm',
    fontTitle: '11pt',
    fontCode: '10pt',
    fontAuthor: '8.5pt',
  },
};

type Props = {
  open: boolean;
  onClose: () => void;
  bukuList: PerpusBukuWithRelations[];
  namaSekolah?: string;
};

export function CetakLabelBukuModal({
  open,
  onClose,
  bukuList,
  namaSekolah = 'SMK KH. A. Wahab Muhsin Sukahideng',
}: Props) {
  const [ukuran, setUkuran] = useState<UkuranLabel>('sedang');
  const [showAuthor, setShowAuthor] = useState(true);

  if (!open) return null;

  const preset = LABEL_PRESETS[ukuran];
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[600] flex flex-col bg-slate-950/95 backdrop-blur-md">
      {/* TOOLBAR */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <QrCode size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Cetak Label QR Buku</h3>
            <p className="text-[11px] text-slate-400">
              {bukuList.length} label · {preset.label}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ukuran}
            onChange={(e) => setUkuran(e.target.value as UkuranLabel)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-indigo-500"
          >
            {(Object.keys(LABEL_PRESETS) as UkuranLabel[]).map((k) => (
              <option key={k} value={k}>
                {LABEL_PRESETS[k].label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs cursor-pointer hover:border-indigo-500/40 transition">
            <input
              type="checkbox"
              checked={showAuthor}
              onChange={(e) => setShowAuthor(e.target.checked)}
              className="accent-indigo-500 cursor-pointer"
            />
            Pengarang
          </label>

          <div className="w-px h-6 bg-slate-700 mx-1" />

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <Printer size={15} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {/* PREVIEW */}
      <div className="flex-1 overflow-auto bg-slate-800 p-4 md:p-6">
        <div
          id="label-buku-print-root"
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
            {bukuList.map((b) => (
              <div
                key={b.id}
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
                <QRCodeSVG
                  value={b.qr_token ?? b.kode_buku ?? b.id}
                  size={preset.qrSize}
                  level="M"
                  marginSize={0}
                />

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
                    {b.judul}
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
                    {b.kode_buku ?? '-'}
                  </div>

                  {showAuthor && b.pengarang && (
                    <div
                      style={{
                        fontSize: preset.fontAuthor,
                        color: '#64748b',
                        marginTop: '0.5mm',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {b.pengarang}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: '5pt',
                      color: '#94a3b8',
                      marginTop: '0.5mm',
                      letterSpacing: '0.2px',
                    }}
                  >
                    {namaSekolah}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRINT CSS */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 5mm; }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * { visibility: hidden !important; }
          #label-buku-print-root,
          #label-buku-print-root * { visibility: visible !important; }
          #label-buku-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 5mm !important;
            width: 200mm !important;
            min-height: 287mm !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
          #label-buku-print-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}