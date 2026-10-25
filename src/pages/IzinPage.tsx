// src/pages/IzinPage.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FileText, Loader2, Plus, Save, Trash2, Clock, CheckCircle2,
  Calendar, UserCheck, BookOpen, Edit3, Link as LinkIcon,
  ExternalLink, MessageCircle, CalendarDays, Users, Info,
  AlertTriangle, UserPlus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  getTodayDateWib,
  formatDateWibShort,
  getHariFromDateString,
} from '@/utils/date';
import {
  sendNotification,
  getGuruIdsByRole,
  getGuruIdsPiketHari,
} from '@/lib/notifications/notification';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  buildDelegasiTugasMessage,
  buildAsistensiMessage,
  openWhatsAppGroup,
  copyWhatsAppMessage,
} from '@/lib/notifications/whatsapp';
import type {
  Kelas, IzinGuruPiketWithRelations, MataPelajaran,
  KategoriIzin, JenisDelegasi, JadwalKbm, JadwalKbmWithRelations,
} from '@/types/database';

const ROLE_KEPALA_KEPEGAWAIAN = ['admin', 'kepala', 'takola'];

// =============================================================================
// TYPES
// =============================================================================
type FormMode = 'full_day' | 'per_sesi';

type FormState = {
  tanggal_izin: string;
  kategori_izin: KategoriIzin;
  keterangan_izin: string;
  mode: FormMode;
  jadwal_kbm_id: number | null;
  use_delegasi: boolean;
  jenis_delegasi: 'asistensi' | 'tugas';
  nama_asisten: string;
  titipan_tugas: string;
  url_file: string;
};

const EMPTY_FORM: FormState = {
  tanggal_izin: getTodayDateWib(),
  kategori_izin: 'Sakit',
  keterangan_izin: '',
  mode: 'full_day',
  jadwal_kbm_id: null,
  use_delegasi: false,
  jenis_delegasi: 'tugas',
  nama_asisten: '',
  titipan_tugas: '',
  url_file: '',
};

/** Group jadwal by slot (waktu_mulai + waktu_selesai) untuk deteksi kelas gabungan */
type JadwalSlot = {
  key: string;
  waktu_mulai: string;
  waktu_selesai: string;
  jadwal_list: JadwalKbmWithRelations[];
  mapel_nama: string;
  kelas_label: string;
};

function groupJadwalBySlot(jadwalList: JadwalKbmWithRelations[]): JadwalSlot[] {
  const map = new Map<string, JadwalKbmWithRelations[]>();
  for (const j of jadwalList) {
    const key = `${j.waktu_mulai}|${j.waktu_selesai}`;
    const arr = map.get(key) ?? [];
    arr.push(j);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([key, list]) => {
    const first = list[0];
    const kelasLabel = list.map((j) => j.kelas?.nama_kelas ?? '-').join(', ');
    return {
      key,
      waktu_mulai: first.waktu_mulai ?? '',
      waktu_selesai: first.waktu_selesai ?? '',
      jadwal_list: list,
      mapel_nama: first.mata_pelajarans?.nama_mapel ?? '-',
      kelas_label: list.length > 1 ? `${kelasLabel} (${list.length} kelas gabungan)` : kelasLabel,
    };
  }).sort((a, b) => a.waktu_mulai.localeCompare(b.waktu_mulai));
}

