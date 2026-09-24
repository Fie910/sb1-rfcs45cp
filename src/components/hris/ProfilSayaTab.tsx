// src/components/hris/ProfilSayaTab.tsx
// Tab Profil Saya — halaman self-service untuk pegawai lihat & edit profil sendiri.

import { useState, useEffect, useCallback } from 'react';
import { Loader2, User, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ModalEditProfil } from './ModalEditProfil';
import {
  getStatusKepegawaianBadge, getJenisPtkBadge,
  hitungKelengkapanProfil, hitungUmur, hitungMasaKerja,
  formatDateShort,
  INPUT_CLASS,
} from './shared';
import { DokumenSection } from './DokumenSection';
import { PendidikanSection } from './PendidikanSection';

export function ProfilSayaTab() {
  const { guru } = useAuth();
  const [guruData, setGuruData] = useState<any>(null);
  const [profil, setProfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);
    try {
      const [guruRes, profilRes] = await Promise.all([
        supabase.from('gurus').select('*').eq('id', guru.id).single(),
        supabase.from('hris_profil_pegawai').select('*').eq('id', guru.id).maybeSingle(),
      ]);
      if (guruRes.error) throw guruRes.error;
      setGuruData(guruRes.data);
      setProfil(profilRes.data);
    } catch (err: any) {
      showToast('error', 'Gagal memuat profil: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [guru?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  if (!guruData) return null;

  const persen = hitungKelengkapanProfil(profil);
  const umur = profil?.tanggal_lahir ? hitungUmur(profil.tanggal_lahir) : null;

  return (
    <div className="space-y-5">
      {/* HEADER CARD */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-indigo-500/15 border-2 border-indigo-500/40 overflow-hidden flex items-center justify-center shrink-0 shadow-lg">
            {profil?.foto_profil_url ? (
              <img src={profil.foto_profil_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={32} className="text-indigo-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
              Profil Pegawai
            </p>
            <h2 className="text-xl font-extrabold text-slate-100 truncate">
              {guruData.nama_lengkap}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {guruData.jenis_ptk && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getJenisPtkBadge(guruData.jenis_ptk)}`}>
                  {guruData.jenis_ptk}
                </span>
              )}
              {guruData.status_kepegawaian && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusKepegawaianBadge(guruData.status_kepegawaian)}`}>
                  {guruData.status_kepegawaian}
                </span>
              )}
              {guruData.nip && (
                <span className="text-[10px] font-mono text-slate-400">
                  NIP: {guruData.nip}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer shrink-0">
            Edit Profil
          </button>
        </div>

        {/* KELENGKAPAN BAR */}
        <div className="mt-5 pt-4 border-t border-slate-800/60">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className={persen >= 80 ? 'text-emerald-400' : 'text-amber-400'} />
              <span className="text-xs font-bold text-slate-300">Kelengkapan Profil</span>
            </div>
            <span className={`text-sm font-extrabold ${persen >= 80 ? 'text-emerald-400' : persen >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
              {persen}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div className={`h-full rounded-full transition-all ${persen >= 80 ? 'bg-emerald-500' : persen >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${persen}%` }} />
          </div>
          {persen < 100 && (
            <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
              <AlertCircle size={10} /> Lengkapi profil Anda untuk kelancaran administrasi
            </p>
          )}
        </div>
      </div>

      {/* GRID INFO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SECTION: BIODATA */}
        <InfoSection title="Biodata" empty={!profil}>
          <InfoRow label="NIK" value={profil?.nik} />
          <InfoRow label="Tempat Lahir" value={profil?.tempat_lahir} />
          <InfoRow label="Tanggal Lahir"
            value={profil?.tanggal_lahir ? `${formatDateShort(profil.tanggal_lahir)}${umur != null ? ` (${umur} thn)` : ''}` : null} />
          <InfoRow label="Jenis Kelamin"
            value={profil?.jenis_kelamin === 'L' ? 'Laki-laki' : profil?.jenis_kelamin === 'P' ? 'Perempuan' : null} />
          <InfoRow label="Agama" value={profil?.agama} />
          <InfoRow label="Gol. Darah" value={profil?.golongan_darah} />
          <InfoRow label="Status Pernikahan" value={profil?.status_pernikahan} />
          <InfoRow label="Jumlah Anak" value={profil?.jumlah_anak?.toString()} />
        </InfoSection>

        {/* SECTION: KONTAK */}
        <InfoSection title="Kontak" empty={!profil}>
          <InfoRow label="No. HP" value={profil?.no_hp} />
          <InfoRow label="Email Pribadi" value={profil?.email_pribadi} />
          <InfoRow label="Alamat KTP" value={profil?.alamat_ktp} />
          <InfoRow label="Alamat Domisili" value={profil?.alamat_domisili} />
        </InfoSection>

        {/* SECTION: KONTAK DARURAT */}
        <InfoSection title="Kontak Darurat" empty={!profil?.nama_kontak_darurat}>
          <InfoRow label="Nama" value={profil?.nama_kontak_darurat} />
          <InfoRow label="Hubungan" value={profil?.hubungan_kontak_darurat} />
          <InfoRow label="No. HP" value={profil?.no_hp_darurat} />
        </InfoSection>

        {/* SECTION: BANK & BPJS */}
        <InfoSection title="Bank, BPJS & NPWP" empty={!profil}>
          <InfoRow label="Bank" value={profil?.bank_nama} />
          <InfoRow label="No. Rekening" value={profil?.bank_nomor_rekening} />
          <InfoRow label="Atas Nama" value={profil?.bank_atas_nama} />
          <InfoRow label="BPJS Kesehatan" value={profil?.bpjs_kesehatan_no} />
          <InfoRow label="BPJS Ketenagakerjaan" value={profil?.bpjs_ketenagakerjaan_no} />
          <InfoRow label="NPWP" value={profil?.npwp} />
        </InfoSection>

        {/* SECTION: KEPEGAWAIAN */}
        <InfoSection title="Kepegawaian">
          <InfoRow label="NIP" value={guruData.nip} />
          <InfoRow label="Jenis PTK" value={guruData.jenis_ptk} />
          <InfoRow label="Status Kepegawaian" value={guruData.status_kepegawaian} />
          <InfoRow label="Tanggal Bergabung"
            value={guruData.tanggal_bergabung ? formatDateShort(guruData.tanggal_bergabung) : null} />
          <InfoRow label="Masa Kerja"
            value={guruData.tanggal_bergabung ? hitungMasaKerja(guruData.tanggal_bergabung) : null} />
          <InfoRow label="Mata Pelajaran" value={guruData.mata_pelajaran} />
        </InfoSection>

              {/* SECTION DOKUMEN */}
      <DokumenSection guruId={guruData.id} editable={true} />

      {/* SECTION PENDIDIKAN */}
      <PendidikanSection guruId={guruData.id} editable={true} />
        
        {/* SECTION: FISIK & PERSONAL */}
        <InfoSection title="Info Personal" empty={!profil}>
          <InfoRow label="Tinggi Badan"
            value={profil?.tinggi_badan ? `${profil.tinggi_badan} cm` : null} />
          <InfoRow label="Berat Badan"
            value={profil?.berat_badan ? `${profil.berat_badan} kg` : null} />
          <InfoRow label="Hobi" value={profil?.hobi} />
          <InfoRow label="Motto" value={profil?.motto_hidup} />
        </InfoSection>
      </div>

      {/* MODAL EDIT */}
      <ModalEditProfil
        open={editOpen}
        onClose={() => setEditOpen(false)}
        guru={guruData}
        profil={profil}
        onSaved={fetchData}
      />
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================
function InfoSection({ title, empty, children }: {
  title: string; empty?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">{title}</h3>
        {empty && (
          <span className="text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            Belum Diisi
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 border-b border-slate-800/40 last:border-b-0">
      <span className="text-[11px] text-slate-500 font-semibold shrink-0">{label}</span>
      <span className={`text-xs text-right ${value ? 'text-slate-200' : 'text-slate-600 italic'}`}>
        {value || 'Belum diisi'}
      </span>
    </div>
  );
}