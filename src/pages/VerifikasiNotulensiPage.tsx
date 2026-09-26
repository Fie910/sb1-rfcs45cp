// src/pages/VerifikasiNotulensiPage.tsx
// Halaman publik verifikasi notulensi rapat via QR scan (tanpa login).
// Hybrid A+B: verifikasi token + hash content.

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Loader2, ShieldCheck, ShieldX, ShieldAlert, Calendar, User,
  FileText, CheckCircle2, AlertTriangle, Hash, Clock, MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type VerifData = {
  id: string;
  verification_token: string;
  ringkasan: string | null;
  status_notulensi: string;
  approved_at: string | null;
  pdf_generated_at: string | null;
  content_hash: string | null;
  frozen_at: string | null;
  nomor_rapat: string;
  judul_rapat: string;
  jenis_rapat: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string | null;
  lokasi: string | null;
  penyelenggara: string | null;
  status_rapat: string;
  pemimpin_nama: string | null;
  notulis_nama: string | null;
  total_peserta: number;
  total_hadir: number;
};

type HashStatus = 'valid' | 'mismatch' | 'no_hash' | 'not_specified';

export default function VerifikasiNotulensiPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const hashFromQr = searchParams.get('h');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifData | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      try {
        const { data: result, error } = await supabase
          .from('v_rapat_notulensi_verifikasi')
          .select('*')
          .eq('verification_token', token)
          .maybeSingle();
        if (error) console.error('[verif-notulensi]', error);
        else setData(result as VerifData | null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const hashStatus: HashStatus = (() => {
    if (!data) return 'not_specified';
    if (!hashFromQr) return 'not_specified';
    if (!data.content_hash) return 'no_hash';
    return data.content_hash.slice(0, 16) === hashFromQr ? 'valid' : 'mismatch';
  })();

  const formatTanggal = (d: string) =>
    new Date(`${d.split('T')[0]}T00:00:00+07:00`).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 mb-3">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Verifikasi Notulensi
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistem Verifikasi Keaslian Dokumen Rapat
          </p>
        </div>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
            <Loader2 className="animate-spin text-indigo-400 mx-auto mb-3" size={32} />
            <p className="text-sm text-slate-400">Memverifikasi notulensi...</p>
          </div>
        ) : !data ? (
          <div className="bg-rose-500/5 border border-rose-500/30 rounded-3xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-4">
              <ShieldX size={32} />
            </div>
            <h2 className="text-lg font-bold text-rose-300 mb-2">
              NOTULENSI TIDAK VALID
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Notulensi dengan kode verifikasi ini tidak ditemukan, atau belum
              difinalisasi secara resmi.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold">
              <AlertTriangle size={12} /> Kemungkinan dokumen palsu
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <StatusBanner hashStatus={hashStatus} />

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="pb-3 border-b border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Nomor Rapat
                </p>
                <p className="text-sm font-mono font-bold text-slate-100 mt-0.5">
                  {data.nomor_rapat}
                </p>
                <p className="text-xs text-slate-300 mt-1.5 font-semibold">
                  {data.judul_rapat}
                </p>
              </div>

              <Row icon={FileText} label="Jenis Rapat" value={data.jenis_rapat} />
              <Row icon={Calendar} label="Tanggal" value={formatTanggal(data.tanggal)} />
              <Row
                icon={Clock}
                label="Waktu"
                value={`${data.waktu_mulai?.slice(0, 5)} — ${data.waktu_selesai?.slice(0, 5) ?? '?'} WIB`}
              />
              {data.lokasi && <Row icon={MapPin} label="Lokasi" value={data.lokasi} />}
              <Row icon={User} label="Pemimpin" value={data.pemimpin_nama ?? '-'} />
              <Row icon={User} label="Notulis" value={data.notulis_nama ?? '-'} />
              <Row
                icon={User}
                label="Peserta"
                value={`${data.total_peserta} orang (${data.total_hadir} hadir)`}
              />

              {data.ringkasan && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                    Ringkasan
                  </p>
                  <p className="text-xs text-slate-200 leading-relaxed">{data.ringkasan}</p>
                </div>
              )}

              {data.content_hash && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1">
                    <Hash size={10} /> SHA-256 Content Hash
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 break-all leading-relaxed">
                    {data.content_hash}
                  </p>
                </div>
              )}

              {data.frozen_at && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 italic flex items-center gap-1">
                    <Clock size={10} />
                    Dokumen dikunci:{' '}
                    {new Date(data.frozen_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                  </p>
                </div>
              )}

              {data.pdf_generated_at && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 italic">
                    Notulensi dicetak:{' '}
                    {new Date(data.pdf_generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                  </p>
                </div>
              )}
            </div>

            <p className="text-center text-[10px] text-slate-500 leading-relaxed">
              Halaman ini dihasilkan otomatis oleh Sistem Informasi Sekolah.
              <br />
              Keaslian dokumen dijamin oleh hash kriptografis SHA-256.
            </p>
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition">
            ← Kembali ke Aplikasi
          </Link>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: Status Banner
// =============================================================================
function StatusBanner({ hashStatus }: { hashStatus: HashStatus }) {
  if (hashStatus === 'valid') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-3">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-lg font-extrabold text-emerald-300">
          NOTULENSI ASLI & VALID
        </h2>
        <p className="text-xs text-emerald-400/80 mt-1">
          Hash cocok — isi notulensi tidak berubah sejak difinalisasi
        </p>
      </div>
    );
  }

  if (hashStatus === 'mismatch') {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-3">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-lg font-extrabold text-rose-300">PDF INI VERSI LAMA</h2>
        <p className="text-xs text-rose-400/80 mt-1 leading-relaxed">
          Notulensi sudah mengalami revisi setelah PDF ini dicetak.
          Isi terkini mungkin berbeda dengan yang ada di PDF Anda.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold">
          <AlertTriangle size={12} /> Hash tidak cocok
        </div>
      </div>
    );
  }

  if (hashStatus === 'no_hash') {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-3">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-lg font-extrabold text-amber-300">NOTULENSI VALID</h2>
        <p className="text-xs text-amber-400/80 mt-1 leading-relaxed">
          Token valid. Hash belum tersedia — notulensi dibuat sebelum sistem hash diaktifkan.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-3">
        <ShieldCheck size={32} />
      </div>
      <h2 className="text-lg font-extrabold text-emerald-300">NOTULENSI VALID</h2>
      <p className="text-xs text-emerald-400/80 mt-1">Notulensi terdaftar dalam sistem kami</p>
    </div>
  );
}

// =============================================================================
// SUB: Row
// =============================================================================
function Row({
  icon: Icon, label, value,
}: {
  icon: typeof User; label: string; value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center shrink-0">
        <Icon size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase font-bold text-slate-500">{label}</p>
        <p className="text-xs font-semibold text-slate-200 break-words">{value}</p>
      </div>
    </div>
  );
}