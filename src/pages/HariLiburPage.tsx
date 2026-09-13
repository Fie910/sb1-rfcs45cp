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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { Modal } from '@/components/Modal';
import { getTodayDateWib, getHariFromDateString, formatDateWibLong } from '@/lib/date';
import type { HariLibur } from '@/types/database';

const emptyForm = {
  tanggal: '',
  keterangan: '',
};

export function HariLiburPage() {
  const confirm = useConfirm();
  const [list, setList] = useState<HariLibur[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>(() => getTodayDateWib().slice(0, 4));

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

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

  // Derive daftar tahun dari data (untuk dropdown filter)
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    years.add(getTodayDateWib().slice(0, 4));
    list.forEach((item) => {
      if (item.tanggal) years.add(item.tanggal.slice(0, 4));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [list]);

  // Filter list
  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchYear = !selectedYear || item.tanggal.startsWith(selectedYear);
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || item.keterangan.toLowerCase().includes(q);
      return matchYear && matchSearch;
    });
  }, [list, selectedYear, searchQuery]);

  const todayStr = getTodayDateWib();

  const upcomingCount = useMemo(
    () => filteredList.filter((item) => item.tanggal >= todayStr).length,
    [filteredList, todayStr]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, tanggal: todayStr });
    setModalOpen(true);
  };

  const openEdit = (item: HariLibur) => {
    setEditingId(item.id);
    setForm({
      tanggal: item.tanggal,
      keterangan: item.keterangan,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.tanggal || !form.keterangan.trim()) {
      showToast('error', 'Tanggal dan keterangan wajib diisi');
      return;
    }

    setSaving(true);

    const payload = {
      tanggal: form.tanggal,
      keterangan: form.keterangan.trim(),
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('hari_liburs')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        showToast('success', 'Hari libur berhasil diperbarui');
      } else {
        const { error } = await supabase.from('hari_liburs').insert(payload);
        if (error) throw error;
        showToast('success', 'Hari libur berhasil ditambahkan');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        showToast('error', 'Tanggal ini sudah terdaftar sebagai hari libur');
      } else {
        showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error tidak diketahui'));
      }
    } finally {
      setSaving(false);
    }
  };

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

  const isPast = (tgl: string) => tgl < todayStr;
  const isToday = (tgl: string) => tgl === todayStr;

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
            agenda guru, dan piket pada tanggal tersebut.
          </div>
        </div>
      </div>

      {/* FILTER CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            size={16}
          />
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
              <option value="" className="bg-slate-900">
                Semua Tahun
              </option>
              {yearOptions.map((y) => (
                <option key={y} value={y} className="bg-slate-900">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-400 font-medium whitespace-nowrap">
            <span className="text-indigo-400 font-bold">{filteredList.length}</span> libur
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
      ) : filteredList.length === 0 ? (
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
          {filteredList.map((item) => {
            const past = isPast(item.tanggal);
            const today = isToday(item.tanggal);

            return (
              <div
                key={item.id}
                className={`relative group bg-slate-900 border rounded-2xl p-4 transition-all shadow-lg ${
                  today
                    ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                    : past
                    ? 'border-slate-800/60 opacity-70'
                    : 'border-slate-800 hover:border-indigo-500/40'
                }`}
              >
                {/* Tombol Aksi */}
                <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Date Display */}
                <div className="flex items-start gap-3.5 mb-3 pr-16">
                  <div
                    className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${
                      today
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : past
                        ? 'bg-slate-950 border-slate-800 text-slate-500'
                        : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider leading-none opacity-80">
                      {getHariFromDateString(item.tanggal).slice(0, 3)}
                    </span>
                    <span className="text-xl font-black leading-tight mt-0.5">
                      {item.tanggal.slice(8, 10)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-bold text-slate-100 leading-tight">
                      {new Date(`${item.tanggal}T00:00:00+07:00`).toLocaleDateString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {today && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Hari Ini
                        </span>
                      )}
                      {past && !today && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                          Lewat
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Keterangan */}
                <div className="pt-3 border-t border-slate-800/80">
                  <p
                    className={`text-sm leading-relaxed ${
                      past ? 'text-slate-400' : 'text-slate-200'
                    }`}
                  >
                    {item.keterangan}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL TAMBAH/EDIT */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Hari Libur' : 'Tambah Hari Libur'}
        size="md"
      >
        <div className="space-y-4 pt-1">
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
            {form.tanggal && (
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <CalendarCheck size={11} className="text-indigo-400" />
                {formatDateWibLong(form.tanggal)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Keterangan / Nama Libur
            </label>
            <input
              type="text"
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Contoh: Maulid Nabi Muhammad SAW"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            />
          </div>

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
              {editingId ? 'Simpan Perubahan' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}