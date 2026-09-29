// src/pages/ForgotPasswordPage.tsx
// Halaman "Lupa Password" — cek email dulu sebelum kirim link reset.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Mail, ArrowLeft, CheckCircle2, AlertTriangle, Send,
  HelpCircle, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';

type PageState =
  | { type: 'form' }
  | { type: 'sent'; email: string }
  | { type: 'not_registered'; email: string };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<PageState>({ type: 'form' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      showToast('error', 'Email wajib diisi');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showToast('error', 'Format email tidak valid');
      return;
    }

    setLoading(true);
    try {
      // ────────────────────────────────────────────────────────────────
      // STEP 1: Cek apakah email terdaftar di tabel gurus
      // ────────────────────────────────────────────────────────────────
      const { data: isRegistered, error: rpcError } = await supabase
        .rpc('check_email_registered', { p_email: trimmedEmail });

      if (rpcError) {
        console.warn('[forgot-password] RPC error:', rpcError);
        // Kalau RPC gagal, tetap lanjut ke step 2 (fail-safe)
      }

      // Kalau RPC sukses & email tidak terdaftar → tampil pesan spesifik
      if (!rpcError && isRegistered === false) {
        setState({ type: 'not_registered', email: trimmedEmail });
        return;
      }

      // ────────────────────────────────────────────────────────────────
      // STEP 2: Kirim link reset
      // ────────────────────────────────────────────────────────────────
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (resetError) throw resetError;

      setState({ type: 'sent', email: trimmedEmail });
    } catch (err: any) {
      showToast('error', 'Gagal kirim email: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEmail('');
    setState({ type: 'form' });
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 mb-3">
            <Mail size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Lupa Password
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Kami akan kirim link reset ke email Anda
          </p>
        </div>

        {/* ===================== STATE: SENT ===================== */}
        {state.type === 'sent' && (
          <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-3xl p-6 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="text-lg font-extrabold text-emerald-300">
              Email Terkirim!
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Kami sudah mengirim link reset password ke{' '}
              <span className="font-bold text-slate-200">{state.email}</span>.
              <br />
              Cek inbox atau folder spam Anda.
            </p>
            <div className="pt-3 border-t border-emerald-500/20">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Link berlaku 1 jam. Tidak menerima email dalam 5 menit?
                Coba kirim ulang.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 text-[11px] text-indigo-400 hover:text-indigo-300 font-bold transition cursor-pointer"
            >
              ← Kirim ke email lain
            </button>
          </div>
        )}

        {/* ===================== STATE: NOT REGISTERED ===================== */}
        {state.type === 'not_registered' && (
          <div className="bg-rose-500/5 border border-rose-500/30 rounded-3xl p-6 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-lg font-extrabold text-rose-300">
              Email Tidak Terdaftar
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Email <span className="font-bold text-slate-200">{state.email}</span>{' '}
              tidak ditemukan di sistem kami.
            </p>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-left space-y-1.5">
              <p className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <HelpCircle size={11} /> Yang bisa Anda lakukan:
              </p>
              <ul className="text-[11px] text-slate-400 space-y-1 pl-4">
                <li>• Cek ejaan email (typo sering terjadi)</li>
                <li>• Coba email kantor yang terdaftar</li>
                <li>• Hubungi admin/HR kalau lupa email terdaftar</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <ArrowLeft size={12} /> Coba Email Lain
            </button>
          </div>
        )}

        {/* ===================== STATE: FORM ===================== */}
        {state.type === 'form' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            {/* INFO BOX — Security notice */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2.5">
              <ShieldCheck size={13} className="text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Masukkan email yang terdaftar di sistem. Kami akan verifikasi
                dan kirim link reset ke email tersebut.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Email Terdaftar *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@smk-wahabmuhsin.sch.id"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Memverifikasi...</>
                ) : (
                  <><Send size={16} /> Kirim Link Reset</>
                )}
              </button>
            </form>
          </div>
        )}

        {/* BACK TO LOGIN */}
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