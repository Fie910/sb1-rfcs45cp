// src/pages/BukuTamuPage.tsx
// Buku Tamu Digital — PUBLIC, form-only untuk tamu.
// Setelah submit, tampilkan thank-you screen dan auto-reset.

import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  UserCheck, Loader2, Building, User, Phone, Camera, Eraser,
  X, GraduationCap, Sparkles, CheckCircle2, ShieldCheck,
  ArrowRight, Clock, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { Guru, Divisi, Siswa, StatusBukuTamu } from '@/types/database';
import { KioskClock } from '@/components/bukutamu/KioskClock';

// Tambah type lokal untuk response RPC
type SiswaPublicRow = {
  id: number;
  nama_lengkap: string;
  nisn: string;
  kelas_id: number | null;
  kelas_nama: string | null;
};

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
  const [siswas, setSiswas] = useState<SiswaPublicRow[]>([]);
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

  // Kiosk Clock & Badge
  
  const [countdown, setCountdown] = useState<number | null>(null);
  const [badgeQr, setBadgeQr] = useState<string | null>(null);
  const [badgeData, setBadgeData] = useState<{ waktu: string; tamu_id: string } | null>(null);

  // ===========================================================================
  // EFFECTS
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
      setSiswas((siswaRes.data as SiswaPublicRow[]) ?? []);
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

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    // Countdown 3-2-1
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCountdown(null);

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

    // ✅ Ambil data yang baru di-insert untuk generate QR Badge
    const { data: insertedData, error } = await supabase
      .from('buku_tamu')
      .insert(payload)
      .select('id, created_at')
      .single();

    if (error) {
      showToast('error', 'Gagal menyimpan: ' + error.message);
      setSaving(false);
      return;
    }

    // Notifikasi via RPC
    try {
      let targetIds: string[] = [];
      if (form.guru_id) {
        targetIds = [form.guru_id];
      } else if (form.divisi_id) {
        const { data: divisiGurus } = await supabase.rpc('get_gurus_by_divisi_public', {
          p_divisi_id: form.divisi_id,
        });
        targetIds = (divisiGurus as any[])?.map((g) => g.id) ?? [];
      }

      if (targetIds.length > 0) {
        await supabase.rpc('notify_buku_tamu', {
          p_guru_ids: targetIds,
          p_nama_tamu: form.nama_tamu,
          p_instansi: form.instansi || null,
          p_keperluan: form.keperluan,
        });
      }
    } catch (notifErr) {
      console.error('Gagal kirim notif:', notifErr);
    }

    // ✅ Generate QR Code Badge
    try {
      if (insertedData) {
        const qrContent = `TAMU-${insertedData.id.slice(0, 8).toUpperCase()}|${form.nama_tamu}|${new Date(insertedData.created_at).toISOString()}`;
        const qrDataUrl = await QRCode.toDataURL(qrContent, {
          width: 400,
          margin: 1,
          color: { dark: '#1e1b4b', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        });
        setBadgeQr(qrDataUrl);
        setBadgeData({
          waktu: new Date(insertedData.created_at).toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
          }),
          tamu_id: insertedData.id.slice(0, 8).toUpperCase(),
        });
      }
    } catch (qrErr) {
      console.warn('Gagal generate QR badge:', qrErr);
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
      setBadgeQr(null);
      setBadgeData(null);
      clearCanvas();
    }, 10000);
  };

  const handleResetManual = () => {
    setForm(emptyForm);
    setCapturedPhoto(null);
    setSubmitted(false);
    setBadgeQr(null);
    setBadgeData(null);
    clearCanvas();
  };

  // ===========================================================================
  // RENDER — THANK YOU SCREEN (DIGITAL BADGE)
  // ===========================================================================
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full space-y-5">
          {/* ✅ DIGITAL VISITOR BADGE */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/50 rounded-3xl shadow-2xl shadow-indigo-500/20">
            <div className="h-2 bg-gradient-to-r from-emerald-400 via-indigo-400 to-purple-400" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

            <div className="relative p-6 space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 mb-2 shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">
                  Kunjungan Tercatat
                </p>
                <h1 className="text-xl font-black text-white tracking-tight">
                  {lastSubmittedName}
                </h1>
              </div>

              {badgeQr ? (
                <div className="flex justify-center">
                  <div className="p-3 bg-white rounded-2xl shadow-xl shadow-indigo-500/20">
                    <img src={badgeQr} alt="Visitor QR" className="w-40 h-40" />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-40 h-40 rounded-2xl bg-slate-800 animate-pulse" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Waktu Masuk</p>
                  <p className="text-sm font-black text-indigo-300 tabular-nums mt-0.5">{badgeData?.waktu ?? '-'} WIB</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">ID Kunjungan</p>
                  <p className="text-sm font-black text-emerald-300 font-mono mt-0.5">{badgeData?.tamu_id ?? '-'}</p>
                </div>
              </div>

              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-center">
                <p className="text-[11px] text-indigo-200 leading-relaxed">
                  <ShieldCheck size={12} className="inline mr-1" />
                  Tunjukkan QR Code ini ke petugas saat bertemu
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleResetManual}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition cursor-pointer active:scale-95"
            >
              <ArrowRight size={16} />
              Isi Tamu Baru
            </button>
          </div>

          <p className="text-center text-xs text-slate-600">
            Halaman akan reset otomatis dalam 10 detik
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
        
        {/* ✅ HEADER KIOSK DENGAN LIVE CLOCK */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-500/10 p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
            <div className="text-center sm:text-left flex items-center gap-4">
              <div className="p-3.5 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/40 shrink-0 shadow-lg shadow-indigo-500/20">
                <UserCheck size={28} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Selamat Datang 👋
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Silakan isi data kunjungan Anda di bawah ini
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <p className="text-5xl sm:text-6xl font-black text-white tracking-tighter tabular-nums">
                {currentTime.toLocaleTimeString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                <span className="text-xl text-indigo-400 ml-1">WIB</span>
              </p>
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-center sm:justify-end gap-1.5 font-semibold">
                <Calendar size={12} />
                {currentTime.toLocaleDateString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
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
                  hint: s.kelas_nama ?? undefined,
                  searchText: `${s.nisn} ${s.kelas_nama ?? ''}`,
                }))}
                value={form.siswa_id}
                onChange={(v) => setForm({ ...form, siswa_id: v })}
                placeholder="Pilih Nama Siswa"
                searchPlaceholder="Cari nama siswa / NISN / kelas..."
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
                    {/* ✅ Countdown Overlay */}
                    {countdown !== null && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                        <p className="text-7xl font-black text-white animate-ping">
                          {countdown}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={countdown !== null}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {countdown !== null ? 'Bersiap...' : '📸 Ambil Foto'}
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