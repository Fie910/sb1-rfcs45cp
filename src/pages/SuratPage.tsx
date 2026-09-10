import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Trash2, Edit3, Paperclip, UserCheck, 
  X, Calendar, FileText, Check, ChevronDown, Printer, MessageSquare, RotateCcw, Image as ImageIcon
} from 'lucide-react';
import { JenisSurat, Surat, KategoriSurat, DisposisiSurat } from '../types/surat';
import { 
  getSuratList, createSurat, deleteSurat, 
  getKategoriSuratList, createKategoriSurat, updateKategoriSurat, deleteKategoriSurat,
  getNextUrutanSurat,
  getDisposisiBySuratId, createDisposisi, updateStatusDisposisi,
  getGuruList, Guru
} from '../services/suratService';
import { formatNomorSurat } from '../utils/formatSurat';
import { useAuth } from '../context/AuthContext';
import { PrintDisposisi } from '../components/PrintDisposisi';
import { supabase } from '../lib/supabase';

const compressAndConvertToWebP = (
  file: File,
  quality = 0.8,
  maxWidth = 1200
): Promise<File> => {
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
      if (!ctx) {
        reject(new Error('Gagal memuat konteks Canvas'));
        return;
      }

      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Gagal mengompresi gambar'));
            return;
          }
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

