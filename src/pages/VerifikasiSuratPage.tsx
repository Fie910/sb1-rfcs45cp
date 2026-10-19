// src/pages/VerifikasiSuratPage.tsx
// Halaman publik verifikasi dokumen via QR scan (tanpa login).
// Support: Surat Izin/Cuti (HRIS) + Surat Peringatan (Kesiswaan).
// Hybrid A+B: verifikasi token + hash content.

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Loader2, ShieldCheck, ShieldX, ShieldAlert, Calendar, User,
  FileText, CheckCircle2, AlertTriangle, Hash, Clock, GraduationCap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================
type HashStatus = 'valid' | 'mismatch' | 'no_hash' | 'not_specified';

type VerifDataIzin = {
  kind: 'izin';
  id: string;
  nomor: string;
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

type VerifDataSP = {
  kind: 'sp';
  id: string;
  nomor: string;
  level: 'SP1' | 'SP2' | 'SP3';
  tanggal_terbit: string;
  batas_waktu: string | null;
  alasan: string;
  catatan: string | null;
  total_poin_pelanggaran: number;
  total_poin_prestasi: number;
  status: string;
  content_hash: string | null;
  pdf_generated_at: string | null;
  siswa_nama: string | null;
  siswa_nisn: string | null;
  siswa_kelas: string | null;
  penandatangan_nama: string | null;
  penandatangan_nip: string | null;
};

type VerifData = VerifDataIzin | VerifDataSP;

// =============================================================================
// HELPER
// =============================================================================
function formatTanggal(d: string): string {
  return new Date(`${d.split('T')[0]}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function VerifikasiSuratPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const hashFromQr = searchParams.get('h');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifData | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // ========================================================
        // Step 1: Coba tabel Surat Izin/Cuti (view HRIS)
        // ========================================================
        const { data: izinResult, error: izinErr } = await supabase
          .from('v_hris_cuti_verifikasi')
          .select('*')
          .eq('verification_token', token)
          .maybeSingle();

        if (izinErr && izinErr.code !== 'PGRST116') {
          console.warn('[verif-surat] Izin query warning:', izinErr.message);
        }

        if (izinResult) {
          setData({
            kind: 'izin',
            id: izinResult.id,
            nomor: izinResult.nomor_pengajuan ?? '-',
            verification_token: izinResult.verification_token,
            tanggal_mulai: izinResult.tanggal_mulai,
            tanggal_selesai: izinResult.tanggal_selesai,
            jumlah_hari: izinResult.jumlah_hari ?? 0,
            jam_mulai: izinResult.jam_mulai,
            jam_selesai: izinResult.jam_selesai,
            status: izinResult.status,
            alasan: izinResult.alasan,
            surat_generated_at: izinResult.surat_generated_at,
            content_hash: izinResult.content_hash,
            frozen_at: izinResult.frozen_at,
            guru_nama: izinResult.guru_nama,
            guru_nip: izinResult.guru_nip,
            jenis_ptk: izinResult.jenis_ptk,
            jenis_nama: izinResult.jenis_nama,
          });
          setLoading(false);
          return;
        }

        // ========================================================
        // Step 2: Coba tabel Surat Peringatan (Kesiswaan)
        // ========================================================
        const { data: spResult, error: spErr } = await supabase
          .from('kesiswaan_surat_peringatan')
          .select(`
            *,
            siswa:siswa_id (
              id, nama_lengkap, nisn,
              kelas:kelas_id (id, nama_kelas)
            ),
            penandatangan:ditandatangani_oleh (id, nama_lengkap, nip)
          `)
          .eq('verification_token', token)
          .maybeSingle();

        if (spErr && spErr.code !== 'PGRST116') {
          console.warn('[verif-surat] SP query warning:', spErr.message);
        }

        if (spResult) {
          setData({
            kind: 'sp',
            id: spResult.id,
            nomor: spResult.nomor_sp ?? '-',
            level: spResult.level,
            tanggal_terbit: spResult.tanggal_terbit,
            batas_waktu: spResult.batas_waktu,
            alasan: spResult.alasan,
            catatan: spResult.catatan,
            total_poin_pelanggaran: spResult.total_poin_pelanggaran ?? 0,
            total_poin_prestasi: spResult.total_poin_prestasi ?? 0,
            status: spResult.status,
            content_hash: spResult.content_hash,
            pdf_generated_at: spResult.pdf_generated_at,
            siswa_nama: spResult.siswa?.nama_lengkap ?? null,
            siswa_nisn: spResult.siswa?.nisn ?? null,
            siswa_kelas: spResult.siswa?.kelas?.nama_kelas ?? null,
            penandatangan_nama: spResult.penandatangan?.nama_lengkap ?? null,
            penandatangan_nip: spResult.penandatangan?.nip ?? null,
          });
        }
      } catch (err) {
        console.error('[verif-surat] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Hitung hash status
  const hashStatus: HashStatus = (() => {
    if (!data) return 'not_specified';
    if (!hashFromQr) return 'not_specified';
    if (!data.content_hash) return 'no_hash';
    return data.content_hash.slice(0, 16) === hashFromQr ? 'valid' : 'mismatch';
  })();

  const pageTitle =
    data?.kind === 'sp' ? 'Verifikasi Surat Peringatan' : 'Verifikasi Surat Izin';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 mb-3">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistem Verifikasi Keaslian Dokumen Sekolah
          </p>
        </div>

        {/* CONTENT */}
        {loading ? (
          <LoadingCard />
        ) : !data ? (
          <NotFoundCard />
        ) : (
          <div className="space-y-4">
            <StatusBanner hashStatus={hashStatus} kind={data.kind} />

            {data.kind === 'izin' && <IzinDetail data={data} />}
            {data.kind === 'sp' && <SPDetail data={data} />}

            <p className="text-center text-[10px] text-slate-500 leading-relaxed">
              Halaman ini dihasilkan otomatis oleh Sistem Informasi Sekolah.
              <br />
              Keaslian dokumen dijamin oleh hash kriptografis SHA-256.
            </p>
          </div>
        )}

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
// SUB: Loading
// =============================================================================
function LoadingCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
      <Loader2 className="animate-spin text-indigo-400 mx-auto mb-3" size={32} />
      <p className="text-sm text-slate-400">Memverifikasi dokumen...</p>
    </div>
  );
}

// =============================================================================
// SUB: Not Found
// =============================================================================
function NotFoundCard() {
  return (
    <div className="bg-rose-500/5 border border-rose-500/30 rounded-3xl p-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-4">
        <ShieldX size={32} />
      </div>
      <h2 className="text-lg font-bold text-rose-300 mb-2">DOKUMEN TIDAK VALID</h2>
      <p className="text-sm text-slate-400 leading-relaxed">
        Dokumen dengan kode verifikasi ini tidak ditemukan dalam sistem, atau
        belum disetujui secara resmi.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold">
        <AlertTriangle size={12} /> Kemungkinan dokumen palsu
      </div>
    </div>
  );
}

// =============================================================================
// SUB: Status Banner
// =============================================================================
function StatusBanner({
  hashStatus,
  kind,
}: {
  hashStatus: HashStatus;
  kind: 'izin' | 'sp';
}) {
  const label = kind === 'sp' ? 'Surat Peringatan' : 'Surat Izin';

  if (hashStatus === 'mismatch') {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-3">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-lg font-extrabold text-rose-300">PDF INI VERSI LAMA</h2>
        <p className="text-xs text-rose-400/80 mt-1 leading-relaxed">
          {label} sudah mengalami revisi setelah PDF ini dicetak. Isi terkini di
          bawah mungkin berbeda dengan yang ada di PDF Anda.
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
          {label.toUpperCase()} VALID
        </h2>
        <p className="text-xs text-amber-400/80 mt-1 leading-relaxed">
          Token valid. Hash belum tersedia — dokumen dibuat sebelum sistem hash
          diaktifkan.
        </p>
      </div>
    );
  }

  // valid atau not_specified
  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-3">
        <CheckCircle2 size={32} />
      </div>
      <h2 className="text-lg font-extrabold text-emerald-300">
        {label.toUpperCase()} ASLI & VALID
      </h2>
      <p className="text-xs text-emerald-400/80 mt-1">
        {hashStatus === 'valid'
          ? 'Hash cocok — isi dokumen tidak berubah sejak dikunci'
          : 'Dokumen terdaftar dalam sistem kami'}
      </p>
    </div>
  );
}

// =============================================================================
// SUB: Detail Izin/Cuti
// =============================================================================
function IzinDetail({ data }: { data: VerifDataIzin }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
      <div className="pb-3 border-b border-slate-800">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
          Nomor Surat Izin
        </p>
        <p className="text-sm font-mono font-bold text-slate-100 mt-0.5">
          {data.nomor}
        </p>
      </div>

      <Row icon={User} label="Nama" value={data.guru_nama ?? '-'} />
      <Row icon={FileText} label="NIP" value={data.guru_nip ?? '-'} />
      <Row icon={FileText} label="Jenis PTK" value={data.jenis_ptk ?? '-'} />
      <Row icon={FileText} label="Jenis Cuti" value={data.jenis_nama ?? '-'} />
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
            {new Date(data.frozen_at).toLocaleString('id-ID', {
              timeZone: 'Asia/Jakarta',
            })}
          </p>
        </div>
      )}

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
  );
}

// =============================================================================
// SUB: Detail Surat Peringatan
// =============================================================================
function SPDetail({ data }: { data: VerifDataSP }) {
  const levelColor = {
    SP1: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    SP2: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    SP3: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
  }[data.level];

  const poinBersih = data.total_poin_pelanggaran - data.total_poin_prestasi;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
      <div className="pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${levelColor}`}
          >
            {data.level}
          </span>
          <span className="text-[10px] text-slate-500">·</span>
          <span className="text-[10px] font-semibold text-slate-400">
            {data.status}
          </span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
          Nomor Surat Peringatan
        </p>
        <p className="text-sm font-mono font-bold text-slate-100 mt-0.5">
          {data.nomor}
        </p>
      </div>

      <Row icon={GraduationCap} label="Nama Siswa" value={data.siswa_nama ?? '-'} />
      <Row icon={FileText} label="NISN" value={data.siswa_nisn ?? '-'} />
      <Row icon={FileText} label="Kelas" value={data.siswa_kelas ?? '-'} />
      <Row
        icon={Calendar}
        label="Tanggal Terbit"
        value={formatTanggal(data.tanggal_terbit)}
      />
      {data.batas_waktu && (
        <Row
          icon={Clock}
          label="Batas Waktu"
          value={formatTanggal(data.batas_waktu)}
        />
      )}

      {/* Poin */}
      <div className="pt-3 border-t border-slate-800">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-2">
          Rekapitulasi Poin
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-2 text-center">
            <p className="text-[9px] text-rose-400 font-bold uppercase">Pelanggaran</p>
            <p className="text-sm font-extrabold text-rose-400">
              {data.total_poin_pelanggaran}
            </p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 text-center">
            <p className="text-[9px] text-emerald-400 font-bold uppercase">Prestasi</p>
            <p className="text-sm font-extrabold text-emerald-400">
              {data.total_poin_prestasi}
            </p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 text-center">
            <p className="text-[9px] text-amber-400 font-bold uppercase">Bersih</p>
            <p className="text-sm font-extrabold text-amber-400">{poinBersih}</p>
          </div>
        </div>
      </div>

      {/* Alasan */}
      <div className="pt-3 border-t border-slate-800">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
          Alasan / Pelanggaran
        </p>
        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
          {data.alasan}
        </p>
      </div>

      {data.catatan && (
        <div className="pt-3 border-t border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
            Catatan Tambahan
          </p>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {data.catatan}
          </p>
        </div>
      )}

      {data.penandatangan_nama && (
        <div className="pt-3 border-t border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
            Ditandatangani Oleh
          </p>
          <p className="text-xs font-semibold text-slate-200">
            {data.penandatangan_nama}
          </p>
          {data.penandatangan_nip && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              NIP. {data.penandatangan_nip}
            </p>
          )}
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

      {data.pdf_generated_at && (
        <div className="pt-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 italic">
            Surat dicetak:{' '}
            {new Date(data.pdf_generated_at).toLocaleString('id-ID', {
              timeZone: 'Asia/Jakarta',
            })}
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB: Row
// =============================================================================
function Row({
  icon: Icon,
  label,
  value,
}: {
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