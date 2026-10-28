//src/pages/ProfilPage.tsx
import { useState, useEffect } from 'react';
import { User, Hash, Save, Loader2, Lock, KeyRound, CheckCircle2, ShieldAlert, BookHeart, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { KartuKehadiran } from '@/components/profil/KartuKehadiran';
import { ProfileHero } from '@/components/profil/ProfileHero';

type TabKey = 'identitas' | 'kehadiran' | 'keamanan';

export function ProfilPage() {
  const { user, guru, refreshGuru } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('kehadiran');

  // State Profil
  const [namaLengkap, setNamaLengkap] = useState('');
  const [nip, setNip] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  // State Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    if (guru) {
      setNamaLengkap(guru.nama_lengkap || '');
      setNip(guru.nip || '');
    }
  }, [guru]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileLoading(true);
    setProfileError('');
    try {
      const { error: updateError } = await supabase
        .from('gurus')
        .update({ nama_lengkap: namaLengkap, nip: nip })
        .eq('id', user.id);
      if (updateError) throw updateError;
      await refreshGuru();
      showToast('success', 'Profil berhasil diperbarui!');
    } catch (err: any) {
      setProfileError(err.message || 'Gagal memperbarui profil');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword.length < 6) { setPasswordError('Password minimal 6 karakter.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Konfirmasi password tidak cocok.'); return; }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess('Password berhasil diubah!');
      setNewPassword('');
      setConfirmPassword('');
      showToast('success', 'Password berhasil diubah!');
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal mengubah password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const tabs = [
    { id: 'identitas', label: 'Identitas Diri', icon: User },
    { id: 'kehadiran', label: 'Catatan Kehadiran', icon: BookHeart },
    { id: 'keamanan', label: 'Keamanan Akun', icon: ShieldCheck },
  ] as const;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      
      {/* 1. HERO PROFILE */}
      <ProfileHero guru={guru} />

      {/* 2. TAB NAVIGATION */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabKey)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. CONTENT AREA */}
      <div className="animate-fade-in-up">
        
        {/* --- TAB IDENTITAS --- */}
        {activeTab === 'identitas' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Form Kiri (2/3) */}
            <div className="md:col-span-2 bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
              
              <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                <User size={18} className="text-indigo-400" /> Edit Informasi Profil
              </h2>
              
              <form onSubmit={handleUpdateProfile} className="space-y-5 relative z-10">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Nama Lengkap</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">NIP / NUPTK</label>
                  <div className="relative">
                    <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" value={nip} onChange={(e) => setNip(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                </div>

                {profileError && (
                  <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-xl p-4 flex items-center gap-3">
                    <ShieldAlert size={18} className="shrink-0 text-rose-400" /> <span>{profileError}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button type="submit" disabled={profileLoading}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer">
                    {profileLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>

            {/* Info Kanan (1/3) */}
            <div className="md:col-span-1 space-y-4">
              <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Informasi Akun</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-slate-500 mb-0.5">Email</p>
                    <p className="text-sm font-medium text-slate-200 truncate">{guru?.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-0.5">Jabatan / Role</p>
                    <p className="text-sm font-medium text-slate-200 capitalize">{guru?.role?.replace(/_/g, ' ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-0.5">Divisi</p>
                    <p className="text-sm font-medium text-slate-200">{guru?.divisis?.nama_divisi || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-0.5">Terdaftar Sejak</p>
                    <p className="text-sm font-medium text-slate-200">
                      {guru?.created_at ? new Date(guru.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 rounded-3xl p-5 border border-indigo-500/20 shadow-xl">
                <p className="text-xs text-indigo-300 font-semibold mb-1">💡 Tahukah Anda?</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Pastikan nama dan NIP Anda sesuai dengan data kepegawaian resmi. Data ini digunakan untuk cetak otomatis Surat Tugas dan Surat Keputusan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB KEHADIRAN --- */}
        {activeTab === 'kehadiran' && (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
            <KartuKehadiran />
          </div>
        )}

        {/* --- TAB KEAMANAN --- */}
        {activeTab === 'keamanan' && (
          <div className="bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl max-w-2xl mx-auto relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
            
            <div className="text-center mb-8 relative z-10">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center mb-3">
                <Lock size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Ubah Password</h2>
              <p className="text-xs text-slate-400 mt-1">Disarankan mengganti password setiap 3 bulan sekali.</p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-5 relative z-10">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Password Baru</label>
                <div className="relative">
                  <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Konfirmasi Password</label>
                <div className="relative">
                  <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password baru"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all" required />
                </div>
              </div>

              {passwordError && (
                <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-xl p-4 flex items-center gap-3">
                  <ShieldAlert size={18} className="shrink-0 text-rose-400" /> <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-400" /> <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="pt-2">
                <button type="submit" disabled={passwordLoading}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl border border-slate-700 shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer">
                  {passwordLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Perbarui Password
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}