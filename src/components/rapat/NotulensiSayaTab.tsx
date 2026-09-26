// src/components/rapat/NotulensiSayaTab.tsx
// Tab Notulensi Saya — daftar rapat tugas notulis/pemimpin + isi notulensi + cetak PDF + WA share.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, ClipboardList, Calendar, Clock, MapPin,
  Edit3, FileText, CheckCircle2, AlertCircle, Printer, Share2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ModalNotulensi } from './ModalNotulensi';
import { generateNotulensiPDF } from '@/lib/generateNotulensiPDF';
import { buildWaShareLinkNotulensi } from '@/lib/rapatNotifications';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  getJenisRapatBadge,
  formatWaktuRapat,
  isToday, isPast,
  INPUT_CLASS,
} from './shared';
import type {
  RapatWithRelations, Guru,
} from '@/types/database';

export function NotulensiSayaTab() {
  const { guru } = useAuth();
  const [list, setList] = useState<RapatWithRelations[]>([]);
  const [guruList, setGuruList] = useState<Pick<Guru, 'id' | 'nama_lengkap' | 'nip'>[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterNotulensi, setFilterNotulensi] = useState<'semua' | 'belum' | 'draft' | 'final'>('semua');
  const [search, setSearch] = useState('');

  const [notulensiTarget, setNotulensiTarget] = useState<RapatWithRelations | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);
    try {
      const [rapatRes, guruRes] = await Promise.all([
        supabase
          .from('v_rapat_lengkap')
          .select('*')
          .or(`notulis_id.eq.${guru.id},pemimpin_rapat_id.eq.${guru.id}`)
          .order('tanggal', { ascending: false }),
        supabase
          .from('gurus')
          .select('id, nama_lengkap, nip')
          .order('nama_lengkap'),
      ]);

      if (rapatRes.error) throw rapatRes.error;

      setList((rapatRes.data as RapatWithRelations[]) ?? []);
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
    return list.filter((r) => {
      if (filterNotulensi === 'belum' && r.has_notulensi) return false;
      if (filterNotulensi === 'draft' && r.notulensi_status !== 'Draft') return false;
      if (filterNotulensi === 'final' && r.notulensi_status !== 'Final') return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          r.judul.toLowerCase().includes(q) ||
          (r.nomor_rapat ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterNotulensi, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const belum = list.filter((r) => !r.has_notulensi && r.status !== 'Dibatalkan').length;
    const draft = list.filter((r) => r.notulensi_status === 'Draft').length;
    const final = list.filter((r) => r.notulensi_status === 'Final').length;
    return { total, belum, draft, final };
  }, [list]);

  // ==========================================================================
  // CETAK NOTULENSI
  // ==========================================================================
  const handleCetakNotulensi = async (rapat: RapatWithRelations) => {
    if (rapat.notulensi_status !== 'Final') {
      showToast('error', 'Notulensi harus difinalisasi dulu sebelum dicetak');
      return;
    }

    setPrintingId(rapat.id);
    try {
      const [notRes, pesertaRes] = await Promise.all([
        supabase
          .from('rapat_notulensi')
          .select('*')
          .eq('rapat_id', rapat.id)
          .single(),
        supabase
          .from('rapat_peserta')
          .select(`
            status_kehadiran,
            jabatan_dalam_rapat,
            guru:gurus!guru_id(nama_lengkap)
          `)
          .eq('rapat_id', rapat.id)
          .order('jabatan_dalam_rapat'),
      ]);

      if (notRes.error) throw notRes.error;

      const notulensi = notRes.data as any;
      if (!notulensi.verification_token) {
        showToast('error', 'Token verifikasi belum tersedia. Coba refresh halaman.');
        return;
      }

      await generateNotulensiPDF({
        nomor_rapat: rapat.nomor_rapat ?? '-',
        judul_rapat: rapat.judul,
        jenis_rapat: rapat.jenis,
        tanggal: rapat.tanggal,
        waktu_mulai: rapat.waktu_mulai,
        waktu_selesai: rapat.waktu_selesai,
        lokasi: rapat.lokasi,
        penyelenggara: rapat.penyelenggara,
        pemimpin_nama: rapat.pemimpin_nama ?? null,
        pemimpin_nip: rapat.pemimpin_nip ?? null,
        notulis_nama: rapat.notulis_nama ?? null,
        notulis_nip: rapat.notulis_nip ?? null,
        total_peserta: rapat.total_peserta ?? 0,
        total_hadir: rapat.total_hadir ?? 0,
        ringkasan: notulensi.ringkasan,
        pembahasan: notulensi.pembahasan,
        keputusan: notulensi.keputusan,
        action_items: Array.isArray(notulensi.action_items) ? notulensi.action_items : [],
        verification_token: notulensi.verification_token,
        content_hash: notulensi.content_hash,
        peserta: (pesertaRes.data ?? []).map((p: any) => ({
          nama: p.guru?.nama_lengkap ?? '-',
          jabatan: p.jabatan_dalam_rapat,
          kehadiran: p.status_kehadiran,
        })),
      });

      await logActivity({
        aksi: 'EXPORT',
        modul: AUDIT_MODUL.TODO,
        targetId: rapat.id,
        deskripsi: `Cetak notulensi: ${rapat.nomor_rapat}`,
      });

      showToast('success', 'Notulensi berhasil dicetak');
    } catch (err: any) {
      showToast('error', 'Gagal cetak: ' + (err.message || 'Error'));
    } finally {
      setPrintingId(null);
    }
  };

  // ==========================================================================
  // SHARE WA
  // ==========================================================================
  const handleShareWa = async (rapat: RapatWithRelations) => {
    try {
      const { data } = await supabase
        .from('rapat_notulensi')
        .select('ringkasan')
        .eq('rapat_id', rapat.id)
        .maybeSingle();

      const link = buildWaShareLinkNotulensi(rapat, data?.ringkasan ?? null);
      window.open(link, '_blank', 'noopener,noreferrer');

      await logActivity({
        aksi: 'VIEW',
        modul: AUDIT_MODUL.TODO,
        targetId: rapat.id,
        deskripsi: `Share notulensi via WA: ${rapat.nomor_rapat}`,
      });
    } catch (err: any) {
      showToast('error', 'Gagal share: ' + (err.message || 'Error'));
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
          <ClipboardList className="text-indigo-400" size={20} /> Notulensi Saya
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {stats.total} rapat · {stats.belum} belum diisi · {stats.draft} draft · {stats.final} final
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={FileText} label="Total Rapat" value={stats.total} color="indigo" />
        <KpiCard icon={AlertCircle} label="Belum Diisi" value={stats.belum} color="amber" />
        <KpiCard icon={Edit3} label="Draft" value={stats.draft} color="blue" />
        <KpiCard icon={CheckCircle2} label="Final" value={stats.final} color="emerald" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'semua' as const, label: `Semua (${stats.total})` },
            { key: 'belum' as const, label: `Belum Diisi (${stats.belum})` },
            { key: 'draft' as const, label: `Draft (${stats.draft})` },
            { key: 'final' as const, label: `Final (${stats.final})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilterNotulensi(t.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                filterNotulensi === t.key
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
          placeholder="Cari judul atau nomor rapat..."
          className={INPUT_CLASS}
        />
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <ClipboardList size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {list.length === 0 ? 'Belum ada rapat yang Anda ditugaskan' : 'Tidak ada yang cocok'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <NotulensiCard
              key={item.id}
              item={item}
              printingId={printingId}
              onOpenNotulensi={() => setNotulensiTarget(item)}
              onCetak={handleCetakNotulensi}
              onShare={handleShareWa}
            />
          ))}
        </div>
      )}

      {/* MODAL NOTULENSI */}
      <ModalNotulensi
        open={!!notulensiTarget}
        onClose={() => setNotulensiTarget(null)}
        onSaved={fetchAll}
        rapat={notulensiTarget}
        guruList={guruList}
        currentGuruId={guru?.id ?? ''}
      />
    </div>
  );
}

// =============================================================================
// SUB: Card
// =============================================================================
function NotulensiCard({
  item, printingId, onOpenNotulensi, onCetak, onShare,
}: {
  item: RapatWithRelations;
  printingId: string | null;
  onOpenNotulensi: () => void;
  onCetak: (item: RapatWithRelations) => void;
  onShare: (item: RapatWithRelations) => void;
}) {
  const today = isToday(item.tanggal);
  const past = isPast(item.tanggal);
  const isPrinting = printingId === item.id;

  // Status label
  let statusLabel = 'Belum Diisi';
  let statusClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  if (item.notulensi_status === 'Draft') {
    statusLabel = 'Draft';
    statusClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  } else if (item.notulensi_status === 'Final') {
    statusLabel = 'Final';
    statusClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  } else if (!past && item.status === 'Akan Datang') {
    statusLabel = 'Belum Berlangsung';
    statusClass = 'bg-slate-800 text-slate-400 border-slate-700';
  }

  return (
    <div className={`bg-slate-900 rounded-2xl border p-4 hover:border-slate-700 transition ${
      today ? 'border-indigo-500/40 bg-indigo-950/20' : 'border-slate-800'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-12 shrink-0 rounded-xl border text-center py-2 ${
          past ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
        }`}>
          <p className="text-[9px] font-bold uppercase">
            {new Date(item.tanggal + 'T00:00:00+07:00').toLocaleDateString('id-ID', { month: 'short' })}
          </p>
          <p className="text-lg font-extrabold leading-tight">
            {new Date(item.tanggal + 'T00:00:00+07:00').getDate()}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisRapatBadge(item.jenis)}`}>
                  {item.jenis}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusClass}`}>
                  {statusLabel}
                </span>
                {today && (
                  <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 animate-pulse">
                    HARI INI
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-100 mt-1.5 truncate">
                {item.judul}
              </p>
              <p className="text-[10px] font-mono text-indigo-400">
                {item.nomor_rapat ?? '-'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock size={10} /> {formatWaktuRapat(item.waktu_mulai, item.waktu_selesai)}
            </span>
            {item.lokasi && (
              <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                <MapPin size={10} /> {item.lokasi}
              </span>
            )}
            {item.total_peserta !== undefined && (
              <span>{item.total_peserta} peserta</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-800">
            {item.notulensi_status === 'Final' && (
              <>
                <button
                  onClick={() => onShare(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-[10px] font-bold transition cursor-pointer"
                  title="Share notulensi via WhatsApp"
                >
                  <Share2 size={11} /> Share WA
                </button>
                <button
                  onClick={() => onCetak(item)}
                  disabled={isPrinting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isPrinting ? (
                    <><Loader2 size={11} className="animate-spin" /> Cetak...</>
                  ) : (
                    <><Printer size={11} /> Cetak Notulensi</>
                  )}
                </button>
              </>
            )}
            <button
              onClick={onOpenNotulensi}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold transition cursor-pointer"
            >
              <Edit3 size={11} />
              {item.has_notulensi
                ? item.notulensi_status === 'Final'
                  ? 'Lihat / Edit Notulensi'
                  : 'Lanjut Isi Notulensi'
                : 'Isi Notulensi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: KPI
// =============================================================================
type KpiColor = 'indigo' | 'amber' | 'blue' | 'emerald';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
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