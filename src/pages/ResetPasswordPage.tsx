// src/pages/ResetPasswordPage.tsx
// Halaman reset password — user buka dari link di email.

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle,
  ShieldCheck, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);

  // ==========================================================================
  // CEK SESSION — Supabase auto-handle token dari URL hash
  // ==========================================================================
  useEffect(() => {
    (async () => {
      // Supabase akan auto-parse hash token dari URL setelah redirect
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setTokenValid(true);
      } else {
        // Coba recover session dari hash URL
        const { data, error } = await supabase.auth.getUser();
        if (data?.user && !error) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
        }
      }
      setCheckingToken(false);
    })();

    // Listen auth state change (untuk PASSWORD_RECOVERY event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (session?.user && event === 'SIGNED_IN')) {
          setTokenValid(true);
          setCheckingToken(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ==========================================================================
  // VALIDASI PASSWORD
  // ==========================================================================
  const passwordStrength = (() => {
    if (!password) return { level: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 1, label: 'Lemah', color: 'text-rose-400' };
    if (score <= 3) return { level: 2, label: 'Sedang', color: 'text-amber-400' };
    if (score <= 4) return { level: 3, label: 'Kuat', color: 'text-emerald-400' };
    return { level: 4, label: 'Sangat Kuat', color: 'text-emerald-400' };
  })();

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      showToast('error', 'Password minimal 6 karakter');
      return;
    }
    if (password !== confirmPassword) {
      showToast('error', 'Konfirmasi password tidak cocok');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      showToast('success', 'Password berhasil diubah');

      // Auto-redirect ke dashboard setelah 3 detik
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
    } catch (err: any) {
      showToast('error', 'Gagal reset password: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (checkingToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-400 mx-auto mb-3" size={40} />
          <p className="text-sm text-slate-400">Memverifikasi link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid && !success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-rose-500/5 border border-rose-500/30 rounded-3xl p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-lg font-extrabold text-rose-300">
              Link Tidak Valid
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Link reset password sudah kadaluarsa atau tidak valid.
              Silakan minta link baru.
            </p>
            <div className="pt-3">
              <Link
                to="/forgot-password"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition"
              >
                Minta Link Baru
              </Link>
            </div>
          </div>
          <div className="text-center mt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition"
            >
              <ArrowLeft size={13} /> Kembali ke Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-3xl p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-lg font-extrabold text-emerald-300">
              Password Berhasil Diubah!
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Anda akan otomatis masuk ke aplikasi dalam 3 detik...
            </p>
            <div className="flex items-center justify-center gap-2 pt-3">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              <span className="text-xs text-slate-500">Mengalihkan...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // FORM RESET PASSWORD
  // ==========================================================================
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 mb-3">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Buat Password Baru
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Masukkan password baru untuk akun Anda
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* PASSWORD BARU */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Password Baru *
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength indicator */}
              {password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-950 rounded-full overflow-hidden flex gap-0.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-full rounded-full transition-all ${
                          i <= passwordStrength.level
                            ? passwordStrength.level <= 1
                              ? 'bg-rose-500'
                              : passwordStrength.level <= 2
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-[10px] font-bold ${passwordStrength.color}`}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* KONFIRMASI */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Konfirmasi Password *
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border text-slate-200 text-sm focus:outline-none focus:ring-2 transition ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-rose-500/50 focus:ring-rose-500/30 focus:border-rose-500'
                      : 'border-slate-800 focus:ring-indigo-500/30 focus:border-indigo-500'
                  }`}
                  required
                />
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-[10px] text-rose-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={10} /> Password tidak cocok
                </p>
              )}
            </div>

            {/* INFO */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                💡 <span className="font-bold text-slate-300">Tips password kuat:</span>{' '}
                Gabungkan huruf besar, kecil, angka, dan simbol. Minimal 10 karakter
                untuk keamanan ekstra.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Menyimpan...</>
              ) : (
                <><ShieldCheck size={16} /> Simpan Password Baru</>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition"
          >
            <ArrowLeft size={13} /> Kembali ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}