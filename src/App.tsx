import { lazy, Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastContainer } from '@/components/Toast';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import type { PageKey } from '@/config/navigation';

// Lazy load seluruh halaman untuk optimasi bundle
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const SiswaPage = lazy(() => import('@/pages/SiswaPage').then((m) => ({ default: m.SiswaPage })));
const KelasPage = lazy(() => import('@/pages/KelasPage').then((m) => ({ default: m.KelasPage })));
const NilaiPage = lazy(() => import('@/pages/NilaiPage').then((m) => ({ default: m.NilaiPage })));
const PresensiPage = lazy(() => import('@/pages/PresensiPage').then((m) => ({ default: m.PresensiPage })));
const AgendaPage = lazy(() => import('@/pages/AgendaPage').then((m) => ({ default: m.AgendaPage })));
const IzinPage = lazy(() => import('@/pages/IzinPage').then((m) => ({ default: m.IzinPage })));
const PiketPage = lazy(() => import('@/pages/PiketPage').then((m) => ({ default: m.PiketPage })));
const SekolahPage = lazy(() => import('@/pages/SekolahPage').then((m) => ({ default: m.SekolahPage })));
const PengumumanPage = lazy(() => import('@/pages/PengumumanPage').then((m) => ({ default: m.PengumumanPage })));
const GuruPage = lazy(() => import('@/pages/GuruPage').then((m) => ({ default: m.GuruPage })));
const JadwalKbmPage = lazy(() => import('@/pages/JadwalKbmPage').then((m) => ({ default: m.JadwalKbmPage })));
const JadwalKbmJpsPage = lazy(() => import('@/pages/JadwalKbmJpsPage').then((m) => ({ default: m.JadwalKbmJpsPage })));
const JadwalPiketPage = lazy(() => import('@/pages/JadwalPiketPage').then((m) => ({ default: m.JadwalPiketPage })));
const RekapPresensiSiswaPage = lazy(() => import('@/pages/RekapPresensiSiswaPage').then((m) => ({ default: m.RekapPresensiSiswaPage })));
const RekapNilaiPage = lazy(() => import('@/pages/RekapNilaiPage').then((m) => ({ default: m.RekapNilaiPage })));
const RekapPresensiGuruPage = lazy(() => import('@/pages/RekapPresensiGuruPage').then((m) => ({ default: m.RekapPresensiGuruPage })));
const RekapAgendaPage = lazy(() => import('@/pages/RekapAgendaPage').then((m) => ({ default: m.RekapAgendaPage })));
const RekapIzinPage = lazy(() => import('@/pages/RekapIzinPage').then((m) => ({ default: m.RekapIzinPage })));
const ProfilPage = lazy(() => import('@/pages/ProfilPage').then((m) => ({ default: m.ProfilPage })));
const HakAksesPage = lazy(() => import('@/pages/HakAksesPage').then((m) => ({ default: m.HakAksesPage })));
const BukuTamuPage = lazy(() => import('@/pages/BukuTamuPage').then((m) => ({ default: m.BukuTamuPage })));
const SuratPage = lazy(() => import('@/pages/SuratPage').then((m) => ({ default: m.SuratPage })));
const TugasDisposisiPage = lazy(() => import('@/pages/TugasDisposisiPage').then((m) => ({ default: m.TugasDisposisiPage })));

// Halaman Piket
const JadwalPiketPenyambutanPage = lazy(() => import('@/pages/JadwalPiketPenyambutanPage').then((m) => ({ default: m.JadwalPiketPenyambutanPage })));
const KehadiranPiketPenyambutanPage = lazy(() => import('@/pages/KehadiranPiketPenyambutanPage').then((m) => ({ default: m.KehadiranPiketPenyambutanPage })));
const KehadiranPiketPage = lazy(() => import('@/pages/KehadiranPiketPage').then((m) => ({ default: m.KehadiranPiketPage })));

// Halaman To-Do List Divisi
const TodoListPage = lazy(() => import('@/pages/TodoListPage').then((m) => ({ default: m.TodoListPage })));

