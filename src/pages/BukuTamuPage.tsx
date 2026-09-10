import { useEffect, useState, useMemo, useRef } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Loader2,
  Clock,
  Building,
  User,
  Phone,
  Camera,
  Eraser,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  GraduationCap,
  Users,
  LogOut,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import type {
  BukuTamuWithRelations,
  Guru,
  Divisi,
  Siswa,
  StatusBukuTamu,
} from '@/types/database';

const KATEGORI_OPTIONS = [
  'Kemitraan DUDI',
  'Orang Tua / BK',
  'Kedinasan',
  'Alumni / Umum',
  'Lainnya',
];

const emptyForm = {
  nama_tamu: '',
  instansi: '',
  no_hp: '',
  guru_id: '',
  divisi_id: '',
  siswa_id: '',
  kategori: 'Kemitraan DUDI',
  keperluan: '',
  foto_url: '',
  tanda_tangan_url: '',
};

export function BukuTamuPage() {
  const [list, setList] = useState<BukuTamuWithRelations[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [divisis, setDivisis] = useState<Divisi[]>([]);
  const [siswas, setSiswas] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<string>('semua');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<BukuTamuWithRelations | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BukuTamuWithRelations | null>(null);

  // Ref Kamera & Canvas Tanda Tangan
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [tamuRes, guruRes, divisiRes, siswaRes] = await Promise.all([
      supabase
        .from('buku_tamu')
        .select('*, gurus(id, nama_lengkap), divisis(id, nama_divisi), siswas(id, nama_lengkap, nisn)')
        .order('created_at', { ascending: false }),
      supabase.from('gurus').select('*').order('nama_lengkap', { ascending: true }),
      supabase.from('divisis').select('*').order('nama_divisi', { ascending: true }),
      supabase.from('siswas').select('*').order('nama_lengkap', { ascending: true }).limit(200),
    ]);

    if (tamuRes.error) {
      showToast('error', 'Gagal memuat buku tamu: ' + tamuRes.error.message);
    } else {
      setList((tamuRes.data as BukuTamuWithRelations[]) || []);
    }

    setGurus((guruRes.data as Guru[]) || []);
    setDivisis((divisiRes.data as Divisi[]) || []);
    setSiswas((siswaRes.data as Siswa[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesKat = selectedKategori === 'semua' || item.kategori === selectedKategori;
      const query = searchQuery.toLowerCase();
      const nama = item.nama_tamu.toLowerCase();
      const instansi = (item.instansi || '').toLowerCase();
      const keperluan = item.keperluan.toLowerCase();
      const guru = (item.gurus?.nama_lengkap || '').toLowerCase();

      const matchesSearch =
        nama.includes(query) || instansi.includes(query) || keperluan.includes(query) || guru.includes(query);

      return matchesKat && matchesSearch;
    });
  }, [list, selectedKategori, searchQuery]);

  // Handler Webcam
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      showToast('error', 'Gagal mengakses kamera');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');

    const maxWidth = 480;
    const videoWidth = videoRef.current.videoWidth || 640;
    const videoHeight = videoRef.current.videoHeight || 480;
    const scale = maxWidth < videoWidth ? maxWidth / videoWidth : 1;

    canvas.width = videoWidth * scale;
    canvas.height = videoHeight * scale;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const photoData = canvas.toDataURL('image/webp', 0.7);
      setCapturedPhoto(photoData);
      setForm((prev) => ({ ...prev, foto_url: photoData }));
    }
    stopCamera();
  };

  // Handler Canvas Tanda Tangan
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      const sigData = canvasRef.current.toDataURL('image/webp', 0.6);
      setForm((prev) => ({ ...prev, tanda_tangan_url: sigData }));
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#818cf8';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.beginPath();
      }
      setForm((prev) => ({ ...prev, tanda_tangan_url: '' }));
    }
  };

  const openCreateModal = () => {
    setForm(emptyForm);
    setCapturedPhoto(null);
    setModalOpen(true);
    setTimeout(() => clearCanvas(), 200);
  };

  const handleSave = async () => {
    if (!form.nama_tamu || !form.keperluan) {
      showToast('error', 'Nama tamu dan keperluan wajib diisi');
      return;
    }

    setSaving(true);

    const payload = {
      nama_tamu: form.nama_tamu,
      instansi: form.instansi || null,
      no_hp: form.no_hp || null,
      guru_id: form.guru_id || null,
      divisi_id: form.divisi_id || null,
      siswa_id: form.siswa_id ? parseInt(form.siswa_id) : null,
      kategori: form.kategori,
      keperluan: form.keperluan,
      foto_url: form.foto_url || null,
      tanda_tangan_url: form.tanda_tangan_url || null,
      status: 'menunggu' as StatusBukuTamu,
    };

    const { data: createdData, error } = await supabase
      .from('buku_tamu')
      .insert(payload)
      .select('*, gurus(nama_lengkap), divisis(nama_divisi)')
      .single();

    if (error) {
      showToast('error', 'Gagal menyimpan buku tamu: ' + error.message);
    } else {
      showToast('success', 'Tamu berhasil dicatat!');

      // Pengiriman Notifikasi
      if (createdData) {
        const originInstansi = form.instansi ? ` dari ${form.instansi}` : '';
        const pesanNotif = `${form.nama_tamu}${originInstansi} ingin bertemu. Keperluan: ${form.keperluan}`;

        if (form.guru_id) {
          // Kirim notifikasi khusus ke guru individual
          const { error: notifError } = await supabase.from('notifikasi').insert({
            guru_id: form.guru_id,
            judul: 'Tamu Baru Menunggu',
            pesan: pesanNotif,
            tipe: 'buku_tamu',
            tautan: '/buku-tamu',
          });

          if (notifError) {
            console.error('Gagal memicu notifikasi push:', notifError.message);
          }
        } else if (form.divisi_id) {
          // Ambil semua guru yang ada dalam divisi tersebut
          const { data: targetGurus, error: fetchGurusError } = await supabase
            .from('gurus')
            .select('id')
            .eq('divisi_id', form.divisi_id);

          if (fetchGurusError) {
            console.error('Gagal mengambil daftar guru divisi:', fetchGurusError.message);
          } else if (targetGurus && targetGurus.length > 0) {
            const namaDivisi = createdData.divisis?.nama_divisi ? ` ${createdData.divisis.nama_divisi}` : '';
            const notifPayload = targetGurus.map((g) => ({
              guru_id: g.id,
              judul: `Tamu Baru (Divisi${namaDivisi})`,
              pesan: pesanNotif,
              tipe: 'buku_tamu',
              tautan: '/buku-tamu',
            }));

            const { error: notifDivisiError } = await supabase
              .from('notifikasi')
              .insert(notifPayload);

            if (notifDivisiError) {
              console.error('Gagal memicu notifikasi push divisi:', notifDivisiError.message);
            }
          }
        }
      }

      stopCamera();
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (id: string, status: StatusBukuTamu) => {
    const updateData: Partial<BukuTamuWithRelations> = { status };
    if (status === 'selesai') {
      updateData.waktu_keluar = new Date().toISOString();
    }

    const { error } = await supabase.from('buku_tamu').update(updateData).eq('id', id);
    if (error) {
      showToast('error', 'Gagal memperbarui status: ' + error.message);
    } else {
      showToast('success', `Status tamu diubah menjadi: ${status}`);
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('buku_tamu').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Catatan tamu dihapus');
      fetchData();
    }
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-indigo-400 mb-2" size={32} />
        <p className="text-xs text-slate-400 font-medium">Memuat data buku tamu...</p>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 relative z-10">
          <div className="p-2.5 sm:p-3.5 bg-indigo-500/15 text-indigo-400 rounded-xl sm:rounded-2xl border border-indigo-500/30 shrink-0">
            <UserCheck size={24} className="sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">Buku Tamu Digital</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Sparkles size={10} /> Live
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Pencatatan kunjungan tamu & rekam jejak kedatangan
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all text-sm cursor-pointer"
        >
          <Plus size={18} /> Isi Buku Tamu
        </button>
      </div>

      {/* Control / Filter Bar */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/70 p-3 sm:p-4 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Cari tamu, instansi, keperluan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 sm:py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200 placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedKategori('semua')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
              selectedKategori === 'semua'
                ? 'bg-indigo-600/90 text-white border-indigo-400/40 shadow-sm'
                : 'bg-slate-950/40 text-slate-400 border-slate-800/60'
            }`}
          >
            Semua
          </button>
          {KATEGORI_OPTIONS.map((kat) => (
            <button
              key={kat}
              onClick={() => setSelectedKategori(kat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
                selectedKategori === kat
                  ? 'bg-indigo-600/90 text-white border-indigo-400/40 shadow-sm'
                  : 'bg-slate-950/40 text-slate-400 border-slate-800/60'
              }`}
            >
              {kat}
            </button>
          ))}
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredList.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-2xl text-center text-slate-500">
            <UserCheck size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-medium text-slate-400">Belum ada catatan buku tamu</p>
          </div>
        ) : (
          filteredList.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 p-4 rounded-2xl space-y-3 shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {item.foto_url ? (
                    <img
                      src={item.foto_url}
                      alt={item.nama_tamu}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-700/80 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                      <User size={20} />
                    </div>
                  )}
                  <div>
                    <h2 className="font-semibold text-slate-100 text-sm">{item.nama_tamu}</h2>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Building size={11} className="text-slate-500" /> {item.instansi || 'Perorangan'}
                    </p>
                  </div>
                </div>

                {item.status === 'menunggu' && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Menunggu
                  </span>
                )}
                {item.status === 'bertemu' && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Bertemu
                  </span>
                )}
                {item.status === 'selesai' && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Selesai
                  </span>
                )}
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 text-[11px]">Tujuan:</span>
                  <span className="font-medium">
                    {item.gurus?.nama_lengkap || item.divisis?.nama_divisi || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 text-[11px]">Kategori:</span>
                  <span className="text-[10px] font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {item.kategori}
                  </span>
                </div>
                <p className="text-slate-400 pt-1 border-t border-slate-800/60 line-clamp-2">
                  {item.keperluan}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(item.waktu_masuk).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  WIB
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDetailItem(item)}
                    className="p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 active:scale-95 transition-all"
                  >
                    <FileText size={15} />
                  </button>
                  {item.status === 'menunggu' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'bertemu')}
                      className="p-2 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 active:scale-95 transition-all"
                    >
                      <CheckCircle2 size={15} />
                    </button>
                  )}
                  {item.status !== 'selesai' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'selesai')}
                      className="p-2 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 active:scale-95 transition-all"
                    >
                      <LogOut size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="p-2 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 active:scale-95 transition-all"
                  >
                    <XCircle size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:block bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800/80 uppercase text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-4">Tamu & Instansi</th>
                <th className="px-5 py-4">Pihak Dituju</th>
                <th className="px-5 py-4">Kategori & Keperluan</th>
                <th className="px-5 py-4">Waktu Masuk</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {item.foto_url ? (
                        <img
                          src={item.foto_url}
                          alt={item.nama_tamu}
                          className="w-10 h-10 rounded-2xl object-cover border border-slate-700/80 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                          <User size={18} />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-100 leading-tight">{item.nama_tamu}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building size={12} className="text-slate-500" /> {item.instansi || 'Perorangan / Umum'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300">
                    {item.gurus?.nama_lengkap ? (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/20 w-fit">
                        <User size={13} /> {item.gurus.nama_lengkap}
                      </div>
                    ) : item.divisis?.nama_divisi ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 w-fit">
                        <Users size={13} /> Divisi {item.divisis.nama_divisi}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 max-w-xs">
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wider bg-slate-950/60 text-slate-300 px-2 py-0.5 rounded border border-slate-800/80 mb-1">
                      {item.kategori}
                    </span>
                    <p className="text-xs text-slate-400 truncate" title={item.keperluan}>
                      {item.keperluan}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-slate-300 font-medium">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock size={13} className="text-slate-500" />
                      <span>
                        {new Date(item.waktu_masuk).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        WIB
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {item.status === 'menunggu' && (
                      <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Menunggu
                      </span>
                    )}
                    {item.status === 'bertemu' && (
                      <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Bertemu
                      </span>
                    )}
                    {item.status === 'selesai' && (
                      <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Selesai
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setDetailItem(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      >
                        <FileText size={16} />
                      </button>
                      {item.status === 'menunggu' && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'bertemu')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/15"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      {item.status !== 'selesai' && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'selesai')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/15"
                        >
                          <LogOut size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Buku Tamu */}
      <Modal
        open={modalOpen}
        onClose={() => {
          stopCamera();
          setModalOpen(false);
        }}
        title="Form Kunjungan Tamu"
        size="lg"
      >
        <div className="space-y-4 pt-1 max-h-[80vh] overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Nama Lengkap Tamu *
              </label>
              <input
                type="text"
                placeholder="cth: Ahmad Rifai"
                value={form.nama_tamu}
                onChange={(e) => setForm({ ...form, nama_tamu: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Instansi / Perusahaan
              </label>
              <input
                type="text"
                placeholder="cth: PT Telkom / Orang Tua"
                value={form.instansi}
                onChange={(e) => setForm({ ...form, instansi: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <Phone size={12} /> No. HP / WhatsApp
              </label>
              <input
                type="text"
                placeholder="08123456789"
                value={form.no_hp}
                onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Kategori Keperluan
              </label>
              <select
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                {KATEGORI_OPTIONS.map((k) => (
                  <option key={k} value={k} className="bg-slate-900 text-slate-200">
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Guru / Staf Dituju
              </label>
              <select
                value={form.guru_id}
                onChange={(e) => setForm({ ...form, guru_id: e.target.value, divisi_id: '' })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="" className="bg-slate-900 text-slate-400">Pilih Guru (Opsional)</option>
                {gurus.map((g) => (
                  <option key={g.id} value={g.id} className="bg-slate-900 text-slate-200">
                    {g.nama_lengkap}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Atau Divisi Dituju
              </label>
              <select
                value={form.divisi_id}
                onChange={(e) => setForm({ ...form, divisi_id: e.target.value, guru_id: '' })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="" className="bg-slate-900 text-slate-400">Pilih Divisi (Opsional)</option>
                {divisis.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                    {d.nama_divisi}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.kategori === 'Orang Tua / BK' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1">
                <GraduationCap size={12} /> Siswa Terkait
              </label>
              <select
                value={form.siswa_id}
                onChange={(e) => setForm({ ...form, siswa_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-indigo-500/30 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="" className="bg-slate-900 text-slate-400">Pilih Nama Siswa</option>
                {siswas.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                    {s.nama_lengkap} ({s.nisn})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Rincian Keperluan *
            </label>
            <textarea
              rows={2}
              placeholder="Tuliskan tujuan kunjungan secara mendetail..."
              value={form.keperluan}
              onChange={(e) => setForm({ ...form, keperluan: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Kamera & TTD Stack */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Foto Tamu (WebP)</span>
                <Camera size={14} className="text-slate-500" />
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center min-h-[130px] flex flex-col items-center justify-center relative overflow-hidden">
                {capturedPhoto ? (
                  <div className="relative w-full h-32">
                    <img src={capturedPhoto} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setCapturedPhoto(null)}
                      className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-full text-xs"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : isCameraActive ? (
                  <div className="relative w-full h-32 bg-black rounded-lg overflow-hidden">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-medium"
                    >
                      Ambil Foto
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-indigo-400"
                  >
                    <Camera size={24} />
                    <span className="text-xs font-medium">Buka Kamera</span>
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Tanda Tangan Digital</span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-[10px] text-rose-400 hover:underline flex items-center gap-0.5"
                >
                  <Eraser size={12} /> Hapus
                </button>
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden touch-none">
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={130}
                  onMouseDown={startDrawing}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onMouseMove={draw}
                  onTouchStart={startDrawing}
                  onTouchEnd={stopDrawing}
                  onTouchMove={draw}
                  className="w-full h-[130px] cursor-crosshair bg-slate-950"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800/80 mt-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setModalOpen(false);
              }}
              className="px-4 py-2.5 rounded-xl text-slate-400 font-medium text-xs sm:text-sm"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-xs sm:text-sm shadow-lg shadow-indigo-600/30 disabled:opacity-60"
            >
              {saving && <Loader2 size={15} className="animate-spin" />} Simpan
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Detail */}
      {detailItem && (
        <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title="Detail Kunjungan Tamu" size="md">
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              {detailItem.foto_url ? (
                <img
                  src={detailItem.foto_url}
                  alt={detailItem.nama_tamu}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                  <ImageIcon size={22} />
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">{detailItem.nama_tamu}</h3>
                <p className="text-xs text-slate-400">{detailItem.instansi || 'Perorangan / Umum'}</p>
                <p className="text-xs text-indigo-400 mt-0.5">HP: {detailItem.no_hp || '-'}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-500">Kategori:</span>
                <span className="font-medium text-slate-200">{detailItem.kategori}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-500">Tujuan:</span>
                <span className="font-medium text-slate-200">
                  {detailItem.gurus?.nama_lengkap || detailItem.divisis?.nama_divisi || '-'}
                </span>
              </div>
              <div className="border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-500 block mb-1">Keperluan:</span>
                <p className="text-slate-200 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  {detailItem.keperluan}
                </p>
              </div>
            </div>

            {detailItem.tanda_tangan_url && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Tanda Tangan Digital
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex justify-center">
                  <img
                    src={detailItem.tanda_tangan_url}
                    alt="Tanda Tangan"
                    className="h-20 object-contain filter invert opacity-90"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal Delete */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Catatan Tamu"
        message="Apakah Anda yakin ingin menghapus catatan kunjungan tamu ini?"
      />
    </div>
  );
}