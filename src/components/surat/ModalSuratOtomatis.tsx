// src/components/surat/ModalSuratOtomatis.tsx
import { useState } from 'react';
import { X, Sparkles, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { generateSuratOtomatisPDF } from '@/lib/pdf/generateSuratOtomatisPDF';
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

export function ModalSuratOtomatis({ open, onClose, onSuccess, kategoriList }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    jenis_surat_text: 'UNDANGAN',
    kategori_id: '',
    nomor_surat: '',
    tanggal_surat: new Date().toISOString().split('T')[0],
    tujuan: '',
    perihal: '',
    isi_surat: '',
    tembusan: '',
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
    if (!form.isi_surat.trim() || !form.tujuan.trim() || !form.perihal.trim() || !form.nomor_surat.trim()) {
      showToast('error', 'Harap isi semua kolom wajib');
      return;
    }

    setLoading(true);
    try {
      const token = crypto.randomUUID();

      // 1. Generate PDF Blob
      const blob = await generateSuratOtomatisPDF({
        nomor_surat: form.nomor_surat,
        jenis_surat_text: form.jenis_surat_text,
        tujuan: form.tujuan,
        perihal: form.perihal,
        isi_surat: form.isi_surat,
        tembusan: form.tembusan,
        tanggal_surat: form.tanggal_surat,
        verification_token: token,
      }, 'blob') as Blob;

      // 2. Upload ke Supabase Storage
      const fileName = `otomatis/${token}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('dokumen-surat')
        .upload(fileName, blob, { 
          contentType: 'application/pdf',
          cacheControl: '31536000', 
          upsert: false 
        });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('dokumen-surat')
        .getPublicUrl(fileName);

      // 3. Simpan ke tabel surat
      const { error: insertErr } = await supabase.from('surat').insert([{
        jenis_surat: 'KELUAR',
        kategori_id: form.kategori_id || null,
        nomor_surat: form.nomor_surat,
        perihal: form.perihal,
        ringkasan: form.isi_surat.slice(0, 200), // Simpan potongan isi sebagai ringkasan
        pengirim_atau_tujuan: form.tujuan,
        tanggal_surat: form.tanggal_surat,
        file_url: publicUrlData.publicUrl,
      }]);

      if (insertErr) throw insertErr;

      await logActivity({
        aksi: 'CREATE',
        modul: (AUDIT_MODUL as any)?.SURAT ?? 'Surat & Persuratan',
        deskripsi: `Buat Surat ${form.jenis_surat_text} Otomatis: ${form.nomor_surat} - ${form.perihal}`,
      });

      showToast('success', 'Surat berhasil dibuat dan disimpan otomatis!');
      onSuccess();
      onClose();
      
      // Reset form
      setForm({
        jenis_surat_text: 'UNDANGAN',
        kategori_id: '',
        nomor_surat: '',
        tanggal_surat: new Date().toISOString().split('T')[0],
        tujuan: '',
        perihal: '',
        isi_surat: '',
        tembusan: '',
      });
      setIsNomorManual(false);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Gagal membuat surat: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* HEADER */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Buat Surat Otomatis</h3>
              <p className="text-xs text-purple-400 mt-0.5">Generate PDF langsung dari aplikasi</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Jenis Surat</label>
              <select
                value={form.jenis_surat_text}
                onChange={(e) => setForm({ ...form, jenis_surat_text: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500"
              >
                <option value="UNDANGAN">Surat Undangan</option>
                <option value="TUGAS">Surat Tugas</option>
                <option value="PEMBERITAHUAN">Surat Pemberitahuan</option>
                <option value="KETERANGAN">Surat Keterangan</option>
                <option value="LAINNYA">Surat Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Kode Perihal</label>
              <SearchableSelect
                options={kategoriList.map(k => ({
                  value: k.id,
                  label: `[${k.kode}] ${k.nama_kategori}`
                }))}
                value={form.kategori_id}
                onChange={handleKategoriChange}
                placeholder="Pilih Kode Perihal"
                searchPlaceholder="Cari..."
                emptyMessage="Tidak ditemukan"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Nomor Surat</label>
              <input
                type="text"
                value={form.nomor_surat}
                onChange={(e) => { setForm({ ...form, nomor_surat: e.target.value }); setIsNomorManual(true); }}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm font-mono text-purple-400 outline-none focus:border-purple-500"
                placeholder="Auto-generate..."
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tanggal Surat</label>
              <input
                type="date"
                value={form.tanggal_surat}
                onChange={(e) => setForm({ ...form, tanggal_surat: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Tujuan / Yth.</label>
            <input
              type="text"
              value={form.tujuan}
              onChange={(e) => setForm({ ...form, tujuan: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500"
              placeholder="Contoh: Seluruh Guru & Staf SMK..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Perihal</label>
            <input
              type="text"
              value={form.perihal}
              onChange={(e) => setForm({ ...form, perihal: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500"
              placeholder="Contoh: Undangan Rapat Evaluasi Semester"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Isi Surat</label>
            <textarea
              value={form.isi_surat}
              onChange={(e) => setForm({ ...form, isi_surat: e.target.value })}
              rows={6}
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500 resize-y"
              placeholder="Tuliskan isi surat selengkapnya di sini... (Akan otomatis format rata kiri kanan di PDF)"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Tembusan (Opsional)</label>
            <textarea
              value={form.tembusan}
              onChange={(e) => setForm({ ...form, tembusan: e.target.value })}
              rows={3}
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-slate-100 outline-none focus:border-purple-500 resize-y"
              placeholder="1. Kepala Sekolah&#10;2. Arsip&#10;(Satu baris satu tembusan)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-white/10 rounded-xl text-xs sm:text-sm text-slate-400 hover:bg-white/5 cursor-pointer">
              Batal
            </button>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-purple-600/30 disabled:opacity-50 cursor-pointer">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Membuat PDF...</> : <><FileText size={16} /> Generate & Simpan</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}