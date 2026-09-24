// src/components/hris/cuti/ApprovalTab.tsx
// Tab Approval — daftar pengajuan yang perlu di-approve + aksi.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, ShieldCheck, CheckCircle2, XCircle, Clock,
  Calendar, Eye, Inbox, History, MessageCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { WhatsAppButton } from './WhatsAppButton';
import {
  getStatusCutiBadge, getJenisCutiBadge,
  formatJumlahHari, formatDateShort,
  HR_APPROVER_ROLES, KEPSEK_ROLES, KEPALA_DIVISI_ROLES,
  STATUS_CUTI_AKTIF,
} from '../shared';
import type { HrisCutiWithRelations, HrisCutiApproval } from '@/types/database';

// Mapping role → level approval
function getApproverLevelFromRole(role: string | null | undefined): number {
  if (!role) return 0;
  const r = role.toLowerCase();
  if (KEPSEK_ROLES.includes(r)) return 3;
  if (HR_APPROVER_ROLES.includes(r)) return 2;
  if (KEPALA_DIVISI_ROLES.includes(r)) return 1;
  return 0;
}

// Status target setelah approve di level tertentu
function nextStatusForLevel(nextLevel: number): string {
  if (nextLevel >= 4) return 'Disetujui';
  if (nextLevel === 3) return 'Disetujui HR';
  if (nextLevel === 2) return 'Disetujui Atasan';
  return 'Diajukan';
}

