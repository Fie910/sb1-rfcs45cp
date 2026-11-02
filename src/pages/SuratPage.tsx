// src/pages/SuratPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Trash2, Edit3, UserCheck, X, Calendar, FileText,
  Printer, MessageSquare, RotateCcw, Image as ImageIcon,
  Send, Truck, Clock, CheckCircle2, Paperclip, UploadCloud, Zap,
  AlertCircle, Sparkles, Check,
} from 'lucide-react';
import { JenisSurat, Surat, KategoriSurat, DisposisiSurat } from '../types/surat';
import {
  getSuratList, createSurat, deleteSurat,
  getKategoriSuratList, createKategoriSurat, updateKategoriSurat, deleteKategoriSurat,
  getNextUrutanSurat, getDisposisiBySuratId, createDisposisi, updateStatusDisposisi,
  getGuruList, Guru,
} from '../services/suratService';
import { formatNomorSurat } from '../utils/formatSurat';
import { useAuth } from '../context/AuthContext';
import { PrintDisposisi } from '../components/PrintDisposisi';
import { SearchableSelect } from '../components/SearchableSelect';
import { showToast, showToastUndo } from '@/components/Toast';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { supabase } from '../lib/supabase';
import { logActivity, AUDIT_MODUL } from '../utils/audit';
import { ModalDetailSurat } from '@/components/surat/ModalDetailSurat';
import { uploadSuratFile, formatCompressionInfo } from '@/utils/uploadSuratFile';
import { ModalSuratOtomatis } from '@/components/surat/ModalSuratOtomatis';
import { ConfirmModal } from '@/components/Modal';

// =============================================================================
// KONSTANTA & HELPER
// =============================================================================
const METODE_PENGIRIMAN_OPTIONS = ['Email', 'Kurir', 'Pos', 'Langsung', 'WhatsApp', 'Lainnya'];
const MODUL_SURAT = (AUDIT_MODUL as any)?.SURAT ?? 'Surat & Persuratan';

const compressAndConvertToWebP = (file: File, quality = 0.8, maxWidth = 1200): Promise<File> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      const canvas = document.createElement('canvas');
      let { width, height } = image;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Gagal memuat konteks Canvas')); return; }
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Gagal mengompresi gambar')); return; }
          const webpName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
          const webpFile = new File([blob], webpName, { type: 'image/webp' });
          resolve(webpFile);
        },
        'image/webp',
        quality
      );
    };
    image.onerror = (error) => reject(error);
  });
};

type DisposisiFormState = {
  pemberi_disposisi: string;
  penerima_id: string;
  penerima_disposisi: string;
  instruksi: string;
  batas_waktu: string;
};

type EkspedisiFormState = {
  nama_penerima_surat: string;
  tanggal_terima_surat: string;
  metode_pengiriman: string;
  no_resi: string;
  bukti_penerimaan_url: string;
};

