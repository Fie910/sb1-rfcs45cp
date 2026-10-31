//src/pages/PengumumanPage.tsx
import { useEffect, useState, ChangeEvent, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Megaphone, Upload, Link as LinkIcon,
  X, CalendarDays, Sparkles, Search, Filter, CheckCircle2, EyeOff, Wand2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { ModalTambahKegiatan } from '@/components/ModalTambahKegiatan';
import { useAuth } from '@/context/AuthContext';
import { broadcastToAllGurus } from '@/lib/notifications/notification';
import type { Pengumuman } from '@/types/database';
import {
  generateRingkasanPengumuman,
  type RingkasanPengumumanAI,
} from '@/lib/ai/pengumumanAi';
import { useLocation } from 'react-router-dom';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { SkeletonCard } from '@/components/Skeleton';

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
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  });
};

// Helper Kompresi & Konversi Gambar ke Format WebP
const compressAndConvertToWebP = (file: File, quality = 0.8, maxWidth = 1200): Promise<File> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      const canvas = document.createElement('canvas');
      let { width, height } = image;
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Gagal memuat konteks Canvas')); return; }
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Gagal mengompresi gambar')); return; }
        const webpName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
        resolve(new File([blob], webpName, { type: 'image/webp' }));
      }, 'image/webp', quality);
    };
    image.onerror = (error) => reject(error);
  });
};

