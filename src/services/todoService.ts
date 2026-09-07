import { supabase } from '@/lib/supabase';
import type { TodoItem, TodoTemplate, SopLog } from '@/types/TodoTemplate';

export const todoService = {
  // 1. Ambil daftar Todo berdasarkan divisi
  async getTodosByDivisi(divisiId: string): Promise<TodoItem[]> {
    const { data, error } = await supabase
      .from('todos')
      .select(`
        *,
        dibuat_oleh:dibuat_oleh_id (nama_lengkap),
        ditugaskan_ke:ditugaskan_ke_id (nama_lengkap)
      `)
      .eq('divisi_id', divisiId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as TodoItem[]) || [];
  },

  // 2. Buat Todo baru
  async createTodo(payload: {
    judul: string;
    deskripsi?: string | null;
    divisi_id: string;
    prioritas: TodoItem['prioritas'];
    status: TodoItem['status'];
    tanggal_tenggat?: string | null;
    dibuat_oleh_id: string;
    ditugaskan_ke_id?: string | null;
    template_id?: string | null;
  }): Promise<TodoItem> {
    const { data, error } = await supabase
      .from('todos')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as TodoItem;
  },

  // 3. Perbarui status atau data Todo
  async updateTodo(id: string, updates: Partial<TodoItem>): Promise<void> {
    const { error } = await supabase
      .from('todos')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  // 4. Hapus Todo
  async deleteTodo(id: string): Promise<void> {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // 5. Ambil daftar template SOP rutin divisi
  async getTemplatesByDivisi(divisiId: string): Promise<TodoTemplate[]> {
    const { data, error } = await supabase
      .from('todo_templates')
      .select(`
        *,
        ditugaskan_ke:ditugaskan_ke_id (nama_lengkap)
      `)
      .eq('divisi_id', divisiId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as TodoTemplate[]) || [];
  },

  // 6. Ambil riwayat log eksekusi SOP
  async getSopLogsByDivisi(divisiId: string, startDate?: string, endDate?: string): Promise<SopLog[]> {
    let query = supabase
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
      .eq('divisi_id', divisiId);

    if (startDate) query = query.gte('tanggal', startDate);
    if (endDate) query = query.lte('tanggal', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return (data as SopLog[]) || [];
  },
};
