// src/components/mitra/ModalDetailMitra.tsx
// Modal detail mitra — info + MoU aktif + riwayat aktivitas + WA.

import { useState, useEffect } from 'react';
import {
  Loader2, Building2, Globe, Phone, Mail, MapPin, User, Star,
  FileSignature, History, ExternalLink, Pencil, Edit3, MessageCircle,
  Clock, Calendar, TrendingUp, AlertCircle, CheckCircle2, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { WhatsAppButton } from '@/components/hris/cuti/WhatsAppButton';
import {
  getStatusMitraBadge, getJenisMitraBadge, getStatusMouBadge,
  getJenisAktivitasBadge, getRatingStars,
  formatTanggal, formatTanggalPanjang, formatRupiah,
  getExpiryStatusBadge, getExpiryStatusLabel,
} from './shared';
import type {
  MitraWithRelations, MouWithRelations, MitraAktivitasWithRelations,
} from '@/types/database';

type TabKey = 'info' | 'mou' | 'aktivitas';

type Props = {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  mitra: MitraWithRelations | null;
  isManager: boolean;
  onEdit: () => void;
};

export function ModalDetailMitra({
  open, onClose, mitra, isManager, onEdit,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [loading, setLoading] = useState(false);
  const [mouList, setMouList] = useState<MouWithRelations[]>([]);
  const [aktivitasList, setAktivitasList] = useState<MitraAktivitasWithRelations[]>([]);

  useEffect(() => {
    if (!open || !mitra?.id) return;
    setActiveTab('info');
    setLoading(true);

    (async () => {
      try {
        const [mouRes, aktRes] = await Promise.all([
          supabase
            .from('v_mou_lengkap')
            .select('*')
            .eq('mitra_id', mitra.id)
            .order('tanggal_mulai', { ascending: false }),
          supabase
            .from('mitra_aktivitas')
            .select('*, mitra:mitra!mitra_id(nama, kode_mitra), mou:mou!mou_id(nomor_mou)')
            .eq('mitra_id', mitra.id)
            .order('tanggal', { ascending: false }),
        ]);

        setMouList((mouRes.data as MouWithRelations[]) ?? []);
        setAktivitasList(
          ((aktRes.data as any[]) ?? []).map((a) => ({
            ...a,
            mitra_nama: a.mitra?.nama ?? null,
            kode_mitra: a.mitra?.kode_mitra ?? null,
            mou_nomor: a.mou?.nomor_mou ?? null,
          }))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, mitra?.id]);

  if (!mitra) return null;

  const waPesan = `Assalamualaikum, saya dari SMK KH. A. Wahab Muhsin Sukahideng ingin berkoordinasi terkait kerjasama. Terima kasih.`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detail Mitra"
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[78vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* HEADER */}
        <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
              {mitra.logo_url ? (
                <img src={mitra.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={24} className="text-indigo-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getJenisMitraBadge(mitra.jenis_mitra)}`}>
                  {mitra.jenis_mitra}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusMitraBadge(mitra.status)}`}>
                  {mitra.status}
                </span>
                {mitra.skala && (
                  <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {mitra.skala}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-extrabold text-slate-100">{mitra.nama}</h3>
              <p className="text-[11px] font-mono text-indigo-400 mt-0.5">
                {mitra.kode_mitra ?? '-'}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-amber-400 font-bold">{getRatingStars(mitra.rating)}</span>
                <span className="text-[10px] text-slate-500">({mitra.rating}/5)</span>
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

          {/* Kategori chips */}
          {mitra.kategori_kerjasama && mitra.kategori_kerjasama.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-800/60">
              {mitra.kategori_kerjasama.map((k, i) => (
                <span key={i} className="text-[10px] font-bold text-indigo-300 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* TAB NAV */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1">
          {[
            { key: 'info' as TabKey, label: 'Info', icon: Building2 },
            { key: 'mou' as TabKey, label: `MoU (${mouList.length})`, icon: FileSignature },
            { key: 'aktivitas' as TabKey, label: `Aktivitas (${aktivitasList.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="animate-spin text-indigo-400 mx-auto" size={24} />
          </div>
        ) : (
          <div>
            {activeTab === 'info' && <TabInfo mitra={mitra} waPesan={waPesan} />}
            {activeTab === 'mou' && <TabMou mouList={mouList} />}
            {activeTab === 'aktivitas' && <TabAktivitas aktivitasList={aktivitasList} />}
          </div>
        )}
      </div>
    </Modal>
  );
}

// =============================================================================
// TAB: Info
// =============================================================================
function TabInfo({ mitra, waPesan }: {
  mitra: MitraWithRelations; waPesan: string;
}) {
  return (
    <div className="space-y-3">
      {mitra.deskripsi && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Deskripsi</p>
          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{mitra.deskripsi}</p>
        </div>
      )}

      {/* Statistik */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="MoU Aktif" value={mitra.total_mou_aktif ?? 0} color="emerald" />
        <StatBox label="Siswa PKL" value={mitra.total_siswa_pkl ?? 0} color="indigo" />
        <StatBox label="Direkrut" value={mitra.total_siswa_direkrut ?? 0} color="teal" />
      </div>

      {/* Alamat */}
      {(mitra.alamat || mitra.kota) && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
          <p className="text-[10px] uppercase font-bold text-slate-500">Alamat</p>
          {mitra.alamat && (
            <p className="text-xs text-slate-200 leading-relaxed flex items-start gap-2">
              <MapPin size={11} className="text-slate-500 mt-0.5 shrink-0" />
              {mitra.alamat}
            </p>
          )}
          {(mitra.kota || mitra.provinsi) && (
            <p className="text-xs text-slate-300 font-semibold">
              {mitra.kota}{mitra.provinsi ? `, ${mitra.provinsi}` : ''}
              {mitra.kode_pos ? ` ${mitra.kode_pos}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Kontak perusahaan */}
      {(mitra.website || mitra.telepon || mitra.email) && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
          <p className="text-[10px] uppercase font-bold text-slate-500">Kontak Perusahaan</p>
          {mitra.website && (
            <a href={mitra.website} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition">
              <Globe size={11} /> {mitra.website}
            </a>
          )}
          {mitra.telepon && (
            <p className="flex items-center gap-2 text-xs text-slate-300">
              <Phone size={11} className="text-slate-500" /> {mitra.telepon}
            </p>
          )}
          {mitra.email && (
            <p className="flex items-center gap-2 text-xs text-slate-300">
              <Mail size={11} className="text-slate-500" /> {mitra.email}
            </p>
          )}
        </div>
      )}

      {/* PIC */}
      {mitra.pic_nama && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">PIC / Kontak Person</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-bold shrink-0">
              {mitra.pic_nama.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200 truncate">{mitra.pic_nama}</p>
              {mitra.pic_jabatan && (
                <p className="text-[10px] text-slate-500">{mitra.pic_jabatan}</p>
              )}
            </div>
          </div>
          {mitra.pic_no_hp && (
            <p className="text-[11px] text-slate-400 mb-2">📞 {mitra.pic_no_hp}</p>
          )}
          {mitra.pic_no_hp && (
            <WhatsAppButton
              nomor={mitra.pic_no_hp}
              pesan={waPesan}
              label="Chat WA PIC"
              variant="outline"
              size="sm"
              className="w-full"
            />
          )}
        </div>
      )}

      {mitra.catatan && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-amber-400 mb-1">Catatan Internal</p>
          <p className="text-xs text-slate-300 whitespace-pre-wrap">{mitra.catatan}</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB: MoU
// =============================================================================
function TabMou({ mouList }: { mouList: MouWithRelations[] }) {
  if (mouList.length === 0) {
    return (
      <div className="text-center py-8">
        <FileSignature size={32} className="mx-auto text-slate-600 mb-2" />
        <p className="text-xs text-slate-500">Belum ada MoU dengan mitra ini</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mouList.map((m) => (
        <div key={m.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusMouBadge(m.status)}`}>
                  {m.status}
                </span>
                <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                  {m.jenis_mou}
                </span>
                {m.expiry_status && m.expiry_status !== 'Aman' && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getExpiryStatusBadge(m.expiry_status)}`}>
                    {getExpiryStatusLabel(m.expiry_status)}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-200 truncate">{m.judul}</p>
              <p className="text-[10px] font-mono text-indigo-400">{m.nomor_mou ?? '-'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 mt-1.5">
            <span className="inline-flex items-center gap-1">
              <Calendar size={9} /> {formatTanggal(m.tanggal_mulai)} — {formatTanggal(m.tanggal_selesai)}
            </span>
            {m.durasi_bulan && (
              <span className="inline-flex items-center gap-1">
                <Clock size={9} /> {m.durasi_bulan} bulan
              </span>
            )}
          </div>

          {m.file_url && (
            <a
              href={m.file_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300"
            >
              <ExternalLink size={10} /> Buka file MoU
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// TAB: Aktivitas
// =============================================================================
function TabAktivitas({ aktivitasList }: { aktivitasList: MitraAktivitasWithRelations[] }) {
  if (aktivitasList.length === 0) {
    return (
      <div className="text-center py-8">
        <History size={32} className="mx-auto text-slate-600 mb-2" />
        <p className="text-xs text-slate-500">Belum ada riwayat aktivitas</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {aktivitasList.map((a) => (
        <div key={a.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <div className="flex items-start gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${getJenisAktivitasBadge(a.jenis)}`}>
              <History size={13} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisAktivitasBadge(a.jenis)}`}>
                  {a.jenis}
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatTanggal(a.tanggal)}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-200">{a.judul}</p>
              {a.deskripsi && (
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{a.deskripsi}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                {a.jumlah_siswa ? <span>{a.jumlah_siswa} siswa</span> : null}
                {a.jumlah_guru ? <span>{a.jumlah_guru} guru</span> : null}
                {a.mou_nomor && <span className="font-mono">{a.mou_nomor}</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// SUB
// =============================================================================
function StatBox({ label, value, color }: {
  label: string; value: number; color: 'emerald' | 'indigo' | 'teal';
}) {
  const cm = {
    emerald: 'text-emerald-400',
    indigo: 'text-indigo-400',
    teal: 'text-teal-400',
  };
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-center">
      <p className={`text-lg font-extrabold ${cm[color]}`}>{value}</p>
      <p className="text-[9px] font-bold uppercase text-slate-500">{label}</p>
    </div>
  );
}