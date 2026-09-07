import { useState } from 'react';
import { LayoutDashboard, Mail, Lock, User, Loader2, CreditCard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';

type Mode = 'signin' | 'signup';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [nip, setNip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError);
        }
      } else {
        if (!namaLengkap || !nip) {
          setError('Semua field harus diisi');
          setLoading(false);
          return;
        }

        const { error: signUpError, user } = await signUp(
          email,
          password,
          namaLengkap,
          nip
        );

        if (signUpError) {
          setError(signUpError);
        } else if (user) {
          showToast('success', 'Akun guru berhasil dibuat. Silakan masuk.');
          setMode('signin');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan tidak terduga');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header Header & Branding */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-2xl shadow-lg shadow-indigo-500/10 mb-4">
            <LayoutDashboard size={32} />
          </div>
<h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
  <span className="block">SMK KH. A. WAHAB MUHSIN</span>
  <span className="block text-xl text-slate-300 font-bold mt-1">Sistem Informasi Proses Memuliakan Murid</span>
</h1>

          <p className="text-sm text-slate-400 mt-1">
            {mode === 'signin' ? 'Masuk sebagai guru' : 'Daftar akun guru baru'}
          </p>
        </div>

        {/* Container Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="text"
                      value={namaLengkap}
                      onChange={(e) => setNamaLengkap(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                      placeholder="Nama lengkap guru"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    NIP
                  </label>
                  <div className="relative">
                    <CreditCard
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                      placeholder="Nomor Induk Pegawai"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                  placeholder="email@sekolah.id"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                  placeholder="Minimal 6 karakter"
                  minLength={6}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-xl p-3.5 backdrop-blur-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transform hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {mode === 'signin' ? 'Masuk' : 'Daftar'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            {mode === 'signin' ? (
              <>
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                  className="text-indigo-400 font-semibold hover:text-indigo-300 hover:underline transition-colors cursor-pointer"
                >
                  Daftar di sini
                </button>
              </>
            ) : (
              <>
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                  }}
                  className="text-indigo-400 font-semibold hover:text-indigo-300 hover:underline transition-colors cursor-pointer"
                >
                  Masuk di sini
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}