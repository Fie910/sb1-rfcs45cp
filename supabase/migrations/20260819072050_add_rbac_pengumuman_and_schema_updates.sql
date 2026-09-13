/*
# RBAC, Pengumuman, and Schema Updates for School Information System

## New Tables

1. `pengumumans` - School announcements board
   - `id` (uuid, primary key)
   - `judul` (text, announcement title)
   - `isi` (text, announcement body)
   - `tanggal_mulai` (date, start date)
   - `tanggal_selesai` (date, end date)
   - `is_aktif` (boolean, default true)
   - `created_at` (timestamptz)

## Modified Tables

1. `gurus` - Added `role` column
   - `role` (text, NOT NULL, DEFAULT 'guru', CHECK in 'admin','guru','guru_piket')

2. `presensis` - Added `guru_id` column
   - `guru_id` (uuid, nullable, references gurus.id ON DELETE SET NULL)

3. `izin_guru_pikets` - Added penyampaian tracking columns
   - `status_penyampaian` (text, NOT NULL, DEFAULT 'Belum Disampaikan',
     CHECK in 'Belum Disampaikan','Sudah Disampaikan')
   - `waktu_penyampaian` (timestamptz, nullable - timestamp when piket teacher
     marked the task as delivered)

## Security (RLS)

- `pengumumans`: RLS enabled, authenticated-only CRUD (shared announcements)

## Important Notes

1. The `role` column on `gurus` defaults to 'guru' so all existing teachers get the
   basic guru role. An admin must manually promote users to 'admin' or 'guru_piket'.
2. `presensis.guru_id` is nullable so existing attendance records remain valid; new
   records will record which teacher input the attendance.
3. `izin_guru_pikets` keeps the existing `status_penanganan` column and adds the new
   `status_penyampaian` + `waktu_penyampaian` columns for tracking whether the piket
   teacher has delivered the delegated task instructions.
*/

-- =====================
-- Alter: gurus (add role)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gurus' AND column_name = 'role'
  ) THEN
    ALTER TABLE gurus ADD COLUMN role text NOT NULL DEFAULT 'guru'
      CHECK (role IN ('admin','guru','guru_piket'));
  END IF;
END $$;

-- =====================
-- Alter: presensis (add guru_id)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'presensis' AND column_name = 'guru_id'
  ) THEN
    ALTER TABLE presensis ADD COLUMN guru_id uuid REFERENCES gurus(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================
-- Alter: izin_guru_pikets (add penyampaian columns)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'izin_guru_pikets' AND column_name = 'status_penyampaian'
  ) THEN
    ALTER TABLE izin_guru_pikets ADD COLUMN status_penyampaian text NOT NULL
      DEFAULT 'Belum Disampaikan'
      CHECK (status_penyampaian IN ('Belum Disampaikan','Sudah Disampaikan'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'izin_guru_pikets' AND column_name = 'waktu_penyampaian'
  ) THEN
    ALTER TABLE izin_guru_pikets ADD COLUMN waktu_penyampaian timestamptz;
  END IF;
END $$;

-- =====================
-- Table: pengumumans
-- =====================
CREATE TABLE IF NOT EXISTS pengumumans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL,
  isi text NOT NULL,
  tanggal_mulai date NOT NULL,
  tanggal_selesai date NOT NULL,
  is_aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pengumumans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pengumumans" ON pengumumans;
CREATE POLICY "select_pengumumans" ON pengumumans FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_pengumumans" ON pengumumans;
CREATE POLICY "insert_pengumumans" ON pengumumans FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_pengumumans" ON pengumumans;
CREATE POLICY "update_pengumumans" ON pengumumans FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_pengumumans" ON pengumumans;
CREATE POLICY "delete_pengumumans" ON pengumumans FOR DELETE
  TO authenticated USING (true);
