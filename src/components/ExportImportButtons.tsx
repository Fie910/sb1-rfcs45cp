import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { exportToExcel, exportToPDF, importFromExcel } from '@/lib/exportImport';
import { showToast } from '@/components/Toast';

type Props = {
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
  onImport?: (data: Record<string, string>[]) => Promise<void>;
  importTemplate?: string[];
  showImport?: boolean;
};

export function ExportImportButtons({
  filename,
  title,
  headers,
  rows,
  onImport,
  showImport = true,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleExportExcel = () => {
    if (rows.length === 0) {
      showToast('error', 'Tidak ada data untuk diekspor');
      return;
    }
    exportToExcel(filename, headers, rows);
    showToast('success', 'Data berhasil diekspor ke Excel');
  };

  const handleExportPDF = () => {
    if (rows.length === 0) {
      showToast('error', 'Tidak ada data untuk diekspor');
      return;
    }
    exportToPDF(filename, title, headers, rows);
    showToast('success', 'Data berhasil diekspor ke PDF');
  };

  const handleImportClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const data = await importFromExcel(file);
      if (onImport) {
        await onImport(data);
      }
      showToast('success', `${data.length} baris berhasil diimpor`);
    } catch (err) {
      showToast('error', 'Gagal mengimpor: ' + (err as Error).message);
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showImport && onImport && (
        <>
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Impor Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </>
      )}
      <button
        onClick={handleExportExcel}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
      >
        <FileSpreadsheet size={15} />
        Ekspor Excel
      </button>
      <button
        onClick={handleExportPDF}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
      >
        <FileText size={15} />
        Ekspor PDF
      </button>
    </div>
  );
}