export const SuratPage: React.FC = () => {
  const { user, guru } = useAuth();
  const [activeTab, setActiveTab] = useState<JenisSurat | 'KATEGORI'>('MASUK');
  const [suratList, setSuratList] = useState<Surat[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriSurat[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [showSuratModal, setShowSuratModal] = useState(false);
  const [formData, setFormData] = useState({
    kategori_id: '',
    nomor_surat: '',
    perihal: '',
    ringkasan: '',
    pengirim_atau_tujuan: '',
    tanggal_surat: new Date().toISOString().split('T')[0],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [showKategoriModal, setShowKategoriModal] = useState(false);
  const [editingKategori, setEditingKategori] = useState<KategoriSurat | null>(null);
  const [kategoriForm, setKategoriForm] = useState<{
    kode: string;
    nama_kategori: string;
    jenis_surat: JenisSurat;
  }>({
    kode: '',
    nama_kategori: '',
    jenis_surat: 'KELUAR'
  });

  const [showDisposisiModal, setShowDisposisiModal] = useState(false);
  const [selectedSuratForDisposisi, setSelectedSuratForDisposisi] = useState<Surat | null>(null);
  const [disposisiList, setDisposisiList] = useState<DisposisiSurat[]>([]);
  const [editingDisposisiId, setEditingDisposisiId] = useState<string | null>(null);
  const [disposisiForm, setDisposisiForm] = useState({
    pemberi_disposisi: 'Kepala Sekolah',
    penerima_disposisi: '',
    instruksi: '',
    batas_waktu: ''
  });

  const [printDisposisiData, setPrintDisposisiData] = useState<{
    surat: Surat;
    disposisi: DisposisiSurat;
  } | null>(null);

  const [guruSearch, setGuruSearch] = useState('');
  const [showGuruDropdown, setShowGuruDropdown] = useState(false);
  const guruDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    fetchGurus();
  }, [activeTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (guruDropdownRef.current && !guruDropdownRef.current.contains(event.target as Node)) {
        setShowGuruDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'KATEGORI') {
        const data = await getKategoriSuratList();
        setKategoriList(data);
      } else {
        const [suratData, katData] = await Promise.all([
          getSuratList(activeTab),
          getKategoriSuratList(activeTab)
        ]);
        setSuratList(suratData);
        setKategoriList(katData);
      }
    } catch (err) {
      console.error('Gagal memuat data:', err);
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

  const handleOpenKategoriModal = (kat?: KategoriSurat) => {
    if (kat) {
      setEditingKategori(kat);
      setKategoriForm({
        kode: kat.kode,
        nama_kategori: kat.nama_kategori,
        jenis_surat: kat.jenis_surat
      });
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
      } else {
        await createKategoriSurat(kategoriForm);
      }
      setShowKategoriModal(false);
      loadData();
    } catch (err) {
      alert('Gagal menyimpan Kode Perihal. Pastikan kode bersifat unik.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKategori = async (id: string) => {
    if (confirm('Hapus Kode Perihal ini?')) {
      try {
        await deleteKategoriSurat(id);
        loadData();
      } catch (err) {
        alert('Gagal menghapus kategori. Kategori mungkin sedang digunakan oleh data surat.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Berkas harus berupa gambar (JPG, PNG, WebP)');
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran berkas mentah tidak boleh melebihi 10 MB');
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const uploadCompressedImage = async (file: File): Promise<string | null> => {
    try {
      const compressedFile = await compressAndConvertToWebP(file, 0.8, 1200);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
      const filePath = `berkas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('surat-berkas')
        .upload(filePath, compressedFile, {
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) {
        alert('Gagal mengunggah gambar: ' + uploadError.message);
        return null;
      }

      const { data } = supabase.storage
        .from('surat-berkas')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err: any) {
      alert('Gagal memproses gambar: ' + (err.message || 'Error tidak diketahui'));
      return null;
    }
  };

  const handleKategoriChange = async (kategoriId: string) => {
    const kat = kategoriList.find(k => k.id === kategoriId);
    
    if (kat && (activeTab === 'KELUAR' || activeTab === 'SK')) {
      const nextUrutan = await getNextUrutanSurat(activeTab);
      const autoNomor = formatNomorSurat(nextUrutan, kat.kode, 'SMK-KHAWM', formData.tanggal_surat);
      setFormData(prev => ({ ...prev, kategori_id: kategoriId, nomor_surat: autoNomor }));
    } else {
      setFormData(prev => ({ ...prev, kategori_id: kategoriId }));
    }
  };

  const handleSubmitSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'KATEGORI') return;

    setLoading(true);
    try {
      let fileUrl = null;
      if (selectedFile) {
        fileUrl = await uploadCompressedImage(selectedFile);
        if (!fileUrl) {
          setLoading(false);
          return;
        }
      }

      await createSurat({
        jenis_surat: activeTab,
        kategori_id: formData.kategori_id || null,
        nomor_surat: formData.nomor_surat,
        perihal: formData.perihal,
        ringkasan: formData.ringkasan,
        pengirim_atau_tujuan: formData.pengirim_atau_tujuan,
        tanggal_surat: formData.tanggal_surat,
        file_url: fileUrl
      });

      setShowSuratModal(false);
      resetForm();
      loadData();
    } catch (err) {
      alert('Gagal menyimpan surat');
    } finally {
      setLoading(false);
    }
  };

  const resetDisposisiForm = () => {
    setEditingDisposisiId(null);
    setDisposisiForm({
      pemberi_disposisi: guru?.nama_lengkap || 'Kepala Sekolah',
      penerima_disposisi: '',
      instruksi: '',
      batas_waktu: ''
    });
    setGuruSearch('');
  };

  const handleOpenDisposisi = async (surat: Surat) => {
    setSelectedSuratForDisposisi(surat);
    resetDisposisiForm();
    
    if (surat.id) {
      const data = await getDisposisiBySuratId(surat.id);
      setDisposisiList(data);
    }
    setShowDisposisiModal(true);
  };

  const handleSubmitDisposisi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuratForDisposisi?.id) return;
    if (!disposisiForm.penerima_disposisi) {
      alert('Silakan pilih atau isi guru penerima disposisi.');
      return;
    }

    const targetGuru = guruList.find(
      g => g.nama_lengkap.toLowerCase() === disposisiForm.penerima_disposisi.toLowerCase()
    );

    try {
      if (editingDisposisiId) {
        const { error } = await supabase
          .from('disposisi_surat')
          .update({
            pemberi_disposisi: disposisiForm.pemberi_disposisi,
            penerima_disposisi: disposisiForm.penerima_disposisi,
            instruksi: disposisiForm.instruksi,
            batas_waktu: disposisiForm.batas_waktu || null,
            penerima_id: targetGuru?.id || null
          })
          .eq('id', editingDisposisiId);

        if (error) throw error;

        // Pemicu Notifikasi jika diedit dan ditugaskan ke guru tertentu
        if (targetGuru?.id) {
          await supabase.from('notifikasi').insert([
            {
              guru_id: targetGuru.id,
              judul: 'Perubahan Disposisi Surat',
              pesan: `Terdapat pembaruan disposisi surat (No: ${selectedSuratForDisposisi.nomor_surat}) dari ${disposisiForm.pemberi_disposisi}: "${disposisiForm.instruksi}"`,
              tipe: 'disposisi_surat',
              tautan: '/tugas-disposisi',
              is_read: false
            }
          ]);
        }
      } else {
        // Mode Tambah Disposisi Baru
        await createDisposisi(
          {
            surat_id: selectedSuratForDisposisi.id,
            pemberi_disposisi: disposisiForm.pemberi_disposisi,
            penerima_disposisi: disposisiForm.penerima_disposisi,
            instruksi: disposisiForm.instruksi,
            batas_waktu: disposisiForm.batas_waktu || null,
            status: 'PENDING',
            pemberi_id: user?.id || null,
            penerima_id: targetGuru?.id || null
          },
          selectedSuratForDisposisi.nomor_surat
        );
      }

      const updated = await getDisposisiBySuratId(selectedSuratForDisposisi.id);
      setDisposisiList(updated);
      resetDisposisiForm();
    } catch (err: any) {
      alert('Gagal menyimpan disposisi: ' + (err.message || 'Error tidak diketahui'));
    }
  };

  const handleEditDisposisi = (d: DisposisiSurat) => {
    setEditingDisposisiId(d.id || null);
    setDisposisiForm({
      pemberi_disposisi: d.pemberi_disposisi,
      penerima_disposisi: d.penerima_disposisi,
      instruksi: d.instruksi,
      batas_waktu: d.batas_waktu || ''
    });
    setGuruSearch(d.penerima_disposisi);
  };

  const handleDeleteDisposisi = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus instruksi disposisi ini?')) return;

    try {
      const { error } = await supabase
        .from('disposisi_surat')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (selectedSuratForDisposisi?.id) {
        const updated = await getDisposisiBySuratId(selectedSuratForDisposisi.id);
        setDisposisiList(updated);
      }
    } catch (err: any) {
      alert('Gagal menghapus disposisi: ' + (err.message || 'Error tidak diketahui'));
    }
  };

  const handleStatusDisposisi = async (id: string, status: 'PENDING' | 'PROSES' | 'SELESAI') => {
    await updateStatusDisposisi(id, status);
    if (selectedSuratForDisposisi?.id) {
      const updated = await getDisposisiBySuratId(selectedSuratForDisposisi.id);
      setDisposisiList(updated);
    }
  };

  const resetForm = () => {
    setFormData({
      kategori_id: '',
      nomor_surat: '',
      perihal: '',
      ringkasan: '',
      pengirim_atau_tujuan: '',
      tanggal_surat: new Date().toISOString().split('T')[0]
    });
    setSelectedFile(null);
  };

  const filteredSurat = suratList.filter(s => 
    s.nomor_surat.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.perihal.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.pengirim_atau_tujuan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGurus = guruList.filter(g => 
    g.nama_lengkap.toLowerCase().includes(guruSearch.toLowerCase()) ||
    (g.nip && g.nip.toLowerCase().includes(guruSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3.5 sm:p-6 space-y-4 sm:space-y-6 antialiased selection:bg-indigo-500 selection:text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/10 shadow-lg shadow-black/40">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" /> Persuratan & Digital Archiving
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Kelola dokumen, surat keluar/masuk, serta lacak disposisi.</p>
        </div>
        
        {activeTab === 'KATEGORI' ? (
          <button
            onClick={() => handleOpenKategoriModal()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-lg shadow-indigo-600/30 border border-indigo-400/20"
          >
            <Plus className="w-4 h-4" /> Tambah Kode Perihal
          </button>
        ) : (
          <button
            onClick={() => { resetForm(); setShowSuratModal(true); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-lg shadow-indigo-600/30 border border-indigo-400/20"
          >
            <Plus className="w-4 h-4" /> Tambah Surat {activeTab}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['MASUK', 'KELUAR', 'SK', 'KATEGORI'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
              activeTab === tab
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-500/10 backdrop-blur-lg'
                : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            {tab === 'MASUK' && 'Surat Masuk'}
            {tab === 'KELUAR' && 'Surat Keluar'}
            {tab === 'SK' && 'SK Sekolah'}
            {tab === 'KATEGORI' && 'Master Kode Perihal'}
          </button>
        ))}
      </div>

      {activeTab !== 'KATEGORI' && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nomor, perihal, atau instansi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs sm:text-sm bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/10">
          Memuat data...
        </div>
      ) : activeTab === 'KATEGORI' ? (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          <div className="divide-y divide-white/5">
            {kategoriList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">Belum ada Kode Perihal. Sila tambahkan data baru.</div>
            ) : (
              kategoriList.map((kat) => (
                <div key={kat.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {kat.kode}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-white/5">
                        {kat.jenis_surat}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-slate-200">{kat.nama_kategori}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenKategoriModal(kat)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition"
                      title="Edit Kode Perihal"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteKategori(kat.id)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition"
                      title="Hapus Kode Perihal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="block sm:hidden space-y-3">
            {filteredSurat.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
                Tidak ada data surat.
              </div>
            ) : (
              filteredSurat.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2.5">
                    <div>
                      <p className="font-mono text-xs font-bold text-indigo-400">{item.nomor_surat}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.pengirim_atau_tujuan}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-white/5 flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3 text-indigo-400" /> {item.tanggal_surat}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xs font-semibold text-slate-100">{item.perihal}</h2>
                    {item.ringkasan && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 bg-slate-950/40 p-2 rounded-lg border border-white/5">
                        {item.ringkasan}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {item.file_url ? (
                      <a 
                        href={item.file_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                      >
                        <ImageIcon className="w-3 h-3" /> Gambar Surat
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">Tanpa Berkas</span>
                    )}

                    <div className="flex items-center gap-1.5">
                      {activeTab === 'MASUK' && (
                        <button
                          onClick={() => handleOpenDisposisi(item)}
                          className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg text-[11px] font-medium"
                        >
                          <UserCheck className="w-3 h-3" /> Disposisi
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (confirm('Hapus surat ini?')) {
                            await deleteSurat(item.id!);
                            loadData();
                          }
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-800/50 rounded-lg border border-white/5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden sm:block bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/50 border-b border-white/10 text-slate-400 text-xs uppercase font-mono tracking-wider">
                <tr>
                  <th className="p-4">Nomor Surat</th>
                  <th className="p-4">Perihal & Ringkasan</th>
                  <th className="p-4">{activeTab === 'MASUK' ? 'Pengirim' : 'Tujuan'}</th>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Berkas</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSurat.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">Tidak ada data surat.</td>
                  </tr>
                ) : (
                  filteredSurat.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition">
                      <td className="p-4 font-medium whitespace-nowrap">
                        <div className="font-mono text-xs text-indigo-400 font-bold">{item.nomor_surat}</div>
                        {item.kategori_surat && (
                          <span className="text-[10px] text-slate-500">{item.kategori_surat.nama_kategori}</span>
                        )}
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="font-semibold text-slate-200 text-xs">{item.perihal}</div>
                        {item.ringkasan && <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.ringkasan}</div>}
                      </td>
                      <td className="p-4 text-xs text-slate-300">{item.pengirim_atau_tujuan}</td>
                      <td className="p-4 text-xs text-slate-400 whitespace-nowrap">{item.tanggal_surat}</td>
                      <td className="p-4">
                        {item.file_url ? (
                          <a 
                            href={item.file_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20"
                          >
                            <ImageIcon className="w-3 h-3" /> Lihat Gambar
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600 italic">Kosong</span>
                        )}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap space-x-2">
                        {activeTab === 'MASUK' && (
                          <button
                            onClick={() => handleOpenDisposisi(item)}
                            className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-amber-500/20 transition"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Disposisi
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (confirm('Hapus surat ini?')) {
                              await deleteSurat(item.id!);
                              loadData();
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showKategoriModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-slate-900/50">
              <h3 className="font-bold text-sm sm:text-base text-white">
                {editingKategori ? 'Edit Kode Perihal' : 'Tambah Kode Perihal Baru'}
              </h3>
              <button onClick={() => setShowKategoriModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitKategori} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kode Singkat (Misal: BK-SP1, SK-KS)</label>
                <input
                  type="text"
                  placeholder="Contoh: BK-SP1"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-indigo-400 font-mono focus:border-indigo-500 outline-none uppercase"
                  value={kategoriForm.kode}
                  onChange={(e) => setKategoriForm({ ...kategoriForm, kode: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nama Kategori Perihal</label>
                <input
                  type="text"
                  placeholder="Contoh: Surat Panggilan Orang Tua 1"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:border-indigo-500 outline-none"
                  value={kategoriForm.nama_kategori}
                  onChange={(e) => setKategoriForm({ ...kategoriForm, nama_kategori: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Berlaku Untuk Jenis Surat</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:border-indigo-500 outline-none"
                  value={kategoriForm.jenis_surat}
                  onChange={(e) => setKategoriForm({ ...kategoriForm, jenis_surat: e.target.value as JenisSurat })}
                  required
                >
                  <option value="KELUAR" className="bg-slate-900">Surat Keluar</option>
                  <option value="MASUK" className="bg-slate-900">Surat Masuk</option>
                  <option value="SK" className="bg-slate-900">Surat Keputusan (SK)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowKategoriModal(false)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-xs sm:text-sm text-slate-400 hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSuratModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-slate-900/50">
              <h3 className="font-bold text-sm sm:text-base text-white">Tambah Surat {activeTab}</h3>
              <button onClick={() => setShowSuratModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSurat} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kode Perihal / Kategori</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:border-indigo-500 outline-none"
                  value={formData.kategori_id}
                  onChange={(e) => handleKategoriChange(e.target.value)}
                  required
                >
                  <option value="" className="bg-slate-900">-- Pilih Kode Perihal --</option>
                  {kategoriList.map(k => (
                    <option key={k.id} value={k.id} className="bg-slate-900">[{k.kode}] - {k.nama_kategori}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nomor Surat {activeTab === 'MASUK' ? '(Input Manual Asli)' : '(Otomatis/Manual)'}
                </label>
                <input
                  type="text"
                  placeholder={activeTab === 'MASUK' ? 'Contoh: 045.2/102/Disdik/2026' : 'Otomatis terisi saat memilih kode'}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-indigo-400 font-mono focus:border-indigo-500 outline-none"
                  value={formData.nomor_surat}
                  onChange={(e) => setFormData({ ...formData, nomor_surat: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{activeTab === 'MASUK' ? 'Pengirim' : 'Tujuan'}</label>
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:border-indigo-500 outline-none"
                    value={formData.pengirim_atau_tujuan}
                    onChange={(e) => setFormData({ ...formData, pengirim_atau_tujuan: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tanggal Surat</label>
                  <input
                    type="date"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:border-indigo-500 outline-none"
                    value={formData.tanggal_surat}
                    onChange={(e) => setFormData({ ...formData, tanggal_surat: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Perihal</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:border-indigo-500 outline-none"
                  value={formData.perihal}
                  onChange={(e) => setFormData({ ...formData, perihal: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ringkasan Isi Surat</label>
                <textarea
                  rows={2}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:border-indigo-500 outline-none"
                  value={formData.ringkasan}
                  onChange={(e) => setFormData({ ...formData, ringkasan: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Unggah Scan/Foto Surat (Khusus Gambar: JPG, PNG, WebP)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 border border-white/10 rounded-xl p-2 bg-slate-950 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Otomatis dikompres & dikonversi ke format WebP sebelum diunggah.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSuratModal(false)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-xs sm:text-sm text-slate-400 hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30"
                >
                  {loading ? 'Mengompresi & Menyimpan...' : 'Simpan Surat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDisposisiModal && selectedSuratForDisposisi && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-slate-900/50">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">Lembar Disposisi Surat</h3>
                <p className="text-xs text-indigo-400 font-mono mt-0.5">{selectedSuratForDisposisi.nomor_surat}</p>
              </div>
              <button onClick={() => setShowDisposisiModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              <form onSubmit={handleSubmitDisposisi} className="bg-slate-950/60 p-4 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {editingDisposisiId ? 'Edit Penugasan Disposisi' : 'Beri Penugasan Baru'}
                  </h4>
                  {editingDisposisiId && (
                    <button
                      type="button"
                      onClick={resetDisposisiForm}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                    >
                      <RotateCcw className="w-3 h-3" /> Batal Edit
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative" ref={guruDropdownRef}>
                    <label className="block text-[11px] text-slate-400 mb-1">Ditugaskan Kepada</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ketik nama atau NIP guru..."
                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 pr-8 text-xs text-slate-100 outline-none focus:border-indigo-500"
                        value={guruSearch}
                        onFocus={() => setShowGuruDropdown(true)}
                        onChange={(e) => {
                          setGuruSearch(e.target.value);
                          setDisposisiForm(prev => ({ ...prev, penerima_disposisi: e.target.value }));
                          setShowGuruDropdown(true);
                        }}
                        required
                      />
                      {guruSearch ? (
                        <button
                          type="button"
                          onClick={() => {
                            setGuruSearch('');
                            setDisposisiForm(prev => ({ ...prev, penerima_disposisi: '' }));
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      )}
                    </div>

                    {showGuruDropdown && (
                      <div className="absolute z-30 w-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-white/5">
                        {filteredGurus.length === 0 ? (
                          <div className="p-3 text-xs text-slate-500 text-center">Guru tidak ditemukan</div>
                        ) : (
                          filteredGurus.map((guruItem) => (
                            <div
                              key={guruItem.id}
                              onClick={() => {
                                setDisposisiForm(prev => ({ ...prev, penerima_disposisi: guruItem.nama_lengkap }));
                                setGuruSearch(guruItem.nama_lengkap);
                                setShowGuruDropdown(false);
                              }}
                              className="p-2.5 hover:bg-indigo-600/20 cursor-pointer transition text-xs flex justify-between items-center group"
                            >
                              <div>
                                <p className="font-medium text-slate-200 group-hover:text-indigo-300">{guruItem.nama_lengkap}</p>
                                <p className="text-[10px] text-slate-500">{guruItem.nip ? `NIP: ${guruItem.nip}` : 'NIP: -'}</p>
                              </div>
                              {disposisiForm.penerima_disposisi === guruItem.nama_lengkap && (
                                <Check className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Batas Waktu (Deadline)</label>
                    <input
                      type="date"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
                      value={disposisiForm.batas_waktu}
                      onChange={(e) => setDisposisiForm({ ...disposisiForm, batas_waktu: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Instruksi / Perintah</label>
                  <input
                    type="text"
                    placeholder="Contoh: Panggil wali murid yang bersangkutan"
                    className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
                    value={disposisiForm.instruksi}
                    onChange={(e) => setDisposisiForm({ ...disposisiForm, instruksi: e.target.value })}
                    required
                  />
                </div>
                
                <div className="flex items-center gap-2 pt-1">
                  <button 
                    type="submit" 
                    className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition shadow-md shadow-amber-600/20"
                  >
                    {editingDisposisiId ? 'Perbarui Disposisi' : '+ Kirim Disposisi'}
                  </button>
                  {editingDisposisiId && (
                    <button
                      type="button"
                      onClick={resetDisposisiForm}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>

              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Penugasan & Feedback</h4>
                {disposisiList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Belum ada disposisi untuk surat ini.</p>
                ) : (
                  disposisiList.map((d) => (
                    <div 
                      key={d.id} 
                      className={`p-3 bg-slate-950/40 border rounded-xl space-y-2 transition-colors ${
                        editingDisposisiId === d.id ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-200">
                            {d.penerima_disposisi} <span className="font-normal text-slate-500">(dari {d.pemberi_disposisi})</span>
                          </p>
                          <p className="text-xs text-slate-400">{d.instruksi}</p>
                          {d.batas_waktu && <p className="text-[10px] text-rose-400">Deadline: {d.batas_waktu}</p>}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditDisposisi(d)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition"
                            title="Edit Disposisi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => d.id && handleDeleteDisposisi(d.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition"
                            title="Hapus Disposisi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintDisposisiData({ surat: selectedSuratForDisposisi, disposisi: d })}
                            className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors flex items-center gap-1 text-[11px]"
                            title="Cetak Lembar Disposisi"
                          >
                            <Printer className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Cetak</span>
                          </button>
                          <select
                            value={d.status}
                            onChange={(e) => d.id && handleStatusDisposisi(d.id, e.target.value as any)}
                            className={`text-xs font-bold border rounded-lg px-2 py-1 outline-none ${
                              d.status === 'SELESAI' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                              d.status === 'PROSES' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                              'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            <option value="PENDING" className="bg-slate-900">PENDING</option>
                            <option value="PROSES" className="bg-slate-900">PROSES</option>
                            <option value="SELESAI" className="bg-slate-900">SELESAI</option>
                          </select>
                        </div>
                      </div>

                      {d.catatan_tindak_lanjut && (
                        <div className="mt-2 text-xs bg-emerald-950/30 border border-emerald-500/20 p-2.5 rounded-lg">
                          <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mb-0.5">
                            <MessageSquare className="w-3 h-3" /> Feedback / Catatan Tindak Lanjut:
                          </p>
                          <p className="text-slate-300 text-xs italic">{d.catatan_tindak_lanjut}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {printDisposisiData && (
        <PrintDisposisi
          surat={{
            no_surat: printDisposisiData.surat.nomor_surat || '-',
            asal_surat: printDisposisiData.surat.pengirim_atau_tujuan || '-',
            tanggal_surat: printDisposisiData.surat.tanggal_surat || '-',
            perihal: printDisposisiData.surat.perihal || '-',
            sifat: 'Biasa'
          }}
          disposisi={{
            id: printDisposisiData.disposisi.id || '',
            tanggal_disposisi: printDisposisiData.disposisi.created_at 
              ? new Date(printDisposisiData.disposisi.created_at).toLocaleDateString('id-ID')
              : new Date().toLocaleDateString('id-ID'),
            penerima_disposisi: printDisposisiData.disposisi.penerima_disposisi,
            isi_disposisi: printDisposisiData.disposisi.instruksi,
            catatan: printDisposisiData.disposisi.catatan_tindak_lanjut,
            status: printDisposisiData.disposisi.status
          }}
          onClose={() => setPrintDisposisiData(null)}
        />
      )}
    </div>
  );
};

export default SuratPage;