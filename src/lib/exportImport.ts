import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 27);

  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c))),
    startY: 32,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });

  doc.save(`${filename}.pdf`);
}

export async function importFromExcel(
  file: File
): Promise<Record<string, string>[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
  return json;
}
