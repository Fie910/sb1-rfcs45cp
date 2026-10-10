// src/components/bk/AsesmenTab.tsx
// Tab Asesmen — DCM, Minat Bakat, Gaya Belajar, dll.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, X, Loader2, Save, Trash2,
  ClipboardList, User, Calendar, Eye, Brain, Target,
  Sparkles, Activity, HeartPulse, ChevronRight, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { formatDateShort, isBkManager, INPUT_CLASS, LABEL_CLASS } from './shared';
import type {
  BkAsesmen, BkAsesmenWithRelations, Siswa, Guru, JenisAsesmen,
} from '@/types/database';

// =============================================================================
// KONFIGURASI JENIS ASESMEN
// =============================================================================

type JenisConfig = {
  jenis: JenisAsesmen;
  icon: typeof Brain;
  color: string;
  bg: string;
  border: string;
  description: string;
  /** Field khusus yang perlu diisi untuk jenis ini */
  customFields?: { key: string; label: string; type: 'text' | 'select' | 'scale'; options?: string[] }[];
};

const JENIS_CONFIG: JenisConfig[] = [
  {
    jenis: 'DCM',
    icon: ClipboardList,
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
    description: 'Daftar Cek Masalah — mengidentifikasi masalah siswa',
    customFields: [
      { key: 'masalah_utama', label: 'Masalah Utama', type: 'text' },
      { key: 'bidang_masalah', label: 'Bidang Masalah', type: 'select', options: ['Pribadi', 'Sosial', 'Belajar', 'Karier'] },
      { key: 'intensitas', label: 'Intensitas', type: 'select', options: ['Ringan', 'Sedang', 'Berat'] },
    ],
  },
  {
    jenis: 'Minat Bakat',
    icon: Sparkles,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    description: 'Identifikasi minat & bakat untuk arah karier',
    customFields: [
      { key: 'minat_dominan', label: 'Minat Dominan', type: 'text' },
      { key: 'bakat_unggulan', label: 'Bakat Unggulan', type: 'text' },
      { key: 'rekomendasi_jurusan', label: 'Rekomendasi Jurusan/Karier', type: 'text' },
    ],
  },
  {
    jenis: 'Kesehatan Mental',
    icon: HeartPulse,
    color: 'text-rose-400',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/30',
    description: 'Skrining kesehatan mental & emosional',
    customFields: [
      { key: 'tingkat_stres', label: 'Tingkat Stres', type: 'select', options: ['Rendah', 'Sedang', 'Tinggi'] },
      { key: 'gejala', label: 'Gejala yang Diamati', type: 'text' },
      { key: 'perlu_rujukan', label: 'Perlu Rujukan Eksternal?', type: 'select', options: ['Ya', 'Tidak'] },
    ],
  },
  {
    jenis: 'Gaya Belajar',
    icon: Brain,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/30',
    description: 'Gaya belajar dominan (visual/auditori/kinestetik)',
    customFields: [
      { key: 'gaya_dominan', label: 'Gaya Dominan', type: 'select', options: ['Visual', 'Auditori', 'Kinestetik', 'Campuran'] },
      { key: 'saran_belajar', label: 'Saran Metode Belajar', type: 'text' },
    ],
  },
  {
    jenis: 'Kepribadian',
    icon: Target,
    color: 'text-teal-400',
    bg: 'bg-teal-500/15',
    border: 'border-teal-500/30',
    description: 'Profil kepribadian (MBTI, DISC, dll.)',
    customFields: [
      { key: 'tipe_kepribadian', label: 'Tipe Kepribadian', type: 'text' },
      { key: 'karakteristik', label: 'Karakteristik Utama', type: 'text' },
    ],
  },
];

function getJenisConfig(jenis: JenisAsesmen): JenisConfig {
  return JENIS_CONFIG.find((j) => j.jenis === jenis) ?? JENIS_CONFIG[0];
}

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================

