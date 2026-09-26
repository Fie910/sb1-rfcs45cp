// src/pages/VerifikasiSuratPage.tsx
// Halaman publik verifikasi surat izin/cuti via QR scan (tanpa login).
// Hybrid A+B: verifikasi token + hash content.

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Loader2, ShieldCheck, ShieldX, ShieldAlert, Calendar, User,
  FileText, CheckCircle2, AlertTriangle, Hash, Clock, MessageCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type VerifData = {
  id: string;
  nomor_pengajuan: string;
  verification_token: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  jam_mulai: string | null;
  jam_selesai: string | null;
  status: string;
  alasan: string;
  surat_generated_at: string | null;
  content_hash: string | null;
  frozen_at: string | null;
  guru_nama: string | null;
  guru_nip: string | null;
  jenis_ptk: string | null;
  jenis_nama: string | null;
};

type HashStatus = 'valid' | 'mismatch' | 'no_hash' | 'not_specified';

export default function VerifikasiSuratPage() {
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
          .from('v_hris_cuti_verifikasi')
          .select('*')
          .eq('verification_token', token)
          .maybeSingle();
        if (error) console.error('[verif-surat]', error);
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
            Verifikasi Surat Izin
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistem Verifikasi Keaslian Dokumen Sekolah
          </p>
        </div>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
            <Loader2 className="animate-spin text-indigo-400 mx-auto mb-3" size={32} />
            <p className="text-sm text-slate-400">Memverifikasi surat...</p>
          </div>
        ) : !data ? (
          <div className="bg-rose-500/5 border border-rose-500/30 rounded-3xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-4">
              <ShieldX size={32} />
            </div>
            <h2 className="text-lg font-bold text-rose-300 mb-2">
              SURAT TIDAK VALID
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Surat dengan kode verifikasi ini tidak ditemukan dalam sistem,
              atau belum disetujui secara resmi.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold">
              <AlertTriangle size={12} /> Kemungkinan surat palsu
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <StatusBanner hashStatus={hashStatus} />

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="pb-3 border-b border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Nomor Surat
                </p>
                <p className="text-sm font-mono font-bold text-slate-100 mt-0.5">
                  {data.nomor_pengajuan}
                </p>
              </div>

              <Row icon={User} label="Nama" value={data.guru_nama ?? '-'} />
              <Row icon={FileText} label="NIP" value={data.guru_nip ?? '-'} />
              <Row icon={FileText} label="Jenis PTK" value={data.jenis_ptk ?? '-'} />
              <Row icon={FileText} label="Jenis" value={data.jenis_nama ?? '-'} />
              <Row
                icon={Calendar}
                label="Periode"
                value={`${formatTanggal(data.tanggal_mulai)} — ${formatTanggal(data.tanggal_selesai)}`}
              />
              <Row
                icon={Calendar}
                label="Durasi"
                value={`${data.jumlah_hari} hari${data.jam_mulai ? ` (${data.jam_mulai} - ${data.jam_selesai})` : ''}`}
              />

              <div className="pt-3 border-t border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                  Alasan
                </p>
                <p className="text-xs text-slate-200 leading-relaxed">{data.alasan}</p>
              </div>

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

              {data.surat_generated_at && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 italic">
                    Surat dicetak:{' '}
                    {new Date(data.surat_generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
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
        <h2 className="text-lg font-extrabold text-emerald-300">SURAT ASLI & VALID</h2>
        <p className="text-xs text-emerald-400/80 mt-1">
          Hash cocok — isi surat tidak berubah sejak dikunci
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
          Surat sudah mengalami revisi setelah PDF ini dicetak. Isi terkini di bawah
          mungkin berbeda dengan yang ada di PDF Anda.
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
        <h2 className="text-lg font-extrabold text-amber-300">SURAT VALID</h2>
        <p className="text-xs text-amber-400/80 mt-1 leading-relaxed">
          Token valid. Hash belum tersedia — surat ini dibuat sebelum sistem hash diaktifkan.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-3">
        <ShieldCheck size={32} />
      </div>
      <h2 className="text-lg font-extrabold text-emerald-300">SURAT VALID</h2>
      <p className="text-xs text-emerald-400/80 mt-1">Surat terdaftar dalam sistem kami</p>
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