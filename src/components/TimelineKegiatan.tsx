import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, User, Users, Clock, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getWibDateString } from '@/lib/date';
import { useAuth } from '@/context/AuthContext';
import { ModalTambahKegiatan } from './ModalTambahKegiatan';
import type { RencanaKegiatan } from '@/types/database';

const ALLOWED_ROLES = [
  'admin',
  'wakil_kepala',
  'kepala',
  'kesiswaan',
  'akademik',
  'sarpras',
  'keuangan',
  'takola',
];

export const TimelineKegiatan = () => {
  const { guru } = useAuth();
  const [kegiatan, setKegiatan] = useState<RencanaKegiatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKegiatan, setSelectedKegiatan] = useState<RencanaKegiatan | null>(null);

  // Verifikasi apakah role akun pengguna memiliki hak akses kelola
  const userRole = guru?.role?.toLowerCase() ?? '';
  const canManage = ALLOWED_ROLES.includes(userRole);

  const fetchKegiatanMendatang = useCallback(async () => {
    try {
      setLoading(true);
      const todayStr = getWibDateString();

      const { data, error } = await supabase
        .from('rencana_kegiatan')
        .select('*')
        // 1. Abaikan kegiatan yang statusnya sudah 'Selesai'
        .neq('status', 'Selesai')
        // 2. Tampilkan jika tanggal_mulai >= hari ini ATAU tanggal_selesai >= hari ini (untuk kegiatan multi-hari)
        .or(`tanggal_mulai.gte.${todayStr},tanggal_selesai.gte.${todayStr}`)
        .order('tanggal_mulai', { ascending: true })
        .limit(5);

      if (error) throw error;
      setKegiatan((data as RencanaKegiatan[]) || []);
    } catch (err) {
      console.error('Gagal mengambil data rencana kegiatan:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKegiatanMendatang();
  }, [fetchKegiatanMendatang]);

  const formatTanggal = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleTambah = () => {
    setSelectedKegiatan(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: RencanaKegiatan) => {
    setSelectedKegiatan(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus rencana kegiatan ini?')) return;

    try {
      const { error } = await supabase
        .from('rencana_kegiatan')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchKegiatanMendatang();
    } catch (err: any) {
      alert('Gagal menghapus kegiatan: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center backdrop-blur-xl flex flex-col items-center justify-center min-h-[200px]">
        <Loader2 className="animate-spin text-indigo-400 mb-2" size={28} />
        <p className="text-slate-400 text-xs font-medium">Memuat linimasa kegiatan...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl space-y-6">
      {/* HEADER KARTU */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-extrabold text-slate-100 tracking-tight">
              Rencana Kegiatan Sekolah
            </h2>
            <p className="text-xs text-slate-400">Agenda dan program kerja mendatang</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={handleTambah}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <Plus size={14} /> Tambah Kegiatan
            </button>
          )}
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
            Linimasa Agenda
          </span>
        </div>
      </div>

      {/* DAFTAR ITEM LINIMASA */}
      {kegiatan.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs font-medium">
          Belum ada rencana kegiatan mendatang.
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-800/80 ml-4 space-y-6">
          {kegiatan.map((item) => (
            <div key={item.id} className="relative pl-6 group">
              {/* Titik Indikator Garis Waktu */}
              <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-indigo-500 border-4 border-slate-900 group-hover:scale-125 transition-transform" />

              <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 md:p-5 space-y-3 hover:border-slate-700/80 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                    {item.nama_kegiatan}
                  </h3>
                  
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full w-fit max-w-full break-words shrink-0">
                      <Clock size={13} />
                      {formatTanggal(item.tanggal_mulai)}
                      {item.tanggal_selesai && item.tanggal_selesai !== item.tanggal_mulai
                        ? ` - ${formatTanggal(item.tanggal_selesai)}`
                        : ''}
                    </span>

                    {/* Tombol Edit & Hapus untuk Role Berhak */}
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          title="Edit Kegiatan"
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Hapus Kegiatan"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* DESKRIPSI */}
                {item.deskripsi && (
                  <p className="text-sm text-slate-300 leading-relaxed font-normal">
                    {item.deskripsi}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-400 font-mono pt-2 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5">
                    <User size={14} className="text-indigo-400" />
                    <span>PJ: <strong className="text-slate-200">{item.penanggung_jawab}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-teal-400" />
                    <span>Peserta: <strong className="text-slate-200">{item.peserta}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah/Edit Kegiatan */}
      {canManage && (
        <ModalTambahKegiatan
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedKegiatan(null);
          }}
          onSuccess={fetchKegiatanMendatang}
          kegiatanEdit={selectedKegiatan}
        />
      )}
    </div>
  );
};