// src/components/hris/PendidikanSection.tsx
// Section Riwayat Pendidikan Formal.

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, X, GraduationCap, Pencil, Trash2,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  getJenjangBadge, getJenjangIcon,
  formatDateShort,
  JENJANG_PENDIDIKAN_OPTIONS,
} from './shared';
import type { HrisPendidikan, JenjangPendidikan } from '@/types/database';

const MODUL_HRIS = (AUDIT_MODUL as any)?.HRIS ?? 'HRIS';

type Props = {
  guruId: string;
  editable: boolean;
};

const emptyForm = {
  jenjang: 'S1' as JenjangPendidikan,
  institusi: '',
  jurusan: '',
  tahun_masuk: '',
  tahun_lulus: '',
  ipk: '',
  nomor_ijazah: '',
  keterangan: '',
};

export function PendidikanSection({ guruId, editable }: Props) {
  const [list, setList] = useState<HrisPendidikan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HrisPendidikan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HrisPendidikan | null>(null);

  const fetchAll = useCallback(async () => {
    if (!guruId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hris_pendidikan')
        .select('*')
        .eq('guru_id', guruId)
        .order('tahun_lulus', { ascending: false });
      if (error) throw error;
      setList((data as HrisPendidikan[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally { setLoading(false); }
  }, [guruId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: HrisPendidikan) => {
    setEditing(item);
    setForm({
      jenjang: item.jenjang,
      institusi: item.institusi,
      jurusan: item.jurusan ?? '',
      tahun_masuk: item.tahun_masuk ? String(item.tahun_masuk) : '',
      tahun_lulus: item.tahun_lulus ? String(item.tahun_lulus) : '',
      ipk: item.ipk ? String(item.ipk) : '',
      nomor_ijazah: item.nomor_ijazah ?? '',
      keterangan: item.keterangan ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.institusi.trim()) { showToast('error', 'Institusi wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = {
        guru_id: guruId,
        jenjang: form.jenjang,
        institusi: form.institusi.trim(),
        jurusan: form.jurusan.trim() || null,
        tahun_masuk: form.tahun_masuk ? Number(form.tahun_masuk) : null,
        tahun_lulus: form.tahun_lulus ? Number(form.tahun_lulus) : null,
        ipk: form.ipk ? Number(form.ipk) : null,
        nomor_ijazah: form.nomor_ijazah.trim() || null,
        keterangan: form.keterangan.trim() || null,
      };

      if (editing?.id) {
        const { error } = await supabase.from('hris_pendidikan').update(payload).eq('id', editing.id);
        if (error) throw error;
        await logActivity({
          aksi: 'UPDATE', modul: MODUL_HRIS, targetId: editing.id,
          deskripsi: `Update pendidikan: ${payload.jenjang} - ${payload.institusi}`,
        });
        showToast('success', 'Riwayat pendidikan diperbarui');
      } else {
        const { data, error } = await supabase.from('hris_pendidikan').insert(payload).select().single();
        if (error) throw error;
        await logActivity({
          aksi: 'CREATE', modul: MODUL_HRIS, targetId: data?.id,
          deskripsi: `Tambah pendidikan: ${payload.jenjang} - ${payload.institusi}`,
        });
        showToast('success', 'Riwayat pendidikan ditambahkan');
      }
      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('hris_pendidikan').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logActivity({
        aksi: 'DELETE', modul: MODUL_HRIS, targetId: deleteTarget.id,
        deskripsi: `Hapus pendidikan: ${deleteTarget.institusi}`,
      });
      showToast('success', 'Riwayat pendidikan dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  // Sort by jenjang order
  const jenjangOrder: Record<string, number> = {
    S3: 8, S2: 7, S1: 6, D4: 5, D3: 4, 'SMA/SMK': 3, SMP: 2, SD: 1,
  };
  const sorted = [...list].sort(
    (a, b) => (jenjangOrder[b.jenjang] ?? 0) - (jenjangOrder[a.jenjang] ?? 0)
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GraduationCap size={14} className="text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Riwayat Pendidikan ({list.length})
          </h3>
        </div>
        {editable && (
          <button onClick={handleOpenCreate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-sm transition cursor-pointer">
            <Plus size={11} /> Tambah
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6">
          <Loader2 className="animate-spin text-emerald-400 mx-auto" size={20} />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
          <GraduationCap size={24} className="mx-auto text-slate-600 mb-1.5" />
          <p className="text-[11px] text-slate-500">Belum ada riwayat pendidikan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => {
            const JenjangIcon = getJenjangIcon(item.jenjang);
            return (
              <div key={item.id}
                className="flex items-start gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 hover:border-slate-700 transition">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${getJenjangBadge(item.jenjang)}`}>
                  <JenjangIcon size={14} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getJenjangBadge(item.jenjang)}`}>
                          {item.jenjang}
                        </span>
                        {item.ipk && (
                          <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded">
                            IPK {item.ipk}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-200 mt-1 truncate">
                        {item.institusi}
                      </p>
                      {item.jurusan && (
                        <p className="text-[11px] text-slate-400 truncate">{item.jurusan}</p>
                      )}
                    </div>
                    {editable && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer">
                          <Pencil size={11} />
                        </button>
                        <button onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-slate-500">
                    {(item.tahun_masuk || item.tahun_lulus) && (
                      <span>
                        {item.tahun_masuk ?? '?'} - {item.tahun_lulus ?? 'sekarang'}
                      </span>
                    )}
                    {item.nomor_ijazah && <span className="font-mono">No: {item.nomor_ijazah}</span>}
                    {item.file_url && (
                      <a href={item.file_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300">
                        <ExternalLink size={9} /> Ijazah
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FORM */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Pendidikan' : 'Tambah Riwayat Pendidikan'} size="md">
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Jenjang *</label>
              <select value={form.jenjang}
                onChange={(e) => setForm({ ...form, jenjang: e.target.value as JenjangPendidikan })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                {JENJANG_PENDIDIKAN_OPTIONS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>IPK / Nilai Akhir</label>
              <input type="number" step="0.01" min={0} max={4}
                value={form.ipk}
                onChange={(e) => setForm({ ...form, ipk: e.target.value })}
                placeholder="3.75"
                className={INPUT_CLASS + ' font-mono'} />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Institusi / Sekolah *</label>
            <input type="text" value={form.institusi}
              onChange={(e) => setForm({ ...form, institusi: e.target.value })}
              placeholder="Universitas Pendidikan Indonesia"
              className={INPUT_CLASS} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Jurusan / Program Studi</label>
            <input type="text" value={form.jurusan}
              onChange={(e) => setForm({ ...form, jurusan: e.target.value })}
              placeholder="Pendidikan Teknik Informatika"
              className={INPUT_CLASS} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tahun Masuk</label>
              <input type="number" min={1900} max={2100}
                value={form.tahun_masuk}
                onChange={(e) => setForm({ ...form, tahun_masuk: e.target.value })}
                placeholder="2018"
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Tahun Lulus</label>
              <input type="number" min={1900} max={2100}
                value={form.tahun_lulus}
                onChange={(e) => setForm({ ...form, tahun_lulus: e.target.value })}
                placeholder="2022"
                className={INPUT_CLASS} />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Nomor Ijazah</label>
            <input type="text" value={form.nomor_ijazah}
              onChange={(e) => setForm({ ...form, nomor_ijazah: e.target.value })}
              className={INPUT_CLASS + ' font-mono'} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Keterangan</label>
            <textarea rows={2} value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Catatan tambahan..."
              className={INPUT_CLASS + ' resize-none'} />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer">
              Batal
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editing ? 'Simpan Perubahan' : 'Tambah Pendidikan'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} title="Hapus Riwayat Pendidikan"
        message={`Yakin hapus "${deleteTarget?.institusi}"?`} />
    </div>
  );
}