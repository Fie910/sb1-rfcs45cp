// src/components/arsip/WajibBacaTab.tsx
// Tab Wajib Baca — daftar dokumen yang perlu dibaca/di-acknowledge user.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Eye, CheckCircle2, AlertCircle, Clock, Download,
  FileText, Calendar, AlertTriangle, ThumbsUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ModalDetailArsip } from './ModalDetailArsip';
import {
  getKategoriBadge, formatTanggalArsip,
  daysToRetensi,
  INPUT_CLASS,
} from './shared';
import type {
  ArsipWithRelations, ArsipKategori, ArsipPembaca, Guru,
} from '@/types/database';

type PembacaWithDokumen = ArsipPembaca & {
  dokumen?: ArsipWithRelations;
};

export function WajibBacaTab() {
  const { guru } = useAuth();
  const [list, setList] = useState<PembacaWithDokumen[]>([]);
  const [kategoriList, setKategoriList] = useState<ArsipKategori[]>([]);
  const [guruList, setGuruList] = useState<Pick<Guru, 'id' | 'nama_lengkap' | 'nip'>[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<'semua' | 'belum' | 'sudah_baca' | 'acknowledged'>('semua');
  const [search, setSearch] = useState('');

  const [detailTarget, setDetailTarget] = useState<ArsipWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);
    try {
      // Ambil list pembaca (wajib_baca) untuk user ini
      const [pbRes, katRes, guruRes] = await Promise.all([
        supabase
          .from('arsip_pembaca')
          .select('*')
          .eq('guru_id', guru.id)
          .eq('wajib_baca', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('arsip_kategori')
          .select('*')
          .eq('is_aktif', true),
        supabase
          .from('gurus')
          .select('id, nama_lengkap, nip')
          .order('nama_lengkap'),
      ]);

      if (pbRes.error) throw pbRes.error;

      const pembacaList = (pbRes.data as ArsipPembaca[]) ?? [];
      const dokIds = pembacaList.map((p) => p.dokumen_id);

      // Fetch dokumen untuk pembacaList
      let dokMap = new Map<string, ArsipWithRelations>();
      if (dokIds.length > 0) {
        const { data: dokData } = await supabase
          .from('v_arsip_lengkap')
          .select('*')
          .in('id', dokIds);
        (dokData ?? []).forEach((d: any) => dokMap.set(d.id, d));
      }

      const combined: PembacaWithDokumen[] = pembacaList.map((p) => ({
        ...p,
        dokumen: dokMap.get(p.dokumen_id),
      }));

      setList(combined);
      setKategoriList((katRes.data as ArsipKategori[]) ?? []);
      setGuruList((guruRes.data as any[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [guru?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTER
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (filterStatus === 'belum' && p.sudah_baca) return false;
      if (filterStatus === 'sudah_baca' && (!p.sudah_baca || p.sudah_acknowledge)) return false;
      if (filterStatus === 'acknowledged' && !p.sudah_acknowledge) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          p.dokumen?.judul.toLowerCase().includes(q) ||
          (p.dokumen?.nomor_dokumen ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterStatus, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const belum = list.filter((p) => !p.sudah_baca).length;
    const sudahBaca = list.filter((p) => p.sudah_baca && !p.sudah_acknowledge).length;
    const acknowledged = list.filter((p) => p.sudah_acknowledge).length;
    const overdue = list.filter((p) => {
      if (p.sudah_acknowledge || !p.deadline_baca) return false;
      return daysToRetensi(p.deadline_baca) < 0;
    }).length;
    return { total, belum, sudahBaca, acknowledged, overdue };
  }, [list]);

  // ==========================================================================
  // HANDLER — Acknowledge
  // ==========================================================================
  const handleAcknowledge = async (pembaca: PembacaWithDokumen) => {
    if (pembaca.sudah_acknowledge) return;
    try {
      const { error } = await supabase
        .from('arsip_pembaca')
        .update({
          sudah_baca: true,
          sudah_acknowledge: true,
          acknowledged_at: new Date().toISOString(),
          last_viewed_at: new Date().toISOString(),
        })
        .eq('id', pembaca.id);
      if (error) throw error;

      // Log aktivitas
      await supabase.from('arsip_aktivitas').insert({
        dokumen_id: pembaca.dokumen_id,
        versi_id: pembaca.versi_id,
        guru_id: guru!.id,
        aksi: 'Acknowledge',
      });

      showToast('success', 'Terima kasih! Dokumen ditandai sudah dibaca.');
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div>
        <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
          <Eye className="text-indigo-400" size={20} /> Wajib Baca
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {stats.total} dokumen · {stats.belum} belum dibaca · {stats.acknowledged} selesai
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={FileText} label="Total" value={stats.total} color="indigo" />
        <KpiCard icon={AlertCircle} label="Belum Dibaca" value={stats.belum} color="rose" />
        <KpiCard icon={Clock} label="Sudah Dibaca" value={stats.sudahBaca} color="amber" />
        <KpiCard icon={CheckCircle2} label="Acknowledged" value={stats.acknowledged} color="emerald" />
      </div>

      {stats.overdue > 0 && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-rose-300">
              {stats.overdue} dokumen melewati deadline baca
            </p>
            <p className="text-slate-400 mt-0.5">
              Segera baca dan acknowledge dokumen tersebut.
            </p>
          </div>
        </div>
      )}

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'semua' as const, label: `Semua (${stats.total})` },
            { key: 'belum' as const, label: `Belum Dibaca (${stats.belum})` },
            { key: 'sudah_baca' as const, label: `Sudah Dibaca (${stats.sudahBaca})` },
            { key: 'acknowledged' as const, label: `Selesai (${stats.acknowledged})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilterStatus(t.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                filterStatus === t.key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari dokumen..."
          className={INPUT_CLASS}
        />
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <CheckCircle2 size={44} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {list.length === 0 ? 'Tidak ada dokumen wajib baca' : 'Semua sudah dibaca! 🎉'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <WajibBacaCard
              key={item.id}
              item={item}
              onDetail={() => item.dokumen && setDetailTarget(item.dokumen)}
              onAcknowledge={() => handleAcknowledge(item)}
            />
          ))}
        </div>
      )}

      {/* MODAL DETAIL */}
      <ModalDetailArsip
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        onRefresh={fetchAll}
        dokumen={detailTarget}
        kategoriList={kategoriList}
        guruList={guruList}
        currentGuruId={guru?.id ?? ''}
        currentGuruRole={guru?.role}
      />
    </div>
  );
}

// =============================================================================
// SUB: Card
// =============================================================================
function WajibBacaCard({
  item, onDetail, onAcknowledge,
}: {
  item: PembacaWithDokumen;
  onDetail: () => void;
  onAcknowledge: () => void;
}) {
  const doc = item.dokumen;
  if (!doc) return null;

  const deadlineDays = item.deadline_baca ? daysToRetensi(item.deadline_baca) : null;
  const isOverdue = deadlineDays !== null && deadlineDays < 0 && !item.sudah_acknowledge;

  let statusLabel = 'Belum Dibaca';
  let statusStyle = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  if (item.sudah_acknowledge) {
    statusLabel = 'Selesai';
    statusStyle = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  } else if (item.sudah_baca) {
    statusLabel = 'Sudah Dibaca';
    statusStyle = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  }

  return (
    <div className={`bg-slate-900 rounded-2xl border p-4 transition ${
      isOverdue ? 'border-rose-500/40 bg-rose-950/10' : 'border-slate-800'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
          item.sudah_acknowledge
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : isOverdue
            ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
            : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
        }`}>
          <FileText size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getKategoriBadge(doc.kategori_warna)}`}>
                  {doc.kategori_nama}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusStyle}`}>
                  {statusLabel}
                </span>
                {isOverdue && (
                  <span className="text-[9px] font-bold text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 inline-flex items-center gap-0.5 animate-pulse">
                    <AlertTriangle size={8} /> TERLAMBAT
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-100 truncate">{doc.judul}</p>
              <p className="text-[10px] font-mono text-indigo-400">{doc.nomor_dokumen ?? '-'}</p>
            </div>
          </div>

          {doc.deskripsi && (
            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{doc.deskripsi}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-slate-500">
            {item.deadline_baca && (
              <span className={`inline-flex items-center gap-1 ${isOverdue ? 'text-rose-400 font-bold' : ''}`}>
                <Calendar size={9} /> Deadline: {formatTanggalArsip(item.deadline_baca)}
              </span>
            )}
            {item.last_viewed_at && (
              <span className="inline-flex items-center gap-1">
                <Eye size={9} /> Terakhir: {new Date(item.last_viewed_at).toLocaleDateString('id-ID')}
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-800">
            <button
              onClick={onDetail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold transition cursor-pointer"
            >
              <Eye size={11} /> Baca
            </button>
            {!item.sudah_acknowledge && (
              <button
                onClick={onAcknowledge}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition cursor-pointer"
              >
                <ThumbsUp size={11} /> Saya Sudah Paham
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: KPI
// =============================================================================
type KpiColor = 'indigo' | 'emerald' | 'amber' | 'rose';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof FileText; label: string; value: number; color: KpiColor;
}) {
  const c = CM[color];
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