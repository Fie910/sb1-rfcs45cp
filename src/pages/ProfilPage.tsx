import { useState, useEffect } from 'react';
import { User, Hash, Save, Loader2, Lock, KeyRound, CheckCircle2, Sparkles, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';

export function ProfilPage() {
  const { user, guru, refreshGuru } = useAuth();

  const [namaLengkap, setNamaLengkap] = useState('');
  const [nip, setNip] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

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
        .update({
          nama_lengkap: namaLengkap,
          nip: nip,
        })
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

    if (newPassword.length < 6) {
      setPasswordError('Password minimal 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok.');
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

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

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      {/* CARD 1: INFORMASI PROFIL */}
      <div className="relative group overflow-hidden bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl backdrop-blur-xl">
        {/* Glow ambient effect */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-800 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Informasi Profil</h1>
            <p className="text-slate-400 text-sm mt-0.5">Kelola identitas diri Anda</p>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-6 relative z-10">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Nama Lengkap
            </label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium placeholder-slate-500 shadow-inner focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                placeholder="Nama lengkap beserta gelar"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              NIP / NUPTK
            </label>
            <div className="relative">
              <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium placeholder-slate-500 shadow-inner focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                placeholder="Nomor Induk Pegawai"
              />
            </div>
          </div>

          {profileError && (
            <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
              <ShieldAlert size={18} className="shrink-0 text-rose-400" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={profileLoading}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transform hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {profileLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Simpan Profil
            </button>
          </div>
        </form>
      </div>

      {/* CARD 2: KEAMANAN & UBAH PASSWORD */}
      <div className="relative group overflow-hidden bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl backdrop-blur-xl">
        {/* Glow ambient effect */}
        <div className="absolute bottom-0 right-0 -mb-10 -mr-10 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-800 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center shadow-lg shadow-slate-950/50">
            <Lock size={22} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">Keamanan Akun</h2>
            <p className="text-slate-400 text-sm mt-0.5">Perbarui password akun Anda secara berkala</p>
          </div>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-6 relative z-10">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Password Baru
            </label>
            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium placeholder-slate-500 shadow-inner focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                placeholder="Minimal 6 karakter"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Konfirmasi Password
            </label>
            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium placeholder-slate-500 shadow-inner focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                placeholder="Ulangi password baru"
                required
              />
            </div>
          </div>

          {passwordError && (
            <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
              <ShieldAlert size={18} className="shrink-0 text-rose-400" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl border border-slate-700/80 shadow-lg shadow-slate-950/40 hover:shadow-slate-950/60 transform hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {passwordLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Ubah Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}