export function PengumumanPage() {
  const { guru } = useAuth();
  const location = useLocation();
  const [list, setList] = useState<Pengumuman[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKegiatanOpen, setModalKegiatanOpen] = useState(false);
  const [editing, setEditing] = useState<Pengumuman | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pengumuman | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState<string | null>(null);
  const [summaryCache, setSummaryCache] = useState<Record<string, RingkasanPengumumanAI>>({});

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'aktif' | 'nonaktif'>('semua');

  // State khusus Upload Gambar
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ===========================================================================
  // FETCH & EFFECTS
  // ===========================================================================
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('pengumumans').select('*').order('created_at', { ascending: false });
    if (error) showToast('error', 'Gagal memuat data: ' + error.message);
    else setList(data as Pengumuman[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (location.state?.openCreate) {
      openCreate();
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const resetImageState = () => { setSelectedFile(null); setPreviewUrl(null); };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    resetImageState();
    setModalOpen(true);
  };

  const openEdit = (item: Pengumuman) => {
    setEditing(item);
    setForm({
      judul: item.judul, isi: item.isi, gambar_url: item.gambar_url || '',
      url: item.url || '', tanggal_mulai: item.tanggal_mulai,
      tanggal_selesai: item.tanggal_selesai, is_aktif: item.is_aktif,
    });
    setSelectedFile(null);
    setPreviewUrl(item.gambar_url || null);
    setModalOpen(true);
  };

  // ===========================================================================
  // FILE HANDLERS
  // ===========================================================================
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('error', 'Berkas harus berupa gambar'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('error', 'Ukuran gambar maksimal 10 MB'); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setForm((prev) => ({ ...prev, gambar_url: '' }));
  };

  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    try {
      const compressedFile = await compressAndConvertToWebP(file, 0.8, 1200);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('pengumuman-banners')
        .upload(`banners/${fileName}`, compressedFile, { cacheControl: '31536000', upsert: false });
      if (uploadError) { showToast('error', 'Gagal mengunggah: ' + uploadError.message); return null; }
      const { data } = supabase.storage.from('pengumuman-banners').getPublicUrl(`banners/${fileName}`);
      return data.publicUrl;
    } catch (err) {
      showToast('error', 'Gagal memproses gambar: ' + (err as Error).message);
      return null;
    }
  };

  // ===========================================================================
  // AI SUMMARY
  // ===========================================================================
  const handleGenerateRingkasan = async (item: Pengumuman) => {
    setGeneratingSummary(item.id);
    try {
      const result = await generateRingkasanPengumuman({
        judul: item.judul, isi: item.isi, prioritas: (item as any).prioritas,
      });
      const { error } = await supabase.from('pengumumans')
        .update({ ringkasan_ai: JSON.stringify(result), ai_processed_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw error;
      setSummaryCache((prev) => ({ ...prev, [item.id]: result }));
      fetchData(); // Refresh agar badge AI muncul
      showToast('success', 'Ringkasan AI berhasil dibuat');
    } catch (err: any) {
      showToast('error', err.message || 'Gagal membuat ringkasan');
    } finally {
      setGeneratingSummary(null);
    }
  };

  // ===========================================================================
  // CRUD HANDLERS
  // ===========================================================================
  const handleSave = async () => {
    if (!form.judul || !form.isi) { showToast('error', 'Judul dan isi wajib diisi'); return; }
    if (!guru?.id) { showToast('error', 'Sesi Anda telah berakhir.'); return; }

    setSaving(true);
    let finalGambarUrl = form.gambar_url;
    if (selectedFile) {
      const uploadedUrl = await uploadImageToStorage(selectedFile);
      if (!uploadedUrl) { setSaving(false); return; }
      finalGambarUrl = uploadedUrl;
    }

    const payload = { ...form, gambar_url: finalGambarUrl.trim() || null, url: form.url.trim() || null };
    let result;
    if (editing) result = await supabase.from('pengumumans').update(payload).eq('id', editing.id);
    else result = await supabase.from('pengumumans').insert(payload);

    if (result.error) {
      showToast('error', 'Gagal menyimpan: ' + result.error.message);
    } else {
      if (!editing && form.is_aktif) {
        try {
          await broadcastToAllGurus({
            judul: '📢 Pengumuman Baru', pesan: form.judul, tipe: 'pengumuman', tautan: '/pengumuman',
          });
        } catch (notifErr) { console.error('Gagal notif:', notifErr); }
      }
      showToast('success', editing ? 'Pengumuman diperbarui' : 'Pengumuman dibuat');
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('pengumumans').delete().eq('id', deleteTarget.id);
    if (error) showToast('error', 'Gagal menghapus: ' + error.message);
    else { showToast('success', 'Pengumuman dihapus'); fetchData(); }
    setDeleteTarget(null);
  };

  const toggleAktif = async (item: Pengumuman) => {
    const { error } = await supabase.from('pengumumans').update({ is_aktif: !item.is_aktif }).eq('id', item.id);
    if (error) showToast('error', 'Gagal mengubah status: ' + error.message);
    else fetchData();
  };

  // ===========================================================================
  // DERIVED STATE (Stats & Filtered List)
  // ===========================================================================
  const stats = useMemo(() => {
    return {
      total: list.length,
      aktif: list.filter((i) => i.is_aktif).length,
      nonaktif: list.filter((i) => !i.is_aktif).length,
      ai: list.filter((i) => i.ringkasan_ai).length,
    };
  }, [list]);

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchSearch = item.judul.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.isi.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'semua' || 
                          (filterStatus === 'aktif' && item.is_aktif) || 
                          (filterStatus === 'nonaktif' && !item.is_aktif);
      return matchSearch && matchStatus;
    });
  }, [list, searchQuery, filterStatus]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
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
            type="button" onClick={() => setModalKegiatanOpen(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 text-indigo-300 font-bold px-4 py-2.5 rounded-2xl border border-indigo-500/30 transition-all shadow-lg cursor-pointer text-sm"
          >
            <CalendarDays size={18} className="text-indigo-400" /> Tambah Kegiatan
          </button>
          <button
            type="button" onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer text-sm"
          >
            <Plus size={18} /> Tambah Pengumuman
          </button>
        </div>
      </div>

      {/* KPI STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0"><Megaphone size={18} /></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-500">Total</p><p className="text-lg font-extrabold text-slate-200"><AnimatedNumber value={stats.total} /></p></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0"><CheckCircle2 size={18} /></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-500">Aktif</p><p className="text-lg font-extrabold text-emerald-400"><AnimatedNumber value={stats.aktif} /></p></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-400 flex items-center justify-center shrink-0"><EyeOff size={18} /></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-500">Nonaktif</p><p className="text-lg font-extrabold text-slate-400"><AnimatedNumber value={stats.nonaktif} /></p></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0"><Sparkles size={18} /></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-500">AI Summarized</p><p className="text-lg font-extrabold text-purple-400"><AnimatedNumber value={stats.ai} /></p></div>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" placeholder="Cari judul atau isi pengumuman..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={14} className="text-slate-500 shrink-0" />
          <select
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm cursor-pointer focus:outline-none focus:border-indigo-500"
          >
            <option value="semua">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* CONTENT GRID */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard lines={5} /><SkeletonCard lines={5} /><SkeletonCard lines={5} /><SkeletonCard lines={5} />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-slate-900 rounded-3xl border border-slate-800/80 text-center py-20 px-4">
          <Megaphone size={44} className="mx-auto mb-3 text-slate-600" />
          <p className="font-bold text-slate-200 text-base">
            {searchQuery || filterStatus !== 'semua' ? 'Tidak ada pengumuman yang cocok' : 'Belum ada pengumuman.'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery || filterStatus !== 'semua' ? 'Coba ubah filter atau kata kunci.' : 'Buat pengumuman baru untuk dibagikan kepada seluruh guru.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredList.map((item, idx) => {
            // Cek apakah ada ringkasan AI
            const aiSummary = summaryCache[item.id] || ((item as PengumumanWithAI).ringkasan_ai ? JSON.parse((item as PengumumanWithAI).ringkasan_ai!) : null) as RingkasanAI | null;
            
            return (
              <div
                key={item.id}
                className="bg-slate-900 rounded-3xl border border-slate-800/80 p-5 md:p-6 shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-indigo-500/40 group animate-fade-in-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div>
                  {/* Gambar Banner */}
                  {item.gambar_url && (
                    <div className="w-full h-48 mb-4 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 relative">
                      <img src={item.gambar_url} alt={item.judul} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      {!item.is_aktif && (
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-300 border-2 border-slate-300 px-3 py-1 rounded-lg rotate-[-10deg]">Nonaktif</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Header Kartu */}
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 transition-colors ${
                        item.is_aktif ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}>
                        <Megaphone size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-100 line-clamp-1 text-base">{item.judul}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatDateWIB(item.tanggal_mulai)} - {formatDateWIB(item.tanggal_selesai)}
                        </p>
                      </div>
                    </div>
                    {/* Toggle Switch */}
                    <button
                      type="button" onClick={() => toggleAktif(item)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors duration-300 ${
                        item.is_aktif ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition-transform duration-300 ${
                        item.is_aktif ? 'translate-x-5 bg-emerald-400' : 'translate-x-0 bg-slate-500'
                      }`} />
                    </button>
                  </div>

                  {/* Isi Teks */}
                  <p className="text-sm text-slate-300 leading-relaxed line-clamp-3 mb-4">{item.isi}</p>

                  {/* ✨ KARTU AI INSIGHT */}
                  {aiSummary && (
                    <div className="mb-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl p-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5 flex items-center gap-1">
                        <Sparkles size={11} /> Ringkasan AI
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed italic line-clamp-2">
                        "{(aiSummary as RingkasanAI)?.inti || (aiSummary as RingkasanAI)?.ringkasan || 'Telah diringkas'}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Aksi */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 mt-auto">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button" onClick={() => handleGenerateRingkasan(item)} disabled={generatingSummary === item.id}
                      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {generatingSummary === item.id ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                      {generatingSummary === item.id ? 'Proses...' : aiSummary ? 'Ulangi AI' : 'Ringkas AI'}
                    </button>
                    <button
                      type="button" onClick={() => openEdit(item)}
                      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      type="button" onClick={() => setDeleteTarget(item)}
                      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} /> Hapus
                    </button>
                  </div>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-2 rounded-xl transition-all">
                      <LinkIcon size={13} /> Tautan
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL INPUT & EDIT PENGUMUMAN */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Pengumuman' : 'Tambah Pengumuman'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Judul Pengumuman</label>
            <input type="text" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} placeholder="Contoh: Jadwal Asesmen Bakat Minat 2026" className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Isi Pengumuman</label>
            <textarea value={form.isi} onChange={(e) => setForm({ ...form, isi: e.target.value })} rows={5} placeholder="Tuliskan rincian pengumuman di sini..." className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-all resize-y" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Gambar Banner (Opsional)</label>
            {previewUrl ? (
              <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 group">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <button type="button" onClick={handleRemoveImage} className="absolute top-2 right-2 p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-slate-200 border border-slate-700 transition-colors cursor-pointer" title="Hapus Gambar"><X size={16} /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-400">
                  <Upload size={24} className="mb-2 text-indigo-400" />
                  <p className="text-xs font-bold text-slate-300">Klik untuk memilih gambar</p>
                  <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, atau WebP (Otomatis dikompres)</p>
                </div>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">URL Link Eksternal (Opsional)</label>
            <div className="relative">
              <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
              <LinkIcon className="absolute left-3 top-3 text-slate-500" size={18} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tanggal Mulai</label>
              <input type="date" value={form.tanggal_mulai} onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tanggal Selesai</label>
              <input type="date" value={form.tanggal_selesai} onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer" />
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer w-max pt-1">
            <input type="checkbox" checked={form.is_aktif} onChange={(e) => setForm({ ...form, is_aktif: e.target.checked })} className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm font-medium text-slate-300">Pengumuman aktif</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 cursor-pointer">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL TAMBAH KEGIATAN SEKOLAH */}
      <ModalTambahKegiatan open={modalKegiatanOpen} onClose={() => setModalKegiatanOpen(false)} onSuccess={() => showToast('success', 'Rencana kegiatan berhasil ditambahkan')} />

      {/* MODAL KONFIRMASI HAPUS */}
      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Hapus Pengumuman" message={`Yakin ingin menghapus "${deleteTarget?.judul}"?`} />
    </div>
  );
}