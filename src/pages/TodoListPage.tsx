import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Circle,
  Clock,
  Plus,
  Filter,
  Loader2,
  Trash2,
  Calendar,
  UserCheck,
  AlertCircle,
  CheckCircle,
  Tag,
  Briefcase,
  RefreshCw,
  ListTodo,
  Power,
  Repeat,
  Pencil,
  XCircle,
  History,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Search,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/Modal';
import { ModalTemplateRutin } from '@/components/ModalTemplateRutin';
import type { PriorityType, StatusType, TipeRutin, TodoItem, TodoTemplate, SopLog } from '@/types/TodoTemplate';
export type { PriorityType, StatusType, TipeRutin, TodoItem, TodoTemplate, SopLog } from '@/types/TodoTemplate';

const NAMA_HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

// Helper Tanggal WIB (Asia/Jakarta)
const getWIBTodayString = () => {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
};

const getWIBFirstDayOfMonthString = () => {
  const todayStr = getWIBTodayString();
  const [year, month] = todayStr.split('-');
  return `${year}-${month}-01`;
};

const formatTanggal = (dateString: string | null) => {
  if (!dateString) return null;
  const rawDate = dateString.split('T')[0];
  const [year, month, day] = rawDate.split('-');
  return `${day}/${month}/${year}`;
};

