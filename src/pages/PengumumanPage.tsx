import { useEffect, useState, ChangeEvent } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Megaphone,
  Upload,
  Link as LinkIcon,
  X,
  CalendarDays,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { ModalTambahKegiatan } from '@/components/ModalTambahKegiatan';
import { useAuth } from '@/context/AuthContext';
import type { Pengumuman } from '@/types/database';

const emptyForm = {
  judul: '',
  isi: '',
  gambar_url: '',
  url: '',
  tanggal_mulai: new Date().toISOString().split('T')[0],
  tanggal_selesai: new Date().toISOString().split('T')[0],
  is_aktif: true,
};

// Helper format tanggal ke WIB (Asia/Jakarta)
const formatDateWIB = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(`${dateString}T00:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
};

export function PengumumanPage() {
  const { guru } = useAuth();

  const [list, setList] = useState<Pengumuman[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKegiatanOpen, setModalKegiatanOpen] = useState(false);
  const [editing, setEditing] = useState<Pengumuman | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pengumuman | null>(null);

  // State khusus Upload Gambar
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pengumumans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showToast('error', 'Gagal memuat data: ' + error.message);
    } else {
      setList(data as Pengumuman[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetImageState = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    resetImageState();
    setModalOpen(true);
  };

  const openEdit = (item: Pengumuman) => {
    setEditing(item);
    setForm({
      judul: item.judul,
      isi: item.isi,
      gambar_url: item.gambar_url || '',
      url: item.url || '',
      tanggal_mulai: item.tanggal_mulai,
      tanggal_selesai: item.tanggal_selesai,
      is_aktif: item.is_aktif,
    });
    setSelectedFile(null);
    setPreviewUrl(item.gambar_url || null);
    setModalOpen(true);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Berkas harus berupa gambar (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Ukuran gambar maksimal 2 MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setForm((prev) => ({ ...prev, gambar_url: '' }));
  };

  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `banners/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('pengumuman-banners')
      .upload(filePath, file);

    if (uploadError) {
      showToast('error', 'Gagal mengunggah gambar: ' + uploadError.message);
      return null;
    }

    const { data } = supabase.storage
      .from('pengumuman-banners')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.judul || !form.isi) {
      showToast('error', 'Judul dan isi wajib diisi');
      return;
    }

    if (!guru?.id) {
      showToast('error', 'Sesi Anda telah berakhir. Silakan login kembali.');
      return;
    }

    setSaving(true);
    let finalGambarUrl = form.gambar_url;

    if (selectedFile) {
      const uploadedUrl = await uploadImageToStorage(selectedFile);
      if (!uploadedUrl) {
        setSaving(false);
        return;
      }
      finalGambarUrl = uploadedUrl;
    }

    const payload = {
      ...form,
      gambar_url: finalGambarUrl.trim() || null,
      url: form.url.trim() || null,
    };

    let result;
    if (editing) {
      result = await supabase.from('pengumumans').update(payload).eq('id', editing.id);
    } else {
      result = await supabase.from('pengumumans').insert(payload);
    }

    if (result.error) {
      showToast('error', 'Gagal menyimpan: ' + result.error.message);
    } else {
      showToast('success', editing ? 'Pengumuman diperbarui' : 'Pengumuman dibuat');
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('pengumumans').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Pengumuman dihapus');
      fetchData();
    }
    setDeleteTarget(null);
  };

  const toggleAktif = async (item: Pengumuman) => {
    const { error } = await supabase
      .from('pengumumans')
      .update({ is_aktif: !item.is_aktif })
      .eq('id', item.id);
    if (error) {
      showToast('error', 'Gagal mengubah status: ' + error.message);
    } else {
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400" size={36} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <Megaphone className="text-indigo-400" size={28} />
            Pengumuman & Kegiatan Sekolah
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Kelola pengumuman dan agenda rencana kegiatan yang tampil di dashboard guru
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setModalKegiatanOpen(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 text-indigo-300 font-bold px-4 py-2.5 rounded-2xl border border-indigo-500/30 transition-all shadow-lg cursor-pointer text-sm"
          >
            <CalendarDays size={18} className="text-indigo-400" />
            Tambah Kegiatan Sekolah
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer text-sm"
          >
            <Plus size={18} />
            Tambah Pengumuman
          </button>
        </div>
      </div>

      {/* Grid Content / Empty State */}
      {list.length === 0 ? (
        <div className="bg-slate-900 rounded-3xl border border-slate-800/80 text-center py-20 px-4 text-slate-400 backdrop-blur-xl shadow-xl">
          <Megaphone size={44} className="mx-auto mb-3 text-slate-600" />
          <p className="font-bold text-slate-200 text-base">Belum ada pengumuman.</p>
          <p className="text-xs text-slate-400 mt-1">
            Buat pengumuman baru untuk dibagikan kepada seluruh guru.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {list.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 rounded-3xl border border-slate-800/80 p-5 md:p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between transition-all hover:border-slate-700/80"
            >
              <div>
                {item.gambar_url && (
                  <div className="w-full h-44 mb-4 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80">
                    <img
                      src={item.gambar_url}
                      alt={item.judul}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
                        item.is_aktif
                          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      <Megaphone size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-100 line-clamp-1 text-base">
                        {item.judul}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDateWIB(item.tanggal_mulai)} - {formatDateWIB(item.tanggal_selesai)}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={() => toggleAktif(item)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
                      item.is_aktif
                        ? 'bg-emerald-500/20 border-emerald-500/50'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                    title={item.is_aktif ? 'Pengumuman Aktif' : 'Pengumuman Nonaktif'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition duration-200 ease-in-out ${
                        item.is_aktif
                          ? 'translate-x-5 bg-emerald-400'
                          : 'translate-x-0 bg-slate-500'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed line-clamp-3 mb-5">
                  {item.isi}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-all cursor-pointer"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    <Trash2 size={13} /> Hapus
                  </button>
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                  >
                    <LinkIcon size={13} /> Tautan
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL INPUT & EDIT PENGUMUMAN */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Pengumuman' : 'Tambah Pengumuman'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Judul Pengumuman
            </label>
            <input
              type="text"
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              placeholder="Contoh: Jadwal Asesmen Bakat Minat 2026"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Isi Pengumuman
            </label>
            <textarea
              value={form.isi}
              onChange={(e) => setForm({ ...form, isi: e.target.value })}
              rows={4}
              placeholder="Tuliskan rincian pengumuman di sini..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-all resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Gambar Banner (Opsional)
            </label>

            {previewUrl ? (
              <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 group">
                <img
                  src={previewUrl}
                  alt="Preview Banner"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  title="Hapus Gambar"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-400">
                  <Upload size={24} className="mb-2 text-indigo-400" />
                  <p className="text-xs font-bold text-slate-300">
                    Klik untuk memilih gambar dari komputer
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    PNG, JPG, atau WebP (Maks. 2 MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              URL Link Eksternal (Opsional)
            </label>
            <div className="relative">
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-all"
              />
              <LinkIcon
                className="absolute left-3 top-3 text-slate-500"
                size={18}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={form.tanggal_mulai}
                onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Tanggal Selesai
              </label>
              <input
                type="date"
                value={form.tanggal_selesai}
                onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer w-max pt-1">
            <input
              type="checkbox"
              checked={form.is_aktif}
              onChange={(e) => setForm({ ...form, is_aktif: e.target.checked })}
              className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-300">Pengumuman aktif</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'Mengunggah & Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL TAMBAH KEGIATAN SEKOLAH */}
      <ModalTambahKegiatan
        open={modalKegiatanOpen}
        onClose={() => setModalKegiatanOpen(false)}
        onSuccess={() => {
          showToast('success', 'Rencana kegiatan sekolah berhasil ditambahkan');
        }}
      />

      {/* MODAL KONFIRMASI HAPUS */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Pengumuman"
        message={`Yakin ingin menghapus "${deleteTarget?.judul}"?`}
      />
    </div>
  );
}