// src/components/hris/ModalDetailProfil.tsx
// Modal detail profil pegawai — view biodata + dokumen + pendidikan + pekerjaan + keluarga + edit.

import { useState, useEffect, useCallback } from 'react';
import { Loader2, User, Edit3, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { ModalEditProfil } from './ModalEditProfil';
import { DokumenSection } from './DokumenSection';
import { PendidikanSection } from './PendidikanSection';
import { PekerjaanSection } from './PekerjaanSection';
import { KeluargaSection } from './KeluargaSection';
import {
  getStatusKepegawaianBadge, getJenisPtkBadge,
  hitungKelengkapanProfil, hitungUmur, hitungMasaKerja,
  formatDateShort,
  isHrManager,
} from './shared';

// =============================================================================
// TYPES
// =============================================================================
type ModalDetailProfilProps = {
  open: boolean;
  onClose: () => void;
  pegawai: any;
  onRefresh: () => void;
  currentGuruId?: string;
  currentGuruRole?: string;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalDetailProfil({
  open,
  onClose,
  pegawai,
  onRefresh,
  currentGuruId,
  currentGuruRole,
}: ModalDetailProfilProps) {
  const [guru, setGuru] = useState<any>(null);
  const [profil, setProfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  // Cek apakah user boleh edit (HR manager ATAU profil sendiri)
  const editable =
    isHrManager(currentGuruRole) || pegawai?.id === currentGuruId;

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchData = useCallback(async () => {
    if (!pegawai?.id) return;
    setLoading(true);
    try {
      const [guruRes, profilRes] = await Promise.all([
        supabase.from('gurus').select('*').eq('id', pegawai.id).single(),
        supabase
          .from('hris_profil_pegawai')
          .select('*')
          .eq('id', pegawai.id)
          .maybeSingle(),
      ]);
      if (guruRes.error) throw guruRes.error;
      setGuru(guruRes.data);
      setProfil(profilRes.data);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [pegawai?.id]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  if (!open) return null;

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <>
      <Modal open={open} onClose={onClose} title="Detail Pegawai" size="lg">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-indigo-400" size={28} />
          </div>
        ) : guru ? (
          <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
            {/* ============ HEADER PROFIL ============ */}
            <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-indigo-500/15 border-2 border-indigo-500/40 overflow-hidden flex items-center justify-center shrink-0">
                  {profil?.foto_profil_url ? (
                    <img
                      src={profil.foto_profil_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={32} className="text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-extrabold text-slate-100 truncate">
                    {guru.nama_lengkap}
                  </h3>
                  <p className="text-[11px] font-mono text-indigo-400 mt-0.5">
                    NIP: {guru.nip ?? '-'}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {guru.jenis_ptk && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getJenisPtkBadge(
                          guru.jenis_ptk
                        )}`}
                      >
                        {guru.jenis_ptk}
                      </span>
                    )}
                    {guru.status_kepegawaian && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusKepegawaianBadge(
                          guru.status_kepegawaian
                        )}`}
                      >
                        {guru.status_kepegawaian}
                      </span>
                    )}
                  </div>
                </div>
                {editable && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer shrink-0"
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                )}
              </div>

              {/* KELENGKAPAN BAR */}
              <div className="mt-4 pt-4 border-t border-slate-800/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-300">
                      Kelengkapan Profil
                    </span>
                  </div>
                  <span
                    className={`text-sm font-extrabold ${
                      profil ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {hitungKelengkapanProfil(profil)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${hitungKelengkapanProfil(profil)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ============ GRID INFO ============ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InfoSection title="Biodata" empty={!profil}>
                <InfoRow label="NIK" value={profil?.nik} />
                <InfoRow label="Tempat Lahir" value={profil?.tempat_lahir} />
                <InfoRow
                  label="Tanggal Lahir"
                  value={
                    profil?.tanggal_lahir
                      ? `${formatDateShort(profil.tanggal_lahir)}${
                          profil.tanggal_lahir
                            ? ` (${hitungUmur(profil.tanggal_lahir)} thn)`
                            : ''
                        }`
                      : null
                  }
                />
                <InfoRow
                  label="Jenis Kelamin"
                  value={
                    profil?.jenis_kelamin === 'L'
                      ? 'Laki-laki'
                      : profil?.jenis_kelamin === 'P'
                      ? 'Perempuan'
                      : null
                  }
                />
                <InfoRow label="Agama" value={profil?.agama} />
                <InfoRow label="Gol. Darah" value={profil?.golongan_darah} />
                <InfoRow label="Status Pernikahan" value={profil?.status_pernikahan} />
                <InfoRow label="Jumlah Anak" value={profil?.jumlah_anak?.toString()} />
              </InfoSection>

              <InfoSection title="Kontak" empty={!profil}>
                <InfoRow label="Email Kantor" value={guru.email} />
                <InfoRow label="Email Pribadi" value={profil?.email_pribadi} />
                <InfoRow label="No. HP" value={profil?.no_hp} />
                <InfoRow label="Alamat KTP" value={profil?.alamat_ktp} />
                <InfoRow label="Alamat Domisili" value={profil?.alamat_domisili} />
              </InfoSection>

              <InfoSection title="Kontak Darurat" empty={!profil?.nama_kontak_darurat}>
                <InfoRow label="Nama" value={profil?.nama_kontak_darurat} />
                <InfoRow label="Hubungan" value={profil?.hubungan_kontak_darurat} />
                <InfoRow label="No. HP" value={profil?.no_hp_darurat} />
              </InfoSection>

              <InfoSection title="Bank, BPJS & NPWP" empty={!profil}>
                <InfoRow label="Bank" value={profil?.bank_nama} />
                <InfoRow label="No. Rekening" value={profil?.bank_nomor_rekening} />
                <InfoRow label="Atas Nama" value={profil?.bank_atas_nama} />
                <InfoRow label="BPJS Kesehatan" value={profil?.bpjs_kesehatan_no} />
                <InfoRow label="BPJS Naker" value={profil?.bpjs_ketenagakerjaan_no} />
                <InfoRow label="NPWP" value={profil?.npwp} />
              </InfoSection>

              <InfoSection title="Kepegawaian">
                <InfoRow
                  label="Tanggal Bergabung"
                  value={
                    guru.tanggal_bergabung
                      ? formatDateShort(guru.tanggal_bergabung)
                      : null
                  }
                />
                <InfoRow
                  label="Masa Kerja"
                  value={
                    guru.tanggal_bergabung
                      ? hitungMasaKerja(guru.tanggal_bergabung)
                      : null
                  }
                />
                <InfoRow label="Role Sistem" value={guru.role} />
              </InfoSection>

              <InfoSection
                title="Personal"
                empty={!profil?.hobi && !profil?.motto_hidup}
              >
                <InfoRow
                  label="Tinggi Badan"
                  value={profil?.tinggi_badan ? `${profil.tinggi_badan} cm` : null}
                />
                <InfoRow
                  label="Berat Badan"
                  value={profil?.berat_badan ? `${profil.berat_badan} kg` : null}
                />
                <InfoRow label="Hobi" value={profil?.hobi} />
                <InfoRow label="Motto" value={profil?.motto_hidup} />
              </InfoSection>
            </div>

            {/* ============ CATATAN ============ */}
            {profil?.catatan && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Catatan
                </p>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {profil.catatan}
                </p>
              </div>
            )}

            {/* ============ SECTION: RIWAYAT PENDIDIKAN ============ */}
            <PendidikanSection guruId={pegawai.id} editable={editable} />

            {/* ============ SECTION: RIWAYAT PEKERJAAN ============ */}
            <PekerjaanSection guruId={pegawai.id} editable={editable} />

            {/* ============ SECTION: DATA KELUARGA ============ */}
            <KeluargaSection guruId={pegawai.id} editable={editable} />

            {/* ============ SECTION: DOKUMEN ============ */}
            <DokumenSection guruId={pegawai.id} editable={editable} />
          </div>
        ) : null}
      </Modal>

      {/* ============ NESTED MODAL EDIT ============ */}
      {editOpen && guru && (
        <ModalEditProfil
          open={editOpen}
          onClose={() => setEditOpen(false)}
          guru={guru}
          profil={profil}
          onSaved={async () => {
            await fetchData();
            onRefresh();
          }}
        />
      )}
    </>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================
function InfoSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
          {title}
        </h3>
        {empty && (
          <span className="text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            Belum Diisi
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-800/40 last:border-b-0">
      <span className="text-[11px] text-slate-500 font-semibold shrink-0">
        {label}
      </span>
      <span
        className={`text-xs text-right ${
          value ? 'text-slate-200' : 'text-slate-600 italic'
        }`}
      >
        {value || 'Belum diisi'}
      </span>
    </div>
  );
}