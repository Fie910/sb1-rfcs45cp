/*
# School GPS Geofencing - School Settings Table & Agenda GPS Columns

Adds GPS location validation (geofencing) support to the Agenda & Presensi Guru feature.

## New Tables

1. `pengaturan_sekolahs` - School location settings (single-row configuration table)
   - `id` (uuid, primary key)
   - `nama_sekolah` (text, school name)
   - `latitude` (double precision, school center latitude)
   - `longitude` (double precision, school center longitude)
   - `radius_meter` (integer, allowed radius in meters from school center, default 100)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

## Modified Tables

1. `agenda_gurus` - Added GPS tracking columns
   - `latitude_guru` (double precision, nullable - teacher's GPS latitude at time of save)
   - `longitude_guru` (double precision, nullable - teacher's GPS longitude at time of save)
   - `jarak_dari_sekolah` (double precision, nullable - distance in meters from school center)

## Security (RLS)

- `pengaturan_sekolahs`: RLS enabled, authenticated-only CRUD (shared settings, all
  authenticated teachers can read the school location config).

## Important Notes

1. The `pengaturan_sekolahs` table stores a single configuration row with the school's
   GPS coordinates and allowed radius. The frontend reads this to validate teacher
   location during agenda/presensi submission.
2. Three new nullable columns on `agenda_gurus` capture the teacher's GPS position and
   calculated distance at the moment of saving. They are nullable so existing agenda
   records (created before this feature) remain valid.
3. The Haversine formula is implemented in the frontend (JavaScript) to calculate the
   distance between the teacher's current GPS position and the school center.
*/

-- =====================
-- Table: pengaturan_sekolahs
-- =====================
CREATE TABLE IF NOT EXISTS pengaturan_sekolahs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_sekolah text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meter integer NOT NULL DEFAULT 100 CHECK (radius_meter > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pengaturan_sekolahs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pengaturan_sekolahs" ON pengaturan_sekolahs;
CREATE POLICY "select_pengaturan_sekolahs" ON pengaturan_sekolahs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_pengaturan_sekolahs" ON pengaturan_sekolahs;
CREATE POLICY "insert_pengaturan_sekolahs" ON pengaturan_sekolahs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_pengaturan_sekolahs" ON pengaturan_sekolahs;
CREATE POLICY "update_pengaturan_sekolahs" ON pengaturan_sekolahs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_pengaturan_sekolahs" ON pengaturan_sekolahs;
CREATE POLICY "delete_pengaturan_sekolahs" ON pengaturan_sekolahs FOR DELETE
  TO authenticated USING (true);

-- =====================
-- Alter: agenda_gurus (add GPS columns)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agenda_gurus' AND column_name = 'latitude_guru'
  ) THEN
    ALTER TABLE agenda_gurus ADD COLUMN latitude_guru double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agenda_gurus' AND column_name = 'longitude_guru'
  ) THEN
    ALTER TABLE agenda_gurus ADD COLUMN longitude_guru double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agenda_gurus' AND column_name = 'jarak_dari_sekolah'
  ) THEN
    ALTER TABLE agenda_gurus ADD COLUMN jarak_dari_sekolah double precision;
  END IF;
END $$;