// Halaman Presensi Kesiswaan
const InputPresensiKesiswaanPage = lazy(() => import('@/pages/InputPresensiKesiswaanPage').then((m) => ({ default: m.InputPresensiKesiswaanPage })));
const RekapPresensiKesiswaanPage = lazy(() => import('@/pages/RekapPresensiKesiswaanPage').then((m) => ({ default: m.RekapPresensiKesiswaanPage })));

// Modul Kesiswaan Baru
const KenaikanKelas = lazy(() => import('@/pages/KenaikanKelas').then((m) => ({ default: m.KenaikanKelas })));
const Kelulusan = lazy(() => import('@/pages/Kelulusan').then((m) => ({ default: m.Kelulusan })));
const RiwayatSiswa = lazy(() => import('@/pages/RiwayatSiswa').then((m) => ({ default: m.RiwayatSiswa })));
const MutasiSiswa = lazy(() => import('@/pages/MutasiSiswa').then((m) => ({ default: m.MutasiSiswa })));

function PageLoadingFallback() {
  return (
    <div className="flex-1 min-h-[60vh] flex items-center justify-center">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-12 h-12 rounded-full bg-indigo-500/20 animate-ping" />
        <Loader2 className="animate-spin text-indigo-400 relative z-10" size={36} />
      </div>
    </div>
  );
}

