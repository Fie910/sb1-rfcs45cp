// src/components/hris/cuti/PengajuanSayaTab.tsx
// Tab Pengajuan Saya — list pengajuan cuti milik user + saldo + CRUD.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Loader2, Calendar, Clock, CheckCircle2, XCircle,
  Pencil, Trash2, Eye, Building2, ChevronRight, MessageCircle,
  TrendingUp, AlertTriangle, ShieldCheck, FileText, History,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { WhatsAppButton } from './WhatsAppButton';
import { ModalPengajuanCuti } from './ModalPengajuanCuti';
import {
  getStatusCutiBadge, getJenisCutiBadge,
  formatJumlahHari, formatDateShort,
  STATUS_CUTI_AKTIF,
} from '../shared';
import type {
  HrisCutiWithRelations, HrisJenisCuti, HrisSaldoCuti, Guru,
  HrisCutiApproval,
} from '@/types/database';

export function PengajuanSayaTab() {
  const { guru } = useAuth();
  const [list, setList] = useState<HrisCutiWithRelations[]>([]);
  const [jenisList, setJenisList] = useState<HrisJenisCuti[]>([]);
  const [guruList, setGuruList] = useState<Pick<Guru, 'id' | 'nama_lengkap' | 'nip' | 'jenis_ptk'>[]>([]);
  const [saldo, setSaldo] = useState<HrisSaldoCuti | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HrisCutiWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HrisCutiWithRelations | null>(null);
  const [detailTarget, setDetailTarget] = useState<HrisCutiWithRelations | null>(null);

  const currentYear = new Date().getFullYear();

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);
    try {
      const [cutiRes, jenisRes, guruRes, saldoRes] = await Promise.all([
        supabase
          .from('v_hris_cuti_lengkap')
          .select('*')
          .eq('guru_id', guru.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('hris_jenis_cuti')
          .select('*')
          .eq('is_aktif', true)
          .order('urutan_tampil'),
        supabase
          .from('gurus')
          .select('id, nama_lengkap, nip, jenis_ptk')
          .order('nama_lengkap'),
        supabase
          .from('hris_saldo_cuti')
          .select('*')
          .eq('guru_id', guru.id)
          .eq('tahun', currentYear)
          .maybeSingle(),
      ]);

      if (cutiRes.error) throw cutiRes.error;

      setList((cutiRes.data as HrisCutiWithRelations[]) ?? []);
      setJenisList((jenisRes.data as HrisJenisCuti[]) ?? []);
      setGuruList((guruRes.data as any[]) ?? []);
      setSaldo(saldoRes.data as HrisSaldoCuti | null);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [guru?.id, currentYear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const total = list.length;
    const aktif = list.filter((c) => STATUS_CUTI_AKTIF.includes(c.status)).length;
    const disetujui = list.filter((c) => c.status === 'Disetujui').length;
    const ditolak = list.filter((c) => c.status === 'Ditolak').length;
    return { total, aktif, disetujui, ditolak };
  }, [list]);

  const saldoSisa = saldo?.saldo_sisa ?? 12;
  const saldoTerpakai = saldo?.saldo_terpakai ?? 0;
  const saldoAwal = saldo?.saldo_awal ?? 12;

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: HrisCutiWithRelations) => {
    if (!['Draft', 'Diajukan'].includes(item.status)) {
      showToast('error', 'Pengajuan yang sudah diproses tidak dapat diubah');
      return;
    }
    setEditing(item);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('hris_cuti')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.HRIS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus pengajuan: ${deleteTarget.jenis_nama ?? '-'}`,
      });
      showToast('success', 'Pengajuan dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const handleBatalkan = async (item: HrisCutiWithRelations) => {
    try {
      const { error } = await supabase
        .from('hris_cuti')
        .update({ status: 'Dibatalkan' })
        .eq('id', item.id);
      if (error) throw error;

      await supabase.from('hris_cuti_approval').insert({
        cuti_id: item.id,
        approver_id: guru!.id,
        approver_role: guru!.role,
        level: item.current_level,
        aksi: 'Batal',
        catatan: 'Dibatalkan oleh pengaju',
      });

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.HRIS,
        targetId: item.id,
        deskripsi: `Batalkan pengajuan: ${item.jenis_nama}`,
      });
      showToast('success', 'Pengajuan dibatalkan');
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <FileText className="text-indigo-400" size={20} /> Pengajuan Saya
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {stats.total} pengajuan · {stats.aktif} menunggu · {stats.disetujui} disetujui
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition cursor-pointer shrink-0 active:scale-95"
        >
          <Plus size={16} /> Ajukan Cuti / Izin
        </button>
      </div>

      {/* SALDO CUTI CARD */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
              Saldo Cuti Tahunan {currentYear}
            </p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-extrabold text-emerald-400">
                {saldoSisa}
              </span>
              <span className="text-sm text-slate-400 mb-1">hari tersisa</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-1">
              Terpakai: <span className="font-bold text-amber-400">{saldoTerpakai}</span> / {saldoAwal} hari
            </p>
            <div className="w-40 h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${(saldoTerpakai / saldoAwal) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* FILTER INFO */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: `Semua (${stats.total})`, count: stats.total },
          { label: `Menunggu (${stats.aktif})`, count: stats.aktif, color: 'amber' },
          { label: `Disetujui (${stats.disetujui})`, count: stats.disetujui, color: 'emerald' },
          { label: `Ditolak (${stats.ditolak})`, count: stats.ditolak, color: 'rose' },
        ].map((t) => (
          <span
            key={t.label}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400"
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* LIST */}
      {list.length === 0 ? (
        <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 text-center py-16 px-6">
          <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={32} />
          </div>
          <p className="text-slate-400 text-base font-medium">Belum ada pengajuan</p>
          <p className="text-xs text-slate-500 mt-1">
            Klik "Ajukan Cuti / Izin" untuk memulai
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map((item) => (
            <CutiCard
              key={item.id}
              item={item}
              onEdit={() => handleOpenEdit(item)}
              onDelete={() => setDeleteTarget(item)}
              onDetail={() => setDetailTarget(item)}
              onBatalkan={() => handleBatalkan(item)}
            />
          ))}
        </div>
      )}

      {/* MODAL FORM */}
      <ModalPengajuanCuti
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  onSaved={fetchAll}
  editing={editing as any}
  guruList={guruList}
  jenisList={jenisList}
  guruId={guru?.id ?? ''}
  userRole={guru?.role}
/>

      {/* MODAL DETAIL */}
      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="Detail Pengajuan"
        size="md"
      >
        {detailTarget && <DetailPengajuan item={detailTarget} />}
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Pengajuan"
        message={`Yakin hapus pengajuan "${deleteTarget?.jenis_nama}"?`}
      />
    </div>
  );
}

// =============================================================================
// SUB: Kartu Cuti
// =============================================================================
function CutiCard({
  item, onEdit, onDelete, onDetail, onBatalkan,
}: {
  item: HrisCutiWithRelations;
  onEdit: () => void;
  onDelete: () => void;
  onDetail: () => void;
  onBatalkan: () => void;
}) {
  const isFinal = ['Disetujui', 'Ditolak', 'Dibatalkan'].includes(item.status);
  const canEdit = ['Draft', 'Diajukan'].includes(item.status);
  const canCancel = STATUS_CUTI_AKTIF.includes(item.status);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 hover:border-slate-700 transition group">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${getJenisCutiBadge(item.jenis_warna)}`}>
            <Calendar size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-100 truncate">
              {item.jenis_nama ?? '-'}
            </p>
            <p className="text-[10px] font-mono text-indigo-400 truncate">
              {item.nomor_pengajuan ?? '-'}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${getStatusCutiBadge(item.status)}`}>
          {item.status}
        </span>
      </div>

      {/* PERIODE */}
      <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 mb-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1">
            <Calendar size={11} /> Periode
          </span>
          <span className="text-slate-200 font-semibold">
            {formatDateShort(item.tanggal_mulai)} — {formatDateShort(item.tanggal_selesai)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1">
            <Clock size={11} /> Durasi
          </span>
          <span className="text-slate-200 font-semibold">
            {formatJumlahHari(item.jumlah_hari)}
            {item.jumlah_jam ? ` (${item.jumlah_jam} jam)` : ''}
          </span>
        </div>
        {item.mengurangi_saldo_tahunan && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <AlertTriangle size={10} /> Memotong saldo cuti tahunan
          </div>
        )}
      </div>

      {/* ALASAN */}
      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{item.alasan}</p>

      {/* AKTIONS */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-1">
          <button
            onClick={onDetail}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 text-[10px] font-bold transition cursor-pointer"
          >
            <Eye size={11} /> Detail
          </button>
          {canEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 text-[10px] font-bold transition cursor-pointer"
            >
              <Pencil size={11} /> Edit
            </button>
          )}
          {canCancel && (
            <button
              onClick={onBatalkan}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 text-[10px] font-bold transition cursor-pointer"
            >
              <XCircle size={11} /> Batalkan
            </button>
          )}
          {item.status === 'Draft' && (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 text-[10px] font-bold transition cursor-pointer"
            >
              <Trash2 size={11} /> Hapus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: Detail Pengajuan
// =============================================================================
function DetailPengajuan({ item }: { item: HrisCutiWithRelations }) {
  const [history, setHistory] = useState<HrisCutiApproval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('hris_cuti_approval')
        .select('*')
        .eq('cuti_id', item.id)
        .order('created_at', { ascending: true });
      setHistory((data as HrisCutiApproval[]) ?? []);
      setLoading(false);
    })();
  }, [item.id]);

  // Auto-fill pesan WA
  const waPesan = `Assalamualaikum, saya ${item.guru_nama}, mengajukan ${item.jenis_nama} dari ${formatDateShort(item.tanggal_mulai)} s/d ${formatDateShort(item.tanggal_selesai)} (${formatJumlahHari(item.jumlah_hari)}). Mohon diperiksa. Terima kasih.`;

  return (
    <div className="space-y-3 pt-1">
      <div className={`bg-slate-950/60 border rounded-2xl p-4 ${getStatusCutiBadge(item.status)}`}>
        <p className="text-[10px] font-mono opacity-80">{item.nomor_pengajuan ?? '-'}</p>
        <p className="text-base font-extrabold mt-0.5">{item.jenis_nama}</p>
        <p className="text-xs opacity-90 mt-1">Status: {item.status}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <DetailBox label="Tanggal Mulai" value={formatDateShort(item.tanggal_mulai)} />
        <DetailBox label="Tanggal Selesai" value={formatDateShort(item.tanggal_selesai)} />
        <DetailBox label="Jumlah Hari" value={formatJumlahHari(item.jumlah_hari)} />
        <DetailBox
          label="Jam"
          value={item.jam_mulai ? `${item.jam_mulai} - ${item.jam_selesai}` : '-'}
        />
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Alasan</p>
        <p className="text-xs text-slate-200 whitespace-pre-wrap">{item.alasan}</p>
      </div>

      {item.alamat_selama_cuti && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Alamat Selama Cuti</p>
          <p className="text-xs text-slate-200">{item.alamat_selama_cuti}</p>
          {item.no_hp_selama_cuti && (
            <p className="text-xs text-slate-400 mt-1">📞 {item.no_hp_selama_cuti}</p>
          )}
        </div>
      )}

      {item.lampiran_url && (
        <a
          href={item.lampiran_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
        >
          <FileText size={14} /> Buka Lampiran
        </a>
      )}

      {/* HISTORY APPROVAL */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
        <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-1.5">
          <History size={11} /> Riwayat Approval
        </p>
        {loading ? (
          <Loader2 className="animate-spin text-indigo-400 mx-auto" size={16} />
        ) : history.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">Belum ada riwayat</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-start gap-2 text-[11px]">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                    h.aksi === 'Approve'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : h.aksi === 'Reject'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}
                >
                  {h.aksi === 'Approve' ? '✓' : h.aksi === 'Reject' ? '✗' : '⊘'}
                </div>
                <div className="flex-1">
                  <p className="text-slate-300 font-semibold">
                    Level {h.level} — {h.aksi}
                  </p>
                  {h.catatan && (
                    <p className="text-slate-500 italic">"{h.catatan}"</p>
                  )}
                  <p className="text-slate-600 text-[10px]">
                    {new Date(h.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WA BUTTON */}
      <div className="pt-1">
        <WhatsAppButton
          nomor={item.no_hp_selama_cuti}
          pesan={waPesan}
          label="Follow-up via WhatsApp"
          variant="outline"
          className="w-full"
        />
      </div>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{label}</p>
      <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
    </div>
  );
}