export function AsesmenTab() {
  const { guru } = useAuth();
  const isManager = isBkManager(guru?.role);

  const [list, setList] = useState<BkAsesmenWithRelations[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BkAsesmen | null>(null);
  const [form, setForm] = useState({
    siswa_id: '',
    jenis: 'DCM' as JenisAsesmen,
    tanggal: new Date().toISOString().split('T')[0],
    guru_bk_id: '',
    rekomendasi: '',
  });
  const [customData, setCustomData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [detailTarget, setDetailTarget] = useState<BkAsesmenWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BkAsesmenWithRelations | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [asesmenRes, siswaRes, guruRes] = await Promise.all([
        supabase.from('bk_asesmen').select(`
          *,
          siswa:siswa_id (id, nama_lengkap, nisn),
          guru_bk:guru_bk_id (id, nama_lengkap)
        `).order('tanggal', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('siswas').select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id, status, created_at')
          .eq('status', 'AKTIF').order('nama_lengkap'),
        supabase.from('gurus').select('id, nip, nama_lengkap, email, role').order('nama_lengkap'),
      ]);

      if (asesmenRes.error) throw asesmenRes.error;
      setList((asesmenRes.data as unknown as BkAsesmenWithRelations[]) || []);
      setSiswaList((siswaRes.data as Siswa[]) || []);
      setGuruList((guruRes.data as Guru[]) || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      showToast('error', 'Gagal memuat asesmen: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    return list.filter((a) => {
      if (filterJenis && a.jenis !== filterJenis) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          (a.siswa?.nama_lengkap ?? '').toLowerCase().includes(q) ||
          (a.siswa?.nisn ?? '').toLowerCase().includes(q) ||
          a.jenis.toLowerCase().includes(q) ||
          (a.rekomendasi ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterJenis, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const dcm = list.filter((a) => a.jenis === 'DCM').length;
    const minat = list.filter((a) => a.jenis === 'Minat Bakat').length;
    const bulanIni = new Date().getMonth();
    const thisMonth = list.filter((a) => new Date(a.tanggal).getMonth() === bulanIni).length;
    return { total, dcm, minat, thisMonth };
  }, [list]);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({
      siswa_id: '',
      jenis: 'DCM',
      tanggal: new Date().toISOString().split('T')[0],
      guru_bk_id: guru?.id ?? '',
      rekomendasi: '',
    });
    setCustomData({});
    setModalOpen(true);
  };

  const handleOpenEdit = (a: BkAsesmenWithRelations) => {
    setEditing(a as BkAsesmen);
    setForm({
      siswa_id: String(a.siswa_id),
      jenis: a.jenis,
      tanggal: a.tanggal,
      guru_bk_id: a.guru_bk_id ?? '',
      rekomendasi: a.rekomendasi ?? '',
    });
    // Load custom data dari jawaban jsonb
    const j = (a.jawaban as Record<string, string>) ?? {};
    setCustomData(j);
    setModalOpen(true);
  };

  const handleJenisChange = (jenis: JenisAsesmen) => {
    setForm({ ...form, jenis });
    setCustomData({}); // reset custom fields
  };

  const handleSave = async () => {
    if (!form.siswa_id) { showToast('error', 'Pilih siswa'); return; }

    setSaving(true);
    try {
      const payload = {
        siswa_id: Number(form.siswa_id),
        jenis: form.jenis,
        tanggal: form.tanggal,
        guru_bk_id: form.guru_bk_id || null,
        rekomendasi: form.rekomendasi.trim() || null,
        jawaban: customData,
        skor: null, // bisa diisi nanti kalau ada scoring engine
      };

      if (editing?.id) {
        const { error } = await supabase.from('bk_asesmen').update(payload).eq('id', editing.id);
        if (error) throw error;
        await logActivity({ aksi: 'UPDATE', modul: AUDIT_MODUL.BK, targetId: editing.id, deskripsi: `Update asesmen ${form.jenis}` });
        showToast('success', 'Asesmen diperbarui');
      } else {
        const { data, error } = await supabase.from('bk_asesmen').insert(payload).select().single();
        if (error) throw error;
        await logActivity({ aksi: 'CREATE', modul: AUDIT_MODUL.BK, targetId: data?.id, deskripsi: `Asesmen baru: ${form.jenis}` });
        showToast('success', 'Asesmen berhasil dicatat');
      }
      setModalOpen(false); fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('bk_asesmen').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logActivity({ aksi: 'DELETE', modul: AUDIT_MODUL.BK, targetId: deleteTarget.id, deskripsi: `Hapus asesmen` });
      showToast('success', 'Asesmen dihapus');
      setDeleteTarget(null); fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const resetFilter = () => { setSearch(''); setFilterJenis(''); };
  const hasFilter = search || filterJenis;

  const exportHeaders = ['Tanggal', 'Siswa', 'NISN', 'Jenis', 'Guru BK', 'Rekomendasi'];
  const exportRows = filtered.map((a) => [
    a.tanggal,
    a.siswa?.nama_lengkap ?? '-',
    a.siswa?.nisn ?? '-',
    a.jenis,
    a.guru_bk?.nama_lengkap ?? '-',
    a.rekomendasi ?? '-',
  ]);

  const activeConfig = getJenisConfig(form.jenis);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <ClipboardList className="text-purple-400" size={20} /> Asesmen & Instrumen
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} asesmen ditampilkan
          </p>
        </div>
        <button onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-colors cursor-pointer">
          <Plus size={14} /> Asesmen Baru
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardList} label="Total Asesmen" value={stats.total} color="purple" />
        <KpiCard icon={Brain} label="DCM" value={stats.dcm} color="indigo" />
        <KpiCard icon={Sparkles} label="Minat Bakat" value={stats.minat} color="amber" />
        <KpiCard icon={Calendar} label="Bulan Ini" value={stats.thisMonth} color="emerald" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari siswa, jenis asesmen, rekomendasi..." className={`${INPUT_CLASS} pl-10`} />
          </div>
          <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer text-xs lg:w-56`}>
            <option value="">Semua Jenis</option>
            {JENIS_CONFIG.map((c) => <option key={c.jenis} value={c.jenis}>{c.jenis}</option>)}
          </select>
          {hasFilter && (
            <button onClick={resetFilter}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer">
              <X size={12} /> Reset
            </button>
          )}
        </div>
        <div className="flex justify-end">
          <ExportImportButtons filename={`asesmen_bk_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Asesmen BK" headers={exportHeaders} rows={exportRows} showImport={false} />
        </div>
      </div>

      {/* GRID JENIS ASESMEN (INFO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {JENIS_CONFIG.map((c) => {
          const Icon = c.icon;
          const count = list.filter((a) => a.jenis === c.jenis).length;
          return (
            <button key={c.jenis}
              onClick={() => setFilterJenis(filterJenis === c.jenis ? '' : c.jenis)}
              className={`text-left bg-slate-900 border rounded-2xl p-4 transition-all cursor-pointer ${
                filterJenis === c.jenis ? `${c.border} ring-1 ring-current ${c.color}` : 'border-slate-800 hover:border-slate-700'
              }`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.border} border ${c.color} flex items-center justify-center shrink-0`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-100 text-sm">{c.jenis}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{c.description}</p>
                  <p className={`text-xs font-extrabold ${c.color} mt-2`}>{count} asesmen</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat asesmen...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <ClipboardList size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada asesmen cocok' : 'Belum ada asesmen'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba reset filter.' : 'Klik "Asesmen Baru" untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Siswa</th>
                  <th className="text-left px-4 py-3">Jenis</th>
                  <th className="text-left px-4 py-3">Tanggal</th>
                  <th className="text-left px-4 py-3">Guru BK</th>
                  <th className="text-left px-4 py-3">Rekomendasi</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((a) => {
                  const conf = getJenisConfig(a.jenis);
                  const Icon = conf.icon;
                  return (
                    <tr key={a.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                            <User size={14} className="text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 text-xs truncate max-w-[180px]">
                              {a.siswa?.nama_lengkap ?? '-'}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500">
                              {a.siswa?.nisn ?? '-'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${conf.border} ${conf.color}`}>
                          <Icon size={10} /> {a.jenis}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDateShort(a.tanggal)}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{a.guru_bk?.nama_lengkap ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">
                        {a.rekomendasi ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDetailTarget(a)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer" title="Lihat">
                            <Eye size={14} />
                          </button>
                          {isManager && (
                            <>
                              <button onClick={() => handleOpenEdit(a)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer" title="Edit">
                                <Save size={14} />
                              </button>
                              <button onClick={() => setDeleteTarget(a)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer" title="Hapus">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL FORM ==================== */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Asesmen' : 'Catat Asesmen Baru'} size="lg">
        <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
          {/* Pilih Jenis */}
          <div>
            <label className={LABEL_CLASS}>Jenis Asesmen *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {JENIS_CONFIG.map((c) => {
                const Icon = c.icon;
                const active = form.jenis === c.jenis;
                return (
                  <button key={c.jenis} type="button" onClick={() => handleJenisChange(c.jenis)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      active ? `${c.bg} ${c.border} ${c.color}` : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}>
                    <Icon size={16} />
                    {c.jenis}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Siswa *</label>
            <SearchableSelect
              options={siswaList.map((s) => ({ value: String(s.id), label: s.nama_lengkap, hint: `NISN: ${s.nisn}` }))}
              value={form.siswa_id}
              onChange={(v) => setForm({ ...form, siswa_id: v })}
              placeholder="Pilih siswa..." searchPlaceholder="Cari nama/NISN..."
              emptyMessage="Siswa tidak ditemukan"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tanggal Asesmen</label>
              <input type="date" value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Guru BK</label>
              <SearchableSelect
                options={guruList.map((g) => ({ value: g.id, label: g.nama_lengkap, hint: g.nip ? `NIP: ${g.nip}` : undefined }))}
                value={form.guru_bk_id}
                onChange={(v) => setForm({ ...form, guru_bk_id: v })}
                placeholder="Pilih guru BK..."
                searchPlaceholder="Cari guru..." emptyMessage="Guru tidak ditemukan"
              />
            </div>
          </div>

          {/* Custom Fields dinamis per jenis */}
          {activeConfig.customFields && activeConfig.customFields.length > 0 && (
            <div className={`${activeConfig.bg} border ${activeConfig.border} rounded-2xl p-4 space-y-3`}>
              <h4 className={`text-xs font-bold uppercase tracking-wider ${activeConfig.color} flex items-center gap-2`}>
                <activeConfig.icon size={13} /> Detail {activeConfig.jenis}
              </h4>

              {activeConfig.customFields.map((f) => (
                <div key={f.key}>
                  <label className={LABEL_CLASS}>{f.label}</label>
                  {f.type === 'select' && f.options ? (
                    <select value={customData[f.key] ?? ''}
                      onChange={(e) => setCustomData({ ...customData, [f.key]: e.target.value })}
                      className={INPUT_CLASS + ' cursor-pointer'}>
                      <option value="">-- Pilih --</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={customData[f.key] ?? ''}
                      onChange={(e) => setCustomData({ ...customData, [f.key]: e.target.value })}
                      placeholder={f.label}
                      className={INPUT_CLASS} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className={LABEL_CLASS}>Rekomendasi / Catatan Akhir</label>
            <textarea rows={3} value={form.rekomendasi}
              onChange={(e) => setForm({ ...form, rekomendasi: e.target.value })}
              placeholder="Rekomendasi tindak lanjut, saran, atau catatan penting..."
              className={INPUT_CLASS + ' resize-none'} />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer">
              Batal
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-colors disabled:opacity-50 cursor-pointer">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editing ? 'Simpan Perubahan' : 'Simpan Asesmen'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== MODAL DETAIL ==================== */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)}
        title="Detail Asesmen" size="md">
        {detailTarget && (() => {
          const conf = getJenisConfig(detailTarget.jenis);
          const Icon = conf.icon;
          const jawaban = (detailTarget.jawaban as Record<string, string>) ?? {};
          return (
            <div className="space-y-4 pt-1">
              <div className={`${conf.bg} border ${conf.border} rounded-2xl p-4`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl ${conf.bg} ${conf.border} border ${conf.color} flex items-center justify-center shrink-0`}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase ${conf.color}`}>{detailTarget.jenis}</p>
                    <p className="font-bold text-slate-100 text-base mt-0.5">
                      {detailTarget.siswa?.nama_lengkap ?? '-'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateShort(detailTarget.tanggal)} · {detailTarget.guru_bk?.nama_lengkap ?? '-'}
                    </p>
                  </div>
                </div>
              </div>

              {Object.keys(jawaban).length > 0 && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Hasil Asesmen
                  </h4>
                  {Object.entries(jawaban).map(([k, v]) => {
                    const fieldLabel = conf.customFields?.find((f) => f.key === k)?.label ?? k;
                    return (
                      <div key={k} className="flex items-start justify-between gap-3 pb-2 border-b border-slate-800/60 last:border-b-0">
                        <span className="text-xs text-slate-500 font-semibold">{fieldLabel}</span>
                        <span className="text-xs text-slate-200 text-right font-medium">
                          {v || '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {detailTarget.rekomendasi && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">
                    Rekomendasi
                  </h4>
                  <p className="text-xs text-emerald-100 leading-relaxed whitespace-pre-wrap">
                    {detailTarget.rekomendasi}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button onClick={() => setDetailTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer">
                  Tutup
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Asesmen"
        message={`Yakin hapus asesmen ${deleteTarget?.jenis} untuk "${deleteTarget?.siswa?.nama_lengkap}"?`} />
    </div>
  );
}

// =============================================================================
// KPI CARD
// =============================================================================
type KpiColor = 'purple' | 'indigo' | 'amber' | 'emerald';
const COLOR_MAP: Record<KpiColor, { bg: string; text: string; border: string }> = {
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof ClipboardList; label: string; value: number; color: KpiColor;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-base font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}