export function ApprovalTab() {
  const { guru } = useAuth();
  const [allPending, setAllPending] = useState<HrisCutiWithRelations[]>([]);
  const [myHistory, setMyHistory] = useState<(HrisCutiApproval & { cuti?: HrisCutiWithRelations })[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailTarget, setDetailTarget] = useState<HrisCutiWithRelations | null>(null);
  const [rejectTarget, setRejectTarget] = useState<HrisCutiWithRelations | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<HrisCutiWithRelations | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const myLevel = getApproverLevelFromRole(guru?.role);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        supabase
          .from('v_hris_cuti_lengkap')
          .select('*')
          .in('status', STATUS_CUTI_AKTIF)
          .order('created_at', { ascending: true }),
        supabase
          .from('hris_cuti_approval')
          .select(`
            *,
            cuti:hris_cuti!inner(id, nomor_pengajuan, guru_id, tanggal_mulai, tanggal_selesai, jumlah_hari, jenis_id, status)
          `)
          .eq('approver_id', guru.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setAllPending((pendingRes.data as HrisCutiWithRelations[]) ?? []);
      setMyHistory((historyRes.data as any[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [guru?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // DERIVED: Filter yang perlu saya approve
  // ==========================================================================
  const myPending = useMemo(() => {
    if (myLevel === 0) return [];
    return allPending.filter((c) => {
      // Hanya yang level saat ini = level saya
      if (c.current_level !== myLevel) return false;
      // Jangan tampilkan pengajuan sendiri
      if (c.guru_id === guru?.id) return false;

      // Level 1: hanya dari divisi yang sama
      if (myLevel === 1) {
        // Cek divisi user & pengaju (butuh data guru_id → divisi)
        // Simplifikasi: tampilkan semua, karena data divisi tidak tersedia di view
        // TODO: filter berdasarkan divisi kalau perlu
        return true;
      }

      return true;
    });
  }, [allPending, myLevel, guru?.id]);

  // ==========================================================================
  // APPROVE / REJECT
  // ==========================================================================
  const handleApprove = async () => {
    if (!approveTarget || !guru?.id) return;
    setProcessing(true);
    try {
      const nextLevel = approveTarget.current_level + 1;
      const newStatus = nextStatusForLevel(nextLevel);

      // Update cuti
      const updateData: any = {
        current_level: nextLevel,
        status: newStatus,
      };
      if (nextLevel >= 4) {
        updateData.approved_by = guru.id;
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('hris_cuti')
        .update(updateData)
        .eq('id', approveTarget.id);
      if (error) throw error;

      // Insert history
      await supabase.from('hris_cuti_approval').insert({
        cuti_id: approveTarget.id,
        approver_id: guru.id,
        approver_role: guru.role,
        level: approveTarget.current_level,
        aksi: 'Approve',
        catatan: approveNote.trim() || null,
      });

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.HRIS,
        targetId: approveTarget.id,
        deskripsi: `Approve ${approveTarget.jenis_nama} (Level ${approveTarget.current_level}) — ${approveTarget.guru_nama}`,
      });

      showToast(
        'success',
        nextLevel >= 4
          ? `Disetujui final: ${approveTarget.guru_nama}`
          : `Disetujui level ${approveTarget.current_level}, diteruskan ke level ${nextLevel}`
      );
      setApproveTarget(null);
      setApproveNote('');
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !guru?.id) return;
    if (!rejectReason.trim()) {
      showToast('error', 'Alasan penolakan wajib diisi');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('hris_cuti')
        .update({
          status: 'Ditolak',
          alasan_penolakan: rejectReason.trim(),
        })
        .eq('id', rejectTarget.id);
      if (error) throw error;

      await supabase.from('hris_cuti_approval').insert({
        cuti_id: rejectTarget.id,
        approver_id: guru.id,
        approver_role: guru.role,
        level: rejectTarget.current_level,
        aksi: 'Reject',
        catatan: rejectReason.trim(),
      });

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.HRIS,
        targetId: rejectTarget.id,
        deskripsi: `Tolak ${rejectTarget.jenis_nama} — ${rejectTarget.guru_nama}: ${rejectReason.trim()}`,
      });

      showToast('success', `Pengajuan ditolak`);
      setRejectTarget(null);
      setRejectReason('');
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setProcessing(false);
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

  if (myLevel === 0) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 text-center">
        <XCircle size={40} className="mx-auto text-amber-400 mb-3" />
        <p className="text-sm font-bold text-amber-300">Anda bukan approver</p>
        <p className="text-xs text-amber-400/80 mt-1">
          Role Anda tidak memiliki kewenangan approval
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="text-indigo-400" size={20} /> Approval
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Level Anda: <span className="font-bold text-indigo-400">{myLevel}</span> · {myPending.length} menunggu
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiBox
          icon={Inbox}
          label="Menunggu"
          value={myPending.length}
          color="amber"
        />
        <KpiBox
          icon={CheckCircle2}
          label="Total Disetujui"
          value={myHistory.filter((h) => h.aksi === 'Approve').length}
          color="emerald"
        />
        <KpiBox
          icon={XCircle}
          label="Total Ditolak"
          value={myHistory.filter((h) => h.aksi === 'Reject').length}
          color="rose"
        />
      </div>

      {/* LIST PENDING */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">
          Perlu Approval Saya ({myPending.length})
        </h3>
        {myPending.length === 0 ? (
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 text-center py-12">
            <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
            <p className="text-sm font-bold text-slate-300">Semua bersih! 🎉</p>
            <p className="text-xs text-slate-500 mt-1">Tidak ada pengajuan yang menunggu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myPending.map((item) => (
              <ApprovalCard
                key={item.id}
                item={item}
                onDetail={() => setDetailTarget(item)}
                onApprove={() => setApproveTarget(item)}
                onReject={() => setRejectTarget(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* HISTORY SAYA */}
      {myHistory.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <History size={12} /> History Approval Saya
          </h3>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
            {myHistory.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    h.aksi === 'Approve'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : h.aksi === 'Reject'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}
                >
                  {h.aksi === 'Approve' ? <CheckCircle2 size={14} /> : h.aksi === 'Reject' ? <XCircle size={14} /> : <XCircle size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {h.aksi} — Level {h.level}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(h.created_at).toLocaleString('id-ID')}
                  </p>
                  {h.catatan && (
                    <p className="text-[10px] text-slate-400 italic mt-0.5">"{h.catatan}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL APPROVE */}
      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Setujui Pengajuan"
        size="sm"
      >
        {approveTarget && (
          <div className="space-y-4 pt-1">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
              <p className="text-xs font-bold text-emerald-300">
                {approveTarget.guru_nama}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {approveTarget.jenis_nama} · {formatJumlahHari(approveTarget.jumlah_hari)}
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDateShort(approveTarget.tanggal_mulai)} — {formatDateShort(approveTarget.tanggal_selesai)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Catatan (opsional)
              </label>
              <textarea
                rows={3}
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Contoh: Disetujui, silakan koordinasi dengan pengganti"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setApproveTarget(null)}
                disabled={processing}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleApprove}
                disabled={processing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Setujui
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL REJECT */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Tolak Pengajuan"
        size="sm"
      >
        {rejectTarget && (
          <div className="space-y-4 pt-1">
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
              <p className="text-xs font-bold text-rose-300">
                {rejectTarget.guru_nama}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {rejectTarget.jenis_nama} · {formatJumlahHari(rejectTarget.jumlah_hari)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Alasan Penolakan *
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Bentrok dengan jadwal ujian semester"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={processing}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Tolak
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL DETAIL */}
      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="Detail Pengajuan"
        size="md"
      >
        {detailTarget && <ApprovalDetail item={detailTarget} />}
      </Modal>
    </div>
  );
}

// =============================================================================
// SUB: Approval Card
// =============================================================================
function ApprovalCard({
  item, onDetail, onApprove, onReject,
}: {
  item: HrisCutiWithRelations;
  onDetail: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 hover:border-indigo-500/40 transition">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${getJenisCutiBadge(item.jenis_warna)}`}>
          <Calendar size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-100 truncate">
                {item.guru_nama ?? '-'}
              </p>
              <p className="text-[10px] font-mono text-indigo-400">
                {item.guru_nip ? `NIP: ${item.guru_nip}` : 'Tanpa NIP'}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${getStatusCutiBadge(item.status)}`}>
              {item.status}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{item.jenis_nama}</span>
              <span className="text-slate-200 font-semibold">
                {formatJumlahHari(item.jumlah_hari)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Periode</span>
              <span className="text-slate-300">
                {formatDateShort(item.tanggal_mulai)} — {formatDateShort(item.tanggal_selesai)}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 line-clamp-2 mt-2">{item.alasan}</p>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
            <button
              onClick={onDetail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-[10px] font-bold transition cursor-pointer"
            >
              <Eye size={11} /> Detail
            </button>
            <div className="flex-1" />
            <button
              onClick={onReject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold transition cursor-pointer"
            >
              <XCircle size={11} /> Tolak
            </button>
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition cursor-pointer"
            >
              <CheckCircle2 size={11} /> Setujui
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: Detail Approval
// =============================================================================
function ApprovalDetail({ item }: { item: HrisCutiWithRelations }) {
  const waPesan = `Assalamualaikum ${item.guru_nama}, saya ingin konfirmasi pengajuan ${item.jenis_nama} Anda tanggal ${formatDateShort(item.tanggal_mulai)} - ${formatDateShort(item.tanggal_selesai)}.`;

  return (
    <div className="space-y-3 pt-1">
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
        <p className="text-[10px] font-mono text-indigo-400">{item.nomor_pengajuan}</p>
        <p className="text-sm font-bold text-slate-100 mt-0.5">{item.guru_nama}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {item.jenis_nama} · {item.status}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
          <p className="text-[10px] uppercase text-slate-500">Mulai</p>
          <p className="font-bold text-slate-200">{formatDateShort(item.tanggal_mulai)}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
          <p className="text-[10px] uppercase text-slate-500">Selesai</p>
          <p className="font-bold text-slate-200">{formatDateShort(item.tanggal_selesai)}</p>
        </div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Alasan</p>
        <p className="text-xs text-slate-200 whitespace-pre-wrap">{item.alasan}</p>
      </div>

      {item.lampiran_url && (
        <a
          href={item.lampiran_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
        >
          Buka Lampiran
        </a>
      )}

      <WhatsAppButton
        nomor={item.no_hp_selama_cuti}
        pesan={waPesan}
        label="Hubungi Pengaju"
        variant="outline"
        className="w-full"
      />
    </div>
  );
}

// =============================================================================
// SUB: KPI Box
// =============================================================================
function KpiBox({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color: 'amber' | 'emerald' | 'rose';
}) {
  const cm: Record<string, string> = {
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };
  const c = cm[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl ${c} border flex items-center justify-center shrink-0`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-base font-extrabold ${c.split(' ')[1]}`}>{value}</p>
      </div>
    </div>
  );
}