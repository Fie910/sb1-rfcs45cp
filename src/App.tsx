import { Loader2 } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastContainer } from '@/components/Toast';
import { AppLayout } from '@/components/AppLayout';
import type { PageKey } from '@/config/navigation';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SiswaPage } from '@/pages/SiswaPage';
import { KelasPage } from '@/pages/KelasPage';
import { NilaiPage } from '@/pages/NilaiPage';
import { PresensiPage } from '@/pages/PresensiPage';
import { AgendaPage } from '@/pages/AgendaPage';
import { IzinPage } from '@/pages/IzinPage';
import { PiketPage } from '@/pages/PiketPage';
import { SekolahPage } from '@/pages/SekolahPage';
import { PengumumanPage } from '@/pages/PengumumanPage';
import { GuruPage } from '@/pages/GuruPage';
import { JadwalKbmPage } from '@/pages/JadwalKbmPage';
import { JadwalPiketPage } from '@/pages/JadwalPiketPage';
import { RekapPresensiSiswaPage } from '@/pages/RekapPresensiSiswaPage';
import { RekapNilaiPage } from '@/pages/RekapNilaiPage';
import { RekapPresensiGuruPage } from '@/pages/RekapPresensiGuruPage';
import { RekapAgendaPage } from '@/pages/RekapAgendaPage';
import { RekapIzinPage } from '@/pages/RekapIzinPage';
import { JadwalKbmJpsPage } from '@/pages/JadwalKbmJpsPage';
import { ProfilPage } from '@/pages/ProfilPage';
import { HakAksesPage } from '@/pages/HakAksesPage';

// Import Halaman Piket
import { JadwalPiketPenyambutanPage } from '@/pages/JadwalPiketPenyambutanPage';
import { KehadiranPiketPenyambutanPage } from '@/pages/KehadiranPiketPenyambutanPage';
import { KehadiranPiketPage } from '@/pages/KehadiranPiketPage';

// Import Halaman To-Do List Divisi
import { TodoListPage } from '@/pages/TodoListPage';

// Import Halaman Presensi Kesiswaan
import { InputPresensiKesiswaanPage } from '@/pages/InputPresensiKesiswaanPage';
import { RekapPresensiKesiswaanPage } from '@/pages/RekapPresensiKesiswaanPage';

// Import Halaman Modul Kesiswaan Baru
import { KenaikanKelas } from '@/pages/KenaikanKelas';
import { Kelulusan } from '@/pages/Kelulusan';
import { RiwayatSiswa } from '@/pages/RiwayatSiswa';
import { MutasiSiswa } from '@/pages/MutasiSiswa';

import { testConnection } from '@/lib/testConnection';

testConnection();

function ProtectedRoute({ accessKey, children }: { accessKey?: string; children: JSX.Element }) {
  const { hasAccess } = useAuth();
  if (accessKey && !hasAccess(accessKey)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppContent() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const currentPath = (location.pathname.replace('/', '') || 'dashboard') as PageKey;

  const handleNavigate = (pageKey: PageKey) => {
    navigate(`/${pageKey === 'dashboard' ? '' : pageKey}`);
  };

  return (
    <AppLayout current={currentPath} onNavigate={handleNavigate}>
      <Routes>
        <Route path="/" element={<DashboardPage onNavigate={handleNavigate} />} />
        <Route path="/dashboard" element={<DashboardPage onNavigate={handleNavigate} />} />
        <Route path="/profil" element={<ProfilPage />} />

        <Route path="/todo" element={<ProtectedRoute accessKey="todo"><TodoListPage /></ProtectedRoute>} />

        <Route path="/siswa" element={<ProtectedRoute accessKey="siswa"><SiswaPage /></ProtectedRoute>} />
        <Route path="/kelas" element={<ProtectedRoute accessKey="kelas"><KelasPage /></ProtectedRoute>} />
        <Route path="/nilai" element={<ProtectedRoute accessKey="nilai"><NilaiPage /></ProtectedRoute>} />
        <Route path="/presensi" element={<ProtectedRoute accessKey="presensi"><PresensiPage /></ProtectedRoute>} />
        
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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