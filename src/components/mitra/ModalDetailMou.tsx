// src/components/mitra/ModalDetailMou.tsx
// Modal detail MoU — info + riwayat perpanjangan + file + WA.

import { useState, useEffect } from 'react';
import {
  Loader2, FileSignature, Building2, Calendar, Clock, User,
  ExternalLink, Edit3, History, CheckCircle2, AlertTriangle,
  ShieldCheck, Copy, FileText, MapPin, Phone, TrendingUp,
  Bell,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { WhatsAppButton } from '@/components/hris/cuti/WhatsAppButton';
import {
  getStatusMouBadge, getExpiryStatusBadge, getExpiryStatusLabel,
  getJenisMitraBadge,
  formatTanggalPanjang, formatRupiah, formatFileSize,
  daysToExpiry,
} from './shared';
import type { MouWithRelations } from '@/types/database';
import { sendManualMouReminder } from '@/lib/mitraNotifications';

type Props = {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  mou: MouWithRelations | null;
  isManager: boolean;
  onEdit: () => void;
};

export function ModalDetailMou({
  open, onClose, mou, isManager, onEdit,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [riwayat, setRiwayat] = useState<MouWithRelations[]>([]);

  useEffect(() => {
    if (!open || !mou?.id) return;
    setLoading(true);

    (async () => {
      try {
        // Cari MoU yang parent_mou_id = mou.id (perpanjangan dari MoU ini)
        const { data } = await supabase
          .from('v_mou_lengkap')
          .select('*')
          .eq('parent_mou_id', mou.id)
          .order('tanggal_mulai', { ascending: false });
        setRiwayat((data as MouWithRelations[]) ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, mou?.id]);

  if (!mou) return null;

  const days = daysToExpiry(mou.tanggal_selesai);
  const isExpired = mou.status === 'Aktif' && days < 0;
  const isH7 = mou.status === 'Aktif' && days >= 0 && days <= 7;
  const isH30 = mou.status === 'Aktif' && days > 7 && days <= 30;

  const handleCopyNomor = () => {
    if (!mou.nomor_mou) return;
    navigator.clipboard.writeText(mou.nomor_mou);
    showToast('success', 'Nomor MoU disalin');
  };

  const waPesan = `Assalamualaikum ${mou.pic_nama ?? 'Bapak/Ibu'}, saya dari SMK KH. A. Wahab Muhsin Sukahideng ingin berkoordinasi terkait MoU "${mou.judul}". Terima kasih.`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detail MoU"
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[78vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* HEADER */}
        <div className={`bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border rounded-2xl p-4 ${
          isExpired ? 'border-rose-500/40' : isH7 ? 'border-rose-500/30' : isH30 ? 'border-amber-500/30' : 'border-indigo-500/30'
        }`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusMouBadge(mou.status)}`}>
                  {mou.status}
                </span>
                <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  {mou.jenis_mou}
                </span>
                {mou.expiry_status && mou.expiry_status !== 'Aman' && mou.status === 'Aktif' && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-0.5 ${getExpiryStatusBadge(mou.expiry_status)}`}>
                    <AlertTriangle size={9} />
                    {getExpiryStatusLabel(mou.expiry_status)}
                  </span>
                )}
              </div>
              <h3 className="text-base font-extrabold text-slate-100">{mou.judul}</h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[11px] font-mono text-indigo-400">{mou.nomor_mou ?? '-'}</p>
                {mou.nomor_mou && (
                  <button
                    onClick={handleCopyNomor}
                    className="p-0.5 rounded text-slate-500 hover:text-indigo-400 transition cursor-pointer"
                  >
                    <Copy size={10} />
                  </button>
                )}
              </div>
            </div>

            {isManager && (
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer shrink-0"
              >
                <Edit3 size={12} /> Edit
              </button>
            )}
          </div>

          {/* Countdown */}
          {mou.status === 'Aktif' && (
            <div className={`mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs ${
              days < 0 ? 'text-rose-400' : days <= 7 ? 'text-rose-400' : days <= 30 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              <span className="flex items-center gap-1.5 font-bold">
                <Clock size={12} />
                {days < 0 ? 'EXPIRED' : 'Sisa waktu'}
              </span>
              <span className="font-extrabold text-base">
                {days < 0 ? `${Math.abs(days)} hari lewat` : `${days} hari`}
              </span>
            </div>
          )}
        </div>

        {/* MITRA */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Mitra</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
              {mou.mitra_logo ? (
                <img src={mou.mitra_logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={18} className="text-indigo-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                {mou.jenis_mitra && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisMitraBadge(mou.jenis_mitra)}`}>
                    {mou.jenis_mitra}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-200">{mou.mitra_nama ?? '-'}</p>
              {mou.bidang_industri && (
                <p className="text-[10px] text-slate-500">{mou.bidang_industri}</p>
              )}
            </div>
          </div>
        </div>

        {/* INFO GRID */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <InfoBox icon={Calendar} label="Tanggal Mulai" value={formatTanggalPanjang(mou.tanggal_mulai)} />
          <InfoBox icon={Calendar} label="Tanggal Selesai" value={formatTanggalPanjang(mou.tanggal_selesai)} />
          <InfoBox icon={Clock} label="Durasi" value={mou.durasi_bulan ? `${mou.durasi_bulan} bulan` : '-'} />
          <InfoBox icon={TrendingUp} label="Nilai Kerjasama" value={formatRupiah(mou.nilai_kerjasama)} />
          <InfoBox icon={User} label="Penandatangan Sekolah" value={mou.penandatangan_sekolah_nama ?? '-'} />
          <InfoBox icon={User} label="Penandatangan Mitra"
            value={mou.penandatangan_mitra_nama
              ? `${mou.penandatangan_mitra_nama}${mou.penandatangan_mitra_jabatan ? ` (${mou.penandatangan_mitra_jabatan})` : ''}`
              : '-'} />
        </div>

        {mou.lingkup_kerjasama && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Lingkup Kerjasama</p>
            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{mou.lingkup_kerjasama}</p>
          </div>
        )}

        {mou.deskripsi && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Deskripsi</p>
            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{mou.deskripsi}</p>
          </div>
        )}

        {/* FILE */}
        {mou.file_url && (
          <a
            href={mou.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <FileText size={14} /> Buka File MoU
            {mou.file_size && (
              <span className="text-[10px] opacity-70">({formatFileSize(mou.file_size)})</span>
            )}
            <ExternalLink size={12} />
          </a>
        )}

        {/* PIC & WA */}
        {mou.pic_nama && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">PIC Mitra</p>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                {mou.pic_nama.charAt(0).toUpperCase()}
              </div>
              <p className="text-xs font-bold text-slate-200 truncate">{mou.pic_nama}</p>
            </div>
            {mou.pic_no_hp && (
              <>
                <p className="text-[11px] text-slate-400 mb-2 flex items-center gap-1.5">
                  <Phone size={10} /> {mou.pic_no_hp}
                </p>
                <WhatsAppButton
                  nomor={mou.pic_no_hp}
                  pesan={waPesan}
                  label="Chat WA PIC"
                  variant="outline"
                  size="sm"
                  className="w-full"
                />
              </>
            )}
          </div>
        )}

        {/* RIWAYAT PERPANJANGAN */}
        {mou.parent_mou_nomor && (
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-cyan-400 mb-1 flex items-center gap-1">
              <History size={10} /> Perpanjangan dari
            </p>
            <p className="text-xs font-mono text-cyan-300">{mou.parent_mou_nomor}</p>
          </div>
        )}

        {/* CHILD MoU — perpanjangan setelah ini */}
        {riwayat.length > 0 && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
            <p className="text-[10px] uppercase font-bold text-cyan-400 mb-2 flex items-center gap-1">
              <History size={10} /> Diperpanjang oleh ({riwayat.length})
            </p>
            <div className="space-y-2">
              {riwayat.map((r) => (
                <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusMouBadge(r.status)}`}>
                      {r.status}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                      {r.jenis_mou}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-200 truncate">{r.judul}</p>
                  <p className="text-[10px] font-mono text-cyan-400">{r.nomor_mou ?? '-'}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {formatTanggalPanjang(r.tanggal_mulai)} — {formatTanggalPanjang(r.tanggal_selesai)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WARNING EXPIRED */}
        {isExpired && (
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-rose-300">MoU Sudah Expired</p>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Segera perpanjang dengan membuat MoU baru (perpanjangan dari MoU ini)
                atau ubah status ke Diperpanjang.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// =============================================================================
// SUB
// =============================================================================
function InfoBox({ icon: Icon, label, value }: {
  icon: any; label: string; value: string;
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500 mb-1">
        <Icon size={10} /> {label}
      </div>
      <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
    </div>
  );
}