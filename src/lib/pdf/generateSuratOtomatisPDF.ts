// src/lib/pdf/generateSuratOtomatisPDF.ts
import jsPDF from 'jspdf';
import { 
  A4_LAYOUT, drawKopSurat, drawFooter, fetchPengaturan, 
  PDF_THEME, drawWatermark, formatTanggalPanjang,
  buildVerifyUrl, drawQrVerifikasi, type PdfAction
} from './pdfShared';

export type TemplateType = 
  | 'UNDANGAN' | 'PERMOHONAN' | 'PEMBERITAHUAN' 
  | 'PENGANTAR' | 'BISNIS' | 'KETERANGAN' 
  | 'PERNYATAAN' | 'TUGAS' | 'SK';

export type SuratOtomatisData = {
  nomor_surat: string;
  tanggal_surat: string;
  perihal: string;
  verification_token: string;
  template_type: TemplateType;
  data: {
    // Universal
    tujuan?: string; // Yth. ...
    lampiran?: string;
    isi_surat?: string;
    isi_penutup?: string;
    catatan?: string;

    // Keterangan / Pernyataan
    pihak_nama?: string;
    pihak_identitas?: string; 

    // Tugas
    pemberi_nama?: string;
    pemberi_jabatan?: string;
    penerima_nama?: string;
    penerima_jabatan?: string;
    tugas_sebagai?: string;
    hari_tanggal?: string;
    waktu?: string;
    tempat?: string;

    // SK
    sk_tentang?: string;
    sk_menimbang?: string;
    sk_mengingat?: string;
    sk_memperhatikan?: string;
    sk_memutuskan?: string;
  };
};