const emptyEkspedisiForm: EkspedisiFormState = {
  nama_penerima_surat: '',
  tanggal_terima_surat: new Date().toISOString().split('T')[0],
  metode_pengiriman: 'Kurir',
  no_resi: '',
  bukti_penerimaan_url: '',
};

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================
export const SuratPage: React.FC = () => {
  const { user, guru } = useAuth();
  const confirm = useConfirm();

  // Tab & Data
  const [activeTab, setActiveTab] = useState<JenisSurat | 'KATEGORI'>('MASUK');
  const [suratList, setSuratList] = useState<Surat[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriSurat[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Surat
  const [showSuratModal, setShowSuratModal] = useState(false);
  const [editingSurat, setEditingSurat] = useState<Surat | null>(null);
  const [formData, setFormData] = useState({
    kategori_id: '', nomor_surat: '', perihal: '', ringkasan: '',
    pengirim_atau_tujuan: '', tanggal_surat: new Date().toISOString().split('T')[0],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isNomorManual, setIsNomorManual] = useState(false);

  // Modal Otomatis & Detail
  const [showOtomatisModal, setShowOtomatisModal] = useState(false);
  const [editingOtomatis, setEditingOtomatis] = useState<Surat | null>(null);
  const [detailSurat, setDetailSurat] = useState<Surat | null>(null);

  // State Konfirmasi Hapus
  const [deleteTarget, setDeleteTarget] = useState<Surat | null>(null);

  // Modal Kategori
  const [showKategoriModal, setShowKategoriModal] = useState(false);
  const [editingKategori, setEditingKategori] = useState<KategoriSurat | null>(null);
  const [kategoriForm, setKategoriForm] = useState<{ kode: string; nama_kategori: string; jenis_surat: JenisSurat }>({ kode: '', nama_kategori: '', jenis_surat: 'KELUAR' });

  // Modal Disposisi
  const [showDisposisiModal, setShowDisposisiModal] = useState(false);
  const [selectedSuratForDisposisi, setSelectedSuratForDisposisi] = useState<Surat | null>(null);
  const [disposisiList, setDisposisiList] = useState<DisposisiSurat[]>([]);
  const [editingDisposisiId, setEditingDisposisiId] = useState<string | null>(null);
  const [disposisiForm, setDisposisiForm] = useState<DisposisiFormState>({ pemberi_disposisi: 'Kepala Sekolah', penerima_id: '', penerima_disposisi: '', instruksi: '', batas_waktu: '' });

  // Modal Ekspedisi
  const [ekspedisiTarget, setEkspedisiTarget] = useState<Surat | null>(null);
  const [ekspedisiForm, setEkspedisiForm] = useState<EkspedisiFormState>(emptyEkspedisiForm);
  const [ekspedisiBukti, setEkspedisiBukti] = useState<File | null>(null);
  const [uploadingBukti, setUploadingBukti] = useState(false);
  const [savingEkspedisi, setSavingEkspedisi] = useState(false);

  // Print
  const [printDisposisiData, setPrintDisposisiData] = useState<{ surat: Surat; disposisi: DisposisiSurat; } | null>(null);

  // =========================================================================
  // LIFECYCLE & FETCH
  // =========================================================================
  useEffect(() => {
    loadData();
    fetchGurus();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'KATEGORI') {
        const data = await getKategoriSuratList();
        setKategoriList(data);
      } else {
        const [suratData, katData] = await Promise.all([getSuratList(activeTab), getKategoriSuratList(activeTab)]);
        setSuratList(suratData);
        setKategoriList(katData);

        // ✅ Sinkronisasi data jika Modal Detail sedang terbuka
        if (detailSurat && detailSurat.id) {
          const updatedDetail = suratData.find((s) => s.id === detailSurat.id);
          if (updatedDetail) setDetailSurat(updatedDetail);
        }
      }
    } catch (err) {
      showToast('error', 'Gagal memuat data surat');
    } finally {
      setLoading(false);
    }
  };

  const fetchGurus = async () => {
    try {
      const data = await getGuruList();
      setGuruList(data);
    } catch (err) {
      console.error('Gagal mengambil daftar guru:', err);
    }
  };

  // =========================================================================
  // KATEGORI HANDLERS
  // =========================================================================
  const handleOpenKategoriModal = (kat?: KategoriSurat) => {
    if (kat) {
      setEditingKategori(kat);
      setKategoriForm({ kode: kat.kode, nama_kategori: kat.nama_kategori, jenis_surat: kat.jenis_surat });
    } else {
      setEditingKategori(null);
      setKategoriForm({ kode: '', nama_kategori: '', jenis_surat: 'KELUAR' });
    }
    setShowKategoriModal(true);
  };

  const handleSubmitKategori = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingKategori) {
        await updateKategoriSurat(editingKategori.id, kategoriForm);
        showToast('success', 'Kode Perihal diperbarui');
      } else {
        await createKategoriSurat(kategoriForm);
        showToast('success', 'Kode Perihal ditambahkan');
      }
      setShowKategoriModal(false);
      loadData();
    } catch (err) {
      showToast('error', 'Gagal menyimpan Kode Perihal.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKategori = async (id: string) => {
    const target = kategoriList.find((x) => x.id === id);
    if (!target) return;
    setKategoriList((prev) => prev.filter((x) => x.id !== id));
    showToastUndo({
      message: `Kode Perihal "${target.nama_kategori}" dihapus`,
      duration: 5000,
      onCommit: async () => {
        try { await deleteKategoriSurat(id); } catch (err) { showToast('error', 'Gagal menghapus kategori.'); loadData(); }
      },
      onUndo: () => {
        setKategoriList((prev) => [target, ...prev].sort((a, b) => a.kode.localeCompare(b.kode)));
        showToast('info', 'Penghapusan dibatalkan');
      },
    });
  };

  // =========================================================================
  // SURAT HANDLERS
  // =========================================================================
  const resetForm = () => {
    setFormData({ kategori_id: '', nomor_surat: '', perihal: '', ringkasan: '', pengirim_atau_tujuan: '', tanggal_surat: new Date().toISOString().split('T')[0] });
    setSelectedFile(null);
    setIsNomorManual(false);
    setEditingSurat(null);
  };

  const handleOpenCreateSurat = () => {
    setEditingSurat(null);
    resetForm();
    setShowSuratModal(true);
  };

  const handleOpenEditSurat = (surat: Surat) => {
    setEditingSurat(surat);
    setFormData({
      kategori_id: surat.kategori_id ?? '',
      nomor_surat: surat.nomor_surat,
      perihal: surat.perihal,
      ringkasan: surat.ringkasan ?? '',
      pengirim_atau_tujuan: surat.pengirim_atau_tujuan,
      tanggal_surat: surat.tanggal_surat,
    });
    setIsNomorManual(true);
    setSelectedFile(null);
    setShowSuratModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setSelectedFile(null); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      showToast('error', 'Berkas harus berupa gambar atau PDF'); e.target.value = ''; setSelectedFile(null); return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast('error', 'Ukuran berkas maksimal 25 MB'); e.target.value = ''; setSelectedFile(null); return;
    }
    setSelectedFile(file);
  };

  const uploadCompressedImage = async (file: File): Promise<string | null> => {
    try {
      const compressedFile = await compressAndConvertToWebP(file, 0.8, 1200);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
      const filePath = `berkas/${fileName}`;
      const { error } = await supabase.storage.from('dokumen-surat').upload(filePath, compressedFile, { cacheControl: '31536000', upsert: false });
      if (error) { showToast('error', 'Gagal mengunggah gambar: ' + error.message); return null; }
      return supabase.storage.from('dokumen-surat').getPublicUrl(filePath).data.publicUrl;
    } catch (err: any) { showToast('error', 'Gagal memproses gambar: ' + (err.message || 'Error')); return null; }
  };

  const uploadSuratBerkas = async (file: File): Promise<string | null> => {
    try {
      const result = await uploadSuratFile(file, { folderId: guru?.id ?? 'umum' });
      const info = formatCompressionInfo(result);
      if (info) showToast('info', info);
      return result.file_url;
    } catch (err: any) { showToast('error', err.message || 'Gagal upload berkas'); return null; }
  };

  const regenerateNomor = async () => {
    if (activeTab === 'KATEGORI') return;
    const kat = kategoriList.find((k) => k.id === formData.kategori_id);
    if (!kat) { showToast('error', 'Pilih Kode Perihal terlebih dahulu'); return; }
    const nextUrutan = await getNextUrutanSurat(activeTab);
    const autoNomor = formatNomorSurat(nextUrutan, kat.kode, 'SMK-KHAWM', formData.tanggal_surat);
    setFormData((prev) => ({ ...prev, nomor_surat: autoNomor }));
    setIsNomorManual(false);
    showToast('info', 'Nomor surat di-reset ke auto-generate');
  };

  const handleKategoriChange = async (kategoriId: string) => {
    const kat = kategoriList.find((k) => k.id === kategoriId);
    if (!kat) { setFormData((prev) => ({ ...prev, kategori_id: kategoriId })); return; }
    if (!isNomorManual) {
      const nextUrutan = await getNextUrutanSurat(activeTab as JenisSurat);
      const autoNomor = formatNomorSurat(nextUrutan, kat.kode, 'SMK-KHAWM', formData.tanggal_surat);
      setFormData((prev) => ({ ...prev, kategori_id: kategoriId, nomor_surat: autoNomor }));
    } else {
      setFormData((prev) => ({ ...prev, kategori_id: kategoriId }));
    }
  };

  const handleSubmitSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'KATEGORI') return;
    setLoading(true);
    try {
      let fileUrl: string | null | undefined = undefined;
      if (selectedFile) {
        fileUrl = await uploadSuratBerkas(selectedFile);
        if (!fileUrl) { setLoading(false); return; }
      }
      const basePayload = {
        kategori_id: formData.kategori_id || null,
        nomor_surat: formData.nomor_surat,
        perihal: formData.perihal,
        ringkasan: formData.ringkasan,
        pengirim_atau_tujuan: formData.pengirim_atau_tujuan,
        tanggal_surat: formData.tanggal_surat,
      };
      if (editingSurat?.id) {
        const updatePayload: any = { ...basePayload };
        if (fileUrl) updatePayload.file_url = fileUrl;
        const { error } = await supabase.from('surat').update(updatePayload).eq('id', editingSurat.id);
        if (error) throw error;
        await logActivity({ aksi: 'UPDATE', modul: MODUL_SURAT, targetId: editingSurat.id, deskripsi: `Edit surat manual ${editingSurat.nomor_surat}` });
        showToast('success', 'Surat diperbarui');
      } else {
        await createSurat({ jenis_surat: activeTab, ...basePayload, file_url: fileUrl ?? null });
        await logActivity({ aksi: 'CREATE', modul: MODUL_SURAT, deskripsi: `Buat surat ${activeTab}: ${formData.nomor_surat}` });
        showToast('success', 'Surat disimpan');
      }
      setShowSuratModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan surat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  // ✅ FINALISASI SURAT
  const handleFinalisasi = async (surat: Surat) => {
    if (!surat.id) return;
    const ok = await confirm({
      title: 'Finalisasi Surat',
      message: `Apakah Anda yakin ingin mengubah status surat "${surat.perihal}" menjadi FINAL? Surat yang sudah final tidak disarankan untuk diedit kembali.`,
      variant: 'default',
      confirmLabel: 'Ya, Finalisasi',
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('surat')
        .update({ status: 'FINAL' })
        .eq('id', surat.id);

      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: MODUL_SURAT,
        targetId: surat.id,
        deskripsi: `Finalisasi surat ${surat.nomor_surat} (Draft -> Final)`,
      });

      showToast('success', 'Surat berhasil difinalisasi');
      loadData();
    } catch (err: any) {
      showToast('error', 'Gagal finalisasi: ' + (err.message || 'Error'));
    }
  };

  // ✅ EKSEKUSI HAPUS (TypeScript Fix)
  const executeDeleteSurat = async () => {
    if (!deleteTarget || !deleteTarget.id) return;
    const target = deleteTarget;
    const safeId = target.id as string; // ✅ PASTIKAN STRING
    setDeleteTarget(null);

    const { data: disposisi } = await supabase.from('disposisi_surat').select('id').eq('surat_id', safeId);
    const jumlahDisposisi = disposisi?.length ?? 0;

    setSuratList((prev) => prev.filter((x) => x.id !== safeId));

    showToastUndo({
      message: `Surat "${target.perihal}" dihapus`,
      duration: 5000,
      onCommit: async () => {
        try {
          if (jumlahDisposisi > 0) await supabase.from('disposisi_surat').delete().eq('surat_id', safeId);
          await deleteSurat(safeId);
          await logActivity({ aksi: 'DELETE', modul: MODUL_SURAT, targetId: safeId, deskripsi: `Hapus surat ${activeTab}` });
        } catch (err) { showToast('error', 'Gagal menghapus surat'); loadData(); }
      },
      onUndo: () => {
        setSuratList((prev) => [target, ...prev].sort((a, b) => (b.tanggal_surat || '').localeCompare(a.tanggal_surat || '')));
        showToast('info', 'Penghapusan dibatalkan');
      },
    });
  };

  // =========================================================================
  // DISPOSISI HANDLERS
  // =========================================================================
  const resetDisposisiForm = () => {
    setEditingDisposisiId(null);
    setDisposisiForm({ pemberi_disposisi: guru?.nama_lengkap || 'Kepala Sekolah', penerima_id: '', penerima_disposisi: '', instruksi: '', batas_waktu: '' });
  };

  const handleOpenDisposisi = async (surat: Surat) => {
    setSelectedSuratForDisposisi(surat);
    resetDisposisiForm();
    if (surat.id) setDisposisiList(await getDisposisiBySuratId(surat.id));
    setShowDisposisiModal(true);
  };

  const handleSubmitDisposisi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuratForDisposisi?.id) return;
    if (!disposisiForm.penerima_disposisi) { showToast('error', 'Pilih guru penerima'); return; }
    const targetGuru = guruList.find((g) => g.id === disposisiForm.penerima_id);
    try {
      if (editingDisposisiId) {
        await supabase.from('disposisi_surat').update({
          pemberi_disposisi: disposisiForm.pemberi_disposisi, penerima_disposisi: disposisiForm.penerima_disposisi,
          instruksi: disposisiForm.instruksi, batas_waktu: disposisiForm.batas_waktu || null, penerima_id: targetGuru?.id || null,
        }).eq('id', editingDisposisiId);
        if (targetGuru?.id) await supabase.from('notifikasi').insert([{ guru_id: targetGuru.id, judul: 'Perubahan Disposisi', pesan: `Disposisi surat (No: ${selectedSuratForDisposisi.nomor_surat}) diperbarui`, tipe: 'disposisi_surat', tautan: '/tugas-disposisi', is_read: false }]);
        showToast('success', 'Disposisi diperbarui');
      } else {
        await createDisposisi({ surat_id: selectedSuratForDisposisi.id, pemberi_disposisi: disposisiForm.pemberi_disposisi, penerima_disposisi: disposisiForm.penerima_disposisi, instruksi: disposisiForm.instruksi, batas_waktu: disposisiForm.batas_waktu || null, status: 'PENDING', pemberi_id: user?.id || null, penerima_id: targetGuru?.id || null }, selectedSuratForDisposisi.nomor_surat);
        showToast('success', 'Disposisi dikirim');
      }
      setDisposisiList(await getDisposisiBySuratId(selectedSuratForDisposisi.id));
      resetDisposisiForm();
    } catch (err: any) { showToast('error', 'Gagal: ' + (err.message || 'Error')); }
  };

  const handleEditDisposisi = (d: DisposisiSurat) => {
    setEditingDisposisiId(d.id || null);
    const penerima = guruList.find((g) => g.nama_lengkap === d.penerima_disposisi);
    setDisposisiForm({ pemberi_disposisi: d.pemberi_disposisi, penerima_id: penerima?.id || '', penerima_disposisi: d.penerima_disposisi, instruksi: d.instruksi, batas_waktu: d.batas_waktu || '' });
  };

  const handleDeleteDisposisi = async (id: string) => {
    const target = disposisiList.find((x) => x.id === id);
    if (!target) return;
    setDisposisiList((prev) => prev.filter((x) => x.id !== id));
    showToastUndo({
      message: `Disposisi dihapus`,
      duration: 5000,
      onCommit: async () => { try { await supabase.from('disposisi_surat').delete().eq('id', id); } catch (err) { showToast('error', 'Gagal menghapus'); setDisposisiList(await getDisposisiBySuratId(selectedSuratForDisposisi?.id || '')); } },
      onUndo: () => { setDisposisiList((prev) => [target, ...prev]); showToast('info', 'Dibatalkan'); },
    });
  };

  const handleStatusDisposisi = async (id: string, status: 'PENDING' | 'PROSES' | 'SELESAI') => {
    await updateStatusDisposisi(id, status);
    if (selectedSuratForDisposisi?.id) setDisposisiList(await getDisposisiBySuratId(selectedSuratForDisposisi.id));
  };

  // =========================================================================
  // EKSPEDISI HANDLERS
  // =========================================================================
  const handleOpenEkspedisi = (surat: Surat) => {
    setEkspedisiTarget(surat);
    setEkspedisiForm({
      nama_penerima_surat: surat.nama_penerima_surat ?? '', tanggal_terima_surat: surat.tanggal_terima_surat ?? new Date().toISOString().split('T')[0],
      metode_pengiriman: surat.metode_pengiriman ?? 'Kurir', no_resi: surat.no_resi ?? '', bukti_penerimaan_url: surat.bukti_penerimaan_url ?? '',
    });
    setEkspedisiBukti(null);
  };

  const handleEkspedisiBuktiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setEkspedisiBukti(null); return; }
    if (!file.type.startsWith('image/')) { showToast('error', 'Harus gambar'); e.target.value = ''; return; }
    if (file.size > 10 * 1024 * 1024) { showToast('error', 'Maks 10 MB'); e.target.value = ''; return; }
    setEkspedisiBukti(file);
  };

  const handleSubmitEkspedisi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ekspedisiTarget?.id) return;
    if (!ekspedisiForm.nama_penerima_surat.trim()) { showToast('error', 'Nama penerima wajib diisi'); return; }
    setSavingEkspedisi(true);
    try {
      let buktiUrl = ekspedisiForm.bukti_penerimaan_url;
      if (ekspedisiBukti) {
        setUploadingBukti(true);
        const uploaded = await uploadCompressedImage(ekspedisiBukti);
        setUploadingBukti(false);
        if (!uploaded) { setSavingEkspedisi(false); return; }
        buktiUrl = uploaded;
      }
      await supabase.from('surat').update({
        nama_penerima_surat: ekspedisiForm.nama_penerima_surat.trim(), tanggal_terima_surat: ekspedisiForm.tanggal_terima_surat || null,
        metode_pengiriman: ekspedisiForm.metode_pengiriman || null, no_resi: ekspedisiForm.no_resi.trim() || null, bukti_penerimaan_url: buktiUrl || null,
      }).eq('id', ekspedisiTarget.id);
      await logActivity({ aksi: 'UPDATE', modul: MODUL_SURAT, targetId: ekspedisiTarget.id, deskripsi: `Update ekspedisi ${ekspedisiTarget.nomor_surat}` });
      showToast('success', 'Ekspedisi disimpan');
      setEkspedisiTarget(null);
      loadData();
    } catch (err: any) { showToast('error', 'Gagal: ' + (err.message || 'Error')); } finally { setSavingEkspedisi(false); setUploadingBukti(false); }
  };

  const handleResetEkspedisi = async () => {
    if (!ekspedisiTarget?.id) return;
    const ok = await confirm({ title: 'Reset Ekspedisi', message: 'Yakin reset data ekspedisi ini?', variant: 'warning', confirmLabel: 'Ya' });
    if (!ok) return;
    try {
      await supabase.from('surat').update({ nama_penerima_surat: null, tanggal_terima_surat: null, metode_pengiriman: null, no_resi: null, bukti_penerimaan_url: null }).eq('id', ekspedisiTarget.id);
      showToast('success', 'Ekspedisi direset'); setEkspedisiTarget(null); loadData();
    } catch (err: any) { showToast('error', 'Gagal: ' + err.message); }
  };

  // =========================================================================
  // FILTER
  // =========================================================================
  const filteredSurat = suratList.filter(
    (s) => s.nomor_surat.toLowerCase().includes(searchQuery.toLowerCase()) || s.perihal.toLowerCase().includes(searchQuery.toLowerCase()) || s.pengirim_atau_tujuan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3.5 sm:p-6 space-y-4 sm:space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/10 shadow-lg">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" /> Persuratan & Digital Archiving
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Kelola dokumen, surat keluar/masuk, disposisi, dan ekspedisi.</p>
        </div>
        {activeTab === 'KATEGORI' ? (
          <button onClick={() => handleOpenKategoriModal()} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition border border-indigo-400/20 cursor-pointer"><Plus className="w-4 h-4" /> Tambah Kode Perihal</button>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeTab !== 'MASUK' && (
              <button onClick={() => setShowOtomatisModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition border border-purple-400/20 cursor-pointer"><Sparkles className="w-4 h-4" /> Buat Surat Otomatis</button>
            )}
            <button onClick={handleOpenCreateSurat} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition border border-white/10 cursor-pointer"><Plus className="w-4 h-4" /> Upload / Manual</button>
          </div>
        )}
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['MASUK', 'KELUAR', 'SK', 'KATEGORI'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border cursor-pointer ${activeTab === tab ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-500/10' : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-800/50'}`}>
            {tab === 'MASUK' ? 'Surat Masuk' : tab === 'KELUAR' ? 'Surat Keluar' : tab === 'SK' ? 'SK Sekolah' : 'Master Kode Perihal'}
          </button>
        ))}
      </div>

      {/* SEARCH */}
      {activeTab !== 'KATEGORI' && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Cari nomor, perihal, atau instansi..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition" />
        </div>
      )}

      {/* CONTENT */}
      {loading ? <PageSkeleton variant="list" /> : activeTab === 'KATEGORI' ? (
        // ==================== TAB KATEGORI ====================
        <div className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl divide-y divide-white/5">
          {kategoriList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">Belum ada Kode Perihal.</div>
          ) : kategoriList.map((kat) => (
            <div key={kat.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{kat.kode}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-white/5">{kat.jenis_surat}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-200">{kat.nama_kategori}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => handleOpenKategoriModal(kat)} className="p-2 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-white/5 cursor-pointer"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteKategori(kat.id)} className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* MOBILE LIST */}
          <div className="block sm:hidden space-y-3">
            {filteredSurat.length === 0 ? <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">Tidak ada data surat.</div> : filteredSurat.map((item) => {
              const ekspedisiSelesai = !!item.tanggal_terima_surat;
              return (
                <div key={item.id} className="bg-slate-900/60 rounded-2xl border border-white/10 p-4 space-y-3 shadow-lg">
                  <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2.5">
                    <div>
                      <p className="font-mono text-xs font-bold text-indigo-400">{item.nomor_surat}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.pengirim_atau_tujuan}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-white/5 flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3 text-indigo-400" /> {item.tanggal_surat}</span>
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                      {item.perihal}
                      {item.status === 'DRAFT' && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">DRAFT</span>}
                    </h2>
                    {item.ringkasan && <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 bg-slate-950/40 p-2 rounded-lg border border-white/5">{item.ringkasan}</p>}
                  </div>
                  {activeTab !== 'MASUK' && (
                    <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border ${ekspedisiSelesai ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                      {ekspedisiSelesai ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      <span className="font-bold">{ekspedisiSelesai ? 'Terkirim' : 'Belum Terkirim'}</span>
                      {item.metode_pengiriman && <span className="text-slate-500">· {item.metode_pengiriman}</span>}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    {item.file_url ? <a href={item.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"><ImageIcon className="w-3 h-3" /> Lihat Surat</a> : <span className="text-[10px] text-slate-500 italic">Tanpa Berkas</span>}
                    <div className="flex items-center gap-1.5">
                      {activeTab === 'MASUK' && <button onClick={() => handleOpenDisposisi(item)} className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer"><UserCheck className="w-3 h-3" /> Disposisi</button>}
                      {activeTab !== 'MASUK' && <button onClick={() => handleOpenEkspedisi(item)} className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer"><Truck className="w-3 h-3" /> Ekspedisi</button>}

                      <button onClick={() => setDetailSurat(item)} className="p-1.5 text-slate-400 hover:text-purple-400 bg-slate-800/50 rounded-lg border border-white/5 transition cursor-pointer" title="Detail"><Sparkles className="w-3.5 h-3.5" /></button>

                      {item.status === 'DRAFT' && (
                        <button onClick={() => handleFinalisasi(item)} className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition cursor-pointer" title="Finalisasi Surat"><Check className="w-3.5 h-3.5" /></button>
                      )}

                      {item.metadata?.template_type && (
                        <button onClick={() => { setEditingOtomatis(item); setShowOtomatisModal(true); }} className="p-1.5 text-slate-400 hover:text-emerald-400 bg-slate-800/50 rounded-lg border border-white/5 transition cursor-pointer" title="Regenerate"><RotateCcw className="w-3.5 h-3.5" /></button>
                      )}

                      <button onClick={() => handleOpenEditSurat(item)} className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800/50 rounded-lg border border-white/5 transition cursor-pointer" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>

                      <button onClick={() => setDeleteTarget(item)} className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-800/50 rounded-lg border border-white/5 cursor-pointer" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP LIST */}
          <div className="hidden sm:block bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/50 border-b border-white/10 text-slate-400 text-xs uppercase font-mono tracking-wider">
                  <tr>
                    <th className="p-4">Nomor Surat</th>
                    <th className="p-4">Perihal & Ringkasan</th>
                    <th className="p-4">{activeTab === 'MASUK' ? 'Pengirim' : 'Tujuan'}</th>
                    <th className="p-4">Tanggal</th>
                    <th className="p-4">Berkas</th>
                    {activeTab !== 'MASUK' && <th className="p-4">Ekspedisi</th>}
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSurat.length === 0 ? (
                    <tr><td colSpan={activeTab !== 'MASUK' ? 7 : 6} className="p-8 text-center text-slate-500 text-xs">Tidak ada data surat.</td></tr>
                  ) : filteredSurat.map((item) => {
                    const ekspedisiSelesai = !!item.tanggal_terima_surat;
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition">
                        <td className="p-4 font-medium whitespace-nowrap">
                          <div className="font-mono text-xs text-indigo-400 font-bold">{item.nomor_surat}</div>
                          {item.kategori_surat && <span className="text-[10px] text-slate-500">{item.kategori_surat.nama_kategori}</span>}
                        </td>
                        <td className="p-4 max-w-xs">
                          <div className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                            {item.perihal}
                            {item.status === 'DRAFT' && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">DRAFT</span>}
                          </div>
                          {item.ringkasan && <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.ringkasan}</div>}
                        </td>
                        <td className="p-4 text-xs text-slate-300">{item.pengirim_atau_tujuan}</td>
                        <td className="p-4 text-xs text-slate-400 whitespace-nowrap">{item.tanggal_surat}</td>
                        <td className="p-4">
                          {item.file_url ? <a href={item.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20"><ImageIcon className="w-3 h-3" /> Lihat</a> : <span className="text-xs text-slate-600 italic">Kosong</span>}
                        </td>
                        {activeTab !== 'MASUK' && (
                          <td className="p-4 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border ${ekspedisiSelesai ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                              {ekspedisiSelesai ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                              <span className="font-bold">{ekspedisiSelesai ? 'Terkirim' : 'Pending'}</span>
                              {item.metode_pengiriman && <span className="text-slate-500">· {item.metode_pengiriman}</span>}
                            </div>
                            {item.nama_penerima_surat && <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[180px]">Ke: {item.nama_penerima_surat}</p>}
                          </td>
                        )}
                        <td className="p-4 text-center whitespace-nowrap space-x-1">
                          {activeTab === 'MASUK' && <button onClick={() => handleOpenDisposisi(item)} className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-amber-500/20 transition cursor-pointer"><UserCheck className="w-3.5 h-3.5" /> Disposisi</button>}
                          {activeTab !== 'MASUK' && <button onClick={() => handleOpenEkspedisi(item)} className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-sky-500/20 transition cursor-pointer"><Truck className="w-3.5 h-3.5" /> Ekspedisi</button>}

                          <button onClick={() => setDetailSurat(item)} className="p-1.5 text-slate-400 hover:text-purple-400 rounded-lg hover:bg-white/5 transition cursor-pointer" title="Detail & AI"><Sparkles className="w-4 h-4" /></button>

                          {item.status === 'DRAFT' && (
                            <button onClick={() => handleFinalisasi(item)} className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition cursor-pointer" title="Finalisasi Surat"><Check className="w-4 h-4" /></button>
                          )}

                          {item.metadata?.template_type && (
                            <button onClick={() => { setEditingOtomatis(item); setShowOtomatisModal(true); }} className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-emerald-500/10 transition cursor-pointer" title="Regenerate"><RotateCcw className="w-4 h-4" /></button>
                          )}

                          <button onClick={() => handleOpenEditSurat(item)} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-white/5 transition cursor-pointer" title="Edit Data"><Edit3 className="w-4 h-4" /></button>

                          <button onClick={() => setDeleteTarget(item)} className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition cursor-pointer" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ==================== MODAL KATEGORI ==================== */}
      {showKategoriModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10">
              <h3 className="font-bold text-sm sm:text-base text-white">{editingKategori ? 'Edit Kode Perihal' : 'Tambah Kode Perihal Baru'}</h3>
              <button onClick={() => setShowKategoriModal(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitKategori} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kode Singkat</label>
                <input type="text" placeholder="Contoh: BK-SP1" className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-indigo-400 font-mono outline-none uppercase" value={kategoriForm.kode} onChange={(e) => setKategoriForm({ ...kategoriForm, kode: e.target.value.toUpperCase() })} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nama Kategori Perihal</label>
                <input type="text" placeholder="Contoh: Surat Panggilan Orang Tua 1" className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none" value={kategoriForm.nama_kategori} onChange={(e) => setKategoriForm({ ...kategoriForm, nama_kategori: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Berlaku Untuk Jenis Surat</label>
                <select className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none cursor-pointer" value={kategoriForm.jenis_surat} onChange={(e) => setKategoriForm({ ...kategoriForm, jenis_surat: e.target.value as JenisSurat })} required>
                  <option value="KELUAR" className="bg-slate-900">Surat Keluar</option>
                  <option value="MASUK" className="bg-slate-900">Surat Masuk</option>
                  <option value="SK" className="bg-slate-900">Surat Keputusan (SK)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowKategoriModal(false)} className="px-4 py-2 border border-white/10 rounded-xl text-xs sm:text-sm text-slate-400 hover:bg-white/5 cursor-pointer">Batal</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold cursor-pointer">{loading ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL SURAT (CREATE + EDIT MANUAL) ==================== */}
      {showSuratModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10">
              <h3 className="font-bold text-sm sm:text-base text-white">{editingSurat ? `Edit Data Surat ${activeTab}` : `Tambah Surat ${activeTab}`}</h3>
              <button onClick={() => setShowSuratModal(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitSurat} className="p-5 space-y-4 overflow-y-auto">
              {editingSurat && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
                  <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-300/90 leading-relaxed"><p className="font-bold mb-0.5">Mode Edit</p><p className="text-amber-400/70">Perubahan akan dicatat pada log audit.</p></div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kode Perihal</label>
                <SearchableSelect options={kategoriList.map((k) => ({ value: k.id, label: `[${k.kode}] ${k.nama_kategori}` }))} value={formData.kategori_id} onChange={handleKategoriChange} placeholder="Pilih..." searchPlaceholder="Cari..." emptyMessage="Kosong" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-400">Nomor Surat <span className="text-slate-500">(Auto/Manual)</span></label>
                  {isNomorManual ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded"><Zap size={9} /> Manual</span> : formData.nomor_surat && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded"><CheckCircle2 size={9} /> Auto</span>}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Nomor surat..." className="flex-1 bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-indigo-400 font-mono outline-none" value={formData.nomor_surat} onChange={(e) => { setFormData({ ...formData, nomor_surat: e.target.value }); setIsNomorManual(true); }} required />
                  <button type="button" onClick={regenerateNomor} disabled={!formData.kategori_id} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition disabled:opacity-40 cursor-pointer" title="Reset ke auto"><RotateCcw size={14} /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{activeTab === 'MASUK' ? 'Pengirim' : 'Tujuan'}</label>
                  <input type="text" className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none" value={formData.pengirim_atau_tujuan} onChange={(e) => setFormData({ ...formData, pengirim_atau_tujuan: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tanggal Surat</label>
                  <input type="date" className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none" value={formData.tanggal_surat} onChange={(e) => setFormData({ ...formData, tanggal_surat: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Perihal</label>
                <input type="text" className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none" value={formData.perihal} onChange={(e) => setFormData({ ...formData, perihal: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ringkasan</label>
                <textarea rows={2} className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none" value={formData.ringkasan} onChange={(e) => setFormData({ ...formData, ringkasan: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{editingSurat ? 'Ganti Berkas (Kosongkan jika tidak)' : 'Unggah Berkas (PDF/Gambar)'}</label>
                <input type="file" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileChange} className="w-full text-xs text-slate-400 border border-white/10 rounded-xl p-2 bg-slate-950 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white cursor-pointer" />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowSuratModal(false)} className="px-4 py-2 border border-white/10 rounded-xl text-xs sm:text-sm text-slate-400 hover:bg-white/5 cursor-pointer">Batal</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-50 cursor-pointer">{loading ? 'Menyimpan...' : editingSurat ? 'Simpan Perubahan' : 'Simpan Surat'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL DISPOSISI ==================== */}
      {showDisposisiModal && selectedSuratForDisposisi && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">Lembar Disposisi Surat</h3>
                <p className="text-xs text-indigo-400 font-mono mt-0.5">{selectedSuratForDisposisi.nomor_surat}</p>
              </div>
              <button onClick={() => setShowDisposisiModal(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto">
              <form onSubmit={handleSubmitDisposisi} className="bg-slate-950/60 p-4 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{editingDisposisiId ? 'Edit Penugasan' : 'Beri Penugasan Baru'}</h4>
                  {editingDisposisiId && <button type="button" onClick={resetDisposisiForm} className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium cursor-pointer"><RotateCcw className="w-3 h-3" /> Batal Edit</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Ditugaskan Kepada</label>
                    <SearchableSelect options={guruList.map((g) => ({ value: g.id, label: g.nama_lengkap, hint: g.nip ? `NIP: ${g.nip}` : undefined }))} value={disposisiForm.penerima_id} onChange={(v) => { const g = guruList.find((x) => x.id === v); setDisposisiForm((prev) => ({ ...prev, penerima_id: v, penerima_disposisi: g?.nama_lengkap ?? '' })); }} placeholder="Pilih..." searchPlaceholder="Cari..." emptyMessage="Kosong" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Batas Waktu</label>
                    <input type="date" className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none" value={disposisiForm.batas_waktu} onChange={(e) => setDisposisiForm({ ...disposisiForm, batas_waktu: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Instruksi</label>
                  <input type="text" placeholder="Contoh: Panggil wali murid..." className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none" value={disposisiForm.instruksi} onChange={(e) => setDisposisiForm({ ...disposisiForm, instruksi: e.target.value })} required />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer">{editingDisposisiId ? 'Perbarui' : '+ Kirim'}</button>
                  {editingDisposisiId && <button type="button" onClick={resetDisposisiForm} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer">Batal</button>}
                </div>
              </form>
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Penugasan</h4>
                {disposisiList.length === 0 ? <p className="text-xs text-slate-500 italic">Belum ada disposisi.</p> : disposisiList.map((d) => (
                  <div key={d.id} className={`p-3 bg-slate-950/40 border rounded-xl space-y-2 ${editingDisposisiId === d.id ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-200">{d.penerima_disposisi} <span className="font-normal text-slate-500">(dari {d.pemberi_disposisi})</span></p>
                        <p className="text-xs text-slate-400">{d.instruksi}</p>
                        {d.batas_waktu && <p className="text-[10px] text-rose-400">Deadline: {d.batas_waktu}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => handleEditDisposisi(d)} className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => d.id && handleDeleteDisposisi(d.id)} className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setPrintDisposisiData({ surat: selectedSuratForDisposisi, disposisi: d })} className="p-1.5 text-slate-300 hover:text-white bg-slate-800 rounded-lg border border-white/10 flex items-center gap-1 text-[11px] cursor-pointer"><Printer className="w-3.5 h-3.5 text-indigo-400" /> Cetak</button>
                        <select value={d.status} onChange={(e) => d.id && handleStatusDisposisi(d.id, e.target.value as any)} className={`text-xs font-bold border rounded-lg px-2 py-1 outline-none cursor-pointer ${d.status === 'SELESAI' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : d.status === 'PROSES' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                          <option value="PENDING" className="bg-slate-900">PENDING</option>
                          <option value="PROSES" className="bg-slate-900">PROSES</option>
                          <option value="SELESAI" className="bg-slate-900">SELESAI</option>
                        </select>
                      </div>
                    </div>
                    {d.catatan_tindak_lanjut && (
                      <div className="mt-2 text-xs bg-emerald-950/30 border border-emerald-500/20 p-2.5 rounded-lg">
                        <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mb-0.5"><MessageSquare className="w-3 h-3" /> Feedback:</p>
                        <p className="text-slate-300 text-xs italic">{d.catatan_tindak_lanjut}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL EKSPEDISI ==================== */}
      {ekspedisiTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center"><Truck size={18} /></div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">Data Ekspedisi</h3>
                  <p className="text-xs text-indigo-400 font-mono mt-0.5">{ekspedisiTarget.nomor_surat}</p>
                </div>
              </div>
              <button onClick={() => setEkspedisiTarget(null)} className="text-slate-400 hover:text-slate-200 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitEkspedisi} className="p-5 space-y-4 overflow-y-auto">
              <div className="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-xs">
                <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Perihal</p>
                <p className="text-slate-200 font-semibold">{ekspedisiTarget.perihal}</p>
                <p className="text-slate-500 text-[10px] mt-1.5">Tujuan: <span className="text-slate-300">{ekspedisiTarget.pengirim_atau_tujuan}</span></p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Metode Pengiriman</label>
                <div className="grid grid-cols-3 gap-2">
                  {METODE_PENGIRIMAN_OPTIONS.map((m) => (
                    <button key={m} type="button" onClick={() => setEkspedisiForm({ ...ekspedisiForm, metode_pengiriman: m })} className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${ekspedisiForm.metode_pengiriman === m ? 'bg-sky-500/15 border-sky-500/40 text-sky-300' : 'bg-slate-950 border-white/10 text-slate-400 hover:bg-slate-800/60'}`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Nama Penerima <span className="text-rose-400">*</span></label>
                  <input type="text" className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none" value={ekspedisiForm.nama_penerima_surat} onChange={(e) => setEkspedisiForm({ ...ekspedisiForm, nama_penerima_surat: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tanggal Diterima</label>
                  <input type="date" className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 outline-none" value={ekspedisiForm.tanggal_terima_surat} onChange={(e) => setEkspedisiForm({ ...ekspedisiForm, tanggal_terima_surat: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">No. Resi / Tracking <span className="text-slate-500">(opsional)</span></label>
                <input type="text" className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 font-mono outline-none" value={ekspedisiForm.no_resi} onChange={(e) => setEkspedisiForm({ ...ekspedisiForm, no_resi: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Bukti Penerimaan</label>
                {ekspedisiForm.bukti_penerimaan_url && !ekspedisiBukti && (
                  <div className="mb-2 relative w-full h-32 rounded-xl overflow-hidden border border-white/10 bg-slate-950">
                    <img src={ekspedisiForm.bukti_penerimaan_url} alt="Bukti" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setEkspedisiForm({ ...ekspedisiForm, bukti_penerimaan_url: '' })} className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-slate-300 border border-white/10 cursor-pointer"><X size={14} /></button>
                  </div>
                )}
                {ekspedisiBukti && (
                  <div className="mb-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs">
                    <Paperclip size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 truncate flex-1">{ekspedisiBukti.name}</span>
                    <button type="button" onClick={() => setEkspedisiBukti(null)} className="p-1 rounded text-slate-400 hover:text-rose-400 cursor-pointer"><X size={12} /></button>
                  </div>
                )}
                {!ekspedisiBukti && !ekspedisiForm.bukti_penerimaan_url && (
                  <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-white/10 hover:border-sky-500/40 bg-slate-950/50 transition-all cursor-pointer">
                    <UploadCloud size={20} className="text-sky-400 mb-1" />
                    <p className="text-[11px] text-slate-400">Klik untuk upload bukti</p>
                    <input type="file" accept="image/*" onChange={handleEkspedisiBuktiChange} className="hidden" />
                  </label>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 pt-4 border-t border-white/10">
                <button type="button" onClick={handleResetEkspedisi} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"><RotateCcw size={12} /> Reset</button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEkspedisiTarget(null)} className="px-4 py-2 border border-white/10 rounded-xl text-xs sm:text-sm text-slate-400 hover:bg-white/5 cursor-pointer">Batal</button>
                  <button type="submit" disabled={savingEkspedisi || uploadingBukti} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-50 cursor-pointer">
                    {uploadingBukti ? 'Mengunggah...' : savingEkspedisi ? 'Menyimpan...' : <><Send size={13} /> Simpan</>}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PRINT DISPOSISI ==================== */}
      {printDisposisiData && (
        <PrintDisposisi
          surat={{ no_surat: printDisposisiData.surat.nomor_surat || '-', asal_surat: printDisposisiData.surat.pengirim_atau_tujuan || '-', tanggal_surat: printDisposisiData.surat.tanggal_surat || '-', perihal: printDisposisiData.surat.perihal || '-', sifat: 'Biasa' }}
          disposisi={{ id: printDisposisiData.disposisi.id || '', tanggal_disposisi: printDisposisiData.disposisi.created_at ? new Date(printDisposisiData.disposisi.created_at).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID'), penerima_disposisi: printDisposisiData.disposisi.penerima_disposisi, isi_disposisi: printDisposisiData.disposisi.instruksi, catatan: printDisposisiData.disposisi.catatan_tindak_lanjut, status: printDisposisiData.disposisi.status }}
          onClose={() => setPrintDisposisiData(null)}
        />
      )}

      {/* ==================== MODAL DETAIL ==================== */}
      <ModalDetailSurat surat={detailSurat} onClose={() => setDetailSurat(null)} onSaved={loadData} />

      {/* ==================== MODAL SURAT OTOMATIS ==================== */}
      <ModalSuratOtomatis
        open={showOtomatisModal}
        onClose={() => { setShowOtomatisModal(false); setEditingOtomatis(null); }}
        onSuccess={loadData}
        kategoriList={kategoriList}
        editData={editingOtomatis}
      />

      {/* ✅ MODAL KONFIRMASI HAPUS */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={executeDeleteSurat}
        title="Hapus Surat"
        message={`Yakin ingin menghapus surat "${deleteTarget?.perihal}" (No: ${deleteTarget?.nomor_surat})? Tindakan ini akan menghapus disposisi terkait.`}
        variant="danger"
      />
    </div>
  );
};

export default SuratPage;