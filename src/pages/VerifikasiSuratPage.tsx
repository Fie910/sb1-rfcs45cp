// src/pages/VerifikasiSuratPage.tsx
// Halaman publik untuk verifikasi keaslian surat via QR scan.
// TIDAK butuh login.

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, ShieldCheck, ShieldX, Calendar, User, FileText,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type VerifData = {
  id: string;
  nomor_pengajuan: string;
  verification_token: string;
  guru_nama: string | null;
  guru_nip: string | null;
  jenis_ptk: string | null;
  jenis_nama: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  jam_mulai: string | null;
  jam_selesai: string | null;
  status: string;
  alasan: string;
  surat_generated_at: string | null;
};

export default function VerifikasiSuratPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifData | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data: result, error } = await supabase
          .from('v_hris_cuti_verifikasi')
          .select('*')
          .eq('verification_token', token)
          .maybeSingle();

        if (error) {
          console.error('[verifikasi]', error);
        } else {
          setData(result as VerifData | null);
        }
      } catch (err) {
        console.error('[verifikasi]', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const formatTanggal = (d: string) =>
    new Date(`${d.split('T')[0]}T00:00:00+07:00`).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

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
            Verifikasi Surat
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistem Verifikasi Keaslian Dokumen
          </p>
        </div>

        {/* CONTENT */}
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
            {/* STATUS BANNER */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-3">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-lg font-extrabold text-emerald-300">
                SURAT ASLI & VALID
              </h2>
              <p className="text-xs text-emerald-400/80 mt-1">
                Dokumen ini terverifikasi dalam sistem kami
              </p>
            </div>

            {/* DETAIL SURAT */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    Nomor Surat
                  </p>
                  <p className="text-sm font-mono font-bold text-slate-100 mt-0.5">
                    {data.nomor_pengajuan}
                  </p>
                </div>
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
                value={`${data.jumlah_hari} hari${
                  data.jam_mulai ? ` (${data.jam_mulai} - ${data.jam_selesai})` : ''
                }`}
              />

              <div className="pt-3 border-t border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                  Alasan
                </p>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {data.alasan}
                </p>
              </div>

              {data.surat_generated_at && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 italic">
                    Surat dicetak:{' '}
                    {new Date(data.surat_generated_at).toLocaleString('id-ID', {
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
              Jika Anda menemukan ketidaksesuaian, hubungi pihak sekolah.
            </p>
          </div>
        )}

        {/* BACK TO HOME */}
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
// SUB: Row
// =============================================================================
function Row({ icon: Icon, label, value }: {
  icon: typeof User;
  label: string;
  value: string;
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