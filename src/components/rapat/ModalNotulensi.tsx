// src/components/rapat/ModalNotulensi.tsx
// Form notulensi rapat — dengan tombol "Generate dengan AI".

import { useState, useEffect } from 'react';
import {
  Loader2, Save, Sparkles, Plus, X, Trash2, Wand2,
  AlertTriangle, FileText, CheckCircle2, ListChecks, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { generateResumeNotulensi, checkAiAvailable } from '@/lib/ai';
import { INPUT_CLASS, LABEL_CLASS, formatTanggalRapat } from './shared';
import { AlertTriangle } from 'lucide-react';
import type {
  RapatWithRelations, RapatNotulensi, RapatPesertaWithGuru,
  ActionItemRapat, Guru, StatusNotulensi,
} from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  rapat: RapatWithRelations | null;
  guruList: Pick<Guru, 'id' | 'nama_lengkap' | 'nip'>[];
  currentGuruId: string;
};

const emptyAction: ActionItemRapat = {
  pic_id: null,
  pic_nama: '',
  deskripsi: '',
  deadline: null,
  prioritas: 'Sedang',
  todo_id: null,
  status: 'Belum',
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalNotulensi({
  open, onClose, onSaved, rapat, guruList, currentGuruId,
}: Props) {
  const [form, setForm] = useState({
    ringkasan: '',
    pembahasan: '',
    keputusan: '',
    status: 'Draft' as StatusNotulensi,
    lampiran_url: '',
  });
  const [actionItems, setActionItems] = useState<ActionItemRapat[]>([]);
  const [pesertaList, setPesertaList] = useState<RapatPesertaWithGuru[]>([]);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [isEditingFinalized, setIsEditingFinalized] = useState(false);

  // ==========================================================================
  // LOAD saat open
  // ==========================================================================
  useEffect(() => {
    if (!open || !rapat) return;

    (async () => {
      // Load notulensi existing
      const { data: notulensi } = await supabase
        .from('rapat_notulensi')
        .select('*')
        .eq('rapat_id', rapat.id)
        .maybeSingle();

      if (notulensi) {
        setExistingId(notulensi.id);
        setForm({
          ringkasan: notulensi.ringkasan ?? '',
          pembahasan: notulensi.pembahasan ?? '',
          keputusan: notulensi.keputusan ?? '',
          status: notulensi.status,
          lampiran_url: notulensi.lampiran_url ?? '',
        });
        setActionItems(
          Array.isArray(notulensi.action_items) ? notulensi.action_items : []
        );
      } else {
        setExistingId(null);
        setForm({
          ringkasan: '',
          pembahasan: rapat.deskripsi ?? '',
          keputusan: '',
          status: 'Draft',
          lampiran_url: '',
        });
        setActionItems([]);
      }
      if (notulensi && rapat?.status === 'Selesai') {
  setIsEditingFinalized(true);
}

      // Load peserta untuk konteks AI
      const { data: peserta } = await supabase
        .from('rapat_peserta')
        .select(`
          *,
          guru:gurus!guru_id(id, nama_lengkap, nip, jenis_ptk)
        `)
        .eq('rapat_id', rapat.id);
      setPesertaList((peserta as RapatPesertaWithGuru[]) ?? []);
    })();

    // Check AI availability
    checkAiAvailable().then(setAiAvailable);
  }, [open, rapat]);

  // ==========================================================================
  // AI GENERATE
  // ==========================================================================
  const handleAiGenerate = async () => {
    if (!rapat) return;
    if (!form.pembahasan.trim() || form.pembahasan.trim().length < 20) {
      showToast('error', 'Pembahasan terlalu pendek. Isi minimal 20 karakter dulu.');
      return;
    }

    setAiLoading(true);
    try {
      const result = await generateResumeNotulensi({
        judul_rapat: rapat.judul,
        jenis_rapat: rapat.jenis,
        tanggal: rapat.tanggal,
        pembahasan_mentah: form.pembahasan,
        keputusan_mentah: form.keputusan || undefined,
        peserta_list: pesertaList
          .map((p) => p.guru?.nama_lengkap ?? '')
          .filter(Boolean),
      });

      // Map pic_nama → pic_id berdasarkan peserta
      const mappedActions: ActionItemRapat[] = result.action_items.map((a) => {
        const matched = pesertaList.find((p) =>
          p.guru?.nama_lengkap
            ?.toLowerCase()
            .includes(a.pic_nama?.toLowerCase() ?? '___')
        );
        return {
          pic_id: matched?.guru_id ?? null,
          pic_nama: a.pic_nama ?? '',
          deskripsi: a.deskripsi,
          deadline: a.deadline,
          prioritas: a.prioritas,
          todo_id: null,
          status: 'Belum',
        };
      });

      setForm((f) => ({
        ...f,
        ringkasan: result.ringkasan_eksekutif || f.ringkasan,
        pembahasan: result.pembahasan || f.pembahasan,
        keputusan: result.keputusan || f.keputusan,
      }));
      setActionItems(mappedActions);

      showToast('success', `AI berhasil meringkas! ${mappedActions.length} action items dideteksi.`);
    } catch (err: any) {
      showToast('error', 'AI error: ' + (err.message || 'Unknown error'));
    } finally {
      setAiLoading(false);
    }
  };

  // ==========================================================================
  // ACTION ITEMS
  // ==========================================================================
  const addActionItem = () => {
    setActionItems([...actionItems, { ...emptyAction }]);
  };

  const updateActionItem = (idx: number, updates: Partial<ActionItemRapat>) => {
    setActionItems((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...updates } : a))
    );
  };

  const removeActionItem = (idx: number) => {
    setActionItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async (finalize = false) => {
    if (!rapat) return;
    if (!form.pembahasan.trim()) {
      showToast('error', 'Pembahasan wajib diisi');
      return;
    }
    if (isEditingFinalized && !finalize) {
  const ok = window.confirm(
    'Rapat sudah selesai. Edit notulensi akan tercatat di audit log.\n\nLanjutkan?'
  );
  if (!ok) return;
}

    setSaving(true);
    try {
      // Filter action items kosong
      const cleanedActions = actionItems.filter((a) => a.deskripsi.trim());

      const payload: any = {
        rapat_id: rapat.id,
        ringkasan: form.ringkasan.trim() || null,
        pembahasan: form.pembahasan.trim(),
        keputusan: form.keputusan.trim() || null,
        action_items: cleanedActions,
        status: finalize ? 'Final' : 'Draft',
        lampiran_url: form.lampiran_url.trim() || null,
        created_by: currentGuruId,
      };

      if (finalize) {
        payload.approved_by = currentGuruId;
        payload.approved_at = new Date().toISOString();
      }

      let notulensiId: string;
      if (existingId) {
        const { error } = await supabase
          .from('rapat_notulensi')
          .update(payload)
          .eq('id', existingId);
        if (error) throw error;
        notulensiId = existingId;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.TODO,
          targetId: existingId,
          deskripsi: `Update notulensi: ${rapat.judul}`,
        });
      } else {
        const { data, error } = await supabase
          .from('rapat_notulensi')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        notulensiId = data.id;

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.TODO,
          targetId: data.id,
          deskripsi: `Buat notulensi: ${rapat.judul}`,
        });
      }

      // Kalau finalize, update status rapat ke Selesai
      if (finalize) {
        await supabase
          .from('rapat')
          .update({ status: 'Selesai' })
          .eq('id', rapat.id);
      }

      showToast(
        'success',
        finalize ? 'Notulensi difinalisasi & rapat selesai' : 'Notulensi disimpan sebagai draft'
      );
      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  if (!rapat) return null;

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notulensi Rapat"
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* HEADER RAPAT */}
        <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4">
          <p className="text-[10px] font-mono text-indigo-400">
            {rapat.nomor_rapat ?? '-'}
          </p>
          <p className="text-sm font-extrabold text-slate-100 mt-0.5">
            {rapat.judul}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {formatTanggalRapat(rapat.tanggal)} · {rapat.jenis}
          </p>
        </div>

        {/* AI BUTTON */}
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-purple-300">
                Buat Resume dengan AI
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                Isi pembahasan mentah dulu (min 20 karakter), lalu klik tombol untuk auto-generate ringkasan, pembahasan terstruktur, keputusan, dan action items.
              </p>
              {aiAvailable === false && (
                <p className="text-[10px] text-rose-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  AI tidak tersedia. Cek API key di .env.local.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading || aiAvailable === false}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold shadow-lg shadow-purple-600/20 transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {aiLoading ? (
                <><Loader2 size={12} className="animate-spin" /> Memproses...</>
              ) : (
                <><Wand2 size={12} /> Generate</>
              )}
            </button>
          </div>
        </div>

        {/* PEMBAHASAN (input mentah) */}
        <div>
          <label className={LABEL_CLASS}>
            Pembahasan Mentah *
            <span className="text-slate-500 normal-case font-normal ml-1">
              (isi bebas, AI akan rapikan)
            </span>
          </label>
          <textarea
            rows={6}
            value={form.pembahasan}
            onChange={(e) => setForm({ ...form, pembahasan: e.target.value })}
            placeholder="Contoh: rapat bahas persiapan UAS, pak Budi lapor kelas 12A butuh tambahan jam matematika, bu Ani usul adakan tryout minggu depan, keputusan: tryout tanggal 15, PIC bu Ani, dll..."
            className={INPUT_CLASS + ' resize-none font-mono text-xs leading-relaxed'}
          />
        </div>

        {/* RINGKASAN */}
        <div>
          <label className={LABEL_CLASS}>Ringkasan Eksekutif</label>
          <textarea
            rows={3}
            value={form.ringkasan}
            onChange={(e) => setForm({ ...form, ringkasan: e.target.value })}
            placeholder="(Terisi otomatis oleh AI, atau tulis manual)"
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* KEPUTUSAN */}
        <div>
          <label className={LABEL_CLASS}>Keputusan Rapat</label>
          <textarea
            rows={4}
            value={form.keputusan}
            onChange={(e) => setForm({ ...form, keputusan: e.target.value })}
            placeholder="Keputusan-keputusan yang diambil..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* ACTION ITEMS */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ListChecks size={12} /> Action Items ({actionItems.length})
            </label>
            <button
              type="button"
              onClick={addActionItem}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold transition cursor-pointer"
            >
              <Plus size={10} /> Tambah
            </button>
          </div>

          {actionItems.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-3">
              Belum ada action item. Isi pembahasan lalu Generate AI, atau tambah manual.
            </p>
          ) : (
            <div className="space-y-2">
              {actionItems.map((item, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono text-slate-500 mt-1 shrink-0">
                      #{idx + 1}
                    </span>
                    <textarea
                      rows={2}
                      value={item.deskripsi}
                      onChange={(e) => updateActionItem(idx, { deskripsi: e.target.value })}
                      placeholder="Deskripsi tugas..."
                      className={INPUT_CLASS + ' resize-none text-xs flex-1'}
                    />
                    <button
                      type="button"
                      onClick={() => removeActionItem(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <SearchableSelect
                      options={guruList.map((g) => ({
                        value: g.id,
                        label: g.nama_lengkap,
                      }))}
                      value={item.pic_id ?? ''}
                      onChange={(v) => {
                        const guru = guruList.find((g) => g.id === v);
                        updateActionItem(idx, {
                          pic_id: v || null,
                          pic_nama: guru?.nama_lengkap ?? '',
                        });
                      }}
                      placeholder="PIC..."
                      searchPlaceholder="Cari guru..."
                      emptyMessage="Tidak ditemukan"
                    />
                    <select
                      value={item.prioritas}
                      onChange={(e) => updateActionItem(idx, {
                        prioritas: e.target.value as any,
                      })}
                      className={INPUT_CLASS + ' text-xs cursor-pointer py-2'}
                    >
                      <option value="Tinggi">🔴 Tinggi</option>
                      <option value="Sedang">🟡 Sedang</option>
                      <option value="Rendah">🟢 Rendah</option>
                    </select>
                  </div>

                  <div>
                    <input
                      type="date"
                      value={item.deadline ?? ''}
                      onChange={(e) => updateActionItem(idx, {
                        deadline: e.target.value || null,
                      })}
                      placeholder="Deadline"
                      className={INPUT_CLASS + ' text-xs font-mono py-2'}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LAMPIRAN */}
        <div>
          <label className={LABEL_CLASS}>Link Lampiran (opsional)</label>
          <input
            type="url"
            value={form.lampiran_url}
            onChange={(e) => setForm({ ...form, lampiran_url: e.target.value })}
            placeholder="https://drive.google.com/..."
            className={INPUT_CLASS}
          />
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving || aiLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs transition cursor-pointer disabled:opacity-50"
          >
            Simpan Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={saving || aiLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Simpan...</>
            ) : (
              <><CheckCircle2 size={14} /> Finalisasi</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}