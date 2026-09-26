// src/components/arsip/ModalDetailArsip.tsx
// Modal detail arsip — view, versioning, tracking pembaca, aktivitas.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, X, FileText, Download, ExternalLink, Eye, Users,
  Shield, AlertTriangle, CheckCircle2, Clock, Upload, History,
  Edit3, Trash2, FileCheck2, FileX2, Bell, HardDrive, Link2,
  Save, Info, Sparkles, Archive, Activity, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  getStatusDokumenBadge, getKategoriBadge, getAksesLevelBadge,
  getStorageProviderBadge, getRetensiBadge,
  formatFileSize, formatTanggalArsip, formatTanggalPanjang,
  compressImageToWebP,
  isArsipManager,
} from './shared';
import type {
  ArsipWithRelations, ArsipKategori, ArsipVersi, ArsipPembaca,
  ArsipAktivitas, Guru, StatusDokumenArsip,
} from '@/types/database';

const BUCKET = 'arsip-files';
const MAX_FILE_SIZE = 25 * 1024 * 1024;

type TabKey = 'detail' | 'versi' | 'pembaca' | 'aktivitas';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  dokumen: ArsipWithRelations | null;
  kategoriList: ArsipKategori[];
  guruList: Pick<Guru, 'id' | 'nama_lengkap' | 'nip'>[];
  currentGuruId: string;
  currentGuruRole: string | undefined;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalDetailArsip({
  open, onClose, onRefresh, dokumen, kategoriList, guruList,
  currentGuruId, currentGuruRole,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('detail');
  const [loading, setLoading] = useState(false);

  const [versiList, setVersiList] = useState<ArsipVersi[]>([]);
  const [pembacaList, setPembacaList] = useState<(ArsipPembaca & { guru_nama?: string; guru_nip?: string | null })[]>([]);
  const [aktivitasList, setAktivitasList] = useState<(ArsipAktivitas & { guru_nama?: string })[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'dokumen' | 'versi'; id: string; label: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: 'publish' | 'obsolete' | 'cabut' } | null>(null);

  const isManager = isArsipManager(currentGuruRole);

  // ==========================================================================
  // FETCH data pendukung
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!dokumen?.id) return;
    setLoading(true);
    try {
      const [versiRes, pembacaRes, aktRes] = await Promise.all([
        supabase
          .from('arsip_versi')
          .select('*')
          .eq('dokumen_id', dokumen.id)
          .order('versi', { ascending: false }),
        supabase
          .from('arsip_pembaca')
          .select('*, guru:gurus!guru_id(nama_lengkap, nip)')
          .eq('dokumen_id', dokumen.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('arsip_aktivitas')
          .select('*, guru:gurus!guru_id(nama_lengkap)')
          .eq('dokumen_id', dokumen.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      setVersiList((versiRes.data as ArsipVersi[]) ?? []);
      setPembacaList(
        ((pembacaRes.data as any[]) ?? []).map((p) => ({
          ...p,
          guru_nama: p.guru?.nama_lengkap ?? null,
          guru_nip: p.guru?.nip ?? null,
        }))
      );
      setAktivitasList(
        ((aktRes.data as any[]) ?? []).map((a) => ({
          ...a,
          guru_nama: a.guru?.nama_lengkap ?? null,
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dokumen?.id]);

  useEffect(() => {
    if (open && dokumen) {
      setActiveTab('detail');
      fetchAll();
    }
  }, [open, dokumen, fetchAll]);

  // ==========================================================================
  // LOG VIEW (saat modal dibuka)
  // ==========================================================================
  useEffect(() => {
    if (!open || !dokumen?.id || !currentGuruId) return;
    (async () => {
      // Update arsip_dokumen total_views
      await supabase
        .from('arsip_dokumen')
        .update({ total_views: (dokumen.total_views ?? 0) + 1 })
        .eq('id', dokumen.id);

      // Update arsip_pembaca kalau sudah terdaftar
      const { data: existing } = await supabase
        .from('arsip_pembaca')
        .select('id, jumlah_view, first_viewed_at')
        .eq('dokumen_id', dokumen.id)
        .eq('guru_id', currentGuruId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('arsip_pembaca')
          .update({
            sudah_baca: true,
            first_viewed_at: existing.first_viewed_at ?? new Date().toISOString(),
            last_viewed_at: new Date().toISOString(),
            jumlah_view: (existing.jumlah_view ?? 0) + 1,
          })
          .eq('id', existing.id);
      }

      // Log aktivitas view
      await supabase.from('arsip_aktivitas').insert({
        dokumen_id: dokumen.id,
        versi_id: dokumen.versi_aktif_id,
        guru_id: currentGuruId,
        aksi: 'View',
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dokumen?.id]);

  // ==========================================================================
  // ACTIONS — Publish, Obsolete, Cabut
  // ==========================================================================
  const handleStatusAction = async () => {
    if (!confirmAction || !dokumen) return;
    const { action } = confirmAction;

    let newStatus: StatusDokumenArsip = 'Aktif';
    let logMsg = '';
    let aksiName: any = 'Publish';

    if (action === 'publish') {
      newStatus = 'Aktif';
      logMsg = `Publikasikan dokumen: ${dokumen.judul}`;
      aksiName = 'Publish';
    } else if (action === 'obsolete') {
      newStatus = 'Obsolete';
      logMsg = `Tandai Obsolete: ${dokumen.judul}`;
      aksiName = 'Obsolete';
    } else if (action === 'cabut') {
      newStatus = 'Dicabut';
      logMsg = `Cabut dokumen: ${dokumen.judul}`;
      aksiName = 'Cabut';
    }

    try {
      const { error } = await supabase
        .from('arsip_dokumen')
        .update({ status: newStatus })
        .eq('id', dokumen.id);
      if (error) throw error;

      await supabase.from('arsip_aktivitas').insert({
        dokumen_id: dokumen.id,
        guru_id: currentGuruId,
        aksi: aksiName,
        catatan: logMsg,
      });

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.HRIS,
        targetId: dokumen.id,
        deskripsi: logMsg,
      });

      showToast('success', `Status → ${newStatus}`);
      setConfirmAction(null);
      onRefresh();
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // DELETE — dokumen (soft) atau versi
  // ==========================================================================
  const handleDelete = async () => {
    if (!deleteTarget || !dokumen) return;

    try {
      if (deleteTarget.type === 'dokumen') {
        // Soft delete
        const { error } = await supabase
          .from('arsip_dokumen')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: currentGuruId,
          })
          .eq('id', dokumen.id);
        if (error) throw error;

        await supabase.from('arsip_aktivitas').insert({
          dokumen_id: dokumen.id,
          guru_id: currentGuruId,
          aksi: 'Hapus',
          catatan: `Soft delete: ${dokumen.judul}`,
        });

        await logActivity({
          aksi: 'DELETE',
          modul: AUDIT_MODUL.HRIS,
          targetId: dokumen.id,
          deskripsi: `Hapus arsip: ${dokumen.judul}`,
        });

        showToast('success', 'Dokumen dihapus');
        onRefresh();
        onClose();
      }
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    } finally {
      setDeleteTarget(null);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (!dokumen) return null;

  const retensiBadge = getRetensiBadge(dokumen.tanggal_retensi);
  const isPreviewable =
    dokumen.file_type === 'application/pdf' ||
    dokumen.file_type?.startsWith('image/');

  const canEdit = isManager || dokumen.created_by === currentGuruId;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Detail Dokumen"
        size="lg"
      >
        <div className="space-y-4 pt-1 max-h-[78vh] overflow-y-auto pr-1 custom-scrollbar">
          {/* HEADER */}
          <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getKategoriBadge(dokumen.kategori_warna)}`}>
                    {dokumen.kategori_nama}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusDokumenBadge(dokumen.status)}`}>
                    {dokumen.status}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getAksesLevelBadge(dokumen.akses_level ?? dokumen.kategori_akses_level)}`}>
                    <Shield size={9} className="inline mr-0.5" />
                    {dokumen.akses_level ?? dokumen.kategori_akses_level}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">
                    v{dokumen.versi_aktif_nomor ?? 1}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-slate-100">
                  {dokumen.judul}
                </h3>
                <p className="text-[11px] font-mono text-indigo-400 mt-0.5">
                  {dokumen.nomor_dokumen ?? '-'}
                </p>
                {dokumen.deskripsi && (
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {dokumen.deskripsi}
                  </p>
                )}
                {dokumen.tags && dokumen.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {dokumen.tags.map((t, i) => (
                      <span key={i} className="text-[9px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800/60">
              {dokumen.file_url && (
                <>
                  <a
                    href={dokumen.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
                  >
                    <Eye size={12} /> Buka File
                  </a>
                  <a
                    href={dokumen.file_url}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition cursor-pointer"
                  >
                    <Download size={12} /> Download
                  </a>
                </>
              )}

              {canEdit && dokumen.status === 'Draft' && (
                <button
                  onClick={() => setConfirmAction({ action: 'publish' })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer"
                >
                  <FileCheck2 size={12} /> Publikasikan
                </button>
              )}

              {canEdit && dokumen.status === 'Aktif' && (
                <button
                  onClick={() => setConfirmAction({ action: 'obsolete' })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold transition cursor-pointer"
                >
                  <Archive size={12} /> Tandai Obsolete
                </button>
              )}

              {isManager && dokumen.status !== 'Dicabut' && (
                <button
                  onClick={() => setConfirmAction({ action: 'cabut' })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition cursor-pointer"
                >
                  <FileX2 size={12} /> Cabut
                </button>
              )}

              {isManager && (
                <button
                  onClick={() => setDeleteTarget({
                    type: 'dokumen',
                    id: dokumen.id,
                    label: dokumen.judul,
                  })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition cursor-pointer ml-auto"
                >
                  <Trash2 size={12} /> Hapus
                </button>
              )}
            </div>
          </div>

          {/* TAB NAVIGATION */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1">
            {[
              { key: 'detail' as TabKey, label: 'Detail', icon: Info },
              { key: 'versi' as TabKey, label: `Versi (${versiList.length})`, icon: History },
              { key: 'pembaca' as TabKey, label: `Pembaca (${pembacaList.length})`, icon: Users },
              { key: 'aktivitas' as TabKey, label: 'Aktivitas', icon: Activity },
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
          <div className="min-h-[200px]">
            {activeTab === 'detail' && <TabDetail dokumen={dokumen} retensiBadge={retensiBadge} />}
            {activeTab === 'versi' && (
              <TabVersi
                dokumen={dokumen}
                versiList={versiList}
                guruList={guruList}
                currentGuruId={currentGuruId}
                canEdit={canEdit}
                onRefresh={() => { fetchAll(); onRefresh(); }}
              />
            )}
            {activeTab === 'pembaca' && (
              <TabPembaca
                pembacaList={pembacaList}
                canEdit={canEdit}
              />
            )}
            {activeTab === 'aktivitas' && (
              <TabAktivitas aktivitasList={aktivitasList} />
            )}
          </div>
        </div>
      </Modal>

      {/* CONFIRM STATUS */}
      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleStatusAction}
        title={
          confirmAction?.action === 'publish' ? 'Publikasikan Dokumen' :
          confirmAction?.action === 'obsolete' ? 'Tandai Obsolete' :
          'Cabut Dokumen'
        }
        message={
          confirmAction?.action === 'publish'
            ? `Publikasikan "${dokumen.judul}"? Dokumen akan aktif dan bisa diakses sesuai level.`
            : confirmAction?.action === 'obsolete'
            ? `Tandai "${dokumen.judul}" sebagai Obsolete? Tandanya dokumen tidak lagi berlaku, tapi tetap tersimpan untuk arsip.`
            : `Cabut "${dokumen.judul}"? Dokumen akan ditandai dicabut.`
        }
        variant={confirmAction?.action === 'cabut' ? 'danger' : 'default'}
        confirmLabel={
          confirmAction?.action === 'publish' ? 'Ya, Publikasikan' :
          confirmAction?.action === 'obsolete' ? 'Ya, Tandai' :
          'Ya, Cabut'
        }
      />

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Dokumen"
        message={`Yakin hapus "${deleteTarget?.label}"? Dokumen akan dihapus (soft-delete) dan bisa direstore oleh admin.`}
      />
    </>
  );
}

// =============================================================================
// TAB: Detail
// =============================================================================
function TabDetail({
  dokumen, retensiBadge,
}: {
  dokumen: ArsipWithRelations;
  retensiBadge: { label: string; style: string } | null;
}) {
  const isImg = dokumen.file_type?.startsWith('image/');
  const isPdf = dokumen.file_type === 'application/pdf';

  return (
    <div className="space-y-3">
      {/* PREVIEW */}
      {dokumen.file_url && (isImg || isPdf) && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
          {isImg ? (
            <img
              src={dokumen.file_url}
              alt={dokumen.judul}
              className="w-full max-h-72 object-contain bg-slate-950"
            />
          ) : isPdf ? (
            <iframe
              src={dokumen.file_url}
              className="w-full h-72 bg-slate-950"
              title={dokumen.judul}
            />
          ) : null}
        </div>
      )}

      {/* INFO GRID */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <InfoBox icon={Calendar} label="Tanggal Berlaku" value={formatTanggalArsip(dokumen.tanggal_berlaku)} />
        <InfoBox icon={Calendar} label="Tanggal Expired" value={formatTanggalArsip(dokumen.tanggal_expired)} />
        <InfoBox icon={HardDrive} label="Ukuran File" value={formatFileSize(dokumen.file_size)} />
        <InfoBox icon={FileText} label="Tipe File" value={dokumen.file_type ?? '-'} />
        <InfoBox icon={Users} label="Pemilik / PIC" value={dokumen.pemilik_nama ?? '-'} />
        <InfoBox icon={Eye} label="Total Views" value={String(dokumen.total_views ?? 0)} />
        <InfoBox
          icon={Link2}
          label="Storage"
          value={dokumen.storage_provider === 'external' ? 'External Link' : 'Supabase Storage'}
        />
        {dokumen.tanggal_retensi && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500 mb-1">
              <Clock size={10} /> Tanggal Retensi
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-200">
                {formatTanggalArsip(dokumen.tanggal_retensi)}
              </span>
              {retensiBadge && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${retensiBadge.style}`}>
                  {retensiBadge.label}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {dokumen.compression_ratio && dokumen.compression_ratio > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
          <Sparkles size={13} className="text-emerald-400 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-emerald-300">
              Dihemat {dokumen.compression_ratio.toFixed(1)}% via kompresi
            </p>
            <p className="text-slate-400 mt-0.5">
              {formatFileSize(dokumen.original_size)} → {formatFileSize(dokumen.file_size)}
            </p>
          </div>
        </div>
      )}

      {dokumen.versi_changelog && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">
            Changelog Versi Aktif
          </p>
          <p className="text-xs text-slate-200 whitespace-pre-wrap">
            {dokumen.versi_changelog}
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB: Versi
// =============================================================================
function TabVersi({
  dokumen, versiList, guruList, currentGuruId, canEdit, onRefresh,
}: {
  dokumen: ArsipWithRelations;
  versiList: ArsipVersi[];
  guruList: Pick<Guru, 'id' | 'nama_lengkap' | 'nip'>[];
  currentGuruId: string;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState('');
  const [uploading, setUploading] = useState(false);

  const nextVersi = versiList.length > 0
    ? Math.max(...versiList.map((v) => v.versi)) + 1
    : 1;

  const handleUploadNewVersion = async () => {
    if (!newFile) {
      showToast('error', 'Pilih file baru');
      return;
    }
    if (!changelog.trim()) {
      showToast('error', 'Isi changelog (perubahan apa)');
      return;
    }

    setUploading(true);
    try {
      // Compress kalau gambar
      let toUpload = newFile;
      let originalSize = newFile.size;
      let compressedRatio = 0;
      if (newFile.type.startsWith('image/')) {
        try {
          const compressed = await compressImageToWebP(newFile, 0.8, 1600);
          toUpload = compressed;
          compressedRatio = (1 - compressed.size / newFile.size) * 100;
        } catch { /* skip */ }
      }

      // Upload
      const ext = toUpload.name.split('.').pop() || 'bin';
      const safeName = toUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `v${nextVersi}-${Date.now()}-${safeName}`;
      const filePath = `${currentGuruId}/${dokumen.id}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, toUpload, { cacheControl: '31536000', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

      // Insert versi baru (is_aktif = true → trigger akan set versi lama jadi false)
      const { data: versiData, error: versiErr } = await supabase
        .from('arsip_versi')
        .insert({
          dokumen_id: dokumen.id,
          versi: nextVersi,
          nomor_revisi: `v${nextVersi}.0`,
          storage_provider: 'supabase',
          file_url: urlData.publicUrl,
          file_size: toUpload.size,
          original_size: originalSize,
          compression_ratio: compressedRatio,
          file_type: toUpload.type,
          file_name: toUpload.name,
          ringkasan_perubahan: changelog.trim(),
          is_aktif: true,
          created_by: currentGuruId,
        })
        .select()
        .single();
      if (versiErr) throw versiErr;

      // Update dokumen: versi_aktif_id & total_versi
      await supabase
        .from('arsip_dokumen')
        .update({
          versi_aktif_id: versiData.id,
          total_versi: nextVersi,
        })
        .eq('id', dokumen.id);

      // Log aktivitas
      await supabase.from('arsip_aktivitas').insert({
        dokumen_id: dokumen.id,
        versi_id: versiData.id,
        guru_id: currentGuruId,
        aksi: 'Upload_Versi',
        catatan: `Upload versi ${nextVersi}: ${changelog.trim()}`,
      });

      showToast('success', `Versi ${nextVersi} berhasil diupload`);
      setNewFile(null);
      setChangelog('');
      setShowUploadForm(false);
      onRefresh();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* UPLOAD VERSI BARU */}
      {canEdit && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
          {!showUploadForm ? (
            <button
              onClick={() => setShowUploadForm(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
            >
              <Upload size={13} /> Upload Versi Baru (v{nextVersi})
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-indigo-300">Upload Versi {nextVersi}</p>

              <div>
                <label className={LABEL_CLASS}>File Baru *</label>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-500/20 file:text-indigo-300 file:font-bold file:text-xs file:cursor-pointer hover:file:bg-indigo-500/30"
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Changelog *</label>
                <textarea
                  rows={2}
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="Contoh: Revisi pasal 5 tentang jadwal piket"
                  className={INPUT_CLASS + ' resize-none text-xs'}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowUploadForm(false); setNewFile(null); setChangelog(''); }}
                  disabled={uploading}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:bg-slate-800 text-[11px] font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleUploadNewVersion}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Upload
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LIST VERSI */}
      {versiList.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">Belum ada versi</p>
      ) : (
        <div className="space-y-2">
          {versiList.map((v) => (
            <div
              key={v.id}
              className={`border rounded-xl p-3 ${
                v.is_aktif
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                  v.is_aktif
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  <History size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100">
                          v{v.versi} {v.nomor_revisi && `· ${v.nomor_revisi}`}
                        </span>
                        {v.is_aktif && (
                          <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                            AKTIF
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(v.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStorageProviderBadge(v.storage_provider)}`}>
                        {v.storage_provider}
                      </span>
                      <span className="text-[9px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {formatFileSize(v.file_size)}
                      </span>
                    </div>
                  </div>

                  {v.ringkasan_perubahan && (
                    <p className="text-[11px] text-slate-300 mt-1.5 whitespace-pre-wrap">
                      {v.ringkasan_perubahan}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <a
                      href={v.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                    >
                      <ExternalLink size={10} /> Buka file
                    </a>
                    {v.content_hash && (
                      <span className="text-[9px] text-slate-600 font-mono truncate max-w-[120px]">
                        #{v.content_hash.slice(0, 12)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB: Pembaca
// =============================================================================
function TabPembaca({
  pembacaList, canEdit,
}: {
  pembacaList: (ArsipPembaca & { guru_nama?: string; guru_nip?: string | null })[];
  canEdit: boolean;
}) {
  const stats = useMemo(() => {
    const total = pembacaList.length;
    const belum = pembacaList.filter((p) => !p.sudah_baca).length;
    const sudah = pembacaList.filter((p) => p.sudah_baca && !p.sudah_acknowledge).length;
    const ack = pembacaList.filter((p) => p.sudah_acknowledge).length;
    const persen = total > 0 ? Math.round((ack / total) * 100) : 0;
    return { total, belum, sudah, ack, persen };
  }, [pembacaList]);

  return (
    <div className="space-y-3">
      {/* STATS */}
      <div className="grid grid-cols-4 gap-2">
        <MiniStat label="Total" value={stats.total} color="indigo" />
        <MiniStat label="Belum" value={stats.belum} color="rose" />
        <MiniStat label="Baca" value={stats.sudah} color="amber" />
        <MiniStat label="ACK" value={stats.ack} color="emerald" />
      </div>

      {/* PROGRESS */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase text-slate-500">Compliance</span>
          <span className={`text-xs font-extrabold ${
            stats.persen >= 75 ? 'text-emerald-400' :
            stats.persen >= 50 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {stats.persen}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              stats.persen >= 75 ? 'bg-emerald-500' :
              stats.persen >= 50 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${stats.persen}%` }}
          />
        </div>
      </div>

      {/* LIST */}
      {pembacaList.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">
          Belum ada pembaca wajib baca
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {pembacaList.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">
                {(p.guru_nama ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-200 truncate">
                  {p.guru_nama ?? '-'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {p.guru_nip ?? '-'}
                </p>
              </div>
              <div className="shrink-0">
                {p.sudah_acknowledge ? (
                  <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded border bg-emerald-500/15 border-emerald-500/30 inline-flex items-center gap-1">
                    <CheckCircle2 size={9} /> ACK
                  </span>
                ) : p.sudah_baca ? (
                  <span className="text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded border bg-amber-500/15 border-amber-500/30">
                    Baca
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded border bg-slate-800 border-slate-700">
                    Belum
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB: Aktivitas
// =============================================================================
function TabAktivitas({
  aktivitasList,
}: {
  aktivitasList: (ArsipAktivitas & { guru_nama?: string })[];
}) {
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
      {aktivitasList.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">Belum ada aktivitas</p>
      ) : (
        aktivitasList.map((a) => (
          <div key={a.id} className="flex items-start gap-2.5 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
              ['Create', 'Upload_Versi', 'Publish'].includes(a.aksi)
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : ['Hapus', 'Cabut', 'Obsolete'].includes(a.aksi)
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : a.aksi === 'View' || a.aksi === 'Download'
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <Activity size={12} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200">
                {a.aksi}
                {a.guru_nama && (
                  <span className="text-slate-400 font-normal"> — {a.guru_nama}</span>
                )}
              </p>
              {a.catatan && (
                <p className="text-[10px] text-slate-400 mt-0.5">{a.catatan}</p>
              )}
              <p className="text-[10px] text-slate-600">
                {new Date(a.created_at).toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
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

function MiniStat({ label, value, color }: {
  label: string; value: number; color: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
  const cm: Record<string, string> = {
    indigo: 'text-indigo-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
  };
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-center">
      <p className={`text-base font-extrabold ${cm[color]}`}>{value}</p>
      <p className="text-[9px] font-bold uppercase text-slate-500">{label}</p>
    </div>
  );
}