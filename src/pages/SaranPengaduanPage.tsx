import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MessageSquareWarning,
  Loader2,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Filter,
  Search,
  UserCheck,
  MessageSquare,
  RefreshCw,
  History,
  Inbox,
  X,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { getTodayDateWib } from '@/lib/date';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { sendNotification, getGuruIdsByRole } from '@/lib/notification';
import type {
  SaranPengaduanWithRelations,
  SaranPengaduanStatus,
  SaranPengaduanPrioritas,
  SaranPengaduanKategori,
} from '@/types/database';
import {
  KATEGORI_SARAN_PENGADUAN,
  STATUS_SARAN_PENGADUAN,
  PRIORITAS_SARAN_PENGADUAN,
} from '@/types/database';

// =============================================================================
// KONSTANTA
// =============================================================================

const MANAGER_ROLES = ['admin', 'kepala', 'wakil_kepala', 'takola', 'akademik', 'kesiswaan', 'sarpras', 'keuangan'];

// =============================================================================
// HELPER — Badge warna
// =============================================================================

function getStatusBadge(status: string): string {
  switch (status) {
    case 'Baru':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Diproses':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Selesai':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Ditolak':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

function getPrioritasBadge(prioritas: string): string {
  switch (prioritas) {
    case 'Tinggi':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Sedang':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Rendah':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

function getKategoriBadge(kategori: string): string {
  switch (kategori) {
    case 'Sarana Prasarana':
      return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
    case 'Akademik':
      return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
    case 'Kesiswaan':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    case 'Keuangan':
      return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
    case 'Kepegawaian':
      return 'bg-teal-500/10 text-teal-300 border-teal-500/20';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'Baru':
      return AlertCircle;
    case 'Diproses':
      return Clock;
    case 'Selesai':
      return CheckCircle2;
    case 'Ditolak':
      return XCircle;
    default:
      return AlertCircle;
  }
}

function formatDateTimeWib(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================

export function SaranPengaduanPage() {
  const { guru, user } = useAuth();

  // Cek apakah user adalah pengelola
  const isManager = useMemo(() => {
    if (!guru?.role) return false;
    return MANAGER_ROLES.includes(guru.role.toLowerCase());
  }, [guru?.role]);

  const [activeTab, setActiveTab] = useState<'kirim' | 'riwayat' | 'kelola'>('kirim');

  // =========================================================================
  // STATE — DATA
  // =========================================================================
  const [myList, setMyList] = useState<SaranPengaduanWithRelations[]>([]);
  const [allList, setAllList] = useState<SaranPengaduanWithRelations[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  // =========================================================================
  // STATE — FORM INPUT
  // =========================================================================
  const [form, setForm] = useState({
    kategori: KATEGORI_SARAN_PENGADUAN[0],
    subjek: '',
    isi: '',
    prioritas: 'Sedang' as SaranPengaduanPrioritas,
    is_anonim: false,
  });
  const [submitting, setSubmitting] = useState(false);

  // =========================================================================
  // STATE — FILTER KELOLA
  // =========================================================================
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterKategori, setFilterKategori] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // =========================================================================
  // STATE — DETAIL MODAL
  // =========================================================================
  const [detailItem, setDetailItem] = useState<SaranPengaduanWithRelations | null>(null);

  // State form tanggapan (di modal)
  const [tanggapanForm, setTanggapanForm] = useState({
    status: 'Baru' as SaranPengaduanStatus,
    tanggapan: '',
  });
  const [submittingTanggapan, setSubmittingTanggapan] = useState(false);

  // =========================================================================
  // FETCH — RIWAYAT SAYA
  // =========================================================================
  const fetchMine = useCallback(async () => {
    if (!user?.id) return;
    setLoadingMine(true);
    try {
      const { data, error } = await supabase
        .from('saran_pengaduan')
        .select(`
          *,
          pelapor:pelapor_id (id, nama_lengkap),
          penanggap:penanggap_id (id, nama_lengkap)
        `)
        .eq('pelapor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyList((data as SaranPengaduanWithRelations[]) || []);
    } catch (err) {
      console.error('Gagal fetch riwayat saran:', err);
      showToast('error', 'Gagal memuat riwayat saran');
    } finally {
      setLoadingMine(false);
    }
  }, [user?.id]);

  // =========================================================================
  // FETCH — SEMUA (KELOLA)
  // =========================================================================
  const fetchAll = useCallback(async () => {
    if (!isManager) return;
    setLoadingAll(true);
    try {
      let query = supabase
        .from('saran_pengaduan')
        .select(`
          *,
          pelapor:pelapor_id (id, nama_lengkap),
          penanggap:penanggap_id (id, nama_lengkap)
        `)
        .order('created_at', { ascending: false });

      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }
      if (filterKategori) {
        query = query.eq('kategori', filterKategori);
      }
      if (searchQuery.trim()) {
        query = query.or(
          `subjek.ilike.%${searchQuery.trim()}%,isi.ilike.%${searchQuery.trim()}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setAllList((data as SaranPengaduanWithRelations[]) || []);
    } catch (err) {
      console.error('Gagal fetch semua saran:', err);
      showToast('error', 'Gagal memuat daftar saran');
    } finally {
      setLoadingAll(false);
    }
  }, [isManager, filterStatus, filterKategori, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchMine();
    if (isManager) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fetch kelola saat filter berubah
  useEffect(() => {
    if (isManager && activeTab === 'kelola') {
      fetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterKategori, searchQuery, activeTab]);

  // Log VIEW
  useEffect(() => {
    logActivity({
      aksi: 'VIEW',
      modul: AUDIT_MODUL.AUTH,
      deskripsi: 'Membuka halaman Saran & Pengaduan',
    });
  }, []);

  // =========================================================================
  // SUBMIT — BUAT SARAN BARU
  // =========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.subjek.trim() || !form.isi.trim()) {
      showToast('error', 'Subjek dan isi wajib diisi');
      return;
    }

    if (!user?.id) {
      showToast('error', 'Sesi Anda tidak valid. Silakan login kembali.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        pelapor_id: form.is_anonim ? null : user.id,
        is_anonim: form.is_anonim,
        kategori: form.kategori,
        subjek: form.subjek.trim(),
        isi: form.isi.trim(),
        prioritas: form.prioritas,
        status: 'Baru' as SaranPengaduanStatus,
      };

      const { data: created, error } = await supabase
        .from('saran_pengaduan')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      // Reset form
      setForm({
        kategori: KATEGORI_SARAN_PENGADUAN[0],
        subjek: '',
        isi: '',
        prioritas: 'Sedang',
        is_anonim: false,
      });

      showToast('success', 'Saran/pengaduan berhasil dikirim!');

      // Audit log
      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.SARAN_PENGADUAN,
        targetId: created?.id,
        deskripsi: `Kirim ${form.is_anonim ? 'anonim' : 'saran/pengaduan'}: [${form.kategori}] ${form.subjek.trim()}`,
        metadata: {
          kategori: form.kategori,
          prioritas: form.prioritas,
          is_anonim: form.is_anonim,
        },
      });

      // Notifikasi ke pengelola (takola + admin)
      try {
        const [takolaIds, adminIds] = await Promise.all([
          getGuruIdsByRole('takola'),
          getGuruIdsByRole('admin'),
          getGuruIdsByRole('kepala'),
          getGuruIdsByRole('akademik'),
          getGuruIdsByRole('kesiswaan'),
          getGuruIdsByRole('sarpras'),
          getGuruIdsByRole('keuangan'),
        ]);
        const targetIds = Array.from(new Set([...takolaIds, ...adminIds])).filter(
          (id) => id !== user.id
        );

        if (targetIds.length > 0) {
          const pelaporLabel = form.is_anonim ? 'Anonim' : guru?.nama_lengkap || 'Guru';
          await sendNotification({
            guruIds: targetIds,
            judul:
              form.prioritas === 'Tinggi'
                ? '🚨 Saran/Pengaduan Prioritas Tinggi'
                : '📬 Saran/Pengaduan Baru',
            pesan: `[${form.kategori}] ${form.subjek.trim()} — dari ${pelaporLabel}`,
            tipe: 'saran_pengaduan',
            tautan: '/saran_pengaduan',
          });
        }
      } catch (notifErr) {
        console.error('Gagal kirim notifikasi saran:', notifErr);
      }

      // Refresh
      fetchMine();
      if (isManager) fetchAll();

      // Pindah ke tab riwayat
      setActiveTab('riwayat');
    } catch (err: any) {
      console.error('Gagal submit saran:', err);
      showToast('error', 'Gagal mengirim: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // SUBMIT — TANGGAPAN (PENGELOLA)
  // =========================================================================
  const handleSubmitTanggapan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!detailItem) return;
    if (!user?.id) return;

    if (!tanggapanForm.tanggapan.trim()) {
      showToast('error', 'Tanggapan tidak boleh kosong');
      return;
    }

    setSubmittingTanggapan(true);
    try {
      const payload = {
        status: tanggapanForm.status,
        tanggapan: tanggapanForm.tanggapan.trim(),
        penanggap_id: user.id,
        ditanggapi_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('saran_pengaduan')
        .update(payload)
        .eq('id', detailItem.id);

      if (error) throw error;

      showToast('success', 'Tanggapan berhasil dikirim');

      // Audit log
      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARAN_PENGADUAN,
        targetId: detailItem.id,
        deskripsi: `Tanggapi saran: [${detailItem.kategori}] ${detailItem.subjek} — Status: ${tanggapanForm.status}`,
        metadata: {
          status_lama: detailItem.status,
          status_baru: tanggapanForm.status,
        },
      });

      // Notifikasi ke pelapor (kalau bukan anonim)
      if (detailItem.pelapor_id && detailItem.pelapor_id !== user.id) {
        try {
          await sendNotification({
            guruIds: detailItem.pelapor_id,
            judul: `💬 Tanggapan untuk Saran Anda`,
            pesan: `[${detailItem.kategori}] "${detailItem.subjek}" — Status: ${tanggapanForm.status}`,
            tipe: 'saran_pengaduan',
            tautan: '/saran_pengaduan',
          });
        } catch (notifErr) {
          console.error('Gagal notif ke pelapor:', notifErr);
        }
      }

      // Refresh data
      setDetailItem(null);
      setTanggapanForm({ status: 'Baru', tanggapan: '' });
      fetchMine();
      fetchAll();
    } catch (err: any) {
      console.error('Gagal submit tanggapan:', err);
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setSubmittingTanggapan(false);
    }
  };

  // =========================================================================
  // OPEN DETAIL
  // =========================================================================
  const openDetail = (item: SaranPengaduanWithRelations) => {
    setDetailItem(item);
    setTanggapanForm({
      status: item.status,
      tanggapan: item.tanggapan || '',
    });
  };

  // =========================================================================
  // DERIVED — KPI untuk pengelola
  // =========================================================================
  const managerStats = useMemo(() => {
    if (!isManager) return null;
    const baru = allList.filter((i) => i.status === 'Baru').length;
    const diproses = allList.filter((i) => i.status === 'Diproses').length;
    const selesai = allList.filter((i) => i.status === 'Selesai').length;
    const ditolak = allList.filter((i) => i.status === 'Ditolak').length;
    return { baru, diproses, selesai, ditolak };
  }, [allList, isManager]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <MessageSquareWarning size={26} />
            </div>
            Saran & Pengaduan
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Kanal resmi untuk menyampaikan saran, kritik, dan pengaduan kepada manajemen sekolah
          </p>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex flex-col md:flex-row gap-1 md:gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('kirim')}
          className={`whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'kirim'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Plus size={15} /> Buat Saran Baru
        </button>
        <button
          onClick={() => setActiveTab('riwayat')}
          className={`whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'riwayat'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <History size={15} /> Riwayat Saya ({myList.length})
        </button>
        {isManager && (
          <button
            onClick={() => setActiveTab('kelola')}
            className={`whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'kelola'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-400/80 hover:text-amber-300 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert size={15} /> Kelola
            {managerStats && managerStats.baru > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">
                {managerStats.baru}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ================================================================== */}
      {/* TAB 1 — KIRIM SARAN BARU */}
      {/* ================================================================== */}
      {activeTab === 'kirim' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
          <div className="mb-5 pb-4 border-b border-slate-800">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-400" />
              Formulir Saran / Pengaduan
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Isi dengan jelas agar dapat ditindaklanjuti dengan tepat
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Kategori & Prioritas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Kategori *
                </label>
                <select
                  value={form.kategori}
                  onChange={(e) => setForm({ ...form, kategori: e.target.value as SaranPengaduanKategori })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer"
                  required
                >
                  {KATEGORI_SARAN_PENGADUAN.map((k) => (
                    <option key={k} value={k} className="bg-slate-900">
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Prioritas *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIORITAS_SARAN_PENGADUAN.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, prioritas: p })}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        form.prioritas === p
                          ? p === 'Tinggi'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : p === 'Sedang'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subjek */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Subjek Ringkas *
              </label>
              <input
                type="text"
                value={form.subjek}
                onChange={(e) => setForm({ ...form, subjek: e.target.value })}
                maxLength={200}
                placeholder="Contoh: AC Ruang Guru Mati Sejak Minggu Lalu"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1 text-right">
                {form.subjek.length}/200
              </p>
            </div>

            {/* Isi */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Uraian Lengkap *
              </label>
              <textarea
                value={form.isi}
                onChange={(e) => setForm({ ...form, isi: e.target.value })}
                rows={7}
                placeholder="Jelaskan detail saran/pengaduan Anda: apa masalahnya, di mana, kapan, dan dampaknya jika memungkinkan..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-y leading-relaxed"
                required
              />
            </div>

            {/* Toggle Anonim */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_anonim}
                  onChange={(e) => setForm({ ...form, is_anonim: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    {form.is_anonim ? (
                      <>
                        <EyeOff size={14} className="text-amber-400" />
                        Kirim sebagai Anonim
                      </>
                    ) : (
                      <>
                        <Eye size={14} className="text-indigo-400" />
                        Kirim dengan Identitas
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {form.is_anonim
                      ? 'Nama Anda tidak akan tercatat. Cocok untuk pengaduan yang sensitif.'
                      : 'Nama Anda akan tercatat agar pengelola bisa menghubungi Anda terkait tindak lanjut.'}
                  </p>
                </div>
              </label>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Kirim Saran/Pengaduan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2 — RIWAYAT SAYA */}
      {/* ================================================================== */}
      {activeTab === 'riwayat' && (
        <div className="space-y-4">
          {loadingMine ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin text-indigo-400" size={28} />
            </div>
          ) : myList.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl text-center py-16 px-6">
              <Inbox size={44} className="mx-auto mb-3 text-slate-600" />
              <p className="font-bold text-slate-200 text-sm">Belum ada saran/pengaduan</p>
              <p className="text-xs text-slate-500 mt-1">
                Saran yang Anda kirim akan tampil di sini
              </p>
              <button
                onClick={() => setActiveTab('kirim')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus size={14} /> Buat Saran Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myList.map((item) => {
                const StatusIcon = getStatusIcon(item.status);
                return (
                  <button
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className="w-full text-left bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 md:p-5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getKategoriBadge(
                            item.kategori
                          )}`}
                        >
                          {item.kategori}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPrioritasBadge(
                            item.prioritas
                          )}`}
                        >
                          {item.prioritas}
                        </span>
                        {item.is_anonim && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 inline-flex items-center gap-1">
                            <EyeOff size={10} /> Anonim
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${getStatusBadge(
                          item.status
                        )}`}
                      >
                        <StatusIcon size={10} />
                        {item.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-100 text-sm md:text-base group-hover:text-indigo-300 transition-colors">
                      {item.subjek}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.isi}
                    </p>

                    {item.tanggapan && (
                      <div className="mt-3 pt-3 border-t border-slate-800/60">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1">
                          <MessageSquare size={10} />
                          Tanggapan dari {item.penanggap?.nama_lengkap || 'Pengelola'}
                        </p>
                        <p className="text-xs text-slate-300 line-clamp-2 italic">
                          "{item.tanggapan}"
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock size={10} />
                        {formatDateTimeWib(item.created_at)}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1">
                        Lihat Detail <ChevronRight size={10} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 3 — KELOLA (PENGELOLA) */}
      {/* ================================================================== */}
      {activeTab === 'kelola' && isManager && (
        <div className="space-y-4">
          {/* KPI Stats */}
          {managerStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle size={14} className="text-indigo-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Baru
                  </span>
                </div>
                <p className="text-2xl font-black text-indigo-400">{managerStats.baru}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-amber-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Diproses
                  </span>
                </div>
                <p className="text-2xl font-black text-amber-400">
                  {managerStats.diproses}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Selesai
                  </span>
                </div>
                <p className="text-2xl font-black text-emerald-400">
                  {managerStats.selesai}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle size={14} className="text-rose-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Ditolak
                  </span>
                </div>
                <p className="text-2xl font-black text-rose-400">{managerStats.ditolak}</p>
              </div>
            </div>
          )}

          {/* Filter Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center gap-3">
            <div className="relative w-full md:w-80">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder="Cari subjek / isi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter size={14} className="text-slate-500 shrink-0" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-indigo-500"
              >
                <option value="">Semua Status</option>
                {STATUS_SARAN_PENGADUAN.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-indigo-500"
              >
                <option value="">Semua Kategori</option>
                {KATEGORI_SARAN_PENGADUAN.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>

              <button
                onClick={fetchAll}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors cursor-pointer shrink-0"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          {loadingAll ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin text-indigo-400" size={28} />
            </div>
          ) : allList.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl text-center py-16 px-6">
              <Inbox size={44} className="mx-auto mb-3 text-slate-600" />
              <p className="font-bold text-slate-200 text-sm">Tidak ada data</p>
              <p className="text-xs text-slate-500 mt-1">
                Sesuaikan filter atau tunggu saran baru masuk
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allList.map((item) => {
                const StatusIcon = getStatusIcon(item.status);
                return (
                  <button
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className="w-full text-left bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 md:p-5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getKategoriBadge(
                            item.kategori
                          )}`}
                        >
                          {item.kategori}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPrioritasBadge(
                            item.prioritas
                          )}`}
                        >
                          {item.prioritas}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${getStatusBadge(
                          item.status
                        )}`}
                      >
                        <StatusIcon size={10} />
                        {item.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-100 text-sm md:text-base group-hover:text-indigo-300 transition-colors">
                      {item.subjek}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.isi}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 flex-wrap gap-2">
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          {item.is_anonim ? (
                            <>
                              <EyeOff size={10} className="text-amber-400" />
                              Anonim
                            </>
                          ) : (
                            <>
                              <UserCheck size={10} className="text-indigo-400" />
                              {item.pelapor?.nama_lengkap || '-'}
                            </>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatDateTimeWib(item.created_at)}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1">
                        Buka <ChevronRight size={10} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL DETAIL */}
      {/* ================================================================== */}
      <Modal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="Detail Saran/Pengaduan"
        size="lg"
      >
        {detailItem && (
          <div className="space-y-5 pt-1">
            {/* Info utama */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${getKategoriBadge(
                    detailItem.kategori
                  )}`}
                >
                  {detailItem.kategori}
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${getPrioritasBadge(
                    detailItem.prioritas
                  )}`}
                >
                  Prioritas: {detailItem.prioritas}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${getStatusBadge(
                    detailItem.status
                  )}`}
                >
                  Status: {detailItem.status}
                </span>
              </div>

              <h2 className="font-bold text-slate-100 text-base md:text-lg">
                {detailItem.subjek}
              </h2>

              <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  {detailItem.is_anonim ? (
                    <>
                      <EyeOff size={11} className="text-amber-400" />
                      Anonim
                    </>
                  ) : (
                    <>
                      <UserCheck size={11} className="text-indigo-400" />
                      {detailItem.pelapor?.nama_lengkap || 'Pengguna'}
                    </>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {formatDateTimeWib(detailItem.created_at)}
                </span>
              </div>
            </div>

            {/* Isi lengkap */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Uraian
              </p>
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {detailItem.isi}
              </div>
            </div>

            {/* Tanggapan existing */}
            {detailItem.tanggapan && detailItem.status !== 'Baru' && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                  <MessageSquare size={12} />
                  Tanggapan dari {detailItem.penanggap?.nama_lengkap || 'Pengelola'}
                </p>
                <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {detailItem.tanggapan}
                  <p className="text-[10px] text-emerald-400/70 mt-3 pt-3 border-t border-emerald-500/10">
                    Ditanggapi pada {formatDateTimeWib(detailItem.ditanggapi_at)}
                  </p>
                </div>
              </div>
            )}

            {/* Form tanggapan (khusus pengelola) */}
            {isManager && (
              <form
                onSubmit={handleSubmitTanggapan}
                className="border-t border-slate-800 pt-5 space-y-4"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  <ShieldAlert size={12} />
                  Panel Pengelola
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Update Status
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {STATUS_SARAN_PENGADUAN.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTanggapanForm({ ...tanggapanForm, status: s })}
                        className={`py-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          tanggapanForm.status === s
                            ? getStatusBadge(s)
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Tanggapan *
                  </label>
                  <textarea
                    value={tanggapanForm.tanggapan}
                    onChange={(e) =>
                      setTanggapanForm({ ...tanggapanForm, tanggapan: e.target.value })
                    }
                    rows={4}
                    placeholder="Tuliskan tanggapan atau tindak lanjut atas saran/pengaduan ini..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-y"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingTanggapan}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {submittingTanggapan ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Simpan Tanggapan
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Info non-manager */}
            {!isManager && detailItem.status === 'Baru' && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
                <Clock size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-200">
                    Menunggu tindak lanjut pengelola
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Saran/pengaduan Anda sudah diterima. Pengelola akan segera menindaklanjuti.
                    Anda akan mendapat notifikasi saat ada tanggapan.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}