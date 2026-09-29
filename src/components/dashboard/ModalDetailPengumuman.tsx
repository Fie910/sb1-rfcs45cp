// src/components/dashboard/ModalDetailPengumuman.tsx
// Modal detail pengumuman lengkap.

import {
  AlertCircle, Info, AlertTriangle, Flame, Calendar, Clock,
  ExternalLink, ArrowRight, Image as ImageIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/Modal';

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
  created_at?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  pengumuman: PengumumanData | null;
};

// =============================================================================
// PRIORITAS CONFIG
// =============================================================================
function getPrioritasConfig(prioritas: string | null | undefined) {
  switch (prioritas) {
    case 'Kritis':
      return {
        Icon: Flame,
        label: 'Kritis',
        border: 'border-rose-500/40',
        iconBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
        badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        text: 'text-rose-300',
      };
    case 'Penting':
      return {
        Icon: AlertTriangle,
        label: 'Penting',
        border: 'border-amber-500/40',
        iconBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        text: 'text-amber-300',
      };
    case 'Rendah':
      return {
        Icon: Info,
        label: 'Info',
        border: 'border-slate-700',
        iconBg: 'bg-slate-800 border-slate-700 text-slate-400',
        badge: 'bg-slate-800 text-slate-400 border-slate-700',
        text: 'text-slate-300',
      };
    default:
      return {
        Icon: AlertCircle,
        label: 'Info',
        border: 'border-blue-500/30',
        iconBg: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
        badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        text: 'text-blue-300',
      };
  }
}

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalDetailPengumuman({ open, onClose, pengumuman }: Props) {
  if (!pengumuman) return null;

  const cfg = getPrioritasConfig(pengumuman.prioritas);
  const Icon = cfg.Icon;

  const formatTanggal = (d: string) =>
    new Date(`${d.split('T')[0]}T00:00:00+07:00`).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const isExternalLink = pengumuman.url && pengumuman.url.startsWith('http');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detail Pengumuman"
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* HEADER */}
        <div className={`border rounded-2xl p-4 ${cfg.border}`}>
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${cfg.iconBg}`}>
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-100 leading-tight">
                {pengumuman.judul}
              </h3>
            </div>
          </div>

          {/* Tanggal */}
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={11} className="text-slate-500" />
              {formatTanggal(pengumuman.tanggal_mulai)} — {formatTanggal(pengumuman.tanggal_selesai)}
            </span>
          </div>
        </div>

        {/* GAMBAR */}
        {pengumuman.gambar_url && (
          <div className="rounded-2xl overflow-hidden border border-slate-800">
            <img
              src={pengumuman.gambar_url}
              alt={pengumuman.judul}
              className="w-full max-h-96 object-contain bg-slate-950"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* ISI LENGKAP */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">
            Isi Pengumuman
          </p>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {pengumuman.isi}
          </p>
        </div>

        {/* LINK / TAUTAN */}
        {pengumuman.url && (
          <div>
            {isExternalLink ? (
              <a
                href={pengumuman.url}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 w-full justify-center px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer`}
              >
                <ExternalLink size={14} /> Buka Tautan Terkait
              </a>
            ) : (
              <Link
                to={pengumuman.url}
                onClick={onClose}
                className={`inline-flex items-center gap-2 w-full justify-center px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer`}
              >
                <ArrowRight size={14} /> Selengkapnya
              </Link>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}