// =============================================================================
// COMPONENT
// =============================================================================
export function IzinPage() {
  const { guru } = useAuth();
  const [izinList, setIzinList] = useState<IzinGuruPiketWithRelations[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalKbmWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJadwal, setLoadingJadwal] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] =
    useState<IzinGuruPiketWithRelations | null>(null);

  const userRole = (guru as any)?.role?.toLowerCase() || '';
  const canViewOtherIzin = ['admin', 'kepala', 'takola'].includes(userRole);

  // ===========================================================================
  // FETCH UTAMA
  // ===========================================================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [izinRes, kelasRes, mapelRes] = await Promise.all([
        supabase
          .from('izin_guru_pikets')
          .select(`
            *,
            gurus:guru_izin_id (id, nama_lengkap),
            kelas (id, nama_kelas),
            guru_piket:guru_piket_id (id, nama_lengkap),
            mata_pelajarans:mapel_id (id, nama_mapel),
            jadwal_kbm:jadwal_kbm_id (id, hari, waktu_mulai, waktu_selesai)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('kelas').select('*').order('nama_kelas'),
        supabase.from('mata_pelajarans').select('*').order('nama_mapel'),
      ]);

      setIzinList((izinRes.data as IzinGuruPiketWithRelations[]) ?? []);
      setKelasList((kelasRes.data as Kelas[]) ?? []);
      setMapelList((mapelRes.data as MataPelajaran[]) ?? []);
    } catch (err) {
      console.error('Error fetching:', err);
      showToast('error', 'Gagal memuat data pengajuan izin');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ===========================================================================
  // FETCH JADWAL — saat tanggal berubah
  // ===========================================================================
  const fetchJadwal = useCallback(async (tanggal: string) => {
    if (!guru?.id || !tanggal) {
      setJadwalList([]);
      return;
    }
    setLoadingJadwal(true);
    try {
      const hari = getHariFromDateString(tanggal);
      const { data, error } = await supabase
        .from('jadwal_kbms')
        .select(`
          *,
          kelas:kelas_id (id, nama_kelas),
          mata_pelajarans:mapel_id (id, nama_mapel)
        `)
        .eq('guru_id', guru.id)
        .eq('hari', hari)
        .order('waktu_mulai');

      if (error) throw error;
      setJadwalList((data as JadwalKbmWithRelations[]) ?? []);
    } catch (err) {
      console.error('Error fetching jadwal:', err);
      setJadwalList([]);
    } finally {
      setLoadingJadwal(false);
    }
  }, [guru?.id]);

  useEffect(() => {
    if (modalOpen) fetchJadwal(form.tanggal_izin);
  }, [modalOpen, form.tanggal_izin, fetchJadwal]);

  // Reset jadwal_kbm_id saat tanggal berubah (agar tidak menyimpan ID lama)
  useEffect(() => {
    setForm((f) => ({ ...f, jadwal_kbm_id: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tanggal_izin]);

  const slots = useMemo(() => groupJadwalBySlot(jadwalList), [jadwalList]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================
  const openModalForCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, tanggal_izin: getTodayDateWib() });
    setModalOpen(true);
  };

  const openModalForEdit = (izin: IzinGuruPiketWithRelations) => {
    const penanganan = (izin.status_penanganan || '').toLowerCase();
    const penyampaian = (izin.status_penyampaian || '').toLowerCase();
    const isSelesai =
      penanganan === 'selesai' ||
      penanganan === 'ditangani' ||
      penyampaian === 'sudah disampaikan';

    if (isSelesai) {
      showToast('error', 'Izin yang sudah disampaikan tidak dapat diubah');
      return;
    }

    setEditingId(izin.id);
    setForm({
      tanggal_izin: izin.tanggal_izin,
      kategori_izin: izin.kategori_izin,
      keterangan_izin: izin.keterangan_izin ?? '',
      mode: izin.is_full_day ? 'full_day' : 'per_sesi',
      jadwal_kbm_id: izin.jadwal_kbm_id,
      use_delegasi: izin.jenis_delegasi !== 'none',
      jenis_delegasi: izin.jenis_delegasi === 'asistensi' ? 'asistensi' : 'tugas',
      nama_asisten: izin.nama_asisten ?? '',
      titipan_tugas: izin.titipan_tugas ?? '',
      url_file: izin.url_file ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guru) return;

    // Validasi
    if (!form.keterangan_izin.trim()) {
      showToast('error', 'Keterangan wajib diisi');
      return;
    }
    if (form.mode === 'per_sesi' && !form.jadwal_kbm_id) {
      showToast('error', 'Pilih jadwal yang akan ditinggalkan');
      return;
    }
    if (form.use_delegasi && form.jenis_delegasi === 'asistensi' && !form.nama_asisten.trim()) {
      showToast('error', 'Nama asisten wajib diisi untuk delegasi asistensi');
      return;
    }
    if (form.use_delegasi && form.jenis_delegasi === 'tugas' && !form.titipan_tugas.trim()) {
      showToast('error', 'Instruksi tugas wajib diisi');
      return;
    }

    // Resolve kelas_id & mapel_id dari jadwal terpilih (untuk kompat display)
    let resolvedKelasId: number | null = null;
    let resolvedMapelId: number | null = null;
    if (form.mode === 'per_sesi' && form.jadwal_kbm_id) {
      const j = jadwalList.find((x) => x.id === form.jadwal_kbm_id);
      resolvedKelasId = j?.kelas_id ?? null;
      resolvedMapelId = j?.mapel_id ?? null;
    }

    const payload = {
      guru_izin_id: guru.id,
      tanggal_izin: form.tanggal_izin,
      kategori_izin: form.kategori_izin,
      keterangan_izin: form.keterangan_izin.trim(),
      jenis_delegasi: (form.use_delegasi
        ? form.jenis_delegasi
        : 'none') as JenisDelegasi,
      nama_asisten:
        form.use_delegasi && form.jenis_delegasi === 'asistensi'
          ? form.nama_asisten.trim()
          : null,
      titipan_tugas:
        form.use_delegasi && form.jenis_delegasi === 'tugas'
          ? form.titipan_tugas.trim()
          : null,
      url_file:
        form.use_delegasi && form.jenis_delegasi === 'tugas'
          ? form.url_file.trim() || null
          : null,
      is_full_day: form.mode === 'full_day',
      jadwal_kbm_id: form.mode === 'per_sesi' ? form.jadwal_kbm_id : null,
      kelas_id: resolvedKelasId,
      mapel_id: resolvedMapelId,
    };

    setSaving(true);
    try {
      let error;
      if (editingId) {
        const res = await supabase
          .from('izin_guru_pikets')
          .update(payload)
          .eq('id', editingId);
        error = res.error;
      } else {
        const res = await supabase
          .from('izin_guru_pikets')
          .insert({ ...payload, status_penanganan: 'Menunggu' });
        error = res.error;
      }

      if (error) throw error;

      showToast(
  'success',
  successMsg(
    `Izin ${editingId ? 'diperbarui' : 'diajukan'}`,
    'ibadah'
  )
);

      await logActivity({
        aksi: editingId ? 'UPDATE' : 'CREATE',
        modul: AUDIT_MODUL.IZIN,
        targetId: editingId ?? undefined,
        deskripsi: `${editingId ? 'Update' : 'Ajukan'} izin ${form.kategori_izin} tgl ${form.tanggal_izin}${form.use_delegasi ? ` (${form.jenis_delegasi})` : ''}`,
      });

      // Notifikasi hanya saat CREATE
      if (!editingId) {
        try {
          const hariIzin = getHariFromDateString(form.tanggal_izin);
          const guruPiketIds = await getGuruIdsPiketHari(hariIzin);
          const kepalaArrays = await Promise.all(
            ROLE_KEPALA_KEPEGAWAIAN.map((r) => getGuruIdsByRole(r))
          );
          const kepalaIds = kepalaArrays.flat();
          const penerimaIds = Array.from(
            new Set([...guruPiketIds, ...kepalaIds])
          ).filter((id) => id !== guru.id);

          if (penerimaIds.length > 0) {
            await sendNotification({
              guruIds: penerimaIds,
              judul: '📝 Pengajuan Izin Baru',
              pesan: `${guru.nama_lengkap} mengajukan ${form.kategori_izin} untuk ${formatDateWibShort(form.tanggal_izin)}${form.use_delegasi ? ` (${form.jenis_delegasi})` : ''}.`,
              tipe: 'izin_guru',
              tautan: '/izin',
            });
          }
        } catch (notifErr) {
          console.error('Notif error:', notifErr);
        }
      }

      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err?.message ?? 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ===========================================================================
  // WHATSAPP HANDLERS
  // ===========================================================================
  const handleKirimWA = (izin: IzinGuruPiketWithRelations) => {
    const kelasNama = izin.kelas?.nama_kelas ?? '-';
    const mapelNama = izin.mata_pelajarans?.nama_mapel ?? '-';

    const message =
      izin.jenis_delegasi === 'asistensi'
        ? buildAsistensiMessage({
            guru_izin_nama: izin.gurus?.nama_lengkap ?? '-',
            tanggal_izin: formatDateWibShort(izin.tanggal_izin),
            kategori_izin: izin.kategori_izin,
            keterangan_izin: izin.keterangan_izin,
            kelas_nama: kelasNama,
            mapel_nama: mapelNama,
            nama_asisten: izin.nama_asisten ?? '-',
            waktu: izin.jadwal_kbm?.waktu_mulai
              ? `${izin.jadwal_kbm.waktu_mulai.slice(0, 5)}-${izin.jadwal_kbm.waktu_selesai?.slice(0, 5) ?? ''}`
              : null,
          })
        : buildDelegasiTugasMessage({
            guru_izin_nama: izin.gurus?.nama_lengkap ?? '-',
            guru_piket_nama: 'Guru Piket',
            tanggal_izin: formatDateWibShort(izin.tanggal_izin),
            kategori_izin: izin.kategori_izin,
            keterangan_izin: izin.keterangan_izin,
            kelas_nama: kelasNama,
            mapel_nama: mapelNama,
            titipan_tugas: izin.titipan_tugas ?? '-',
            url_file: izin.url_file,
          });

    openWhatsAppGroup(message);
    showToast('success', 'WhatsApp terbuka — pilih guru piket lalu kirim');
  };

  const handleCopyWA = async (izin: IzinGuruPiketWithRelations) => {
    const kelasNama = izin.kelas?.nama_kelas ?? '-';
    const mapelNama = izin.mata_pelajarans?.nama_mapel ?? '-';
    const message =
      izin.jenis_delegasi === 'asistensi'
        ? buildAsistensiMessage({
            guru_izin_nama: izin.gurus?.nama_lengkap ?? '-',
            tanggal_izin: formatDateWibShort(izin.tanggal_izin),
            kategori_izin: izin.kategori_izin,
            keterangan_izin: izin.keterangan_izin,
            kelas_nama: kelasNama,
            mapel_nama: mapelNama,
            nama_asisten: izin.nama_asisten ?? '-',
            waktu: izin.jadwal_kbm?.waktu_mulai
              ? `${izin.jadwal_kbm.waktu_mulai.slice(0, 5)}-${izin.jadwal_kbm.waktu_selesai?.slice(0, 5) ?? ''}`
              : null,
          })
        : buildDelegasiTugasMessage({
            guru_izin_nama: izin.gurus?.nama_lengkap ?? '-',
            guru_piket_nama: 'Guru Piket',
            tanggal_izin: formatDateWibShort(izin.tanggal_izin),
            kategori_izin: izin.kategori_izin,
            keterangan_izin: izin.keterangan_izin,
            kelas_nama: kelasNama,
            mapel_nama: mapelNama,
            titipan_tugas: izin.titipan_tugas ?? '-',
            url_file: izin.url_file,
          });

    const ok = await copyWhatsAppMessage(message);
    if (ok) showToast('success', 'Pesan disalin');
    else showToast('error', 'Gagal menyalin');
  };

  // ===========================================================================
  // DELETE
  // ===========================================================================
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const penyampaian = (deleteTarget.status_penyampaian || '').toLowerCase();
    const penanganan = (deleteTarget.status_penanganan || '').toLowerCase();
    if (
      penanganan === 'selesai' ||
      penanganan === 'ditangani' ||
      penyampaian === 'sudah disampaikan'
    ) {
      showToast('error', 'Izin yang sudah disampaikan tidak dapat dihapus');
      setDeleteTarget(null);
      return;
    }

    const { error } = await supabase
      .from('izin_guru_pikets')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.IZIN,
        targetId: deleteTarget.id,
        deskripsi: `Hapus izin ${deleteTarget.kategori_izin} tgl ${deleteTarget.tanggal_izin}`,
      });
      showToast('success', 'Izin dihapus');
      setDeleteTarget(null);
      fetchData();
    }
  };

  // ===========================================================================
  // LIST DERIVED
  // ===========================================================================
  const safeList = izinList || [];
  const myIzin = safeList.filter((i) => i?.guru_izin_id === guru?.id);
  const otherIzin = safeList.filter((i) => i?.guru_izin_id !== guru?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="animate-spin text-indigo-400" size={36} />
      </div>
    );
  }

  // ===========================================================================
  // RENDER KARTU IZIN
  // ===========================================================================
  const renderIzinCard = (izin: IzinGuruPiketWithRelations, isMine: boolean) => {
    const penanganan = (izin.status_penanganan || '').toLowerCase();
    const penyampaian = (izin.status_penyampaian || '').toLowerCase();
    const isSelesai =
      penanganan === 'selesai' || penanganan === 'ditangani' ||
      penyampaian === 'sudah disampaikan';
    const statusLabel = isSelesai ? (izin.status_penyampaian || 'Selesai') : 'Menunggu';

    const delegasiLabel =
      izin.jenis_delegasi === 'asistensi'
        ? 'Asistensi'
        : izin.jenis_delegasi === 'tugas'
        ? 'Tugas'
        : null;

    return (
      <div
        key={izin.id}
        className="bg-slate-900 rounded-3xl border border-slate-800/80 p-5 md:p-6 transition-all backdrop-blur-xl hover:border-slate-700 shadow-xl group relative"
      >
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                isSelesai
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}
            >
              {isSelesai ? <CheckCircle2 size={24} /> : <Clock size={24} />}
            </div>
            <div>
              <p className="font-bold text-slate-100 text-base">
                {izin.gurus?.nama_lengkap ?? 'Guru'}
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Calendar size={12} className="text-slate-500" />
                {formatDateWibShort(izin.tanggal_izin)}
                {izin.jadwal_kbm?.waktu_mulai && (
                  <span className="text-indigo-400 ml-1">
                    · {izin.jadwal_kbm.waktu_mulai.slice(0, 5)}-{izin.jadwal_kbm.waktu_selesai?.slice(0, 5)}
                  </span>
                )}
                {izin.is_full_day && (
                  <span className="ml-1 text-cyan-400">· Full Day</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              izin.kategori_izin === 'Sakit'
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                : izin.kategori_izin === 'Dinas'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-purple-500/15 border-purple-500/30 text-purple-400'
            }`}>
              {izin.kategori_izin}
            </span>
            {delegasiLabel && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                izin.jenis_delegasi === 'asistensi'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
              }`}>
                {delegasiLabel}
              </span>
            )}
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isSelesai
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}>
              {statusLabel}
            </span>
            {isMine && !isSelesai && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {izin.jenis_delegasi !== 'none' && (
                  <>
                    <button
                      onClick={() => handleKirimWA(izin)}
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                      title="Kirim via WA"
                    >
                      <MessageCircle size={16} />
                    </button>
                    <button
                      onClick={() => handleCopyWA(izin)}
                      className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 cursor-pointer"
                      title="Salin pesan WA"
                    >
                      <FileText size={16} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => openModalForEdit(izin)}
                  className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 cursor-pointer"
                  title="Edit"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => setDeleteTarget(izin)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                  title="Hapus"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
            <div>
              <span className="text-xs font-bold uppercase text-slate-400">Keterangan: </span>
              <span className="text-slate-200">{izin.keterangan_izin ?? '-'}</span>
            </div>
            {(izin.kelas || izin.mata_pelajarans) && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold uppercase text-slate-400">Kelas & Mapel:</span>
                <span className="text-indigo-400 font-semibold flex items-center gap-1.5">
                  <BookOpen size={13} />
                  {izin.kelas?.nama_kelas ?? '-'} • {izin.mata_pelajarans?.nama_mapel ?? '-'}
                </span>
              </div>
            )}
          </div>

          {izin.jenis_delegasi === 'tugas' && izin.titipan_tugas && (
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 mb-1.5">
                Delegasi Tugas:
              </p>
              <p className="text-slate-300 text-xs md:text-sm whitespace-pre-wrap bg-slate-950 border border-slate-800/80 rounded-2xl p-4 leading-relaxed">
                {izin.titipan_tugas}
              </p>
            </div>
          )}

          {izin.jenis_delegasi === 'asistensi' && izin.nama_asisten && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5">
              <UserPlus size={16} className="text-amber-400" />
              <div>
                <p className="text-[10px] font-bold uppercase text-amber-400">Asisten</p>
                <p className="text-sm text-slate-200 font-semibold">{izin.nama_asisten}</p>
              </div>
            </div>
          )}

          {izin.url_file && (
            <a
              href={izin.url_file}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
            >
              <LinkIcon size={14} /> Buka Link File
              <ExternalLink size={12} className="opacity-70" />
            </a>
          )}

          {isSelesai && izin.guru_piket && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <UserCheck size={14} />
              <span>Ditangani oleh: {izin.guru_piket.nama_lengkap}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <FileText className="text-indigo-400" size={28} />
            Izin & Delegasi Tugas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Ajukan izin (full day atau per sesi) & delegasikan tugas ke guru piket
          </p>
        </div>
        <button
          onClick={openModalForCreate}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition cursor-pointer"
        >
          <Plus size={18} /> Ajukan Izin Baru
        </button>
      </div>

      {/* IZIN SAYA */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Clock size={20} className="text-indigo-400" /> Pengajuan Izin Saya
        </h2>
        {myIzin.length === 0 ? (
          <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 text-center py-16 px-6">
            <FileText size={32} className="mx-auto mb-3 text-slate-500" />
            <p className="text-slate-400">Belum ada pengajuan izin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {myIzin.map((i) => renderIzinCard(i, true))}
          </div>
        )}
      </div>

      {/* IZIN GURU LAIN */}
      {canViewOtherIzin && otherIzin.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <UserCheck size={20} className="text-indigo-400" /> Izin Guru Lain
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {otherIzin.map((i) => renderIzinCard(i, false))}
          </div>
        </div>
      )}

      {/* MODAL FORM */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Izin & Delegasi' : 'Ajukan Izin & Delegasi'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-5">
          {/* Tanggal + Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                Tanggal Izin
              </label>
              <input
                type="date"
                value={form.tanggal_izin}
                onChange={(e) => setForm({ ...form, tanggal_izin: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                Kategori Izin
              </label>
              <select
                value={form.kategori_izin}
                onChange={(e) =>
                  setForm({ ...form, kategori_izin: e.target.value as KategoriIzin })
                }
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm cursor-pointer"
                required
              >
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin</option>
                <option value="Dinas">Dinas (Tugas Sekolah)</option>
              </select>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
              Cakupan Izin
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setForm({ ...form, mode: 'full_day', jadwal_kbm_id: null })}
                className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  form.mode === 'full_day'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Full Hari
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, mode: 'per_sesi' })}
                className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  form.mode === 'per_sesi'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Per Sesi
              </button>
            </div>
          </div>

          {/* Jadwal Panel */}
          {loadingJadwal ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin text-indigo-400" size={20} />
            </div>
          ) : slots.length === 0 ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                Tidak ada jadwal mengajar pada tanggal ini. Izin akan dicatat tanpa
                mempengaruhi sesi manapun.
              </span>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                Jadwal Anda pada {formatDateWibShort(form.tanggal_izin)}
                {form.mode === 'full_day' && ' (semua terdampak)'}
              </label>
              <div className="space-y-1.5">
                {slots.map((slot) => {
                  const selected =
                    form.mode === 'per_sesi' &&
                    form.jadwal_kbm_id === slot.jadwal_list[0].id;
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      disabled={form.mode === 'full_day'}
                      onClick={() =>
                        setForm({ ...form, jadwal_kbm_id: slot.jadwal_list[0].id })
                      }
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition flex items-center gap-3 ${
                        form.mode === 'full_day'
                          ? 'bg-slate-900/50 border-slate-800 cursor-default'
                          : selected
                          ? 'bg-emerald-500/10 border-emerald-500/50 cursor-pointer'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 cursor-pointer'
                      }`}
                    >
                      <Clock size={14} className={selected ? 'text-emerald-400' : 'text-slate-500'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-200">
                          {slot.waktu_mulai.slice(0, 5)} - {slot.waktu_selesai.slice(0, 5)}
                          <span className="text-slate-500 font-normal ml-2">
                            · {slot.mapel_nama}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {slot.kelas_label}
                        </p>
                      </div>
                      {selected && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
              Keterangan Izin <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.keterangan_izin}
              onChange={(e) => setForm({ ...form, keterangan_izin: e.target.value })}
              placeholder="Contoh: Sakit demam tinggi / Dinas ke Dinas Pendidikan"
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
              required
            />
          </div>

          {/* Delegasi Checkbox */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.use_delegasi}
                onChange={(e) => setForm({ ...form, use_delegasi: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-200">
                Saya ingin mendelegasikan tugas
              </span>
            </label>

            {form.use_delegasi && (
              <div className="mt-4 space-y-3 pl-6">
                {/* Radio Asistensi / Tugas */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, jenis_delegasi: 'asistensi' })}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      form.jenis_delegasi === 'asistensi'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <UserPlus size={12} className="inline mr-1" /> Asistensi
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, jenis_delegasi: 'tugas' })}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      form.jenis_delegasi === 'tugas'
                        ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FileText size={12} className="inline mr-1" /> Tugas
                  </button>
                </div>

                {/* Field Asistensi */}
                {form.jenis_delegasi === 'asistensi' && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                      Nama Asisten <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.nama_asisten}
                      onChange={(e) => setForm({ ...form, nama_asisten: e.target.value })}
                      placeholder="Nama guru yang akan mendampingi kelas"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-xs"
                    />
                  </div>
                )}

                {/* Field Tugas */}
                {form.jenis_delegasi === 'tugas' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                        Instruksi / Delegasi Tugas <span className="text-rose-400">*</span>
                      </label>
                      <textarea
                        value={form.titipan_tugas}
                        onChange={(e) => setForm({ ...form, titipan_tugas: e.target.value })}
                        rows={3}
                        placeholder="Instruksi untuk siswa / guru piket..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 text-xs resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                        Link File Tugas (Opsional)
                      </label>
                      <div className="relative">
                        <input
                          type="url"
                          value={form.url_file}
                          onChange={(e) => setForm({ ...form, url_file: e.target.value })}
                          placeholder="https://drive.google.com/..."
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 text-xs"
                        />
                        <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold text-xs cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingId ? 'Simpan Perubahan' : 'Ajukan Izin'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Pengajuan Izin"
        message="Apakah Anda yakin ingin menghapus pengajuan izin ini?"
      />
    </div>
  );
}