export function TodoListPage() {
  const { guru, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'tugas' | 'sop' | 'riwayat' | 'controlling'>('tugas');

  // Validasi Role Admin / Wakil Kepala
  const isAdminOrWakil = useMemo(() => {
    if (!guru) return false;
    const jabatanLower = (guru.jabatan || '').toLowerCase();
    const roleLower = (guru.role || '').toLowerCase();
    return (
      jabatanLower.includes('admin') ||
      jabatanLower.includes('wakil') ||
      jabatanLower.includes('kepala') ||
      roleLower.includes('admin') ||
      roleLower.includes('wakil_kepala')
    );
  }, [guru]);

  // Data States
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [templates, setTemplates] = useState<TodoTemplate[]>([]);
  const [sopLogs, setSopLogs] = useState<SopLog[]>([]);
  const [todaySopLogs, setTodaySopLogs] = useState<Record<string, { id: string; status: 'Selesai' | 'Terlewat' }>>({});
  const [guruList, setGuruList] = useState<{ id: string; nama_lengkap: string }[]>([]);

  const namaDivisi = guru?.divisis?.nama_divisi || '';
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter States
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('Semua');
  const [sopPetugasFilter, setSopPetugasFilter] = useState<string>('');
  
  // Filter Tab Riwayat
  const [riwayatStartDate, setRiwayatStartDate] = useState<string>(getWIBFirstDayOfMonthString());
  const [riwayatEndDate, setRiwayatEndDate] = useState<string>(getWIBTodayString());
  const [riwayatPetugasFilter, setRiwayatPetugasFilter] = useState<string>('Semua');

  // Filter Tab Controlling
  const [controllingSearch, setControllingSearch] = useState<string>('');

  // Modal & Edit States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);

  const [isModalRutinOpen, setIsModalRutinOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TodoTemplate | null>(null);

  const [formData, setFormData] = useState({
    judul: '',
    deskripsi: '',
    prioritas: 'Sedang' as PriorityType,
    tanggal_tenggat: '',
    ditugaskan_ke_id: '',
  });

  // Default SOP Filter ke ID Pengguna
  useEffect(() => {
    if (guru?.id && !sopPetugasFilter) {
      setSopPetugasFilter(guru.id);
    }
  }, [guru?.id, sopPetugasFilter]);

  // Fetch daftar tugas
  const fetchTodos = useCallback(async () => {
    if (!guru?.divisi_id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('todos')
        .select(`
          *,
          dibuat_oleh:dibuat_oleh_id (nama_lengkap),
          ditugaskan_ke:ditugaskan_ke_id (nama_lengkap)
        `)
        .eq('divisi_id', guru.divisi_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos((data as TodoItem[]) || []);
    } catch (err) {
      console.error('Gagal mengambil data tugas:', err);
    } finally {
      setLoading(false);
    }
  }, [guru?.divisi_id]);

  // Fetch daftar template SOP rutin
  const fetchTemplates = useCallback(async () => {
    if (!guru?.divisi_id) return;
    try {
      const { data, error } = await supabase
        .from('todo_templates')
        .select(`
          *,
          ditugaskan_ke:ditugaskan_ke_id (nama_lengkap)
        `)
        .eq('divisi_id', guru.divisi_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data as TodoTemplate[]) || []);
    } catch (err) {
      console.error('Gagal mengambil template SOP:', err);
    }
  }, [guru?.divisi_id]);

  // Fetch riwayat pengerjaan SOP
  const fetchSopLogs = useCallback(async () => {
    if (!guru?.divisi_id) return;
    try {
      const { data, error } = await supabase
        .from('sop_logs')
        .select(`
          *,
          dikerjakan_oleh:dikerjakan_oleh_id (nama_lengkap),
          template:template_id (
            judul,
            ditugaskan_ke_id,
            ditugaskan_ke:ditugaskan_ke_id (nama_lengkap)
          )
        `)
        .eq('divisi_id', guru.divisi_id)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setSopLogs((data as SopLog[]) || []);
    } catch (err) {
      console.error('Gagal mengambil riwayat SOP:', err);
    }
  }, [guru?.divisi_id]);

  // Fetch log SOP khusus hari ini (WIB)
  const fetchTodaySopLogs = useCallback(async () => {
    if (!guru?.divisi_id) return;
    const today = getWIBTodayString();
    try {
      const { data, error } = await supabase
        .from('sop_logs')
        .select('id, template_id, status')
        .eq('divisi_id', guru.divisi_id)
        .eq('tanggal', today);

      if (error) throw error;
      const logMap: Record<string, { id: string; status: 'Selesai' | 'Terlewat' }> = {};
      data?.forEach((log) => {
        logMap[log.template_id] = { id: log.id, status: log.status as 'Selesai' | 'Terlewat' };
      });
      setTodaySopLogs(logMap);
    } catch (err) {
      console.error('Gagal mengambil log SOP hari ini:', err);
    }
  }, [guru?.divisi_id]);

  // Fetch daftar anggota divisi
  const fetchDivisiAndGurus = useCallback(async () => {
    if (!guru?.divisi_id) return;
    try {
      const { data, error } = await supabase
        .from('gurus')
        .select('id, nama_lengkap')
        .eq('divisi_id', guru.divisi_id)
        .order('nama_lengkap');

      if (error) throw error;
      setGuruList(data || []);
    } catch (err) {
      console.error('Gagal memuat daftar guru:', err);
    }
  }, [guru?.divisi_id]);

  useEffect(() => {
    if (!authLoading) {
      fetchTodos();
      fetchTemplates();
      fetchSopLogs();
      fetchTodaySopLogs();
      fetchDivisiAndGurus();
    }
  }, [authLoading, fetchTodos, fetchTemplates, fetchSopLogs, fetchTodaySopLogs, fetchDivisiAndGurus]);

  // Modals & Save Handlers
  const handleOpenCreateModal = () => {
    setEditingTodo(null);
    setFormData({
      judul: '',
      deskripsi: '',
      prioritas: 'Sedang',
      tanggal_tenggat: '',
      ditugaskan_ke_id: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (todo: TodoItem) => {
    setEditingTodo(todo);
    setFormData({
      judul: todo.judul,
      deskripsi: todo.deskripsi || '',
      prioritas: todo.prioritas,
      tanggal_tenggat: todo.tanggal_tenggat ? todo.tanggal_tenggat.split('T')[0] : '',
      ditugaskan_ke_id: todo.ditugaskan_ke_id || '',
    });
    setIsModalOpen(true);
  };

  const handleOpenCreateRutinModal = () => {
    setEditingTemplate(null);
    setIsModalRutinOpen(true);
  };

  const handleOpenEditTemplateModal = (template: TodoTemplate) => {
    setEditingTemplate(template);
    setIsModalRutinOpen(true);
  };

  const handleSaveTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.judul.trim() || !guru || !guru.divisi_id) return;

    try {
      setIsSubmitting(true);
      if (editingTodo) {
        const { error } = await supabase
          .from('todos')
          .update({
            judul: formData.judul,
            deskripsi: formData.deskripsi || null,
            prioritas: formData.prioritas,
            tanggal_tenggat: formData.tanggal_tenggat || null,
            ditugaskan_ke_id: formData.ditugaskan_ke_id || null,
          })
          .eq('id', editingTodo.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('todos').insert({
          judul: formData.judul,
          deskripsi: formData.deskripsi || null,
          divisi_id: guru.divisi_id,
          prioritas: formData.prioritas,
          tanggal_tenggat: formData.tanggal_tenggat || null,
          dibuat_oleh_id: guru.id,
          ditugaskan_ke_id: formData.ditugaskan_ke_id || null,
          status: 'Belum Selesai',
        });

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingTodo(null);
      setFormData({
        judul: '',
        deskripsi: '',
        prioritas: 'Sedang',
        tanggal_tenggat: '',
        ditugaskan_ke_id: '',
      });
      fetchTodos();
    } catch (err) {
      console.error('Gagal menyimpan tugas:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTemplateActive = async (templateId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('todo_templates')
        .update({ is_active: !currentStatus })
        .eq('id', templateId);

      if (error) throw error;
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, is_active: !currentStatus } : t))
      );
    } catch (err) {
      console.error('Gagal merubah status SOP:', err);
    }
  };

  const handleSingleToggleSop = async (templateId: string) => {
    if (!guru?.divisi_id || !guru?.id) return;
    const today = getWIBTodayString();
    const existingLog = todaySopLogs[templateId];

    try {
      if (existingLog) {
        const { error } = await supabase
          .from('sop_logs')
          .delete()
          .eq('id', existingLog.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sop_logs')
          .insert({
            template_id: templateId,
            divisi_id: guru.divisi_id,
            dikerjakan_oleh_id: guru.id,
            tanggal: today,
            status: 'Selesai',
          });

        if (error) throw error;
      }

      await fetchTodaySopLogs();
      fetchSopLogs();
    } catch (err) {
      console.error('Gagal memperbarui status SOP:', err);
      alert('Terjadi kesalahan saat memperbarui status SOP.');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal SOP rutin ini?')) return;
    try {
      const { error } = await supabase.from('todo_templates').delete().eq('id', templateId);
      if (error) throw error;
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error('Gagal menghapus SOP:', err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: StatusType) => {
    try {
      const { error } = await supabase.from('todos').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    } catch (err) {
      console.error('Gagal mengupdate status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus tugas ini?')) return;
    try {
      const { error } = await supabase.from('todos').delete().eq('id', id);
      if (error) throw error;
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Gagal menghapus tugas:', err);
    }
  };

  // Filter Tugas Sekali Jalan
  const oneTimeTodos = todos.filter((todo) => !todo.template_id);
  const filteredTodos = oneTimeTodos.filter((todo) => {
    return selectedStatusFilter === 'Semua' || todo.status === selectedStatusFilter;
  });

  // Filter SOP Rutin sesuai Petugas
  const filteredTemplates = useMemo(() => {
    if (sopPetugasFilter === 'Semua') return templates;
    if (sopPetugasFilter === 'Unassigned') return templates.filter((t) => !t.ditugaskan_ke_id);
    return templates.filter((t) => t.ditugaskan_ke_id === sopPetugasFilter || !t.ditugaskan_ke_id);
  }, [templates, sopPetugasFilter]);

  // Combined History & Filters
  const combinedHistory = useMemo(() => {
    const sopHistory = sopLogs.map((log) => ({
      id: `sop-${log.id}`,
      tipe: 'SOP Rutin' as const,
      judul: log.template?.judul || 'SOP Dihapus',
      petugasId: log.dikerjakan_oleh_id || log.template?.ditugaskan_ke_id || '',
      petugas:
        log.dikerjakan_oleh?.nama_lengkap ||
        log.template?.ditugaskan_ke?.nama_lengkap ||
        'Semua Anggota Divisi',
      tanggal: log.tanggal,
      status: log.status,
      rawDate: log.tanggal,
    }));

    const taskHistory = oneTimeTodos
      .filter((t) => t.status === 'Selesai')
      .map((todo) => ({
        id: `todo-${todo.id}`,
        tipe: 'Tugas Sekali Jalan' as const,
        judul: todo.judul,
        petugasId: todo.ditugaskan_ke_id || todo.dibuat_oleh_id || '',
        petugas:
          todo.ditugaskan_ke?.nama_lengkap ||
          todo.dibuat_oleh?.nama_lengkap ||
          'Semua Anggota Divisi',
        tanggal: todo.tanggal_tenggat
          ? todo.tanggal_tenggat.split('T')[0]
          : todo.created_at.split('T')[0],
        status: todo.status,
        rawDate: todo.created_at,
      }));

    return [...sopHistory, ...taskHistory].sort(
      (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()
    );
  }, [sopLogs, oneTimeTodos]);

  const filteredHistory = useMemo(() => {
    return combinedHistory.filter((item) => {
      const itemDate = item.tanggal;
      const passDate =
        (!riwayatStartDate || itemDate >= riwayatStartDate) &&
        (!riwayatEndDate || itemDate <= riwayatEndDate);

      const passPetugas =
        riwayatPetugasFilter === 'Semua' || item.petugasId === riwayatPetugasFilter;

      return passDate && passPetugas;
    });
  }, [combinedHistory, riwayatStartDate, riwayatEndDate, riwayatPetugasFilter]);

  // Daftar Tugas Keseluruhan untuk Tab Controlling (Kategori: SOP + Tugas Insidental)
  const allAssignments = useMemo(() => {
    const templateItems = templates.map((tmpl) => ({
      id: `tmpl-${tmpl.id}`,
      jenis: 'SOP Rutin',
      judul: tmpl.judul,
      deskripsi: tmpl.deskripsi,
      petugas: tmpl.ditugaskan_ke?.nama_lengkap || 'Semua Anggota Divisi',
      petugasId: tmpl.ditugaskan_ke_id,
      jadwal: `${tmpl.tipe_rutin}${
        tmpl.tipe_rutin === 'Mingguan' && tmpl.hari_mingguan ? ` (${NAMA_HARI[tmpl.hari_mingguan]})` : ''
      }${tmpl.tipe_rutin === 'Bulanan' && tmpl.tanggal_bulanan ? ` (Tgl ${tmpl.tanggal_bulanan})` : ''}`,
      statusAktif: tmpl.is_active ? 'Aktif' : 'Nonaktif',
      prioritas: tmpl.prioritas,
    }));

    const taskItems = oneTimeTodos.map((todo) => ({
      id: `task-${todo.id}`,
      jenis: 'Tugas Sekali Jalan',
      judul: todo.judul,
      deskripsi: todo.deskripsi,
      petugas: todo.ditugaskan_ke?.nama_lengkap || 'Semua Anggota Divisi',
      petugasId: todo.ditugaskan_ke_id,
      jadwal: todo.tanggal_tenggat ? `Tenggat: ${formatTanggal(todo.tanggal_tenggat)}` : 'Insidental',
      statusAktif: todo.status,
      prioritas: todo.prioritas,
    }));

    const combined = [...templateItems, ...taskItems];

    if (!controllingSearch.trim()) return combined;
    const query = controllingSearch.toLowerCase();
    return combined.filter(
      (item) =>
        item.judul.toLowerCase().includes(query) ||
        item.petugas.toLowerCase().includes(query) ||
        item.jenis.toLowerCase().includes(query)
    );
  }, [templates, oneTimeTodos, controllingSearch]);

  // Export Excel Filtered
  const handleExportExcel = () => {
    if (filteredHistory.length === 0) {
      alert('Tidak ada data riwayat untuk diekspor.');
      return;
    }

    const dataToExport = filteredHistory.map((item, index) => ({
      No: index + 1,
      Tanggal: formatTanggal(item.tanggal) || '',
      Tipe: item.tipe,
      'Nama Tugas / SOP': item.judul,
      Petugas: item.petugas,
      Status: item.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat SOP');

    const fileName = `Riwayat_SOP_${namaDivisi || 'Divisi'}_${getWIBTodayString()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Export PDF Filtered
  const handleExportPDF = () => {
    if (filteredHistory.length === 0) {
      alert('Tidak ada data riwayat untuk diekspor.');
      return;
    }

    const doc = new jsPDF();
    const currentDate = formatTanggal(getWIBTodayString());

    doc.setFontSize(16);
    doc.text('Laporan Riwayat SOP & Tugas Divisi', 14, 15);
    doc.setFontSize(10);
    doc.text(`Divisi: ${namaDivisi || 'Seluruh Divisi'}`, 14, 22);
    doc.text(`Periode Filter: ${formatTanggal(riwayatStartDate)} s.d ${formatTanggal(riwayatEndDate)}`, 14, 27);
    doc.text(`Tanggal Cetak: ${currentDate}`, 14, 32);

    const tableColumn = ['No', 'Tanggal', 'Tipe', 'Nama Tugas / SOP', 'Petugas', 'Status'];
    const tableRows = filteredHistory.map((item, index) => [
      index + 1,
      formatTanggal(item.tanggal) || '',
      item.tipe,
      item.judul,
      item.petugas,
      item.status,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 37,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    const fileName = `Riwayat_SOP_${namaDivisi || 'Divisi'}_${getWIBTodayString()}.pdf`;
    doc.save(fileName);
  };

  const getPriorityBadge = (priority: PriorityType) => {
    switch (priority) {
      case 'Tinggi':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Sedang':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Rendah':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Briefcase className="text-indigo-400 shrink-0" size={26} />
            To-Do List Divisi
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Kelola one-time task dan SOP rutin internal{' '}
            <span className="text-indigo-400 font-semibold">{namaDivisi || 'Divisi Anda'}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            onClick={handleOpenCreateRutinModal}
            disabled={!guru?.divisi_id}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 border border-indigo-500/20 font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            <RefreshCw size={15} /> + SOP Rutin
          </button>
          <button
            onClick={handleOpenCreateModal}
            disabled={!guru?.divisi_id}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            <Plus size={16} /> Tugas Sekali Jalan
          </button>
        </div>
      </div>

      {/* NAV TAB PANEL */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => setActiveTab('tugas')}
            className={`whitespace-nowrap flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'tugas'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListTodo size={14} /> Tugas Sekali Jalan ({oneTimeTodos.length})
          </button>
          <button
            onClick={() => setActiveTab('sop')}
            className={`whitespace-nowrap flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'sop'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Repeat size={14} /> SOP Rutin ({filteredTemplates.length})
          </button>
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`whitespace-nowrap flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'riwayat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History size={14} /> Riwayat ({filteredHistory.length})
          </button>

          {/* TAB DAFTAR TUGAS (KHUSUS ADMIN / WAKIL KEPALA) */}
          {isAdminOrWakil && (
            <button
              onClick={() => setActiveTab('controlling')}
              className={`whitespace-nowrap flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'controlling'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <ShieldCheck size={14} /> Daftar Tugas
            </button>
          )}
        </div>

        {/* Filter Khusus Tab Tugas Sekali Jalan */}
        {activeTab === 'tugas' && (
          <div className="flex items-center gap-3 justify-between md:justify-end">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <Filter size={14} className="text-indigo-400" /> Filter:
            </span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="Semua">Semua Status</option>
              <option value="Belum Selesai">Belum Selesai</option>
              <option value="Sedang Dikerjakan">Sedang Dikerjakan</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>
        )}

        {/* Filter Khusus Tab SOP Rutin */}
        {activeTab === 'sop' && (
          <div className="flex items-center gap-3 justify-between md:justify-end">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <Filter size={14} className="text-indigo-400" /> Petugas:
            </span>
            <select
              value={sopPetugasFilter}
              onChange={(e) => setSopPetugasFilter(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value={guru?.id || ''}>Tugas Saya</option>
              <option value="Semua">Semua Anggota Divisi</option>
              <option value="Unassigned">Tanpa Penanggung Jawab Khusus</option>
              {guruList
                .filter((g) => g.id !== guru?.id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama_lengkap}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* CONTENT TAB 1: LIST TUGAS SEKALI JALAN */}
      {activeTab === 'tugas' && (
        <>
          {loading || authLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="animate-spin text-indigo-400 mb-2" size={32} />
              <p className="text-xs text-slate-400">Memuat daftar tugas divisi...</p>
            </div>
          ) : filteredTodos.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <AlertCircle size={40} className="mx-auto text-slate-600 mb-2" />
              <h3 className="text-sm font-bold text-slate-300">Tidak ada tugas ditemukan</h3>
              <p className="text-xs text-slate-500 mt-1">Belum ada tugas sekali jalan untuk kriteria filter ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTodos.map((todo) => {
                const isFinished = todo.status === 'Selesai';
                return (
                  <div
                    key={todo.id}
                    className={`relative group bg-slate-900 border rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between transition-all ${
                      isFinished
                        ? 'border-slate-800/60 opacity-75'
                        : 'border-slate-800 hover:border-indigo-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 truncate">
                          <Tag size={10} /> {namaDivisi || 'Divisi'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPriorityBadge(
                            todo.prioritas
                          )}`}
                        >
                          {todo.prioritas}
                        </span>
                      </div>

                      <h3
                        className={`font-bold text-sm sm:text-base mb-1.5 ${
                          isFinished ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      >
                        {todo.judul}
                      </h3>
                      {todo.deskripsi && (
                        <p className="text-slate-400 text-xs line-clamp-2 mb-4 leading-relaxed">
                          {todo.deskripsi}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        {todo.tanggal_tenggat ? (
                          <span className="flex items-center gap-1 text-amber-300/90 font-medium">
                            <Calendar size={12} /> {formatTanggal(todo.tanggal_tenggat)}
                          </span>
                        ) : (
                          <span className="text-slate-600">Tanpa Tenggat</span>
                        )}

                        {todo.ditugaskan_ke?.nama_lengkap && (
                          <span className="flex items-center gap-1 text-indigo-300 font-medium truncate max-w-[130px]">
                            <UserCheck size={12} /> {todo.ditugaskan_ke.nama_lengkap}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1">
                          {todo.status === 'Belum Selesai' && (
                            <button
                              onClick={() => handleUpdateStatus(todo.id, 'Sedang Dikerjakan')}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Circle size={12} /> Kerjakan
                            </button>
                          )}
                          {todo.status === 'Sedang Dikerjakan' && (
                            <button
                              onClick={() => handleUpdateStatus(todo.id, 'Selesai')}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Clock size={12} /> Selesaikan
                            </button>
                          )}
                          {todo.status === 'Selesai' && (
                            <button
                              onClick={() => handleUpdateStatus(todo.id, 'Belum Selesai')}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle size={12} /> Selesai
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(todo)}
                            className="text-slate-500 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors cursor-pointer"
                            title="Edit Tugas"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(todo.id)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Hapus Tugas"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* CONTENT TAB 2: KELOLA SOP RUTIN */}
      {activeTab === 'sop' && (
        <div className="space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <RefreshCw size={40} className="mx-auto text-slate-600 mb-2" />
              <h3 className="text-sm font-bold text-slate-300">Belum Ada Jadwal SOP Rutin</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Tidak ada SOP rutin yang ditugaskan untuk kriteria petugas yang dipilih.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((tmpl) => {
                const currentLog = todaySopLogs[tmpl.id];
                const isDone = currentLog?.status === 'Selesai';

                return (
                  <div
                    key={tmpl.id}
                    className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                      tmpl.is_active ? 'border-slate-800' : 'border-slate-800/40 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                          <Repeat size={10} /> {tmpl.tipe_rutin}
                          {tmpl.tipe_rutin === 'Mingguan' && tmpl.hari_mingguan
                            ? ` (${NAMA_HARI[tmpl.hari_mingguan]})`
                            : ''}
                          {tmpl.tipe_rutin === 'Bulanan' && tmpl.tanggal_bulanan
                            ? ` (Tgl ${tmpl.tanggal_bulanan})`
                            : ''}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              isDone
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {isDone ? 'Selesai Hari Ini' : 'Belum Dikerjakan'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPriorityBadge(
                              tmpl.prioritas
                            )}`}
                          >
                            {tmpl.prioritas}
                          </span>
                        </div>
                      </div>

                      <h3
                        className={`font-bold text-sm sm:text-base mb-1 transition-all ${
                          isDone ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      >
                        {tmpl.judul}
                      </h3>
                      {tmpl.deskripsi && (
                        <p className="text-slate-400 text-xs line-clamp-2 mb-2 leading-relaxed">
                          {tmpl.deskripsi}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 font-medium mt-3 pt-2 border-t border-slate-800/50">
                        <UserCheck size={13} className="shrink-0 text-indigo-400" />
                        <span className="truncate">
                          {tmpl.ditugaskan_ke?.nama_lengkap
                            ? tmpl.ditugaskan_ke.nama_lengkap
                            : 'Semua Anggota Divisi'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 mt-4 border-t border-slate-800 space-y-3">
                      <button
                        onClick={() => handleSingleToggleSop(tmpl.id)}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {isDone ? (
                          <>
                            <CheckCircle size={15} /> Selesai Hari Ini
                          </>
                        ) : (
                          <>
                            <Circle size={15} /> Belum Dikerjakan (Tandai Selesai)
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => handleToggleTemplateActive(tmpl.id, tmpl.is_active)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                            tmpl.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          <Power size={12} /> {tmpl.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditTemplateModal(tmpl)}
                            className="text-slate-500 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors cursor-pointer"
                            title="Edit SOP Rutin"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(tmpl.id)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Hapus SOP"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENT TAB 3: RIWAYAT GABUNGAN DENGAN FILTER TANGGAL & PETUGAS */}
      {activeTab === 'riwayat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <History className="text-indigo-400" size={18} />
                Catatan Pengerjaan Tugas & SOP Divisi
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Menampilkan {filteredHistory.length} entri riwayat.
              </p>
            </div>

            {/* Tombol Ekspor */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={filteredHistory.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={filteredHistory.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>

          {/* PANEL FILTER TANGGAL (WIB) & PETUGAS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Dari Tanggal </label>
              <input
                type="date"
                value={riwayatStartDate}
                onChange={(e) => setRiwayatStartDate(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Sampai Tanggal </label>
              <input
                type="date"
                value={riwayatEndDate}
                onChange={(e) => setRiwayatEndDate(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Filter Petugas</label>
              <select
                value={riwayatPetugasFilter}
                onChange={(e) => setRiwayatPetugasFilter(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Semua">Semua Petugas</option>
                {guruList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama_lengkap}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <History size={36} className="mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-400 font-medium">
                Tidak ada riwayat yang sesuai dengan filter tanggal atau petugas ini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Tipe</th>
                    <th className="p-3">Nama Tugas / SOP</th>
                    <th className="p-3">Petugas</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-medium text-slate-400">{formatTanggal(item.tanggal)}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                            item.tipe === 'SOP Rutin'
                              ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          }`}
                        >
                          {item.tipe}
                        </span>
                      </td>
                      <td className="p-3 text-slate-100 font-semibold">{item.judul}</td>
                      <td className="p-3 text-slate-300">{item.petugas}</td>
                      <td className="p-3">
                        {item.status === 'Selesai' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                            <CheckCircle size={10} /> Selesai
                          </span>
                        ) : item.status === 'Terlewat' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold text-[10px]">
                            <XCircle size={10} /> Terlewat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[10px]">
                            <Clock size={10} /> {item.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTENT TAB 4: DAFTAR TUGAS CONTROLLING (KHUSUS ADMIN / WAKIL KEPALA) */}
      {activeTab === 'controlling' && isAdminOrWakil && (
        <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                <ShieldCheck size={20} />
                Pemantauan Penugasan Anggota Divisi
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Daftar ringkas seluruh SOP rutin dan one-time task beserta penanggung jawabnya.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Cari tugas / petugas..."
                value={controllingSearch}
                onChange={(e) => setControllingSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {allAssignments.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle size={36} className="mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">Tidak ada data penugasan ditemukan.</p>
            </div>
          ) : (
            <>
              {/* Tampilan Tabel pada Layar Sedang & Besar */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Jenis</th>
                      <th className="p-3">Nama Tugas / SOP</th>
                      <th className="p-3">Penanggung Jawab</th>
                      <th className="p-3">Jadwal / Tenggat</th>
                      <th className="p-3">Prioritas</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {allAssignments.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              item.jenis === 'SOP Rutin'
                                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            }`}
                          >
                            {item.jenis}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-100">{item.judul}</td>
                        <td className="p-3 text-indigo-300 font-medium">{item.petugas}</td>
                        <td className="p-3 text-slate-400">{item.jadwal}</td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPriorityBadge(
                              item.prioritas
                            )}`}
                          >
                            {item.prioritas}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-medium">{item.statusAktif}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tampilan Kartu Ringkas Responsif Khusus Seluler / HP */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {allAssignments.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          item.jenis === 'SOP Rutin'
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}
                      >
                        {item.jenis}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPriorityBadge(
                          item.prioritas
                        )}`}
                      >
                        {item.prioritas}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-100 text-xs">{item.judul}</h4>

                    <div className="flex flex-col gap-1 text-[11px] pt-1 border-t border-slate-900">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Petugas:</span>
                        <span className="text-indigo-300 font-semibold">{item.petugas}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Jadwal:</span>
                        <span className="text-slate-400">{item.jadwal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status:</span>
                        <span className="text-slate-300 font-medium">{item.statusAktif}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL TAMBAH / EDIT TUGAS */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTodo ? 'Edit Tugas Divisi' : 'Tambah Tugas Sekali Jalan'}
      >
        <form onSubmit={handleSaveTodo} className="space-y-4 text-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Judul Tugas *</label>
            <input
              type="text"
              required
              value={formData.judul}
              onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
              placeholder="Contoh: Pengisian Evaluasi Bulanan"
              className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Target Divisi</label>
              <input
                type="text"
                readOnly
                value={namaDivisi || 'Belum Ada Divisi'}
                className="w-full text-xs p-3 rounded-xl bg-slate-900 border border-slate-800 text-indigo-300 font-bold cursor-not-allowed outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Prioritas</label>
              <select
                value={formData.prioritas}
                onChange={(e) => setFormData({ ...formData, prioritas: e.target.value as PriorityType })}
                className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="Rendah">Rendah</option>
                <option value="Sedang">Sedang</option>
                <option value="Tinggi">Tinggi</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Penanggung Jawab</label>
              <select
                value={formData.ditugaskan_ke_id}
                onChange={(e) => setFormData({ ...formData, ditugaskan_ke_id: e.target.value })}
                className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Pilih Anggota Staf --</option>
                {guruList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama_lengkap}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Tanggal Tenggat (Opsional)</label>
              <input
                type="date"
                value={formData.tanggal_tenggat}
                onChange={(e) => setFormData({ ...formData, tanggal_tenggat: e.target.value })}
                className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Deskripsi / Catatan Tugas</label>
            <textarea
              rows={3}
              value={formData.deskripsi}
              onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
              placeholder="Rincian instruksi tugas..."
              className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {editingTodo ? 'Perbarui Tugas' : 'Simpan Tugas'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL TEMPLATE RUTIN / SOP */}
      <ModalTemplateRutin
        isOpen={isModalRutinOpen}
        onClose={() => {
          setIsModalRutinOpen(false);
          setEditingTemplate(null);
        }}
        divisiId={guru?.divisi_id || ''}
        namaDivisi={namaDivisi}
        guruList={guruList}
        templateToEdit={editingTemplate}
        onSuccess={fetchTemplates}
      />
    </div>
  );
}