export async function generateSuratOtomatisPDF(
  surat: SuratOtomatisData, 
  action: PdfAction | 'blob' = 'save'
): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { pageWidth, pageHeight, marginX, contentWidth } = A4_LAYOUT;
  const pengaturan = await fetchPengaturan(true);
  const d = surat.data;

  let y = await drawKopSurat(doc, pengaturan);
  y += 10;

  // ==========================================
  // HEADER: Gaya Blok vs Gaya Center
  // ==========================================
  const isCenterStyle = ['KETERANGAN', 'PERNYATAAN'].includes(surat.template_type);
  const isSK = surat.template_type === 'SK';

  let judul = '';
  if (surat.template_type === 'UNDANGAN') judul = 'SURAT UNDANGAN';
  else if (surat.template_type === 'PERMOHONAN') judul = 'SURAT PERMOHONAN';
  else if (surat.template_type === 'PEMBERITAHUAN') judul = 'SURAT PEMBERITAHUAN';
  else if (surat.template_type === 'PENGANTAR') judul = 'SURAT PENGANTAR';
  else if (surat.template_type === 'BISNIS') judul = 'SURAT NIAGA';
  else if (surat.template_type === 'KETERANGAN') judul = 'SURAT KETERANGAN';
  else if (surat.template_type === 'PERNYATAAN') judul = 'SURAT PERNYATAAN';
  else if (surat.template_type === 'TUGAS') judul = 'SURAT TUGAS';

  if (isSK) {
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
    doc.text(pengaturan.nama_sekolah.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.text('KEPUTUSAN KEPALA SEKOLAH', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(12);
    doc.text(`Nomor: ${surat.nomor_surat}`, pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.text('TENTANG', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.text((d.sk_tentang || '').toUpperCase(), pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
  } 
  else if (isCenterStyle) {
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
    doc.text(judul, pageWidth / 2, y, { align: 'center' });
    y += 2;
    doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Nomor: ${surat.nomor_surat}`, pageWidth / 2, y, { align: 'center' });
  } 
  else if (surat.template_type === 'TUGAS') {
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
    doc.text('SURAT TUGAS', pageWidth / 2, y, { align: 'center' });
    y += 2;
    doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Nomor: ${surat.nomor_surat}`, pageWidth / 2, y, { align: 'center' });
  } 
  else {
    // GAYA BLOK KIRI (Undangan, Permohonan, Pemberitahuan, Pengantar, Bisnis)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0);
    
    // Rata kiri untuk Nomor, Lampiran, Perihal
    const colX = marginX;
    const sepX = marginX + 20;
    const valX = marginX + 23;

    doc.text('Nomor', colX, y); doc.text(':', sepX, y); doc.text(surat.nomor_surat, valX, y); y += 5;
    doc.text('Lampiran', colX, y); doc.text(':', sepX, y); doc.text(d.lampiran || '-', valX, y); y += 5;
    doc.text('Perihal', colX, y); doc.text(':', sepX, y); doc.setFont('helvetica', 'bold'); doc.text(surat.perihal, valX, y); doc.setFont('helvetica', 'normal'); y += 10;
  }

  y += 8;

  // ==========================================
  // BODY
  // ==========================================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  if (!isSK && !isCenterStyle && surat.template_type !== 'TUGAS') {
    // Standar Blok (Yth...)
    doc.text('Yth. Bapak/Ibu', marginX, y); y += 5;
    doc.text(d.tujuan || '', marginX, y); y += 5;
    doc.text('di Tempat', marginX, y); y += 8;
  }

  if (surat.template_type === 'UNDANGAN' || surat.template_type === 'PERMOHONAN' || surat.template_type === 'PEMBERITAHUAN' || surat.template_type === 'BISNIS') {
    const lines = doc.splitTextToSize(d.isi_surat || '', contentWidth);
    doc.text(lines, marginX, y);
    y += lines.length * 5 + 4;

    if (d.hari_tanggal || d.waktu || d.tempat) {
      const identitas = [
        ['Hari, Tanggal', d.hari_tanggal || '-'],
        ['Waktu', d.waktu || '-'],
        ['Tempat', d.tempat || '-'],
      ];
      identitas.forEach(([label, val]) => {
        if (val === '-') return;
        doc.text(label, marginX + 5, y);
        doc.text(':', marginX + 35, y);
        doc.text(val, marginX + 40, y);
        y += 5;
      });
      y += 4;
    }

    const penutupLines = doc.splitTextToSize(d.isi_penutup || '', contentWidth);
    doc.text(penutupLines, marginX, y);
    y += penutupLines.length * 5 + 6;
    
    if (d.catatan) {
      doc.text('Catatan:', marginX, y); y += 5;
      const catLines = doc.splitTextToSize(d.catatan, contentWidth - 5);
      doc.text(catLines, marginX + 5, y);
      y += catLines.length * 5 + 4;
    }
  }
  else if (surat.template_type === 'PENGANTAR') {
    doc.text('Dengan hormat,', marginX, y); y += 6;
    const lines = doc.splitTextToSize(d.isi_surat || '', contentWidth);
    doc.text(lines, marginX, y);
    y += lines.length * 5 + 6;
    if (d.catatan) {
      doc.text('Adapun dokumen yang kami sampaikan adalah sebagai berikut:', marginX, y); y += 5;
      const catLines = doc.splitTextToSize(d.catatan, contentWidth - 5);
      doc.text(catLines, marginX + 5, y);
      y += catLines.length * 5 + 6;
    }
    doc.text(d.isi_penutup || 'Demikian surat pengantar ini kami sampaikan, atas perhatiannya kami ucapkan terima kasih.', marginX, y);
    y += 10;
  }
  else if (isCenterStyle) {
    doc.text(`Yang bertanda tangan di bawah ini, Kepala ${pengaturan.nama_sekolah}, dengan ini menyatakan bahwa:`, marginX, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Nama', marginX + 5, y); doc.text(':', marginX + 40, y); doc.text(d.pihak_nama || '-', marginX + 45, y); y += 5;
    doc.text('Identitas', marginX + 5, y); doc.text(':', marginX + 40, y); doc.text(d.pihak_identitas || '-', marginX + 45, y); y += 8;
    doc.setFont('helvetica', 'normal');
    
    const lines = doc.splitTextToSize(d.isi_surat || '', contentWidth);
    doc.text(lines, marginX, y);
    y += lines.length * 5 + 6;

    doc.text(d.isi_penutup || 'Demikian surat ini dibuat untuk dipergunakan sebagaimana mestinya.', marginX, y);
    y += 10;
  }
  else if (surat.template_type === 'TUGAS') {
    doc.text('Yang bertanda tangan di bawah ini:', marginX, y); y += 6;
    doc.text('Nama', marginX + 5, y); doc.text(':', marginX + 35, y); doc.text(d.pemberi_nama || '-', marginX + 40, y); y += 5;
    doc.text('Jabatan', marginX + 5, y); doc.text(':', marginX + 35, y); doc.text(d.pemberi_jabatan || '-', marginX + 40, y); y += 8;
    doc.text('memberikan tugas kepada:', marginX, y); y += 6;
    doc.text('Nama', marginX + 5, y); doc.text(':', marginX + 35, y); doc.text(d.penerima_nama || '-', marginX + 40, y); y += 5;
    doc.text('Jabatan', marginX + 5, y); doc.text(':', marginX + 35, y); doc.text(d.penerima_jabatan || '-', marginX + 40, y); y += 8;
    doc.text(`Sebagai ${d.tugas_sebagai || ''}, pada:`, marginX, y); y += 5;
    doc.text('Hari, Tanggal', marginX + 5, y); doc.text(':', marginX + 35, y); doc.text(d.hari_tanggal || '-', marginX + 40, y); y += 5;
    doc.text('Waktu', marginX + 5, y); doc.text(':', marginX + 35, y); doc.text(d.waktu || '-', marginX + 40, y); y += 5;
    doc.text('Tempat', marginX + 5, y); doc.text(':', marginX + 35, y); doc.text(d.tempat || '-', marginX + 40, y); y += 8;
    doc.text('Demikian surat tugas ini dibuat untuk digunakan sebagaimana mestinya.', marginX, y);
    y += 10;
  }
  else if (isSK) {
    const renderSKSection = (title: string, content: string) => {
      if (!content) return;
      doc.setFont('helvetica', 'bold'); doc.text(title, marginX, y); y += 5;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(content, contentWidth - 5);
      doc.text(lines, marginX + 5, y);
      y += lines.length * 5 + 4;
    };
    renderSKSection('Menimbang :', d.sk_menimbang || '');
    renderSKSection('Mengingat :', d.sk_mengingat || '');
    renderSKSection('Memperhatikan :', d.sk_memperhatikan || '');
    y += 2;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('MEMUTUSKAN', pageWidth / 2, y, { align: 'center' });
    doc.setFontSize(11);
    y += 6;
    renderSKSection('Menetapkan :', d.sk_memutuskan || '');
  }

  // ==========================================
  // FOOTER & TTD (Universal)
  // ==========================================
  if (y > pageHeight - 80) { doc.addPage(); y = 30; }
  y += 10;
  
  if (isSK && d.catatan) {
     doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
     doc.text('Tembusan:', marginX, y); y += 4;
     doc.setFont('helvetica', 'normal');
     const tLines = d.catatan.split('\n');
     tLines.forEach((t, i) => { doc.text(`${i+1}. ${t}`, marginX + 3, y); y += 4; });
     y += 6;
  }

  if (y > pageHeight - 60) { doc.addPage(); y = 30; }
  const rightX = pageWidth - marginX - 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tasikmalaya, ${formatTanggalPanjang(surat.tanggal_surat)}`, rightX, y);
  y += 5;
  doc.text('Kepala Sekolah,', rightX, y);
  
  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(pengaturan.nama_kepsek ?? '-', rightX, y);
  
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (pengaturan.nip_kepsek) doc.text(`NIP. ${pengaturan.nip_kepsek}`, rightX, y);

  const qrSize = 25;
  const verifyUrl = buildVerifyUrl('surat', surat.verification_token, null);
  await drawQrVerifikasi(doc, verifyUrl, marginX, y - 30, qrSize, ['Scan verifikasi', 'keaslian surat']);

  drawFooter(doc, pengaturan, A4_LAYOUT, `Surat ${judul} - ${surat.perihal}`);
  await drawWatermark(doc, pengaturan.logo_url);

  // ==========================================
  // OUTPUT
  // ==========================================
  if (action === 'preview') {
    window.open(doc.output('bloburl'), '_blank');
  } else if (action === 'blob') {
    return doc.output('blob');
  } else {
    const safeNomor = surat.nomor_surat.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Surat_${judul.replace(/\s/g, '_')}_${safeNomor}.pdf`);
  }
}