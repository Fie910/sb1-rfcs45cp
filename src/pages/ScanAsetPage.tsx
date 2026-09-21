// src/pages/ScanAsetPage.tsx
// Halaman publik untuk scan QR code label aset.
// URL: /scan/:token  → fetch data via RPC get_aset_by_qr_token
// Tidak butuh login (anon bisa akses).

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Package,
  MapPin,
  Tag,
  User,
  Hash,
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Boxes,
  Home,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

type AsetInfo = {
  kode_aset: string;
  nama_aset: string;
  merek: string | null;
  model: string | null;
  nomor_seri: string | null;
  kondisi: string;
  status: string;
  lokasi_nama: string | null;
  kategori_nama: string | null;
  pic_nama: string | null;
  foto_url: string | null;
  satuan: string;
  jumlah: number;
};

// =============================================================================
// HELPERS
// =============================================================================

function getKondisiStyle(kondisi: string): string {
  switch (kondisi) {
    case 'Baik':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Rusak Ringan':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Rusak Berat':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'Aktif':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Dipinjam':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Perbaikan':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Hilang':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Dihapus':
      return 'bg-slate-700 text-slate-400 border-slate-600';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

function getKondisiIcon(kondisi: string) {
  switch (kondisi) {
    case 'Baik':
      return CheckCircle2;
    case 'Rusak Ringan':
      return AlertTriangle;
    case 'Rusak Berat':
      return XCircle;
    default:
      return Package;
  }
}

// =============================================================================
// KOMPONEN
// =============================================================================

export function ScanAsetPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AsetInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannedAt] = useState(new Date());

  useEffect(() => {
    if (!token) {
      setError('Token tidak ditemukan di URL');
      setLoading(false);
      return;
    }

    const fetchAset = async () => {
      try {
        const { data: rows, error: rpcErr } = await supabase.rpc(
          'get_aset_by_qr_token',
          { p_token: token }
        );

        if (rpcErr) throw rpcErr;

        if (!rows || (Array.isArray(rows) && rows.length === 0)) {
          setError('Aset tidak ditemukan. QR code mungkin sudah tidak valid atau palsu.');
        } else {
          const row = Array.isArray(rows) ? rows[0] : rows;
          setData(row as AsetInfo);
        }
      } catch (err: any) {
        console.error('Scan error:', err);
        setError(err.message || 'Gagal memuat data aset');
      } finally {
        setLoading(false);
      }
    };

    fetchAset();
  }, [token]);

  // ==========================================================================
  // LOADING
  // ==========================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-indigo-400" size={40} />
          <p className="text-slate-400 text-sm">Memverifikasi QR code...</p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // ERROR / INVALID TOKEN
  // ==========================================================================
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-6 md:p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>

          <div>
            <h1 className="text-xl font-extrabold text-slate-100">QR Code Tidak Valid</h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              {error ?? 'Aset dengan token ini tidak ditemukan di sistem kami.'}
            </p>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3 text-left">
            <p className="text-[11px] font-bold text-rose-300 mb-1.5 uppercase tracking-wider">
              ⚠️ Kemungkinan Penyebab:
            </p>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside leading-relaxed">
              <li>QR code label sudah dipalsukan</li>
              <li>Token sudah direvoke/di-regenerate oleh admin</li>
              <li>Aset sudah dihapus dari sistem</li>
              <li>URL QR code rusak</li>
            </ul>
          </div>

          <p className="text-[11px] text-slate-500">
            Hubungi Divisi Sarpras jika Anda yakin ini kesalahan.
          </p>

          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
            >
              <Home size={14} /> Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SUCCESS — TAMPILKAN INFORMASI ASET
  // ==========================================================================
  const KondisiIcon = getKondisiIcon(data.kondisi);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header bar dengan badge verifikasi */}
      <div className="sticky top-0 z-10 bg-emerald-500/10 backdrop-blur-md border-b border-emerald-500/30 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-emerald-300 tracking-tight">
              ✓ QR Code Terverifikasi
            </p>
            <p className="text-[10px] text-emerald-400/80 truncate">
              Data asli dari server SMK KH. A. Wahab Muhsin ·{' '}
              {scannedAt.toLocaleString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Konten utama */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Kartu utama aset */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Foto */}
          <div className="aspect-video bg-slate-950 flex items-center justify-center overflow-hidden relative">
            {data.foto_url ? (
              <img
                src={data.foto_url}
                alt={data.nama_aset}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package size={64} className="text-slate-700" />
            )}

            {/* Kategori pill di atas foto */}
            {data.kategori_nama && (
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-full px-3 py-1">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                  {data.kategori_nama}
                </p>
              </div>
            )}
          </div>

          {/* Info utama */}
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[11px] font-mono font-bold text-indigo-400 tracking-wider">
                {data.kode_aset}
              </p>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-100 tracking-tight mt-1">
                {data.nama_aset}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {data.jumlah} {data.satuan}
              </p>
            </div>

            {/* Badge kondisi & status */}
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getKondisiStyle(
                  data.kondisi
                )}`}
              >
                <KondisiIcon size={12} />
                {data.kondisi}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(
                  data.status
                )}`}
              >
                <Boxes size={12} />
                {data.status}
              </span>
            </div>
          </div>
        </div>

        {/* Grid detail */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Fingerprint size={14} className="text-indigo-400" />
            Detail Aset
          </h2>

          <div className="space-y-2.5 pt-1">
            <DetailRow
              icon={Tag}
              label="Merek"
              value={data.merek}
            />
            <DetailRow
              icon={Package}
              label="Model"
              value={data.model}
            />
            <DetailRow
              icon={Hash}
              label="Nomor Seri"
              value={data.nomor_seri}
              mono
            />
            <DetailRow
              icon={MapPin}
              label="Lokasi"
              value={data.lokasi_nama}
            />
            <DetailRow
              icon={User}
              label="Penanggung Jawab"
              value={data.pic_nama}
            />
          </div>
        </div>

        {/* Info footer */}
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
          <ShieldCheck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-indigo-300/90 leading-relaxed">
            <p className="font-bold mb-0.5">Verifikasi Data dari Server</p>
            <p className="text-indigo-400/70">
              Semua informasi di halaman ini diambil langsung dari database
              resmi sekolah. QR code hanya berisi token unik — data aset tidak
              dapat dipalsukan meski label difotokopi.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 pb-6">
          <p className="text-[10px] text-slate-600">
            © SMK KH. A. Wahab Muhsin Sukahideng · Sistem Informasi Sarpras
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================

function DetailRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof Tag;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800/60 last:border-b-0">
      <div className="flex items-center gap-2.5 text-slate-400 shrink-0">
        <Icon size={14} className="text-slate-500" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <span
        className={`text-sm font-medium text-slate-100 text-right truncate max-w-[60%] ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {value || <span className="text-slate-600 italic">Tidak disebutkan</span>}
      </span>
    </div>
  );
}