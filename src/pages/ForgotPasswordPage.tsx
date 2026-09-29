// src/pages/ForgotPasswordPage.tsx
// Halaman "Lupa Password" — user input email untuk kirim link reset.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Mail, ArrowLeft, CheckCircle2, AlertTriangle, Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('error', 'Email wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      showToast('error', 'Gagal kirim email: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

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

        {sent ? (
          /* SUCCESS STATE */
          <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-3xl p-6 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="text-lg font-extrabold text-emerald-300">
              Email Terkirim!
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Kami sudah mengirim link reset password ke{' '}
              <span className="font-bold text-slate-200">{email}</span>.
              <br />
              Cek inbox atau folder spam Anda.
            </p>
            <div className="pt-3 border-t border-emerald-500/20">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Link berlaku 1 jam. Kalau tidak menerima email dalam 5 menit,
                coba kirim ulang.
              </p>
            </div>
          </div>
        ) : (
          /* FORM STATE */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle size={13} className="text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Masukkan email yang terdaftar di sistem. Kami akan kirim link
                untuk membuat password baru.
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
                  <><Loader2 size={16} className="animate-spin" /> Mengirim...</>
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