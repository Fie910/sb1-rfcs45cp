// src/pages/HariLiburPage.tsx
import { useEffect, useState, useMemo } from 'react';
import {
  CalendarX,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Filter,
  Calendar,
  Info,
  CalendarCheck,
  CalendarRange,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Layers,
  PlusCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { Modal } from '@/components/Modal';
import { getTodayDateWib, getHariFromDateString, formatDateWibLong } from '@/utils/date';
import type { HariLibur } from '@/types/database';

// =============================================================================
// HELPERS
// =============================================================================
type FormMode = 'single' | 'range';

const emptyForm = {
  mode: 'single' as FormMode,
  tanggal: '',
  tanggal_mulai: '',
  tanggal_selesai: '',
  keterangan: '',
};

/** Generate semua tanggal YYYY-MM-DD dari rentang */
function generateDateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/** Jumlah hari dalam rentang (inklusif) */
function daysBetween(startStr: string, endStr: string): number {
  const [ay, am, ad] = startStr.split('-').map(Number);
  const [by, bm, bd] = endStr.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

/** Tambah n hari ke tanggal YYYY-MM-DD */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  cur.setUTCDate(cur.getUTCDate() + n);
  return cur.toISOString().slice(0, 10);
}

function isNextDay(a: string, b: string): boolean {
  return addDays(a, 1) === b;
}

/** Format rentang ringkas: "22 Des 2026 — 2 Jan 2027" */
function formatRange(start: string, end: string): string {
  if (start === end) return formatDateWibLong(start);
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return `${fmt(start)} — ${fmt(end)}`;
}

// =============================================================================
// GROUPING
// =============================================================================
type LiburGroup = {
  key: string;
  keterangan: string;
  items: HariLibur[]; // terurut naik berdasarkan tanggal
  start: string;
  end: string;
  count: number;
};

/**
 * Group by (keterangan + tanggal berurutan).
 * Contoh: [1 Jan A, 2 Jan A, 4 Jan A] → 2 grup: [1-2 Jan A], [4 Jan A]
 */
function groupLibur(list: HariLibur[]): LiburGroup[] {
  const sorted = [...list].sort((a, b) => {
    const k = a.keterangan.localeCompare(b.keterangan);
    if (k !== 0) return k;
    return a.tanggal.localeCompare(b.tanggal);
  });

  const groups: LiburGroup[] = [];
  let current: LiburGroup | null = null;

  for (const item of sorted) {
    if (
      current &&
      current.keterangan === item.keterangan &&
      isNextDay(current.end, item.tanggal)
    ) {
      current.items.push(item);
      current.end = item.tanggal;
      current.count += 1;
    } else {
      if (current) groups.push(current);
      current = {
        key: `${item.keterangan}::${item.tanggal}`,
        keterangan: item.keterangan,
        items: [item],
        start: item.tanggal,
        end: item.tanggal,
        count: 1,
      };
    }
  }
  if (current) groups.push(current);

  return groups.sort((a, b) => a.start.localeCompare(b.start));
}

// =============================================================================
// PAGE
// =============================================================================
export function HariLiburPage() {
  const confirm = useConfirm();
  const [list, setList] = useState<HariLibur[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>(() => getTodayDateWib().slice(0, 4));

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  // Grup yang sedang di-expand
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const todayStr = getTodayDateWib();

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hari_liburs')
      .select('*')
      .order('tanggal', { ascending: true });

    if (error) {
      showToast('error', 'Gagal memuat data hari libur: ' + error.message);
    } else {
      setList((data as HariLibur[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ==========================================================================
  // DERIVED
  // ==========================================================================
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    years.add(todayStr.slice(0, 4));
    list.forEach((item) => {
      if (item.tanggal) years.add(item.tanggal.slice(0, 4));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [list, todayStr]);

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchYear = !selectedYear || item.tanggal.startsWith(selectedYear);
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || item.keterangan.toLowerCase().includes(q);
      return matchYear && matchSearch;
    });
  }, [list, selectedYear, searchQuery]);

  const groupedList = useMemo(() => groupLibur(filteredList), [filteredList]);

  const upcomingCount = useMemo(
    () => filteredList.filter((item) => item.tanggal >= todayStr).length,
    [filteredList, todayStr]
  );

  // ==========================================================================
  // FORM HANDLERS
  // ==========================================================================
  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      mode: 'single',
      tanggal: todayStr,
      tanggal_mulai: todayStr,
      tanggal_selesai: todayStr,
    });
    setModalOpen(true);
  };

  const openEdit = (item: HariLibur) => {
    setEditingId(item.id);
    setForm({
      mode: 'single',
      tanggal: item.tanggal,
      tanggal_mulai: item.tanggal,
      tanggal_selesai: item.tanggal,
      keterangan: item.keterangan,
    });
    setModalOpen(true);
  };

  /** Extend grup yang sudah ada: prefill keterangan + start = end+1 */
  const openAddToGroup = (group: LiburGroup) => {
    setEditingId(null);
    const nextDay = addDays(group.end, 1);
    setForm({
      ...emptyForm,
      mode: 'range',
      tanggal_mulai: nextDay,
      tanggal_selesai: nextDay,
      keterangan: group.keterangan,
    });
    setModalOpen(true);
  };

  const setMode = (mode: FormMode) => {
    if (mode === 'range' && form.mode === 'single' && form.tanggal) {
      setForm({ ...form, mode, tanggal_mulai: form.tanggal, tanggal_selesai: form.tanggal });
    } else if (mode === 'single' && form.mode === 'range' && form.tanggal_mulai) {
      setForm({ ...form, mode, tanggal: form.tanggal_mulai });
    } else {
      setForm({ ...form, mode });
    }
  };

  const handleSave = async () => {
    const isRange = form.mode === 'range' && !editingId;

    if (!form.keterangan.trim()) {
      showToast('error', 'Keterangan wajib diisi');
      return;
    }

    if (isRange) {
      if (!form.tanggal_mulai || !form.tanggal_selesai) {
        showToast('error', 'Tanggal mulai dan selesai wajib diisi');
        return;
      }
      if (form.tanggal_selesai < form.tanggal_mulai) {
        showToast('error', 'Tanggal selesai tidak boleh sebelum tanggal mulai');
        return;
      }
      const total = daysBetween(form.tanggal_mulai, form.tanggal_selesai);
      if (total > 90) {
        showToast('error', 'Rentang maksimal 90 hari per input');
        return;
      }
    } else {
      if (!form.tanggal) {
        showToast('error', 'Tanggal wajib diisi');
        return;
      }
    }

    setSaving(true);
    try {
      // ---- EDIT (selalu single) ----
      if (editingId) {
        const { error } = await supabase
          .from('hari_liburs')
          .update({ tanggal: form.tanggal, keterangan: form.keterangan.trim() })
          .eq('id', editingId);
        if (error) throw error;
        showToast('success', 'Hari libur berhasil diperbarui');
      }
      // ---- RANGE ADD ----
      else if (isRange) {
        const allDates = generateDateRange(form.tanggal_mulai, form.tanggal_selesai);

        // Cek tanggal yang sudah ada
        const { data: existing, error: qErr } = await supabase
          .from('hari_liburs')
          .select('tanggal')
          .in('tanggal', allDates);
        if (qErr) throw qErr;

        const existingSet = new Set((existing || []).map((r: { tanggal: string }) => r.tanggal));
        const newDates = allDates.filter((d) => !existingSet.has(d));

        if (newDates.length === 0) {
          showToast('error', 'Semua tanggal dalam rentang ini sudah terdaftar');
          return;
        }

        const payload = newDates.map((tanggal) => ({
          tanggal,
          keterangan: form.keterangan.trim(),
        }));

        const { error } = await supabase.from('hari_liburs').insert(payload);
        if (error) throw error;

        if (existingSet.size > 0) {
          showToast(
            'success',
            `${newDates.length} hari ditambahkan, ${existingSet.size} tanggal dilewati (sudah ada)`
          );
        } else {
          showToast('success', `${newDates.length} hari libur berhasil ditambahkan`);
        }
      }
      // ---- SINGLE ADD ----
      else {
        const { error } = await supabase
          .from('hari_liburs')
          .insert({ tanggal: form.tanggal, keterangan: form.keterangan.trim() });
        if (error) {
          if (error.code === '23505') {
            showToast('error', 'Tanggal ini sudah terdaftar sebagai hari libur');
            return;
          }
          throw error;
        }
        showToast('success', 'Hari libur berhasil ditambahkan');
      }

      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err?.code === '23505') {
        showToast('error', 'Ada tanggal yang sudah terdaftar');
      } else {
        showToast('error', 'Gagal menyimpan: ' + (err?.message || 'Error tidak diketahui'));
      }
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // DELETE
  // ==========================================================================
  const handleDelete = async (item: HariLibur) => {
    const ok = await confirm({
      title: 'Hapus Hari Libur',
      message: `Hapus hari libur "${item.keterangan}" pada ${formatDateWibLong(item.tanggal)}?`,
      variant: 'danger',
      confirmLabel: 'Ya, Hapus',
    });
    if (!ok) return;

    try {
      const { error } = await supabase.from('hari_liburs').delete().eq('id', item.id);
      if (error) throw error;
      showToast('success', 'Hari libur berhasil dihapus');
      fetchData();
    } catch (err: any) {
      showToast('error', 'Gagal menghapus: ' + (err.message || 'Error tidak diketahui'));
    }
  };

  const handleDeleteGroup = async (group: LiburGroup) => {
    const ok = await confirm({
      title: 'Hapus Semua Hari Libur',
      message: `Hapus ${group.count} hari libur "${group.keterangan}"?`,
      variant: 'danger',
      confirmLabel: `Ya, Hapus ${group.count} Hari`,
    });
    if (!ok) return;

    try {
      const ids = group.items.map((i) => i.id);
      const { error } = await supabase.from('hari_liburs').delete().in('id', ids);
      if (error) throw error;
      showToast('success', `${group.count} hari libur berhasil dihapus`);
      fetchData();
    } catch (err: any) {
      showToast('error', 'Gagal menghapus: ' + (err.message || 'Error tidak diketahui'));
    }
  };

  // ==========================================================================
  // UI HELPERS
  // ==========================================================================
  const toggleExpand = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const previewDays =
    form.mode === 'range' &&
    form.tanggal_mulai &&
    form.tanggal_selesai &&
    form.tanggal_selesai >= form.tanggal_mulai
      ? daysBetween(form.tanggal_mulai, form.tanggal_selesai)
      : 0;

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <CalendarX className="text-indigo-400" size={28} />
            Hari Libur Sekolah
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Kelola daftar hari libur nasional, cuti bersama, dan agenda libur sekolah
          </p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer shrink-0"
        >
          <Plus size={16} />
          Tambah Hari Libur
        </button>
      </div>

      {/* INFO BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Info size={18} />
          </div>
          <div className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Hari libur yang terdaftar di sini akan otomatis memblokir pengisian presensi,
            agenda guru, dan piket pada tanggal tersebut. Gunakan <b className="text-indigo-400">mode Rentang</b> untuk
            input libur multi-hari sekaligus (mis. Libur Semester).
          </div>
        </div>
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari keterangan libur..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
            <Filter size={14} className="text-slate-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">Semua Tahun</option>
              {yearOptions.map((y) => (
                <option key={y} value={y} className="bg-slate-900">{y}</option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-400 font-medium whitespace-nowrap">
            <span className="text-indigo-400 font-bold">{filteredList.length}</span> hari
            {' • '}
            <span className="text-slate-500 font-bold">{groupedList.length}</span> entri
            {' • '}
            <span className="text-emerald-400 font-bold">{upcomingCount}</span> mendatang
          </div>
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="animate-spin text-indigo-400 mb-2" size={32} />
          <p className="text-xs text-slate-400 font-medium">Memuat data hari libur...</p>
        </div>
      ) : groupedList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl text-center py-20 px-6">
          <CalendarX size={40} className="mx-auto mb-3 opacity-40 text-slate-500" />
          <p className="text-slate-400 text-base font-medium">
            {searchQuery || selectedYear
              ? 'Tidak ada hari libur yang cocok dengan filter'
              : 'Belum ada hari libur yang terdaftar'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Klik "Tambah Hari Libur" untuk mulai menambahkan
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupedList.map((group) => {
            const hasRange = group.count > 1;
            const isExpanded = expandedGroups.has(group.key);
            const allPast = group.end < todayStr;
            const isOngoing = group.start <= todayStr && group.end >= todayStr;

            return (
              <div
                key={group.key}
                className={`relative group bg-slate-900 border rounded-2xl p-4 transition-all shadow-lg ${
                  isOngoing
                    ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                    : allPast
                    ? 'border-slate-800/60 opacity-70'
                    : 'border-slate-800 hover:border-indigo-500/40'
                }`}
              >
                {/* Top Actions */}
                <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  {hasRange ? (
                    <>
                      <button
                        onClick={() => openAddToGroup(group)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                        title="Tambah tanggal ke grup ini"
                      >
                        <PlusCircle size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title={`Hapus semua ${group.count} hari`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openEdit(group.items[0])}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(group.items[0])}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>

                {/* Date Display */}
                <div className="flex items-start gap-3.5 mb-3 pr-20">
                  <div
                    className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${
                      isOngoing
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : allPast
                        ? 'bg-slate-950 border-slate-800 text-slate-500'
                        : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider leading-none opacity-80">
                      {getHariFromDateString(group.start).slice(0, 3)}
                    </span>
                    <span className="text-xl font-black leading-tight mt-0.5">
                      {group.start.slice(8, 10)}
                    </span>
                    {hasRange && (
                      <span className="text-[8px] font-bold opacity-70 leading-none">
                        s.d. {group.end.slice(8, 10)}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-bold text-slate-100 leading-tight">
                      {hasRange
                        ? formatRange(group.start, group.end)
                        : new Date(`${group.start}T00:00:00+07:00`).toLocaleDateString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            month: 'long',
                            year: 'numeric',
                          })}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {hasRange && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-flex items-center gap-1">
                          <Layers size={9} /> {group.count} hari
                        </span>
                      )}
                      {isOngoing && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Hari Ini
                        </span>
                      )}
                      {allPast && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                          Lewat
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Keterangan */}
                <div className="pt-3 border-t border-slate-800/80">
                  <p className={`text-sm leading-relaxed ${allPast ? 'text-slate-400' : 'text-slate-200'}`}>
                    {group.keterangan}
                  </p>
                </div>

                {/* Expand toggle (hanya untuk grup multi-hari) */}
                {hasRange && (
                  <button
                    onClick={() => toggleExpand(group.key)}
                    className="mt-3 w-full flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400 hover:text-indigo-300 py-1.5 rounded-lg hover:bg-slate-800/50 transition cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp size={12} /> Sembunyikan {group.count} tanggal
                      </>
                    ) : (
                      <>
                        <ChevronDown size={12} /> Lihat {group.count} tanggal
                      </>
                    )}
                  </button>
                )}

                {/* Expanded per-date list */}
                {hasRange && isExpanded && (
                  <div className="mt-2 space-y-1 pt-2 border-t border-slate-800/60">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-slate-950/60"
                      >
                        <span className="text-slate-300 font-medium">
                          {getHariFromDateString(item.tanggal)}, {formatDateWibLong(item.tanggal)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer"
                            title="Edit tanggal ini"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Hapus tanggal ini"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL TAMBAH/EDIT */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingId
            ? 'Edit Hari Libur'
            : form.mode === 'range'
            ? 'Tambah Rentang Hari Libur'
            : 'Tambah Hari Libur'
        }
        size="md"
      >
        <div className="space-y-4 pt-1">
          {/* Mode Toggle (hanya saat tambah, tidak saat edit) */}
          {!editingId && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  form.mode === 'single'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar size={13} />
                Satu Tanggal
              </button>
              <button
                type="button"
                onClick={() => setMode('range')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  form.mode === 'range'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CalendarRange size={13} />
                Rentang Tanggal
              </button>
            </div>
          )}

          {/* Tanggal Input */}
          {form.mode === 'range' && !editingId ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                  <CalendarDays size={13} /> Mulai
                </label>
                <input
                  type="date"
                  value={form.tanggal_mulai}
                  onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                  <CalendarDays size={13} /> Selesai
                </label>
                <input
                  type="date"
                  value={form.tanggal_selesai}
                  min={form.tanggal_mulai}
                  onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Calendar size={13} /> Tanggal Libur
              </label>
              <input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all cursor-pointer"
              />
            </div>
          )}

          {/* Preview */}
          {form.mode === 'range' && !editingId && previewDays > 0 && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
              <p className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Layers size={12} />
                Akan membuat <span className="text-indigo-200">{previewDays} hari</span> libur
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {formatRange(form.tanggal_mulai, form.tanggal_selesai)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 italic">
                Tanggal yang sudah terdaftar akan otomatis dilewati
              </p>
            </div>
          )}

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Keterangan / Nama Libur
            </label>
            <input
              type="text"
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Contoh: Libur Semester Ganjil / Maulid Nabi"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            />
            {form.mode === 'single' && form.tanggal && (
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <CalendarCheck size={11} className="text-indigo-400" />
                {formatDateWibLong(form.tanggal)}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 mt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-medium text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editingId
                ? 'Simpan Perubahan'
                : form.mode === 'range' && previewDays > 1
                ? `Simpan ${previewDays} Hari`
                : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}