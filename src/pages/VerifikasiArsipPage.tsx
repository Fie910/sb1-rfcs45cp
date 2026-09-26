// src/pages/VerifikasiArsipPage.tsx
// Halaman publik verifikasi arsip via QR scan (tanpa login).
// Hybrid A+B: verifikasi token + hash content.

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Loader2, ShieldCheck, ShieldX, ShieldAlert, Calendar, User,
  FileText, CheckCircle2, AlertTriangle, Hash, Clock, Archive,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================
type VerifData = {
  verification_token: string;
  content_hash: string | null;
  versi: number;
  versi_frozen_at: string | null;
  dokumen_id: string;
  nomor_dokumen: string | null;
  judul: string;
  deskripsi: string | null;
  status_dokumen: string;
  tanggal_berlaku: string | null;
  tanggal_expired: string | null;
  kategori_nama: string | null;
  pemilik_nama: string | null;
};

type HashStatus = 'valid' | 'mismatch' | 'no_hash' | 'not_specified';

// =============================================================================
// KOMPONEN
// =============================================================================
export default function VerifikasiArsipPage() {
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
          .from('v_arsip_verifikasi')
          .select('*')
          .eq('verification_token', token)
          .maybeSingle();
        if (error) console.error('[verif-arsip]', error);
        else setData(result as VerifData | null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ==========================================================================
  // HASH VERIFICATION
  // ==========================================================================
  const hashStatus: HashStatus = (() => {
    if (!data) return 'not_specified';
    if (!hashFromQr) return 'not_specified';
    if (!data.content_hash) return 'no_hash';
    const dbShort = data.content_hash.slice(0, 16);
    return dbShort === hashFromQr ? 'valid' : 'mismatch';
  })();

  const formatTanggal = (d: string | null) => {
    if (!d) return '-';
    return new Date(`${d.split('T')[0]}T00:00:00+07:00`).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 mb-3">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Verifikasi Arsip
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistem Verifikasi Keaslian Dokumen Sekolah
          </p>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
            <Loader2 className="animate-spin text-indigo-400 mx-auto mb-3" size={32} />
            <p className="text-sm text-slate-400">Memverifikasi dokumen...</p>
          </div>
        ) : !data ? (
          /* TIDAK DITEMUKAN */
          <div className="bg-rose-500/5 border border-rose-500/30 rounded-3xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-4">
              <ShieldX size={32} />
            </div>
            <h2 className="text-lg font-bold text-rose-300 mb-2">
              DOKUMEN TIDAK VALID
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Dokumen dengan kode verifikasi ini tidak ditemukan dalam sistem,
              atau belum dipublikasikan secara resmi.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold">
              <AlertTriangle size={12} /> Kemungkinan dokumen palsu
            </div>
          </div>
        ) : (
          /* DITEMUKAN */
          <div className="space-y-4">
            {/* STATUS BANNER — adaptive by hashStatus */}
            <StatusBanner hashStatus={hashStatus} />

            {/* DETAIL DOKUMEN */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="pb-3 border-b border-slate-800">
                <div className="flex items-center gap-1.5 mb-1">
                  <Archive size={11} className="text-indigo-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    {data.kategori_nama ?? 'Dokumen'}
                  </p>
                </div>
                <p className="text-base font-extrabold text-slate-100">
                  {data.judul}
                </p>
                <p className="text-[11px] font-mono text-indigo-400 mt-0.5">
                  {data.nomor_dokumen ?? '-'}
                </p>
                {data.deskripsi && (
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {data.deskripsi}
                  </p>
                )}
              </div>

              {/* INFO ROWS */}
              <Row icon={Hash} label="Versi" value={`v${data.versi}`} />
              <Row
                icon={FileText}
                label="Status Dokumen"
                value={data.status_dokumen}
                valueClass={
                  data.status_dokumen === 'Aktif'
                    ? 'text-emerald-400'
                    : data.status_dokumen === 'Obsolete'
                    ? 'text-amber-400'
                    : 'text-slate-200'
                }
              />
              <Row icon={Calendar} label="Tanggal Berlaku" value={formatTanggal(data.tanggal_berlaku)} />
              {data.tanggal_expired && (
                <Row icon={Calendar} label="Tanggal Expired" value={formatTanggal(data.tanggal_expired)} />
              )}
              <Row icon={User} label="Pemilik / PIC" value={data.pemilik_nama ?? '-'} />

              {/* HASH SECTION */}
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

              {/* FROZEN INFO */}
              {data.versi_frozen_at && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 italic flex items-center gap-1">
                    <Clock size={10} />
                    Versi dikunci pada:{' '}
                    {new Date(data.versi_frozen_at).toLocaleString('id-ID', {
                      timeZone: 'Asia/Jakarta',
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <p className="text-center text-[10px] text-slate-500 leading-relaxed">
              Halaman ini dihasilkan otomatis oleh Sistem Informasi Sekolah.
              <br />
              Keaslian dokumen dijamin oleh hash kriptografis SHA-256.
            </p>
          </div>
        )}

        {/* BACK */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition"
          >
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
          DOKUMEN ASLI & VALID
        </h2>
        <p className="text-xs text-emerald-400/80 mt-1">
          Hash cocok — isi dokumen tidak berubah sejak dikunci
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
        <h2 className="text-lg font-extrabold text-rose-300">
          PDF INI VERSI LAMA
        </h2>
        <p className="text-xs text-rose-400/80 mt-1 leading-relaxed">
          Dokumen sudah mengalami revisi setelah PDF ini dicetak.
          Isi terkini di bawah mungkin berbeda dengan yang ada di PDF Anda.
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
        <h2 className="text-lg font-extrabold text-amber-300">
          DOKUMEN VALID
        </h2>
        <p className="text-xs text-amber-400/80 mt-1 leading-relaxed">
          Token valid. Hash belum tersedia — dokumen ini dibuat sebelum sistem
          hash diaktifkan.
        </p>
      </div>
    );
  }

  // not_specified — tidak ada param h, tapi tetap valid token
  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-3">
        <ShieldCheck size={32} />
      </div>
      <h2 className="text-lg font-extrabold text-emerald-300">
        DOKUMEN VALID
      </h2>
      <p className="text-xs text-emerald-400/80 mt-1">
        Dokumen terdaftar dalam sistem kami
      </p>
    </div>
  );
}

// =============================================================================
// SUB: Row
// =============================================================================
function Row({
  icon: Icon, label, value, valueClass = 'text-slate-200',
}: {
  icon: typeof User; label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center shrink-0">
        <Icon size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase font-bold text-slate-500">{label}</p>
        <p className={`text-xs font-semibold break-words ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}