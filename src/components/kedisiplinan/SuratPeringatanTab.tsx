// src/components/kedisiplinan/SuratPeringatanTab.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, X, Pencil, Trash2, Calendar, User, Eye,
  ShieldAlert, Filter, Printer, CheckCircle2, XCircle, Clock,
  ExternalLink, FileWarning,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { ModalSP } from './ModalSP';
import { PrintSP } from './PrintSP';
import {
  getLevelSPBadge, getStatusSPBadge, formatDateShort,
  isKedisiplinanManager, INPUT_CLASS, LABEL_CLASS,
  LEVEL_SP_OPTIONS, STATUS_SP_OPTIONS,
} from './shared';
import type {
  KesiswaanSuratPeringatan, KesiswaanSuratPeringatanWithRelations,
  Siswa, Kelas, Guru, StatusSP,
} from '@/types/database';

const MODUL_KEDISIPLINAN = (AUDIT_MODUL as any)?.KEDISIPLINAN ?? 'Kedisiplinan';

type SiswaWithKelas = Siswa & { kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null };

export function SuratPeringatanTab() {
  const { guru } = useAuth();
  const isManager = isKedisiplinanManager(guru?.role);

  const [list, setList] = useState<KesiswaanSuratPeringatanWithRelations[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaWithKelas[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KesiswaanSuratPeringatan | null>(null);
  const [detailTarget, setDetailTarget] = useState<KesiswaanSuratPeringatanWithRelations | null>(null);
  const [printTarget, setPrintTarget] = useState<KesiswaanSuratPeringatanWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KesiswaanSuratPeringatanWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [spRes, siswaRes, guruRes] = await Promise.all([
        supabase.from('kesiswaan_surat_peringatan').select(`
          *,
          siswa:siswa_id (id, nama_lengkap, nisn, jenis_kelamin, kelas:kelas_id (id, nama_kelas)),
          penandatangan:ditandatangani_oleh (id, nama_lengkap, nip)
        `).order('tanggal_terbit', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('siswas')
          .select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id, status, created_at, kelas:kelas_id (id, nama_kelas)')
          .eq('status', 'AKTIF').order('nama_lengkap'),
        supabase.from('gurus').select('id, nip, nama_lengkap, email, role').order('nama_lengkap'),
      ]);

      if (spRes.error) throw spRes.error;

      setList((spRes.data as unknown as KesiswaanSuratPeringatanWithRelations[]) || []);
      setSiswaList((siswaRes.data as unknown as SiswaWithKelas[]) || []);
      setGuruList((guruRes.data as Guru[]) || []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat SP: ' + (err.message || 'Error'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTERED + STATS
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((sp) => {
      if (filterLevel && sp.level !== filterLevel) return false;
      if (filterStatus && sp.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          (sp.nomor_sp ?? '').toLowerCase().includes(q) ||
          (sp.siswa?.nama_lengkap ?? '').toLowerCase().includes(q) ||
          (sp.siswa?.nisn ?? '').toLowerCase().includes(q) ||
          sp.alasan.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterLevel, filterStatus, search]);

  const stats = useMemo(() => {
    return {
      total: list.length,
      sp1: list.filter((s) => s.level === 'SP1').length,
      sp2: list.filter((s) => s.level === 'SP2').length,
      sp3: list.filter((s) => s.level === 'SP3').length,
      aktif: list.filter((s) => s.status === 'Aktif').length,
    };
  }, [list]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => { setEditingItem(null); setModalOpen(true); };
  const handleOpenEdit = (sp: KesiswaanSuratPeringatanWithRelations) => {
    setEditingItem(sp as KesiswaanSuratPeringatan); setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('kesiswaan_surat_peringatan')
        .delete().eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE', modul: MODUL_KEDISIPLINAN, targetId: deleteTarget.id,
        deskripsi: `Hapus ${deleteTarget.level} [${deleteTarget.nomor_sp}] — ${deleteTarget.siswa?.nama_lengkap}`,
      });

      showToast('success', 'SP dihapus');
      setDeleteTarget(null); fetchAll();
    } catch (err: any) { showToast('error', 'Gagal hapus: ' + (err.message || 'Error')); }
  };

  const handleUpdateStatus = async (id: string, status: StatusSP) => {
    try {
      const { error } = await supabase.from('kesiswaan_surat_peringatan')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE', modul: MODUL_KEDISIPLINAN, targetId: id,
        deskripsi: `Update status SP → ${status}`,
      });

      showToast('success', `Status diubah ke ${status}`);
      fetchAll();
      if (detailTarget?.id === id) setDetailTarget(null);
    } catch (err: any) { showToast('error', 'Gagal: ' + (err.message || 'Error')); }
  };

  const resetFilter = () => { setSearch(''); setFilterLevel(''); setFilterStatus(''); };
  const hasFilter = search || filterLevel || filterStatus;

  const exportHeaders = ['Nomor SP', 'Level', 'Tanggal', 'Siswa', 'NISN', 'Kelas', 'Poin Pelanggaran', 'Poin Prestasi', 'Status', 'Alasan'];
  const exportRows = filtered.map((sp) => [
    sp.nomor_sp ?? '-', sp.level, sp.tanggal_terbit,
    sp.siswa?.nama_lengkap ?? '-', sp.siswa?.nisn ?? '-', sp.siswa?.kelas?.nama_kelas ?? '-',
    sp.total_poin_pelanggaran, sp.total_poin_prestasi,
    sp.status, sp.alasan,
  ]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <FileWarning className="text-rose-400" size={20} /> Surat Peringatan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} SP ditampilkan
          </p>
        </div>
        <button onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-colors cursor-pointer">
          <Plus size={14} /> Terbitkan SP
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={FileWarning} label="Total SP" value={stats.total} color="rose" />
        <KpiCard icon={ShieldAlert} label="SP1" value={stats.sp1} color="amber" />
        <KpiCard icon={ShieldAlert} label="SP2" value={stats.sp2} color="orange" />
        <KpiCard icon={ShieldAlert} label="SP3" value={stats.sp3} color="rose" />
        <KpiCard icon={Clock} label="SP Aktif" value={stats.aktif} color="indigo" pulse={stats.aktif > 0} />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-rose-400" /> Filter & Pencarian
          </div>
          {hasFilter && (
            <button onClick={resetFilter}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
              <X size={12} /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor SP / nama / NISN..." className={`${INPUT_CLASS} pl-10`} />
          </div>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer`}>
            <option value="">Semua Level</option>
            {LEVEL_SP_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer`}>
            <option value="">Semua Status</option>
            {STATUS_SP_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex justify-end">
          <ExportImportButtons filename={`surat_peringatan_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Surat Peringatan" headers={exportHeaders} rows={exportRows} showImport={false} />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat data SP...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <FileWarning size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada SP cocok' : 'Belum ada Surat Peringatan'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba reset filter.' : 'Klik "Terbitkan SP" untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((sp) => (
            <div key={sp.id}
              className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                sp.status === 'Aktif'
                  ? sp.level === 'SP3' ? 'border-rose-500/40'
                    : sp.level === 'SP2' ? 'border-orange-500/40'
                    : 'border-amber-500/40'
                  : 'border-slate-800 hover:border-slate-700'
              }`}>
              {/* HEADER */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                    sp.level === 'SP3'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : sp.level === 'SP2'
                      ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  }`}>
                    <ShieldAlert size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getLevelSPBadge(sp.level)}`}>
                        {sp.level}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusSPBadge(sp.status)}`}>
                        {sp.status}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono font-bold text-indigo-400 mt-1 truncate">
                      {sp.nomor_sp ?? '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* INFO SISWA */}
              <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <User size={12} className="text-slate-500" />
                  <p className="text-xs font-bold text-slate-100">
                    {sp.siswa?.nama_lengkap ?? '-'}
                  </p>
                </div>
                <p className="text-[10px] text-slate-500">
                  {sp.siswa?.kelas?.nama_kelas ?? '-'} · NISN: {sp.siswa?.nisn ?? '-'}
                </p>
              </div>

              {/* ALASAN */}
              <div className="mb-3">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Alasan</p>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                  {sp.alasan}
                </p>
              </div>

              {/* REKAP POIN */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-2 text-center">
                  <p className="text-rose-400 font-bold uppercase">Pelanggaran</p>
                  <p className="text-base font-extrabold text-rose-400">{sp.total_poin_pelanggaran}</p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 text-center">
                  <p className="text-emerald-400 font-bold uppercase">Prestasi</p>
                  <p className="text-base font-extrabold text-emerald-400">{sp.total_poin_prestasi}</p>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 text-center">
                  <p className="text-amber-400 font-bold uppercase">Bersih</p>
                  <p className="text-base font-extrabold text-amber-400">
                    {sp.total_poin_pelanggaran - sp.total_poin_prestasi}
                  </p>
                </div>
              </div>

              {/* FOOTER */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Calendar size={10} />
                  {formatDateShort(sp.tanggal_terbit)}
                </span>

                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPrintTarget(sp)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[11px] font-bold transition cursor-pointer"
                    title="Cetak SP">
                    <Printer size={11} /> Cetak
                  </button>
                  <button onClick={() => setDetailTarget(sp)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition cursor-pointer"
                    title="Detail">
                    <Eye size={13} />
                  </button>
                  {isManager && (
                    <>
                      <button onClick={() => handleOpenEdit(sp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                        title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteTarget(sp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Hapus">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== MODAL FORM SP ==================== */}
      <ModalSP
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        sp={editingItem}
        siswaList={siswaList}
        guruList={guruList}
        onSaved={fetchAll}
      />

      {/* ==================== MODAL DETAIL ==================== */}
      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="Detail Surat Peringatan"
        size="md"
      >
        {detailTarget && (
          <div className="space-y-4 pt-1">
            <div className={`border rounded-2xl p-4 ${
              detailTarget.level === 'SP3'
                ? 'bg-rose-500/5 border-rose-500/20'
                : detailTarget.level === 'SP2'
                ? 'bg-orange-500/5 border-orange-500/20'
                : 'bg-amber-500/5 border-amber-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  detailTarget.level === 'SP3'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : detailTarget.level === 'SP2'
                    ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                }`}>
                  <ShieldAlert size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getLevelSPBadge(detailTarget.level)}`}>
                      {detailTarget.level}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusSPBadge(detailTarget.status)}`}>
                      {detailTarget.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono font-bold text-indigo-400">
                    {detailTarget.nomor_sp ?? '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* SISWA */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Siswa</p>
              <p className="font-bold text-slate-100">{detailTarget.siswa?.nama_lengkap ?? '-'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {detailTarget.siswa?.kelas?.nama_kelas ?? '-'} · NISN: {detailTarget.siswa?.nisn ?? '-'}
              </p>
            </div>

            {/* POIN */}
            <div className="grid grid-cols-3 gap-2.5">
              <DetailBox label="Pelanggaran" value={String(detailTarget.total_poin_pelanggaran)} valueClass="text-rose-400" />
              <DetailBox label="Prestasi" value={String(detailTarget.total_poin_prestasi)} valueClass="text-emerald-400" />
              <DetailBox label="Poin Bersih"
                value={String(detailTarget.total_poin_pelanggaran - detailTarget.total_poin_prestasi)}
                valueClass="text-amber-400" />
            </div>

            {/* ALASAN */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Alasan</p>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {detailTarget.alasan}
              </p>
            </div>

            {/* CATATAN */}
            {detailTarget.catatan && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Catatan</p>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {detailTarget.catatan}
                </p>
              </div>
            )}

            {/* DATES */}
            <div className="grid grid-cols-2 gap-2.5">
              <DetailBox label="Tanggal Terbit" value={formatDateShort(detailTarget.tanggal_terbit)} />
              <DetailBox label="Batas Waktu" value={detailTarget.batas_waktu ? formatDateShort(detailTarget.batas_waktu) : '-'} />
            </div>

            {/* PENANDATANGAN */}
            {detailTarget.penandatangan && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Ditandatangani Oleh</p>
                <p className="text-xs font-semibold text-slate-200">
                  {detailTarget.penandatangan.nama_lengkap}
                </p>
                {detailTarget.penandatangan.nip && (
                  <p className="text-[10px] text-slate-500 mt-0.5">NIP. {detailTarget.penandatangan.nip}</p>
                )}
              </div>
            )}

            {/* STATUS ACTIONS */}
            {isManager && detailTarget.status === 'Aktif' && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <p className="text-[10px] uppercase font-bold text-slate-500">Ubah Status SP</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleUpdateStatus(detailTarget.id, 'Selesai')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition cursor-pointer">
                    <CheckCircle2 size={12} /> Tandai Selesai
                  </button>
                  <button onClick={() => handleUpdateStatus(detailTarget.id, 'Dicabut')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition cursor-pointer">
                    <XCircle size={12} /> Cabut SP
                  </button>
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex justify-between gap-2.5 pt-4 border-t border-slate-800">
              <button onClick={() => { setDetailTarget(null); setPrintTarget(detailTarget); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer">
                <Printer size={13} /> Cetak SP
              </button>
              <button onClick={() => setDetailTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== PRINT SP ==================== */}
      {printTarget && (
        <PrintSP
          sp={{
            nomor_sp: printTarget.nomor_sp ?? '-',
            level: printTarget.level,
            tanggal_terbit: printTarget.tanggal_terbit,
            batas_waktu: printTarget.batas_waktu,
            alasan: printTarget.alasan,
            total_poin_pelanggaran: printTarget.total_poin_pelanggaran,
            total_poin_prestasi: printTarget.total_poin_prestasi,
            catatan: printTarget.catatan,
          }}
          siswa={{
            nisn: printTarget.siswa?.nisn ?? '-',
            nama_lengkap: printTarget.siswa?.nama_lengkap ?? '-',
            jenis_kelamin: printTarget.siswa?.jenis_kelamin ?? 'L',
            kelas: printTarget.siswa?.kelas?.nama_kelas ?? '-',
          }}
          penandatangan={{
            nama: printTarget.penandatangan?.nama_lengkap ?? '-',
            nip: printTarget.penandatangan?.nip,
            jabatan: 'Kepala Sekolah',
          }}
          onClose={() => setPrintTarget(null)}
        />
      )}

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Surat Peringatan"
        message={`Yakin hapus ${deleteTarget?.level} [${deleteTarget?.nomor_sp}] untuk ${deleteTarget?.siswa?.nama_lengkap}? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================

type KpiColor = 'rose' | 'amber' | 'orange' | 'indigo';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
};

function KpiCard({ icon: Icon, label, value, color, pulse = false }: {
  icon: typeof FileWarning; label: string; value: number; color: KpiColor; pulse?: boolean;
}) {
  const c = CM[color];
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 ${pulse ? 'ring-1 ring-current ' + c.text : ''}`}>
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-base font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}

function DetailBox({ label, value, valueClass = 'text-slate-200' }: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{label}</p>
      <p className={`text-xs font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}