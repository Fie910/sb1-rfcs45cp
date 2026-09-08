import React, { useEffect, useState } from 'react';
import { Calendar, User, Users, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getWibDateString } from '@/lib/date';
import type { RencanaKegiatan } from '@/types/database';

export const TimelineKegiatan = () => {
  const [kegiatan, setKegiatan] = useState<RencanaKegiatan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKegiatanMendatang();
  }, []);

  const fetchKegiatanMendatang = async () => {
    try {
      setLoading(true);
      // Mengambil tanggal hari ini berbasis WIB (YYYY-MM-DD)
      const todayStr = getWibDateString();

      const { data, error } = await supabase
        .from('rencana_kegiatan')
        .select('*')
        .gte('tanggal_mulai', todayStr)
        .order('tanggal_mulai', { ascending: true })
        .limit(5);

      if (error) throw error;
      setKegiatan((data as RencanaKegiatan[]) || []);
    } catch (err) {
      console.error('Gagal mengambil data rencana kegiatan:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTanggal = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
          Linimasa Agenda
        </span>
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

              <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 space-y-2 hover:border-slate-700/80 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                    {item.nama_kegiatan}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full w-fit max-w-full break-words">
                    <Clock size={12} />
                    {formatTanggal(item.tanggal_mulai)}
                    {item.tanggal_selesai && item.tanggal_selesai !== item.tanggal_mulai
                      ? ` - ${formatTanggal(item.tanggal_selesai)}`
                      : ''}
                  </span>
                </div>

                {item.deskripsi && (
                  <p className="text-xs text-slate-400 leading-relaxed">{item.deskripsi}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono pt-1 border-t border-slate-800/40">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-indigo-400" />
                    <span>PJ: <strong className="text-slate-200">{item.penanggung_jawab}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-teal-400" />
                    <span>Peserta: <strong className="text-slate-200">{item.peserta}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};