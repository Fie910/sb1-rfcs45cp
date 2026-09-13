import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Search, 
  User, 
  Calendar,
  MessageSquare,
  Loader2,
  Filter,
  Printer,
  Paperclip
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PrintDisposisi } from '@/components/PrintDisposisi';

export interface DisposisiItem {
  id: string;
  instruksi: string;
  created_at: string;
  batas_waktu?: string;
  status: 'PENDING' | 'PROSES' | 'SELESAI';
  catatan_tindak_lanjut?: string;
  pemberi_disposisi: string;
  penerima_disposisi: string;
  surat?: {
    nomor_surat?: string;
    pengirim_atau_tujuan?: string;
    perihal?: string;
    tanggal_surat?: string;
    file_url?: string | null;
  } | null;
}

export function TugasDisposisiPage() {
  const { user, guru } = useAuth();
  const [tugasList, setTugasList] = useState<DisposisiItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter & Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal update status state
  const [selectedTask, setSelectedTask] = useState<DisposisiItem | null>(null);
  const [newStatus, setNewStatus] = useState<'PENDING' | 'PROSES' | 'SELESAI'>('PROSES');
  const [catatan, setCatatan] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal Print state
  const [printTask, setPrintTask] = useState<DisposisiItem | null>(null);

  const fetchTugas = async () => {
    try {
      setLoading(true);
      setError(null);

      const namaGuru = guru?.nama_lengkap;
      if (!namaGuru) {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('disposisi_surat')
        .select(`
          id,
          instruksi,
          created_at,
          batas_waktu,
          status,
          catatan_tindak_lanjut,
          pemberi_disposisi,
          penerima_disposisi,
          surat:surat_id (
            nomor_surat,
            pengirim_atau_tujuan,
            perihal,
            tanggal_surat,
            file_url
          )
        `)
        .eq('penerima_disposisi', namaGuru)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTugasList((data as unknown as DisposisiItem[]) || []);
    } catch (err: any) {
      console.error('Error fetching disposisi_surat:', err);
      setError(err.message || 'Gagal mengambil data tugas disposisi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTugas();
  }, [guru?.nama_lengkap, user]);

  const handleUpdateTugas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      setIsSubmitting(true);

      const { error: updateError } = await supabase
        .from('disposisi_surat')
        .update({
          status: newStatus,
          catatan_tindak_lanjut: catatan
        })
        .eq('id', selectedTask.id);

      if (updateError) throw updateError;

      setSelectedTask(null);
      setCatatan('');
      fetchTugas();
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Gagal memperbarui status disposisi: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTugas = tugasList.filter((item) => {
    const matchesSearch = 
      item.instruksi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.surat?.perihal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.surat?.nomor_surat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.surat?.pengirim_atau_tujuan?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SELESAI':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Selesai
          </span>
        );
      case 'PROSES':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Diproses
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <AlertCircle className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tugas Disposisi Surat</h1>
        <p className="text-sm text-slate-400">
          Daftar instruksi dan disposisi surat yang ditujukan kepada Anda.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari perihal, pengirim, instruksi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
            {['ALL', 'PENDING', 'PROSES', 'SELESAI'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'ALL' ? 'Semua' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredTugas.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 rounded-xl border border-slate-800">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Tidak ada tugas disposisi ditemukan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTugas.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                      {item.surat?.nomor_surat || 'Tanpa Nomor'}
                    </span>
                    <h3 className="font-semibold text-slate-100 text-base mt-1 line-clamp-1">
                      {item.surat?.perihal || 'Tidak ada perihal'}
                    </h3>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                <div className="text-xs space-y-1 bg-slate-950/50 p-3 rounded-lg border border-slate-800/60">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Send className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pengirim/Tujuan Surat:</span>
                    <strong className="text-slate-300 font-medium">
                      {item.surat?.pengirim_atau_tujuan || '-'}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Dari:</span>
                    <strong className="text-slate-300 font-medium">{item.pemberi_disposisi}</strong>
                  </div>
                  {item.batas_waktu && (
                    <div className="flex items-center gap-2 text-amber-400/90">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Batas Waktu:</span>
                      <strong>{new Date(item.batas_waktu).toLocaleDateString('id-ID')}</strong>
                    </div>
                  )}
                </div>

                {/* Tombol Lihat Berkas Surat */}
                {item.surat?.file_url ? (
                  <div>
                    <a
                      href={item.surat.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-colors font-medium"
                    >
                      <Paperclip className="w-3.5 h-3.5" /> Lihat Berkas / Scan Surat
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Berkas surat tidak dilampirkan</p>
                )}

                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Instruksi Disposisi:</p>
                  <p className="text-sm text-slate-200 bg-slate-800/40 p-3 rounded-lg border border-slate-800 italic">
                    "{item.instruksi}"
                  </p>
                </div>

                {item.catatan_tindak_lanjut && (
                  <div>
                    <p className="text-xs font-medium text-emerald-400 flex items-center gap-1 mb-1">
                      <MessageSquare className="w-3.5 h-3.5" /> Catatan Tindak Lanjut:
                    </p>
                    <p className="text-xs text-slate-300 bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded-lg">
                      {item.catatan_tindak_lanjut}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex justify-between items-center">
                <button
                  onClick={() => setPrintTask(item)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700"
                  title="Cetak Lembar Disposisi"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  Cetak
                </button>
                <button
                  onClick={() => {
                    setSelectedTask(item);
                    setNewStatus(item.status);
                    setCatatan(item.catatan_tindak_lanjut || '');
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  Update Status / Catatan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Update Status */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Tindak Lanjut Disposisi</h3>
            
            <form onSubmit={handleUpdateTugas} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Status Pekerjaan
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="PROSES">PROSES</option>
                  <option value="SELESAI">SELESAI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Catatan / Laporan Tindak Lanjut
                </label>
                <textarea
                  rows={4}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Tuliskan catatan tindak lanjut..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Komponen Cetak Disposisi */}
      {printTask && (
        <PrintDisposisi
          surat={{
            no_surat: printTask.surat?.nomor_surat || '-',
            asal_surat: printTask.surat?.pengirim_atau_tujuan || '-',
            tanggal_surat: printTask.surat?.tanggal_surat || '-',
            perihal: printTask.surat?.perihal || '-',
            sifat: 'Biasa'
          }}
          disposisi={{
            id: printTask.id,
            tanggal_disposisi: new Date(printTask.created_at).toLocaleDateString('id-ID'),
            penerima_disposisi: printTask.penerima_disposisi,
            isi_disposisi: printTask.instruksi,
            catatan: printTask.catatan_tindak_lanjut,
            status: printTask.status
          }}
          onClose={() => setPrintTask(null)}
        />
      )}
    </div>
  );
}

export default TugasDisposisiPage;