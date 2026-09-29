// src/components/dashboard/PengumumanCard.tsx
// Kartu pengumuman untuk dashboard.

import {
  AlertCircle, Info, AlertTriangle, Flame, Calendar, ArrowRight,
  Image as ImageIcon, ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// =============================================================================
// TYPES
// =============================================================================
type PengumumanData = {
  id: number;
  judul: string;
  isi: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  gambar_url?: string | null;
  url?: string | null;
  prioritas?: string | null;
};

// =============================================================================
// PRIORITAS STYLE
// =============================================================================
function getPrioritasConfig(prioritas: string | null | undefined) {
  switch (prioritas) {
    case 'Kritis':
      return {
        Icon: Flame,
        label: 'Kritis',
        border: 'border-rose-500/40',
        bg: 'bg-rose-500/5',
        iconBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
        badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        text: 'text-rose-300',
      };
    case 'Penting':
      return {
        Icon: AlertTriangle,
        label: 'Penting',
        border: 'border-amber-500/40',
        bg: 'bg-amber-500/5',
        iconBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        text: 'text-amber-300',
      };
    case 'Rendah':
      return {
        Icon: Info,
        label: 'Info',
        border: 'border-slate-700',
        bg: 'bg-slate-900/60',
        iconBg: 'bg-slate-800 border-slate-700 text-slate-400',
        badge: 'bg-slate-800 text-slate-400 border-slate-700',
        text: 'text-slate-300',
      };
    default:
      return {
        Icon: AlertCircle,
        label: 'Info',
        border: 'border-blue-500/30',
        bg: 'bg-blue-500/5',
        iconBg: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
        badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        text: 'text-blue-300',
      };
  }
}

// =============================================================================
// KOMPONEN
// =============================================================================
export function PengumumanCard({ item }: { item: PengumumanData }) {
  const cfg = getPrioritasConfig(item.prioritas);
  const Icon = cfg.Icon;

  const formatTanggal = (d: string) =>
    new Date(`${d.split('T')[0]}T00:00:00+07:00`).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const isExternalLink = item.url && item.url.startsWith('http');

  return (
    <div className={`border rounded-2xl p-4 transition ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${cfg.iconBg}`}>
          <Icon size={16} />
        </div>

        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
                  {cfg.label}
                </span>
                <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                  <Calendar size={9} />
                  s.d. {formatTanggal(item.tanggal_selesai)}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-100">{item.judul}</p>
            </div>
          </div>

          {/* Isi */}
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 mt-1">
            {item.isi}
          </p>

          {/* Gambar (kalau ada) */}
          {item.gambar_url && (
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-800">
              <img
                src={item.gambar_url}
                alt=""
                className="w-full max-h-40 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Link */}
          {item.url && (
            <div className="mt-2">
              {isExternalLink ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1 text-[11px] font-bold ${cfg.text} hover:underline`}
                >
                  <ExternalLink size={10} /> Buka Tautan
                </a>
              ) : (
                <Link
                  to={item.url}
                  className={`inline-flex items-center gap-1 text-[11px] font-bold ${cfg.text} hover:underline`}
                >
                  <ArrowRight size={10} /> Selengkapnya
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: Empty State
// =============================================================================
export function PengumumanEmpty() {
  return (
    <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl">
      <Info size={28} className="mx-auto text-slate-600 mb-2" />
      <p className="text-xs text-slate-500">Tidak ada pengumuman aktif saat ini</p>
    </div>
  );
}