function ProtectedRoute({ accessKey, children }: { accessKey?: PageKey; children: JSX.Element }) {
  const { hasAccess } = useAuth();
  if (accessKey && !hasAccess(accessKey)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppContent() {
  const { session, loading, guru } = useAuth();
  const location = useLocation();
  const [badgeCounts, setBadgeCounts] = useState<Partial<Record<PageKey, number>>>({});

  // Real-time listener Supabase berdasar nama_lengkap pada tabel disposisi_surat
  useEffect(() => {
    if (!guru?.nama_lengkap) return;

    const fetchPendingCount = async () => {
      const { count, error } = await supabase
        .from('disposisi_surat')
        .select('*', { count: 'exact', head: true })
        .eq('penerima_disposisi', guru.nama_lengkap)
        .neq('status', 'SELESAI');

      if (!error && count !== null) {
        setBadgeCounts((prev) => ({ ...prev, tugas_disposisi: count }));
      }
    };

    fetchPendingCount();

    const channel = supabase
      .channel('disposisi-badge-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'disposisi_surat',
          filter: `penerima_disposisi=eq.${guru.nama_lengkap}`,
        },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guru?.nama_lengkap]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-16 h-16 rounded-full bg-indigo-500/20 animate-ping" />
          <Loader2 className="animate-spin text-indigo-400 relative z-10" size={40} />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LoginPage />
      </Suspense>
    );
  }

  const currentPath = (location.pathname.replace('/', '') || 'dashboard') as PageKey;

  return (
    <AppLayout current={currentPath} badgeCounts={badgeCounts}>
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profil" element={<ProfilPage />} />
          <Route path="/todo" element={<ProtectedRoute accessKey="todo"><TodoListPage /></ProtectedRoute>} />
          <Route path="/siswa" element={<ProtectedRoute accessKey="siswa"><SiswaPage /></ProtectedRoute>} />
          <Route path="/kelas" element={<ProtectedRoute accessKey="kelas"><KelasPage /></ProtectedRoute>} />
          <Route path="/nilai" element={<ProtectedRoute accessKey="nilai"><NilaiPage /></ProtectedRoute>} />
          <Route path="/presensi" element={<ProtectedRoute accessKey="presensi"><PresensiPage /></ProtectedRoute>} />
          <Route path="/surat" element={<ProtectedRoute accessKey="surat"><SuratPage /></ProtectedRoute>} />
          <Route path="/tugas_disposisi" element={<ProtectedRoute accessKey="tugas_disposisi"><TugasDisposisiPage /></ProtectedRoute>} />

          {/* Rute Modul Kesiswaan */}
          <Route path="/kenaikan_kelas" element={<ProtectedRoute accessKey="kenaikan_kelas"><KenaikanKelas /></ProtectedRoute>} />
          <Route path="/kelulusan" element={<ProtectedRoute accessKey="kelulusan"><Kelulusan /></ProtectedRoute>} />
          <Route path="/riwayat_siswa" element={<ProtectedRoute accessKey="riwayat_siswa"><RiwayatSiswa /></ProtectedRoute>} />
          <Route path="/mutasi_siswa" element={<ProtectedRoute accessKey="mutasi_siswa"><MutasiSiswa /></ProtectedRoute>} />

          {/* Rute Presensi Kesiswaan */}
          <Route path="/presensi_kesiswaan" element={<ProtectedRoute accessKey="presensi_kesiswaan"><InputPresensiKesiswaanPage /></ProtectedRoute>} />

          <Route path="/agenda" element={<ProtectedRoute accessKey="agenda"><AgendaPage /></ProtectedRoute>} />
          <Route path="/izin" element={<ProtectedRoute accessKey="izin"><IzinPage /></ProtectedRoute>} />
          <Route path="/piket" element={<ProtectedRoute accessKey="piket"><PiketPage /></ProtectedRoute>} />
          <Route path="/sekolah" element={<ProtectedRoute accessKey="sekolah"><SekolahPage /></ProtectedRoute>} />
          <Route path="/pengumuman" element={<ProtectedRoute accessKey="pengumuman"><PengumumanPage /></ProtectedRoute>} />
          <Route path="/guru" element={<ProtectedRoute accessKey="guru"><GuruPage /></ProtectedRoute>} />
          <Route path="/jadwal_kbm" element={<ProtectedRoute accessKey="jadwal_kbm"><JadwalKbmPage /></ProtectedRoute>} />
          <Route path="/jadwal_kbm_jps" element={<ProtectedRoute accessKey="jadwal_kbm_jps"><JadwalKbmJpsPage /></ProtectedRoute>} />
          <Route path="/jadwal_piket" element={<ProtectedRoute accessKey="jadwal_piket"><JadwalPiketPage /></ProtectedRoute>} />
          <Route path="/jadwal_piket_penyambutan" element={<ProtectedRoute accessKey="jadwal_piket_penyambutan"><JadwalPiketPenyambutanPage /></ProtectedRoute>} />
          <Route path="/kehadiran_piket" element={<ProtectedRoute accessKey="kehadiran_piket"><KehadiranPiketPage /></ProtectedRoute>} />
          <Route path="/kehadiran_piket_penyambutan" element={<ProtectedRoute accessKey="kehadiran_piket_penyambutan"><KehadiranPiketPenyambutanPage /></ProtectedRoute>} />
          <Route path="/rekap_presensi_siswa" element={<ProtectedRoute accessKey="rekap_presensi_siswa"><RekapPresensiSiswaPage /></ProtectedRoute>} />

          {/* Rute Rekap Presensi Kesiswaan */}
          <Route path="/rekap_presensi_kesiswaan" element={<ProtectedRoute accessKey="rekap_presensi_kesiswaan"><RekapPresensiKesiswaanPage /></ProtectedRoute>} />
          <Route path="/rekap_nilai" element={<ProtectedRoute accessKey="rekap_nilai"><RekapNilaiPage /></ProtectedRoute>} />
          <Route path="/rekap_presensi_guru" element={<ProtectedRoute accessKey="rekap_presensi_guru"><RekapPresensiGuruPage /></ProtectedRoute>} />
          <Route path="/rekap_agenda" element={<ProtectedRoute accessKey="rekap_agenda"><RekapAgendaPage /></ProtectedRoute>} />
          <Route path="/rekap_izin" element={<ProtectedRoute accessKey="rekap_izin"><RekapIzinPage /></ProtectedRoute>} />
          <Route path="/hak_akses" element={<ProtectedRoute accessKey="hak_akses"><HakAksesPage /></ProtectedRoute>} />
          <Route path="/buku_tamu" element={<ProtectedRoute accessKey="buku_tamu"><BukuTamuPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
        <ToastContainer />
      </BrowserRouter>
    </AuthProvider>
  );
}