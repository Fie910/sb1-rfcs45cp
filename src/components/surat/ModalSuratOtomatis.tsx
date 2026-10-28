// src/components/surat/ModalSuratOtomatis.tsx
import { useState } from 'react';
import { X, Sparkles, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { generateSuratOtomatisPDF, type TemplateType } from '@/lib/pdf/generateSuratOtomatisPDF';
import { formatNomorSurat } from '@/utils/formatSurat';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { KategoriSurat } from '@/types/surat';
import { getNextUrutanSurat } from '@/services/suratService';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  kategoriList: KategoriSurat[];
};

const emptyData = {
  tujuan: '', lampiran: '', isi_surat: '', isi_penutup: '', catatan: '',
  pihak_nama: '', pihak_identitas: '',
  pemberi_nama: '', pemberi_jabatan: '', penerima_nama: '', penerima_jabatan: '', tugas_sebagai: '', hari_tanggal: '', waktu: '', tempat: '',
  sk_tentang: '', sk_menimbang: '', sk_mengingat: '', sk_memperhatikan: '', sk_memutuskan: ''
};

export function ModalSuratOtomatis({ open, onClose, onSuccess, kategoriList }: Props) {
  const [loading, setLoading] = useState(false);
  const [templateType, setTemplateType] = useState<TemplateType>('UNDANGAN');
  const [form, setForm] = useState({
    kategori_id: '', nomor_surat: '', tanggal_surat: new Date().toISOString().split('T')[0], perihal: '', ...emptyData
  });
  const [isNomorManual, setIsNomorManual] = useState(false);

  const handleKategoriChange = async (katId: string) => {
    const kat = kategoriList.find(k => k.id === katId);
    if (!kat) return;
    setForm(prev => ({ ...prev, kategori_id: katId }));
    if (!isNomorManual) {
      const nextUrutan = await getNextUrutanSurat('KELUAR');
      const autoNomor = formatNomorSurat(nextUrutan, kat.kode, 'SMK-KHAWM', form.tanggal_surat);
      setForm(prev => ({ ...prev, nomor_surat: autoNomor }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nomor_surat.trim() || !form.perihal.trim()) {
      showToast('error', 'Nomor dan Perihal wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const token = crypto.randomUUID();
      const blob = await generateSuratOtomatisPDF({
        nomor_surat: form.nomor_surat,
        tanggal_surat: form.tanggal_surat,
        perihal: form.perihal,
        verification_token: token,
        template_type: templateType,
        data: form
      }, 'blob') as Blob;

      const fileName = `otomatis/${token}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('dokumen-surat')
        .upload(fileName, blob, { contentType: 'application/pdf', cacheControl: '31536000', upsert: false });

      if (uploadErr) throw uploadErr;
      const { data: publicUrlData } = supabase.storage.from('dokumen-surat').getPublicUrl(fileName);

      const { error: insertErr } = await supabase.from('surat').insert([{
        jenis_surat: 'KELUAR', kategori_id: form.kategori_id || null,
        nomor_surat: form.nomor_surat, perihal: form.perihal,
        ringkasan: form.perihal, pengirim_atau_tujuan: form.tujuan || form.penerima_nama || form.pihak_nama || '-',
        tanggal_surat: form.tanggal_surat, file_url: publicUrlData.publicUrl,
      }]);

      if (insertErr) throw insertErr;

      await logActivity({ aksi: 'CREATE', modul: (AUDIT_MODUL as any)?.SURAT ?? 'Surat', deskripsi: `Buat Surat ${templateType}: ${form.nomor_surat}` });
      showToast('success', 'Surat berhasil dibuat!');
      onSuccess(); onClose();
      setForm({ kategori_id: '', nomor_surat: '', tanggal_surat: new Date().toISOString().split('T')[0], perihal: '', ...emptyData });
      setIsNomorManual(false);
    } catch (err: any) {
      showToast('error', 'Gagal: ' + err.message);
    } finally { setLoading(false); }
  };

  if (!open) return null;

  const renderField = (label: string, key: keyof typeof form, type: 'text' | 'textarea' = 'text', placeholder?: string) => (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {type === 'text' ? (
        <input type="text" value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500" placeholder={placeholder} />
      ) : (
        <textarea value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={4}
          className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500 resize-y" placeholder={placeholder} />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center"><Sparkles size={18} /></div>
            <h3 className="font-bold text-sm sm:text-base text-white">Buat Surat Otomatis</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* TEMPLATE SELECTOR */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
            <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Pilih Template</label>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {[
                { id: 'UNDANGAN', label: 'Undangan' }, { id: 'PERMOHONAN', label: 'Permohonan' }, { id: 'PEMBERITAHUAN', label: 'Pemberitahuan' },
                { id: 'TUGAS', label: 'Surat Tugas' }, { id: 'PENGANTAR', label: 'Pengantar' }, { id: 'BISNIS', label: 'Bisnis / Niaga' },
                { id: 'KETERANGAN', label: 'Keterangan' }, { id: 'PERNYATAAN', label: 'Pernyataan' }, { id: 'SK', label: 'Surat Keputusan' }
              ].map((t) => (
                <button key={t.id} type="button" onClick={() => setTemplateType(t.id as TemplateType)}
                  className={`py-2 px-1 rounded-lg text-[10px] sm:text-xs font-bold border transition text-center ${
                    templateType === t.id ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Kode Perihal</label>
              <SearchableSelect options={kategoriList.map(k => ({ value: k.id, label: `[${k.kode}] ${k.nama_kategori}` }))}
                value={form.kategori_id} onChange={handleKategoriChange} placeholder="Pilih..." searchPlaceholder="Cari..." emptyMessage="Kosong" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Perihal</label>
              <input type="text" value={form.perihal} onChange={(e) => setForm({ ...form, perihal: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500" required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nomor Surat</label>
              <input type="text" value={form.nomor_surat} onChange={(e) => { setForm({ ...form, nomor_surat: e.target.value }); setIsNomorManual(true); }}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm font-mono text-purple-400 outline-none focus:border-purple-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tanggal Surat</label>
              <input type="date" value={form.tanggal_surat} onChange={(e) => setForm({ ...form, tanggal_surat: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500" required />
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-4">
            {/* GAYA BLOK KIRI */}
            {['UNDANGAN', 'PERMOHONAN', 'PEMBERITAHUAN', 'BISNIS'].includes(templateType) && (
              <>
                {renderField('Tujuan (Yth.)', 'tujuan', 'text', 'Bapak/Ibu ...')}
                {renderField('Lampiran (Opsional)', 'lampiran', 'text', '1 Berkas / -')}
                {renderField('Isi Pembuka / Latar Belakang', 'isi_surat', 'textarea', 'Sehubungan dengan...')}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {renderField('Hari, Tanggal', 'hari_tanggal', 'text', 'Senin, 21 Juli 2025')}
                  {renderField('Waktu', 'waktu', 'text', '07.15 WIB')}
                  {renderField('Tempat', 'tempat', 'text', 'Aula Sekolah')}
                </div>
                {renderField('Isi Penutup', 'isi_penutup', 'textarea', 'Demikian surat ini kami sampaikan...')}
              </>
            )}

            {templateType === 'PENGANTAR' && (
              <>
                {renderField('Tujuan (Yth.)', 'tujuan', 'text', 'Bapak/Ibu ...')}
                {renderField('Isi Pengantar', 'isi_surat', 'textarea', 'Bersama dengan surat ini kami sampaikan...')}
                {renderField('Daftar Dokumen yang disampaikan', 'catatan', 'textarea', '1. Laporan Keuangan\n2. Berkas Pendukung')}
                {renderField('Isi Penutup', 'isi_penutup', 'textarea', 'Demikian surat pengantar ini...')}
              </>
            )}

            {/* GAYA CENTER */}
            {['KETERANGAN', 'PERNYATAAN'].includes(templateType) && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderField('Nama Pihak', 'pihak_nama', 'text', 'Nama Siswa / Guru')}
                  {renderField('Identitas (NISN/NIP)', 'pihak_identitas', 'text', '12345678')}
                </div>
                {renderField('Isi Keterangan / Pernyataan', 'isi_surat', 'textarea', 'Yang bersangkutan adalah benar...')}
                {renderField('Penutup', 'isi_penutup', 'textarea', 'Demikian surat ini dibuat...')}
              </>
            )}

            {templateType === 'TUGAS' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderField('Nama Pemberi', 'pemberi_nama', 'text', 'Yunus, S.Pd.I')}
                  {renderField('Jabatan Pemberi', 'pemberi_jabatan', 'text', 'Kepala Sekolah')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderField('Nama Penerima', 'penerima_nama', 'text', 'Gina...')}
                  {renderField('Jabatan Penerima', 'penerima_jabatan', 'text', 'Guru')}
                </div>
                {renderField('Tugas Sebagai', 'tugas_sebagai', 'text', 'Pengawas Silang')}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {renderField('Hari, Tanggal', 'hari_tanggal', 'text', 'Rabu, 06 Agustus 2025')}
                  {renderField('Waktu', 'waktu', 'text', '08.00 s.d selesai')}
                  {renderField('Tempat', 'tempat', 'text', 'SMK Plus An-Nuur')}
                </div>
              </>
            )}

            {templateType === 'SK' && (
              <>
                {renderField('Tentang', 'sk_tentang', 'text', 'PENGANGKATAN WALI KELAS...')}
                {renderField('Menimbang', 'sk_menimbang', 'textarea', 'Bahwa dalam rangka...')}
                {renderField('Mengingat', 'sk_mengingat', 'textarea', '1. Undang-undang...\n2. Peraturan...')}
                {renderField('Memperhatikan', 'sk_memperhatikan', 'textarea', 'Hasil Musyawarah...')}
                {renderField('Memutuskan', 'sk_memutuskan', 'textarea', 'PERTAMA: Menetapkan...\nKEDUA: ...')}
                {renderField('Tembusan', 'catatan', 'textarea', 'Yayasan KH. Zainal Muhsin\nArsip')}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-white/10 rounded-xl text-xs sm:text-sm text-slate-400 hover:bg-white/5 cursor-pointer">Batal</button>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-purple-600/30 disabled:opacity-50 cursor-pointer">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Membuat...</> : <><FileText size={16} /> Generate PDF</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}