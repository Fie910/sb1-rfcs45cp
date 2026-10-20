// src/lib/rapatActions.ts
// Utility untuk konversi action items rapat → todos.

import { supabase } from '@/lib/supabase';
import type { ActionItemRapat } from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
export type ConversionResult = {
  berhasil: number;
  gagal: number;
  skipped: number;
  detail: {
    deskripsi: string;
    status: 'ok' | 'gagal' | 'skip';
    error?: string;
    todo_id?: string;
  }[];
};

// =============================================================================
// MAIN — CONVERT ACTION ITEMS → TODOS
// =============================================================================
export async function convertActionItemsToTodos(
  actionItems: ActionItemRapat[],
  options: {
    rapatId: string;
    rapatJudul: string;
    nomorRapat: string | null;
    dibuatOlehId: string;
  }
): Promise<ConversionResult> {
  const result: ConversionResult = {
    berhasil: 0,
    gagal: 0,
    skipped: 0,
    detail: [],
  };

  // Filter: harus punya PIC + deskripsi + belum di-convert
  const valid = actionItems.filter(
    (a) => a.pic_id && a.deskripsi.trim() && !a.todo_id
  );
  const skipped = actionItems.filter((a) => a.todo_id);

  result.skipped = skipped.length;
  skipped.forEach((a) => {
    result.detail.push({
      deskripsi: a.deskripsi,
      status: 'skip',
      todo_id: a.todo_id ?? undefined,
    });
  });

  if (valid.length === 0) return result;

  // Fetch divisi_id untuk semua PIC (todos butuh divisi_id NOT NULL)
  const picIds = Array.from(new Set(valid.map((a) => a.pic_id!)));
  const { data: guruData } = await supabase
    .from('gurus')
    .select('id, divisi_id, nama_lengkap')
    .in('id', picIds);

  const divisiMap = new Map<string, string | null>();
  (guruData ?? []).forEach((g: any) => divisiMap.set(g.id, g.divisi_id));

  // Default divisi (kalau PIC tidak punya divisi_id)
  const { data: defaultDivisi } = await supabase
    .from('divisis')
    .select('id')
    .limit(1)
    .maybeSingle();
  const defaultDivisiId = defaultDivisi?.id;

  if (!defaultDivisiId) {
    valid.forEach((a) => {
      result.gagal++;
      result.detail.push({
        deskripsi: a.deskripsi,
        status: 'gagal',
        error: 'Tidak ada divisi di sistem',
      });
    });
    return result;
  }

  // Insert satu-satu
  for (const item of valid) {
    const divisiId = divisiMap.get(item.pic_id!) ?? defaultDivisiId;

    // ✅ Generate ID di frontend untuk menghindari RLS error saat RETURNING data
    const todoId = crypto.randomUUID();

    const { error } = await supabase
      .from('todos')
      .insert({
        id: todoId, // Suntikkan ID yang sudah kita buat
        judul: `[${options.nomorRapat ?? 'Rapat'}] ${item.deskripsi.slice(0, 120)}`,
        deskripsi: `Dari rapat: ${options.rapatJudul}\n\nDeskripsi tugas:\n${item.deskripsi}`,
        divisi_id: divisiId,
        prioritas: item.prioritas,
        status: 'Belum Selesai',
        tanggal_tenggat: item.deadline,
        dibuat_oleh_id: options.dibuatOlehId,
        ditugaskan_ke_id: item.pic_id,
      });
    // ⚠️ Tidak ada .select().single() di sini

    if (error) {
      result.gagal++;
      result.detail.push({
        deskripsi: item.deskripsi,
        status: 'gagal',
        error: error.message ?? 'Unknown error',
      });
    } else {
      result.berhasil++;
      // Update in-memory: set todo_id
      item.todo_id = todoId;
      item.status = 'Belum';

      result.detail.push({
        deskripsi: item.deskripsi,
        status: 'ok',
        todo_id: todoId,
      });
    }
  }

  return result;
}

// =============================================================================
// HELPER — cek apakah action item sudah ada di todos
// =============================================================================
export function hasConvertibleItems(actionItems: ActionItemRapat[]): boolean {
  return actionItems.some((a) => a.pic_id && a.deskripsi.trim() && !a.todo_id);
}