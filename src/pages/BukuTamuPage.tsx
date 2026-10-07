// src/pages/BukuTamuPage.tsx
// Buku Tamu Digital — PUBLIC, form-only untuk tamu.
// Setelah submit, tampilkan thank-you screen dan auto-reset.

import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck, Loader2, Building, User, Phone, Camera, Eraser,
  X, GraduationCap, Sparkles, CheckCircle2, ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { SearchableSelect } from '@/components/SearchableSelect';
import { sendNotification, getGuruIdsByDivisi } from '@/lib/notifications/notification';
import type { Guru, Divisi, Siswa, StatusBukuTamu } from '@/types/database';

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
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [divisis, setDivisis] = useState<Divisi[]>([]);
  const [siswas, setSiswas] = useState<Siswa[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmittedName, setLastSubmittedName] = useState('');

  // Kamera & TTD
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // ===========================================================================
  // FETCH MASTER DATA
  // ===========================================================================
  useEffect(() => {
    (async () => {
      setLoadingMaster(true);
        const [guruRes, divisiRes, siswaRes] = await Promise.all([
          supabase.rpc('get_gurus_public'),
          supabase.rpc('get_divisis_public'),
          supabase.rpc('get_siswas_public'),
        ]);

      setGurus((guruRes.data as any[]) ?? []);
      setDivisis((divisiRes.data as any[]) ?? []);
      setSiswas((siswaRes.data as any[]) ?? []);
      setLoadingMaster(false);
    })();
  }, []);

  // ===========================================================================
  // WEBCAM
  // ===========================================================================
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

  // ===========================================================================
  // TTD CANVAS
  // ===========================================================================
  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
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

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
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

  // ===========================================================================
  // SUBMIT
  // ===========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      showToast('error', 'Gagal menyimpan: ' + error.message);
      setSaving(false);
      return;
    }

    // Notifikasi ke guru/divisi tujuan
    if (createdData) {
      const originInstansi = form.instansi ? ` dari ${form.instansi}` : '';
      const pesanNotif = `${form.nama_tamu}${originInstansi} ingin bertemu. Keperluan: ${form.keperluan}`;

      try {
        if (form.guru_id) {
          await sendNotification({
            guruIds: form.guru_id,
            judul: 'Tamu Baru Menunggu',
            pesan: pesanNotif,
            tipe: 'buku_tamu',
            tautan: '/buku_tamu/kelola',
          });
        } else if (form.divisi_id) {
          const targetIds = await getGuruIdsByDivisi(form.divisi_id);
          if (targetIds.length > 0) {
            const namaDivisi = createdData.divisis?.nama_divisi
              ? ` ${createdData.divisis.nama_divisi}`
              : '';
            await sendNotification({
              guruIds: targetIds,
              judul: `Tamu Baru (Divisi${namaDivisi})`,
              pesan: pesanNotif,
              tipe: 'buku_tamu',
              tautan: '/buku_tamu/kelola',
            });
          }
        }
      } catch (notifErr) {
        console.error('Gagal kirim notif:', notifErr);
      }
    }

    stopCamera();

    // Show thank-you screen
    setLastSubmittedName(form.nama_tamu);
    setSubmitted(true);
    setSaving(false);

    // Auto-reset setelah 10 detik
    setTimeout(() => {
      setForm(emptyForm);
      setCapturedPhoto(null);
      setSubmitted(false);
      clearCanvas();
    }, 10000);
  };

  const handleResetManual = () => {
    setForm(emptyForm);
    setCapturedPhoto(null);
    setSubmitted(false);
    clearCanvas();
  };

  // ===========================================================================
  // RENDER — THANK YOU SCREEN
  // ===========================================================================
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-slate-100">
              Terima Kasih, {lastSubmittedName}!
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Kunjungan Anda telah tercatat. Petugas akan segera menemui Anda.
            </p>
          </div>
          <button
            onClick={handleResetManual}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition cursor-pointer"
          >
            Isi Tamu Baru
            <ArrowRight size={16} />
          </button>
          <p className="text-xs text-slate-600">
            Form akan otomatis reset dalam 10 detik
          </p>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER — FORM
  // ===========================================================================
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="p-3.5 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-4 sm:space-y-6">
        {/* HEADER */}
        <div className="relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl">
          <div className="flex items-center gap-3 sm:gap-4 relative z-10">
            <div className="p-2.5 sm:p-3.5 bg-indigo-500/15 text-indigo-400 rounded-xl sm:rounded-2xl border border-indigo-500/30 shrink-0">
              <UserCheck size={24} className="sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                  Selamat Datang
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Sparkles size={10} /> Buku Tamu Digital
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Silakan isi data kunjungan Anda
              </p>
            </div>
          </div>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-4"
        >
          {/* Nama + Instansi */}
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
                required
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

          {/* HP + Kategori */}
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
              >
                {KATEGORI_OPTIONS.map((k) => (
                  <option key={k} value={k} className="bg-slate-900 text-slate-200">
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tujuan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Guru / Staf Dituju
              </label>
              <SearchableSelect
                options={gurus.map((g) => ({
                  value: g.id,
                  label: g.nama_lengkap,
                  hint: g.nip ? `NIP: ${g.nip}` : undefined,
                }))}
                value={form.guru_id}
                onChange={(v) => setForm({ ...form, guru_id: v, divisi_id: '' })}
                placeholder={loadingMaster ? 'Memuat...' : 'Pilih Guru (Opsional)'}
                searchPlaceholder="Cari nama atau NIP..."
                emptyMessage="Guru tidak ditemukan"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Atau Divisi Dituju
              </label>
              <SearchableSelect
                options={divisis.map((d) => ({
                  value: d.id,
                  label: d.nama_divisi,
                }))}
                value={form.divisi_id}
                onChange={(v) => setForm({ ...form, divisi_id: v, guru_id: '' })}
                placeholder={loadingMaster ? 'Memuat...' : 'Pilih Divisi (Opsional)'}
                searchPlaceholder="Cari divisi..."
                emptyMessage="Divisi tidak ditemukan"
              />
            </div>
          </div>

          {/* Siswa (kalau Orang Tua) */}
          {form.kategori === 'Orang Tua / BK' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1">
                <GraduationCap size={12} /> Siswa Terkait
              </label>
              <SearchableSelect
                options={siswas.map((s) => ({
                  value: s.id,
                  label: s.nama_lengkap,
                  hint: `NISN: ${s.nisn}`,
                }))}
                value={form.siswa_id}
                onChange={(v) => setForm({ ...form, siswa_id: v })}
                placeholder="Pilih Nama Siswa"
                searchPlaceholder="Cari nama atau NISN siswa..."
                emptyMessage="Siswa tidak ditemukan"
              />
            </div>
          )}

          {/* Keperluan */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Rincian Keperluan *
            </label>
            <textarea
              rows={3}
              placeholder="Tuliskan tujuan kunjungan secara mendetail..."
              value={form.keperluan}
              onChange={(e) => setForm({ ...form, keperluan: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
              required
            />
          </div>

          {/* Foto + TTD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Foto Tamu</span>
                <Camera size={14} className="text-slate-500" />
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center min-h-[130px] flex flex-col items-center justify-center relative overflow-hidden">
                {capturedPhoto ? (
                  <div className="relative w-full h-32">
                    <img
                      src={capturedPhoto}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedPhoto(null);
                        setForm((prev) => ({ ...prev, foto_url: '' }));
                      }}
                      className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-full text-xs"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : isCameraActive ? (
                  <div className="relative w-full h-32 bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
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
                    className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-indigo-400 transition cursor-pointer"
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
                  className="text-[10px] text-rose-400 hover:underline flex items-center gap-0.5 cursor-pointer"
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

          {/* Submit */}
          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-60 cursor-pointer active:scale-95"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Kirim Data Kunjungan
            </button>
          </div>
        </form>

        {/* FOOTER */}
        <div className="text-center pt-2">
          <Link
            to="/buku_tamu/kelola"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
          >
            <ShieldCheck size={12} />
            Pegawai? Kelola Buku Tamu
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}