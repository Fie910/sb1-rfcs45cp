import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  Clock,
  CheckCircle2,
  Calendar,
  UserCheck,
  BookOpen,
  Edit3,
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import type {
  Kelas,
  IzinGuruPiketWithRelations,
  MataPelajaran,
  KategoriIzin,
} from '@/types/database';

// Helper untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD berbasis WIB (Asia/Jakarta)
const getTodayWIB = (): string => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
};

// Helper untuk memformat string tanggal ke tampilan Bahasa Indonesia sesuai zona waktu WIB
const formatDateWIB = (dateStr: string): string => {
  if (!dateStr) return '-';
  const dateObj = dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(`${dateStr}T00:00:00+07:00`);

  return dateObj.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export function IzinPage() {
  const { guru } = useAuth();
  const [izinList, setIzinList] = useState<IzinGuruPiketWithRelations[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    tanggal_izin: getTodayWIB(),
    kategori_izin: 'Sakit' as KategoriIzin,
    keterangan_izin: '',
    titipan_tugas: '',
    url_file: '',
    kelas_id: '',
    mapel_id: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<IzinGuruPiketWithRelations | null>(null);

  // Pengecekan Hak Akses untuk melihat Izin Guru Lain
  const userRole = (guru as any)?.role?.toLowerCase() || '';
  const canViewOtherIzin = ['admin', 'kepala', 'wakil_kepala'].includes(userRole);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [izinRes, kelasRes, mapelRes] = await Promise.all([
        supabase
          .from('izin_guru_pikets')
          .select(`
            *,
            gurus:guru_izin_id (id, nama_lengkap),
            kelas (id, nama_kelas),
            guru_piket:guru_piket_id (id, nama_lengkap),
            mata_pelajarans:mapel_id (id, nama_mapel)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('kelas').select('*').order('nama_kelas'),
        supabase.from('mata_pelajarans').select('*').order('nama_mapel'),
      ]);

      if (izinRes.error) console.error('Error fetching izin:', izinRes.error);

      setIzinList((izinRes.data as IzinGuruPiketWithRelations[]) ?? []);
      setKelasList((kelasRes.data as Kelas[]) ?? []);
      setMapelList((mapelRes.data as MataPelajaran[]) ?? []);
    } catch (err) {
      console.error('Error fetching data:', err);
      showToast('error', 'Gagal memuat data pengajuan izin');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (guru && guru.mapel_id && !form.mapel_id && !editingId) {
      setForm((f) => ({ ...f, mapel_id: guru.mapel_id! }));
    }
  }, [guru, form.mapel_id, editingId]);

  const openModalForCreate = () => {
    setEditingId(null);
    setForm({
      tanggal_izin: getTodayWIB(),
      kategori_izin: 'Sakit',
      keterangan_izin: '',
      titipan_tugas: '',
      url_file: '',
      kelas_id: '',
      mapel_id: guru?.mapel_id ?? '',
    });
    setModalOpen(true);
  };

  const openModalForEdit = (izin: IzinGuruPiketWithRelations) => {
    const penanganan = (izin.status_penanganan || '').toLowerCase();
    const penyampaian = ((izin as any).status_penyampaian || '').toLowerCase();
    const isSelesai =
      penanganan === 'selesai' ||
      penanganan === 'ditangani' ||
      penyampaian === 'sudah disampaikan' ||
      penyampaian === 'selesai';

    if (isSelesai) {
      showToast('error', 'Izin yang sudah disampaikan tidak dapat diubah');
      return;
    }

    setEditingId(izin.id);
    setForm({
      tanggal_izin: izin.tanggal_izin || getTodayWIB(),
      kategori_izin: (izin.kategori_izin as KategoriIzin) || 'Sakit',
      keterangan_izin: izin.keterangan_izin ?? (izin as any).alasan_izin ?? '',
      titipan_tugas: izin.titipan_tugas || '',
      url_file: (izin as any).url_file || (izin as any).link_tugas || (izin as any).file_url || '',
      kelas_id: izin.kelas_id || '',
      mapel_id: izin.mapel_id || guru?.mapel_id || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guru) return;
    if (!form.keterangan_izin || !form.titipan_tugas || !form.kelas_id || !form.mapel_id) {
      showToast('error', 'Semua field wajib harus diisi');
      return;
    }
    setSaving(true);

    const payload = {
      guru_izin_id: guru.id,
      tanggal_izin: form.tanggal_izin,
      kategori_izin: form.kategori_izin,
      keterangan_izin: form.keterangan_izin,
      titipan_tugas: form.titipan_tugas,
      url_file: form.url_file,
      kelas_id: form.kelas_id,
      mapel_id: form.mapel_id,
    };

    let error;
    if (editingId) {
      const res = await supabase
        .from('izin_guru_pikets')
        .update(payload)
        .eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase
        .from('izin_guru_pikets')
        .insert({
          ...payload,
          status_penanganan: 'Menunggu',
        });
      error = res.error;
    }

    if (error) {
      showToast('error', `Gagal ${editingId ? 'memperbarui' : 'mengajukan'} izin: ` + error.message);
    } else {
      showToast('success', `Izin & delegasi tugas berhasil ${editingId ? 'diperbarui' : 'diajukan'}`);
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const penanganan = (deleteTarget.status_penanganan || '').toLowerCase();
    const penyampaian = ((deleteTarget as any).status_penyampaian || '').toLowerCase();
    const isSelesai =
      penanganan === 'selesai' ||
      penanganan === 'ditangani' ||
      penyampaian === 'sudah disampaikan' ||
      penyampaian === 'selesai';

    if (isSelesai) {
      showToast('error', 'Izin yang sudah disampaikan tidak dapat dihapus');
      setDeleteTarget(null);
      return;
    }

    const { error } = await supabase.from('izin_guru_pikets').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Pengajuan izin berhasil dihapus');
      setDeleteTarget(null);
      fetchData();
    }
  };

  const getMapelName = (izin: IzinGuruPiketWithRelations): string =>
    izin.mata_pelajarans?.nama_mapel ?? (izin as any).mata_pelajaran ?? '-';

  const safeIzinList = izinList || [];
  const myIzin = safeIzinList.filter((i) => i?.guru_izin_id === guru?.id);
  const otherIzin = safeIzinList.filter((i) => i?.guru_izin_id !== guru?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="animate-spin text-indigo-400" size={36} />
      </div>
    );
  }

  const renderIzinCard = (izin: IzinGuruPiketWithRelations, isMine: boolean) => {
    const penanganan = (izin.status_penanganan || '').toLowerCase();
    const penyampaian = ((izin as any).status_penyampaian || '').toLowerCase();

    const isSelesai =
      penanganan === 'selesai' ||
      penanganan === 'ditangani' ||
      penyampaian === 'sudah disampaikan' ||
      penyampaian === 'selesai';

    const statusLabel = isSelesai
      ? (izin as any).status_penyampaian || izin.status_penanganan || 'Selesai'
      : 'Menunggu';

    const fileUrl = (izin as any).url_file || (izin as any).link_tugas || (izin as any).file_url;

    return (
      <div
        key={izin.id}
        className="bg-slate-900 rounded-3xl border border-slate-800/80 p-5 md:p-6 transition-all duration-200 backdrop-blur-xl hover:border-slate-700 shadow-xl group relative overflow-hidden"
      >
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                isSelesai
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10'
              }`}
            >
              {isSelesai ? <CheckCircle2 size={24} /> : <Clock size={24} />}
            </div>
            <div>
              <p className="font-bold text-slate-100 text-base tracking-tight">
                {izin.gurus?.nama_lengkap ?? 'Guru'}
              </p>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                <Calendar size={12} className="text-slate-500" />
                {formatDateWIB(izin.tanggal_izin)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {izin.kategori_izin && (
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  izin.kategori_izin === 'Sakit'
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                }`}
              >
                {izin.kategori_izin}
              </span>
            )}
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                isSelesai
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}
            >
              {statusLabel}
            </span>
            {isMine && !isSelesai && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openModalForEdit(izin)}
                  className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  title="Edit pengajuan"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => setDeleteTarget(izin)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Hapus pengajuan"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Keterangan: </span>
              <span className="text-slate-200 font-medium">
                {izin.keterangan_izin ?? (izin as any).alasan_izin}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-400">Kelas & Mapel:</span>
              <span className="text-indigo-400 font-semibold flex items-center gap-1.5">
                <BookOpen size={13} />
                {izin.kelas?.nama_kelas ?? '-'} • {getMapelName(izin)}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Delegasi Tugas:
            </p>
            <p className="text-slate-300 text-xs md:text-sm whitespace-pre-wrap bg-slate-950 border border-slate-800/80 rounded-2xl p-4 leading-relaxed">
              {izin.titipan_tugas}
            </p>
          </div>

          {/* LINK FILE TUGAS / GDRIVE (JIKA ADA) */}
          {fileUrl && (
            <div className="pt-1">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3.5 py-2 rounded-xl transition-all cursor-pointer group/link"
              >
                <LinkIcon size={14} className="text-indigo-400 group-hover/link:rotate-45 transition-transform" />
                <span>Buka Link File / Tugas</span>
                <ExternalLink size={12} className="opacity-70" />
              </a>
            </div>
          )}

          {isSelesai && izin.guru_piket && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 pt-1">
              <UserCheck size={14} />
              <span>Ditangani oleh: {izin.guru_piket.nama_lengkap}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER PAGE */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <FileText className="text-indigo-400" size={28} />
            Izin & Delegasi Tugas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Ajukan izin ketika berhalangan hadir dan titipkan instruksi tugas ke guru piket
          </p>
        </div>
        <button
          onClick={openModalForCreate}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 cursor-pointer active:scale-95"
        >
          <Plus size={18} />
          Ajukan Izin Baru
        </button>
      </div>

      {/* PENGAJUAN IZIN SAYA */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Clock size={20} className="text-indigo-400" />
          Pengajuan Izin Saya
        </h2>
        {myIzin.length === 0 ? (
          <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 text-center py-16 px-6 backdrop-blur-xl">
            <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <FileText size={32} />
            </div>
            <p className="text-slate-400 text-base font-medium">Belum ada pengajuan izin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {myIzin.map((i) => renderIzinCard(i, true))}
          </div>
        )}
      </div>

      {/* IZIN GURU LAIN (HANYA DITAMPILKAN UNTUK ROLE ADMIN, KEPALA, WAKIL_KEPALA) */}
      {canViewOtherIzin && otherIzin.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <UserCheck size={20} className="text-indigo-400" />
            Izin Guru Lain
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {otherIzin.map((i) => renderIzinCard(i, false))}
          </div>
        </div>
      )}

      {/* MODAL FORM AJUKAN / EDIT IZIN */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Izin & Delegasi Tugas' : 'Ajukan Izin & Delegasi Tugas'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Tanggal Izin
              </label>
              <input
                type="date"
                value={form.tanggal_izin}
                onChange={(e) => setForm({ ...form, tanggal_izin: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Kategori Izin
              </label>
              <select
                value={form.kategori_izin}
                onChange={(e) => setForm({ ...form, kategori_izin: e.target.value as KategoriIzin })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm cursor-pointer"
                required
              >
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Kelas Tujuan
              </label>
              <select
                value={form.kelas_id}
                onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm cursor-pointer"
                required
              >
                <option value="">Pilih kelas...</option>
                {(kelasList || []).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama_kelas}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Mata Pelajaran
              </label>
              <select
                value={form.mapel_id}
                onChange={(e) => setForm({ ...form, mapel_id: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm cursor-pointer"
                required
              >
                <option value="">Pilih mata pelajaran...</option>
                {(mapelList || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama_mapel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Keterangan Izin
            </label>
            <input
              type="text"
              value={form.keterangan_izin}
              onChange={(e) => setForm({ ...form, keterangan_izin: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm"
              placeholder="Contoh: Sakit demam tinggi, keperluan dinas luar, dll."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Instruksi / Delegasi Tugas
            </label>
            <textarea
              value={form.titipan_tugas}
              onChange={(e) => setForm({ ...form, titipan_tugas: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none text-sm leading-relaxed"
              placeholder="Tuliskan instruksi tugas untuk siswa, buku/materi yang harus dikerjakan, atau catatan penting untuk guru piket..."
              required
            />
          </div>

          {/* INPUT URL / LINK FILE TUGAS */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Link File Tugas (Opsional / Google Drive)
            </label>
            <div className="relative">
              <input
                type="url"
                value={form.url_file}
                onChange={(e) => setForm({ ...form, url_file: e.target.value })}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm"
                placeholder="https://drive.google.com/..."
              />
              <LinkIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingId ? 'Simpan Perubahan' : 'Ajukan Izin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL KONFIRMASI HAPUS */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Pengajuan Izin"
        message="Apakah Anda yakin ingin menghapus pengajuan izin ini?"
      />
    </div>
  );
}