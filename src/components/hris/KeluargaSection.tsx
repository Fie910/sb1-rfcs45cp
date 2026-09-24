// src/components/hris/KeluargaSection.tsx
// Section Data Keluarga (ayah, ibu, suami/istri, anak, saudara) + auto-suggest kontak darurat.

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, X, Users, Pencil, Trash2,
  Phone, Heart, ShieldCheck, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  formatDateShort, hitungUmur,
  getHubunganIcon,
  HUBUNGAN_KELUARGA_OPTIONS,
} from './shared';
import type { HrisKeluarga, HubunganKeluarga } from '@/types/database';

// =============================================================================
// HELPER BADGE (inline)
// =============================================================================
function getHubunganBadge(hubungan: HubunganKeluarga | string | null | undefined): string {
  switch (hubungan) {
    case 'Suami':
    case 'Istri':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Anak':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Ayah':
    case 'Ibu':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Saudara':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  guruId: string;
  editable: boolean;
};

const emptyForm = {
  nama: '',
  hubungan: 'Ayah' as HubunganKeluarga,
  tanggal_lahir: '',
  jenis_kelamin: '' as '' | 'L' | 'P',
  pekerjaan: '',
  no_hp: '',
  alamat: '',
  is_kontak_darurat: false,
  keterangan: '',
};

// Urutan tampilan kelompok keluarga
const URUTAN_HUBUNGAN: HubunganKeluarga[] = [
  'Suami', 'Istri', 'Anak', 'Ayah', 'Ibu', 'Saudara', 'Lainnya',
];

// =============================================================================
// KOMPONEN
// =============================================================================
export function KeluargaSection({ guruId, editable }: Props) {
  const [list, setList] = useState<HrisKeluarga[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HrisKeluarga | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<HrisKeluarga | null>(null);
  const [setKontakTarget, setSetKontakTarget] = useState<HrisKeluarga | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guruId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hris_keluarga')
        .select('*')
        .eq('guru_id', guruId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setList((data as HrisKeluarga[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [guruId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: HrisKeluarga) => {
    setEditing(item);
    setForm({
      nama: item.nama,
      hubungan: item.hubungan,
      tanggal_lahir: item.tanggal_lahir ?? '',
      jenis_kelamin: (item.jenis_kelamin ?? '') as '' | 'L' | 'P',
      pekerjaan: item.pekerjaan ?? '',
      no_hp: item.no_hp ?? '',
      alamat: item.alamat ?? '',
      is_kontak_darurat: item.is_kontak_darurat,
      keterangan: item.keterangan ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nama.trim()) {
      showToast('error', 'Nama wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        guru_id: guruId,
        nama: form.nama.trim(),
        hubungan: form.hubungan,
        tanggal_lahir: form.tanggal_lahir || null,
        jenis_kelamin: form.jenis_kelamin || null,
        pekerjaan: form.pekerjaan.trim() || null,
        no_hp: form.no_hp.trim() || null,
        alamat: form.alamat.trim() || null,
        is_kontak_darurat: form.is_kontak_darurat,
        keterangan: form.keterangan.trim() || null,
      };

      if (editing?.id) {
        const { error } = await supabase
          .from('hris_keluarga')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.HRIS,
          targetId: editing.id,
          deskripsi: `Update keluarga: ${payload.nama} (${payload.hubungan})`,
        });
        showToast('success', 'Data keluarga diperbarui');
      } else {
        const { data, error } = await supabase
          .from('hris_keluarga')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.HRIS,
          targetId: data?.id,
          deskripsi: `Tambah keluarga: ${payload.nama} (${payload.hubungan})`,
        });
        showToast('success', 'Data keluarga ditambahkan');
      }

      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('hris_keluarga')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.HRIS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus keluarga: ${deleteTarget.nama} (${deleteTarget.hubungan})`,
      });
      showToast('success', 'Data keluarga dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  /**
   * Jadikan anggota keluarga ini sebagai kontak darurat di hris_profil_pegawai.
   * Auto-isi: nama_kontak_darurat, hubungan_kontak_darurat, no_hp_darurat.
   */
  const handleSetAsKontakDarurat = async () => {
    if (!setKontakTarget) return;
    const target = setKontakTarget;

    if (!target.no_hp) {
      showToast('error', 'Nomor HP belum diisi. Edit dulu untuk melengkapi.');
      setSetKontakTarget(null);
      return;
    }

    try {
      // 1. Update profil pegawai (upsert, karena mungkin belum ada)
      const { error: profilErr } = await supabase
        .from('hris_profil_pegawai')
        .upsert(
          {
            id: guruId,
            nama_kontak_darurat: target.nama,
            hubungan_kontak_darurat: target.hubungan,
            no_hp_darurat: target.no_hp,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      if (profilErr) throw profilErr;

      // 2. Reset flag is_kontak_darurat yang lain, set yang ini saja
      await supabase
        .from('hris_keluarga')
        .update({ is_kontak_darurat: false })
        .eq('guru_id', guruId);

      await supabase
        .from('hris_keluarga')
        .update({ is_kontak_darurat: true })
        .eq('id', target.id);

      // 3. Log
      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.HRIS,
        targetId: target.id,
        deskripsi: `Set kontak darurat ke: ${target.nama} (${target.hubungan})`,
      });

      showToast('success', `${target.nama} dijadikan kontak darurat`);
      setSetKontakTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal set kontak darurat: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // GROUPING
  // ==========================================================================
  const grouped = (() => {
    const map = new Map<string, HrisKeluarga[]>();
    list.forEach((item) => {
      const arr = map.get(item.hubungan) ?? [];
      arr.push(item);
      map.set(item.hubungan, arr);
    });
    return URUTAN_HUBUNGAN
      .map((h) => ({ hubungan: h, items: map.get(h) ?? [] }))
      .filter((g) => g.items.length > 0);
  })();

  const kontakDarurat = list.find((k) => k.is_kontak_darurat);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-rose-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
            Data Keluarga ({list.length})
          </h3>
          {kontakDarurat && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
              <ShieldCheck size={9} /> Kontak darurat: {kontakDarurat.nama}
            </span>
          )}
        </div>
        {editable && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold shadow-sm transition cursor-pointer"
          >
            <Plus size={11} /> Tambah
          </button>
        )}
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-6">
          <Loader2 className="animate-spin text-rose-400 mx-auto" size={20} />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
          <Users size={24} className="mx-auto text-slate-600 mb-1.5" />
          <p className="text-[11px] text-slate-500">
            {editable ? 'Belum ada data keluarga. Klik "Tambah".' : 'Belum ada data keluarga.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((grup) => (
            <div key={grup.hubungan}>
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getHubunganBadge(grup.hubungan)}`}>
                  {grup.hubungan}
                </span>
                <span className="text-[10px] text-slate-500">({grup.items.length})</span>
              </div>

              <div className="space-y-2">
                {grup.items.map((item) => {
                  const Icon = getHubunganIcon(item.hubungan);
                  const umur = item.tanggal_lahir ? hitungUmur(item.tanggal_lahir) : null;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 bg-slate-950/60 border rounded-xl p-2.5 hover:border-slate-700 transition ${
                        item.is_kontak_darurat
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : 'border-slate-800/60'
                      }`}
                    >
                      {/* ICON */}
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${getHubunganBadge(item.hubungan)}`}
                      >
                        <Icon size={14} />
                      </div>

                      {/* INFO */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-slate-200 truncate">
                                {item.nama}
                              </p>
                              {item.is_kontak_darurat && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                                  <Star size={8} className="fill-current" /> Kontak Darurat
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] text-slate-500">
                              {umur != null && (
                                <span>
                                  {formatDateShort(item.tanggal_lahir)} ({umur} thn)
                                </span>
                              )}
                              {item.jenis_kelamin && (
                                <span>
                                  {item.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                                </span>
                              )}
                              {item.pekerjaan && <span>{item.pekerjaan}</span>}
                            </div>
                            {item.no_hp && (
                              <p className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                                <Phone size={9} className="text-slate-500" />
                                {item.no_hp}
                              </p>
                            )}
                            {item.alamat && (
                              <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                {item.alamat}
                              </p>
                            )}
                          </div>

                          {/* ACTIONS */}
                          {editable && (
                            <div className="flex items-center gap-1 shrink-0">
                              {!item.is_kontak_darurat && item.no_hp && (
                                <button
                                  onClick={() => setSetKontakTarget(item)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                  title="Jadikan kontak darurat"
                                >
                                  <Heart size={11} />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                                title="Edit"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== MODAL FORM ========== */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Data Keluarga' : 'Tambah Data Keluarga'}
        size="md"
      >
        <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Hubungan *</label>
              <select
                value={form.hubungan}
                onChange={(e) => setForm({ ...form, hubungan: e.target.value as HubunganKeluarga })}
                className={INPUT_CLASS + ' cursor-pointer'}
              >
                {HUBUNGAN_KELUARGA_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Nama Lengkap *</label>
              <input
                type="text"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Nama anggota keluarga"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tanggal Lahir</label>
              <input
                type="date"
                value={form.tanggal_lahir}
                onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Jenis Kelamin</label>
              <select
                value={form.jenis_kelamin}
                onChange={(e) =>
                  setForm({ ...form, jenis_kelamin: e.target.value as '' | 'L' | 'P' })
                }
                className={INPUT_CLASS + ' cursor-pointer'}
              >
                <option value="">-- Pilih --</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Pekerjaan</label>
              <input
                type="text"
                value={form.pekerjaan}
                onChange={(e) => setForm({ ...form, pekerjaan: e.target.value })}
                placeholder="Contoh: Wiraswasta, PNS, IRT"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>No. HP</label>
              <input
                type="tel"
                value={form.no_hp}
                onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                placeholder="08123456789"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Alamat</label>
            <textarea
              rows={2}
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value })}
              placeholder="Alamat lengkap (opsional)"
              className={INPUT_CLASS + ' resize-none'}
            />
          </div>

          {/* TOGGLE KONTAK DARURAT */}
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_kontak_darurat}
                onChange={(e) =>
                  setForm({ ...form, is_kontak_darurat: e.target.checked })
                }
                className="mt-0.5 w-4 h-4 accent-rose-500 cursor-pointer"
              />
              <div className="flex-1">
                <p className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <ShieldCheck size={12} /> Jadikan Kontak Darurat
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                  Data anggota keluarga ini akan otomatis mengisi{' '}
                  <span className="font-mono text-rose-300">nama_kontak_darurat</span>,{' '}
                  <span className="font-mono text-rose-300">hubungan_kontak_darurat</span>, dan{' '}
                  <span className="font-mono text-rose-300">no_hp_darurat</span> di profil pegawai.
                  Pastikan No. HP sudah diisi.
                </p>
              </div>
            </label>
          </div>

          <div>
            <label className={LABEL_CLASS}>Keterangan</label>
            <textarea
              rows={2}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Catatan tambahan..."
              className={INPUT_CLASS + ' resize-none'}
            />
          </div>

          {/* FOOTER */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> Simpan...</>
              ) : editing ? (
                'Simpan Perubahan'
              ) : (
                'Tambah Keluarga'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Data Keluarga"
        message={`Yakin hapus "${deleteTarget?.nama}" (${deleteTarget?.hubungan})?`}
      />

      {/* CONFIRM SET KONTAK DARURAT */}
      <ConfirmModal
        open={!!setKontakTarget}
        onClose={() => setSetKontakTarget(null)}
        onConfirm={handleSetAsKontakDarurat}
        title="Jadikan Kontak Darurat"
        message={`Jadikan "${setKontakTarget?.nama}" (${setKontakTarget?.hubungan}) sebagai kontak darurat? Data akan otomatis mengisi kolom kontak darurat di profil pegawai.`}
        variant="warning"
        confirmLabel="Ya, Jadikan"
      />
    </div>
  );
}