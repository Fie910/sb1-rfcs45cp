/*
# School Information System - Initial Schema

Creates the complete schema for a School Information System (Sistem Informasi Sekolah)
with teacher authentication via Supabase Auth.

## New Tables

1. `gurus` - Teacher profiles (linked to auth.users)
   - `id` (uuid, primary key, references auth.users)
   - `nip` (text, unique teacher registration number)
   - `nama_lengkap` (text, full name)
   - `email` (text, unique email)
   - `mata_pelajaran` (text, subject taught)
   - `created_at` (timestamptz)

2. `kelas` - Classes
   - `id` (uuid, primary key)
   - `nama_kelas` (text, class name e.g. "X IPA 1")
   - `wali_kelas_id` (uuid, foreign key to gurus.id, nullable)
   - `created_at` (timestamptz)

3. `siswas` - Students
   - `id` (uuid, primary key)
   - `nisn` (text, unique student ID number)
   - `nama_lengkap` (text, full name)
   - `jenis_kelamin` (text, 'L' or 'P')
   - `kelas_id` (uuid, foreign key to kelas.id)
   - `created_at` (timestamptz)

4. `nilais` - Grade records
   - `id` (uuid, primary key)
   - `siswa_id` (uuid, foreign key to siswas.id)
   - `guru_id` (uuid, foreign key to gurus.id)
   - `mata_pelajaran` (text, subject)
   - `jenis_penilaian` (text, assessment type e.g. 'Tugas', 'UH', 'UTS', 'UAS')
   - `nilai` (numeric, score 0-100)
   - `semester` (text, e.g. 'Ganjil', 'Genap')
   - `tahun_ajaran` (text, e.g. '2025/2026')
   - `created_at` (timestamptz)

5. `presensis` - Daily attendance records
   - `id` (uuid, primary key)
   - `siswa_id` (uuid, foreign key to siswas.id)
   - `tanggal` (date, attendance date)
   - `status` (text, 'Hadir', 'Sakit', 'Izin', 'Alpa')
   - `keterangan` (text, nullable notes)
   - `created_at` (timestamptz)

## Security (RLS)

All tables have RLS enabled. Since this app uses teacher authentication (Supabase Auth),
policies are scoped to `authenticated` role. All authenticated teachers can read and write
school data (shared workspace model - all teachers manage the same student body).

- `gurus`: each teacher can read all guru profiles; a teacher can insert/update their own
  profile row (matched by `auth.uid() = id`).
- `kelas`, `siswas`, `nilais`, `presensis`: any authenticated teacher can perform CRUD
  (shared school data managed by all authenticated staff).

## Important Notes

1. The `gurus.id` column references `auth.users(id)` so each teacher's profile is tied to
   their auth account. A trigger could auto-create a guru row on signup, but the frontend
   handles profile creation on first login instead for flexibility.
2. Foreign keys use `ON DELETE CASCADE` for child tables so deleting a class removes its
   students' related records cleanly, and deleting a student removes their grades/attendance.
3. Indexes added for frequently queried columns (kelas_id on siswas, siswa_id on nilais and
   presensis, guru_id on nilais).
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- Table: gurus
-- =====================
CREATE TABLE IF NOT EXISTS gurus (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nip text UNIQUE NOT NULL,
  nama_lengkap text NOT NULL,
  email text UNIQUE NOT NULL,
  mata_pelajaran text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gurus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gurus" ON gurus;
CREATE POLICY "select_gurus" ON gurus FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_guru" ON gurus;
CREATE POLICY "insert_own_guru" ON gurus FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_guru" ON gurus;
CREATE POLICY "update_own_guru" ON gurus FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =====================
-- Table: kelas
-- =====================
CREATE TABLE IF NOT EXISTS kelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kelas text NOT NULL,
  wali_kelas_id uuid REFERENCES gurus(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_kelas" ON kelas;
CREATE POLICY "select_kelas" ON kelas FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_kelas" ON kelas;
CREATE POLICY "insert_kelas" ON kelas FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_kelas" ON kelas;
CREATE POLICY "update_kelas" ON kelas FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_kelas" ON kelas;
CREATE POLICY "delete_kelas" ON kelas FOR DELETE
  TO authenticated USING (true);

-- =====================
-- Table: siswas
-- =====================
CREATE TABLE IF NOT EXISTS siswas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nisn text UNIQUE NOT NULL,
  nama_lengkap text NOT NULL,
  jenis_kelamin text NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
  kelas_id uuid REFERENCES kelas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE siswas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_siswas" ON siswas;
CREATE POLICY "select_siswas" ON siswas FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_siswas" ON siswas;
CREATE POLICY "insert_siswas" ON siswas FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_siswas" ON siswas;
CREATE POLICY "update_siswas" ON siswas FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_siswas" ON siswas;
CREATE POLICY "delete_siswas" ON siswas FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_siswas_kelas_id ON siswas(kelas_id);

-- =====================
-- Table: nilais
-- =====================
CREATE TABLE IF NOT EXISTS nilais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id uuid NOT NULL REFERENCES siswas(id) ON DELETE CASCADE,
  guru_id uuid NOT NULL REFERENCES gurus(id) ON DELETE CASCADE,
  mata_pelajaran text NOT NULL,
  jenis_penilaian text NOT NULL,
  nilai numeric NOT NULL CHECK (nilai >= 0 AND nilai <= 100),
  semester text NOT NULL,
  tahun_ajaran text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nilais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_nilais" ON nilais;
CREATE POLICY "select_nilais" ON nilais FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_nilais" ON nilais;
CREATE POLICY "insert_nilais" ON nilais FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_nilais" ON nilais;
CREATE POLICY "update_nilais" ON nilais FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_nilais" ON nilais;
CREATE POLICY "delete_nilais" ON nilais FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_nilais_siswa_id ON nilais(siswa_id);
CREATE INDEX IF NOT EXISTS idx_nilais_guru_id ON nilais(guru_id);

-- =====================
-- Table: presensis
-- =====================
CREATE TABLE IF NOT EXISTS presensis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id uuid NOT NULL REFERENCES siswas(id) ON DELETE CASCADE,
  tanggal date NOT NULL,
  status text NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alpa')),
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE presensis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_presensis" ON presensis;
CREATE POLICY "select_presensis" ON presensis FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_presensis" ON presensis;
CREATE POLICY "insert_presensis" ON presensis FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_presensis" ON presensis;
CREATE POLICY "update_presensis" ON presensis FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_presensis" ON presensis;
CREATE POLICY "delete_presensis" ON presensis FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_presensis_siswa_id ON presensis(siswa_id);
CREATE INDEX IF NOT EXISTS idx_presensis_tanggal ON presensis(tanggal);
