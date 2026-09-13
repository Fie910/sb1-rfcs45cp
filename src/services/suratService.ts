import { supabase } from '../lib/supabase';
import { Surat, KategoriSurat, DisposisiSurat, JenisSurat } from '../types/surat';

export interface Guru {
  id: string;
  nip?: string | null;
  nama_lengkap: string;
  email?: string;
  role?: string | null;
  jabatan?: string | null;
}

// --- A. MASTER KATEGORI ---
export const getKategoriSuratList = async (jenis?: JenisSurat) => {
  let query = supabase.from('kategori_surat').select('*').order('kode');
  if (jenis) query = query.eq('jenis_surat', jenis);
  const { data, error } = await query;
  if (error) throw error;
  return data as KategoriSurat[];
};

export const createKategoriSurat = async (kategori: Omit<KategoriSurat, 'id'>) => {
  const { data, error } = await supabase.from('kategori_surat').insert([kategori]).select();
  if (error) throw error;
  return data[0] as KategoriSurat;
};

export const updateKategoriSurat = async (id: string, updateData: Partial<KategoriSurat>) => {
  const { data, error } = await supabase
    .from('kategori_surat')
    .update(updateData)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data[0] as KategoriSurat;
};

export const deleteKategoriSurat = async (id: string) => {
  const { error } = await supabase.from('kategori_surat').delete().eq('id', id);
  if (error) throw error;
};

// --- B. SURAT (CRUD & UPLOAD) ---
export const getSuratList = async (jenis?: JenisSurat) => {
  let query = supabase
    .from('surat')
    .select('*, kategori_surat(*), siswas(id, nama_lengkap, nisn)')
    .order('created_at', { ascending: false });

  if (jenis) query = query.eq('jenis_surat', jenis);
  const { data, error } = await query;
  if (error) throw error;
  return data as Surat[];
};

export const getSuratById = async (id: string) => {
  const { data, error } = await supabase
    .from('surat')
    .select('*, kategori_surat(*), siswas(id, nama_lengkap, nisn)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Surat;
};

export const getNextUrutanSurat = async (jenis: JenisSurat) => {
  const { count, error } = await supabase
    .from('surat')
    .select('*', { count: 'exact', head: true })
    .eq('jenis_surat', jenis);

  if (error) throw error;
  return (count || 0) + 1;
};

export const uploadFileSurat = async (file: File, folder: 'berkas' | 'bukti' = 'berkas') => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('dokumen-surat')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('dokumen-surat')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

export const createSurat = async (suratData: Omit<Surat, 'id' | 'created_at'>) => {
  const { data, error } = await supabase.from('surat').insert([suratData]).select();
  if (error) throw error;
  return data[0] as Surat;
};

export const updateSurat = async (id: string, updateData: Partial<Surat>) => {
  const { data, error } = await supabase.from('surat').update(updateData).eq('id', id).select();
  if (error) throw error;
  return data[0] as Surat;
};

export const deleteSurat = async (id: string) => {
  const { error } = await supabase.from('surat').delete().eq('id', id);
  if (error) throw error;
};

// --- C. DISPOSISI SURAT & GURU ---
export const getGuruList = async (): Promise<Guru[]> => {
  const { data, error } = await supabase
    .from('gurus')
    .select('id, nip, nama_lengkap, email, role')
    .order('nama_lengkap', { ascending: true });

  if (error) {
    console.error('Error fetching guru:', error);
    return [];
  }
  return data || [];
};

export const getDisposisiBySuratId = async (suratId: string) => {
  const { data, error } = await supabase
    .from('disposisi_surat')
    .select('*')
    .eq('surat_id', suratId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as DisposisiSurat[];
};

export const createDisposisi = async (
  disposisi: Omit<DisposisiSurat, 'id' | 'created_at' | 'updated_at'>,
  nomorSurat?: string
) => {
  // 1. Simpan data disposisi ke tabel disposisi_surat
  const { data, error } = await supabase.from('disposisi_surat').insert([disposisi]).select();
  if (error) throw error;

  const createdDisposisi = data[0] as DisposisiSurat;

  // 2. Kirim notifikasi ke penerima jika penerima_id (guru_id) tersedia
  if (disposisi.penerima_id) {
    const infoNomor = nomorSurat ? ` (No: ${nomorSurat})` : '';
    await supabase.from('notifikasi').insert([
      {
        guru_id: disposisi.penerima_id,
        judul: 'Disposisi Surat Baru',
        pesan: `Anda menerima instruksi disposisi surat${infoNomor} dari ${disposisi.pemberi_disposisi}: "${disposisi.instruksi}"`,
        tipe: 'disposisi_surat',
        tautan: '/tugas-disposisi',
        is_read: false
      }
    ]);
  }

  return createdDisposisi;
};

export const updateStatusDisposisi = async (
  id: string,
  status: 'PENDING' | 'PROSES' | 'SELESAI',
  catatan_tindak_lanjut?: string
) => {
  const { data, error } = await supabase
    .from('disposisi_surat')
    .update({ 
      status, 
      catatan_tindak_lanjut, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0] as DisposisiSurat;
};