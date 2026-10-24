-- =============================================================================
-- Enhance: Kategori Dinas, Delegasi Hybrid, Asistensi, Full-day mode
-- =============================================================================
BEGIN;

-- 1. Update kategori_izin: tambah 'Dinas'
ALTER TABLE public.izin_guru_pikets 
  DROP CONSTRAINT IF EXISTS izin_guru_pikets_kategori_izin_check;
ALTER TABLE public.izin_guru_pikets 
  ADD CONSTRAINT izin_guru_pikets_kategori_izin_check 
  CHECK (kategori_izin IN ('Izin', 'Sakit', 'Dinas'));

-- 2. Kolom baru: jenis_delegasi, nama_asisten, is_full_day, jadwal_kbm_id
ALTER TABLE public.izin_guru_pikets 
  ADD COLUMN IF NOT EXISTS jenis_delegasi varchar(20) NOT NULL DEFAULT 'none'
    CHECK (jenis_delegasi IN ('none', 'asistensi', 'tugas')),
  ADD COLUMN IF NOT EXISTS nama_asisten text NULL,
  ADD COLUMN IF NOT EXISTS is_full_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS jadwal_kbm_id bigint NULL 
    REFERENCES public.jadwal_kbms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_izin_jadwal_kbm 
  ON public.izin_guru_pikets (jadwal_kbm_id) 
  WHERE jadwal_kbm_id IS NOT NULL;

-- 3. Kelonggaran constraint: titipan_tugas & kelas_id jadi nullable
ALTER TABLE public.izin_guru_pikets 
  ALTER COLUMN titipan_tugas DROP NOT NULL,
  ALTER COLUMN kelas_id DROP NOT NULL;

-- 4. Backfill: record lama dianggap full-day (preserve perilaku lama)
UPDATE public.izin_guru_pikets 
  SET is_full_day = true 
  WHERE jadwal_kbm_id IS NULL AND is_full_day = false;

-- 5. Update agenda_gurus status_kehadiran enum
ALTER TABLE public.agenda_gurus 
  DROP CONSTRAINT IF EXISTS agenda_gurus_status_kehadiran_check;
ALTER TABLE public.agenda_gurus 
  ADD CONSTRAINT agenda_gurus_status_kehadiran_check 
  CHECK (status_kehadiran IN (
    'Hadir Mengajar', 'Terlambat', 'Alpa', 
    'Izin', 'Sakit', 'Dinas',
    'Asistensi',
    'Sakit+tugas', 'Izin+tugas', 'Dinas+tugas'
  ));

COMMENT ON COLUMN public.izin_guru_pikets.jenis_delegasi 
  IS 'none=bukan delegasi, asistensi=ada asisten, tugas=ada instruksi tugas';
COMMENT ON COLUMN public.izin_guru_pikets.is_full_day 
  IS 'true=berlaku semua jadwal hari itu, false=hanya jadwal_kbm_id tertentu';
COMMENT ON COLUMN public.agenda_gurus.status_kehadiran 
  IS 'Status sesi mengajar; +tugas=ada delegasi tugas, Asistensi=guru lain mendampingi';

COMMIT;