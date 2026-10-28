// src/components/surat/ModalSuratOtomatis.tsx
import { useState } from 'react';
import { X, Sparkles, Loader2, FileText, ChevronDown } from 'lucide-react';
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
  tujuan: '', isi_pembuka: '', hari_tanggal: '', waktu: '', tempat: '', agenda: '', isi_penutup: '', catatan: '',
  pemberi_nama: '', pemberi_jabatan: '', pemberi_instansi: '',
  penerima_nama: '', penerima_jabatan: '', penerima_instansi: '', tugas_sebagai: '',
  siswa_nama: '', siswa_ttl: '', siswa_jk: '', siswa_kompetensi: '', isi_keterangan: '',
  sk_tentang: '', sk_menimbang: '', sk_mengingat: '', sk_memperhatikan: '', sk_memutuskan: ''
};

export function ModalSuratOtomatis({ open, onClose, onSuccess, kategoriList }: Props) {
  const [loading, setLoading] = useState(false);
  const [templateType, setTemplateType] = useState<TemplateType>('UNDANGAN');
  const [form, setForm] = useState({
    kategori_id: '',
    nomor_surat: '',
    tanggal_surat: new Date().toISOString().split('T')[0],
    perihal: '',
    ...emptyData
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
      
      const dataPayload = {
        tujuan: form.tujuan, isi_pembuka: form.isi_pembuka, hari_tanggal: form.hari_tanggal, waktu: form.waktu, tempat: form.tempat, agenda: form.agenda, isi_penutup: form.isi_penutup, catatan: form.catatan,
        pemberi_nama: form.pemberi_nama, pemberi_jabatan: form.pemberi_jabatan, pemberi_instansi: form.pemberi_instansi,
        penerima_nama: form.penerima_nama, penerima_jabatan: form.penerima_jabatan, penerima_instansi: form.penerima_instansi, tugas_sebagai: form.tugas_sebagai,
        siswa_nama: form.siswa_nama, siswa_ttl: form.siswa_ttl, siswa_jk: form.siswa_jk, siswa_kompetensi: form.siswa_kompetensi, isi_keterangan: form.isi_keterangan,
        sk_tentang: form.sk_tentang, sk_menimbang: form.sk_menimbang, sk_mengingat: form.sk_mengingat, sk_memperhatikan: form.sk_memperhatikan, sk_memutuskan: form.sk_memutuskan
      };

      const blob = await generateSuratOtomatisPDF({
        nomor_surat: form.nomor_surat,
        tanggal_surat: form.tanggal_surat,
        perihal: form.perihal,
        verification_token: token,
        template_type: templateType,
        data: dataPayload
      }, 'blob') as Blob;

      const fileName = `otomatis/${token}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('dokumen-surat')
        .upload(fileName, blob, { contentType: 'application/pdf', cacheControl: '31536000', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage.from('dokumen-surat').getPublicUrl(fileName);

      const { error: insertErr } = await supabase.from('surat').insert([{
        jenis_surat: 'KELUAR',
        kategori_id: form.kategori_id || null,
        nomor_surat: form.nomor_surat,
        perihal: form.perihal,
        ringkasan: form.perihal, // Bisa disesuaikan
        pengirim_atau_tujuan: form.tujuan || form.penerima_nama || '-',
        tanggal_surat: form.tanggal_surat,
        file_url: publicUrlData.publicUrl,
      }]);

      if (insertErr) throw insertErr;

      await logActivity({
        aksi: 'CREATE',
        modul: (AUDIT_MODUL as any)?.SURAT ?? 'Surat & Persuratan',
        deskripsi: `Buat Surat ${templateType} Otomatis: ${form.nomor_surat}`,
      });

      showToast('success', 'Surat berhasil dibuat dan disimpan!');
      onSuccess();
      onClose();
      setForm({ kategori_id: '', nomor_surat: '', tanggal_surat: new Date().toISOString().split('T')[0], perihal: '', ...emptyData });
      setIsNomorManual(false);
    } catch (err: any) {
      showToast('error', 'Gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const renderField = (label: string, key: keyof typeof form, type: 'text' | 'textarea' = 'text', placeholder?: string) => (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {type === 'text' ? (
        <input
          type="text"
          value={form[key] as string}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500"
          placeholder={placeholder}
        />
      ) : (
        <textarea
          value={form[key] as string}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          rows={4}
          className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500 resize-y"
          placeholder={placeholder}
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Buat Surat Otomatis</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          
          {/* PEMILIHAN TEMPLATE */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
            <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Pilih Template Surat</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['UNDANGAN', 'TUGAS', 'KETERANGAN', 'SK'] as TemplateType[]).map((t) => (
                <button
                  key={t} type="button" onClick={() => setTemplateType(t)}
                  className={`py-2 rounded-lg text-xs font-bold border transition ${
                    templateType === t ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {t === 'SK' ? 'Surat Keputusan' : `Surat ${t.charAt(0) + t.slice(1).toLowerCase()}`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Kode Perihal</label>
              <SearchableSelect
                options={kategoriList.map(k => ({ value: k.id, label: `[${k.kode}] ${k.nama_kategori}` }))}
                value={form.kategori_id} onChange={handleKategoriChange}
                placeholder="Pilih Kode..." searchPlaceholder="Cari..." emptyMessage="Kosong"
              />
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
            {/* FORM UNDANGAN */}
            {templateType === 'UNDANGAN' && (
              <>
                {renderField('Tujuan (Yth.)', 'tujuan', 'text', 'Bapak/Ibu Staf Pendidik...')}
                {renderField('Isi Pembuka', 'isi_pembuka', 'textarea', 'Assalamu\'alaikum... Dalam rangka...')}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {renderField('Hari, Tanggal', 'hari_tanggal', 'text', 'Senin, 21 Juli 2025')}
                  {renderField('Waktu', 'waktu', 'text', '07.15 WIB s.d selesai')}
                  {renderField('Tempat', 'tempat', 'text', 'Aula KH. Zainal Muhsin')}
                </div>
                {renderField('Agenda (Opsional)', 'agenda', 'textarea', '1. Pembukaan\n2. Sambutan...')}
                {renderField('Isi Penutup', 'isi_penutup', 'textarea', 'Mengingat pentingnya acara...')}
                {renderField('Catatan (Opsional)', 'catatan', 'textarea', '1. Membawa laptop\n2. Batik bebas')}
              </>
            )}

            {/* FORM TUGAS */}
            {templateType === 'TUGAS' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {renderField('Nama Pemberi', 'pemberi_nama', 'text', 'Yunus, S.Pd.I')}
                  {renderField('Jabatan Pemberi', 'pemberi_jabatan', 'text', 'Kepala Sekolah')}
                  {renderField('Instansi Pemberi', 'pemberi_instansi', 'text', 'SMK KH. A. Wahab Muhsin')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {renderField('Nama Penerima', 'penerima_nama', 'text', 'Gina Meilinda...')}
                  {renderField('Jabatan Penerima', 'penerima_jabatan', 'text', 'Guru')}
                  {renderField('Instansi Penerima', 'penerima_instansi', 'text', 'SMK KH. A. Wahab Muhsin')}
                </div>
                {renderField('Sebagai / Tugas', 'tugas_sebagai', 'text', 'Pengawas Silang ANBK')}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {renderField('Hari, Tanggal', 'hari_tanggal', 'text', 'Rabu, 06 Agustus 2025')}
                  {renderField('Waktu', 'waktu', 'text', '08.00 s.d selesai')}
                  {renderField('Tempat', 'tempat', 'text', 'SMK Plus An-Nuur')}
                </div>
              </>
            )}

            {/* FORM KETERANGAN */}
            {templateType === 'KETERANGAN' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderField('Nama Siswa', 'siswa_nama', 'text', 'Keysa Nafiza Sabna')}
                  {renderField('Tempat/Tgl Lahir', 'siswa_ttl', 'text', 'Bandung, 24 Agustus 2007')}
                  {renderField('Jenis Kelamin', 'siswa_jk', 'text', 'Perempuan')}
                  {renderField('Kompetensi Keahlian', 'siswa_kompetensi', 'text', 'Farmasi Klinis')}
                </div>
                {renderField('Isi Keterangan', 'isi_keterangan', 'textarea', 'Yang bersangkutan adalah benar siswa...')}
              </>
            )}

            {/* FORM SK */}
            {templateType === 'SK' && (
              <>
                {renderField('Tentang', 'sk_tentang', 'text', 'PENGANGKATAN WALI KELAS TAHUN PELAJARAN 2025/2026')}
                {renderField('Menimbang', 'sk_menimbang', 'textarea', 'Bahwa dalam rangka memperlancar...')}
                {renderField('Mengingat', 'sk_mengingat', 'textarea', '1. Undang-undang Nomor 20 Tahun 2003...\n2. Peraturan...')}
                {renderField('Memperhatikan', 'sk_memperhatikan', 'textarea', 'Hasil Musyawarah Kepala Sekolah dengan...')}
                {renderField('Memutuskan (PERTAMA, KEDUA, dst)', 'sk_memutuskan', 'textarea', 'PERTAMA: Menetapkan Wali Kelas...\nKEDUA: Seluruh Wali Kelas...')}
                {renderField('Tembusan (Opsional)', 'catatan', 'textarea', 'Yayasan KH. Zainal Muhsin\nArsip')}
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