/*
# School Information System - Teacher Agenda, Schedule & Piket Tables

Extends the existing schema with four new tables to support teacher agenda/attendance,
leave requests with task delegation, and piket (duty) management.

## New Tables

1. `jadwal_kbms` - Teacher teaching schedule (KBM = Kegiatan Belajar Mengajar)
   - `id` (uuid, primary key)
   - `guru_id` (uuid, foreign key to gurus.id, ON DELETE CASCADE)
   - `hari` (text, day of week: 'Senin','Selasa','Rabu','Kamis','Jumat','Sabtu')
   - `jam_ke` (integer, period number, e.g. 1, 2, 3...)
   - `kelas_id` (uuid, foreign key to kelas.id, ON DELETE CASCADE)
   - `mata_pelajaran` (text, subject being taught in this slot)
   - `created_at` (timestamptz)

2. `agenda_gurus` - Teacher daily agenda/journal + self-attendance
   - `id` (uuid, primary key)
   - `guru_id` (uuid, foreign key to gurus.id, ON DELETE CASCADE)
   - `jadwal_kbm_id` (uuid, foreign key to jadwal_kbms.id, ON DELETE SET NULL)
   - `tanggal` (date, the date this agenda entry is for)
   - `status_kehadiran` (text, 'Hadir' or 'Tidak Hadir')
   - `catatan_materi` (text, journal notes about material taught)
   - `created_at` (timestamptz)

3. `jadwal_pikets` - Teacher piket (duty) schedule
   - `id` (uuid, primary key)
   - `guru_id` (uuid, foreign key to gurus.id, ON DELETE CASCADE)
   - `hari_piket` (text, day of week for piket duty)
   - `created_at` (timestamptz)

4. `izin_guru_pikets` - Teacher leave requests with task delegation
   - `id` (uuid, primary key)
   - `guru_izin_id` (uuid, foreign key to gurus.id - the teacher requesting leave)
   - `tanggal_izin` (date, date of leave)
   - `alasan_izin` (text, reason for leave)
   - `titipan_tugas` (text, task instructions for the substitute)
   - `kelas_id` (uuid, foreign key to kelas.id - target class)
   - `mata_pelajaran` (text, subject to be covered)
   - `status_penanganan` (text, 'Menunggu' | 'Ditangani' - handling status)
   - `guru_piket_id` (uuid, foreign key to gurus.id, nullable - piket teacher who handled it)
   - `created_at` (timestamptz)

## Security (RLS)

All tables have RLS enabled. Policies scoped to `authenticated` role (shared workspace
model - all authenticated teachers can read and manage school data, consistent with
existing tables).

- `jadwal_kbms`: authenticated CRUD (shared schedule data)
- `agenda_gurus`: authenticated CRUD (all teachers can view/manage agendas)
- `jadwal_pikets`: authenticated CRUD
- `izin_guru_pikets`: authenticated CRUD (teachers create leave requests, piket teachers
  update status_penanganan and guru_piket_id)

## Important Notes

1. `jadwal_kbms` links a teacher to a class, day, and period. The frontend uses this to
   detect whether the logged-in teacher has an active teaching slot at the current time,
   which gates the "Absen Diri" (self-attendance) and agenda journal buttons.
2. `agenda_gurus.jadwal_kbm_id` uses ON DELETE SET NULL so deleting a KBM schedule doesn't
   lose historical agenda records.
3. `izin_guru_pikets` has two guru FK references: `guru_izin_id` (the teacher who is absent)
   and `guru_piket_id` (the piket teacher handling the delegation). Both cascade on delete.
4. Indexes added for frequently queried columns: guru_id and hari on jadwal_kbms,
   guru_id and tanggal on agenda_gurus, guru_id on jadwal_pikets, and tanggal_izin +
   guru_piket_id on izin_guru_pikets.
*/

-- =====================
-- Table: jadwal_kbms
-- =====================
CREATE TABLE IF NOT EXISTS jadwal_kbms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id uuid NOT NULL REFERENCES gurus(id) ON DELETE CASCADE,
  hari text NOT NULL CHECK (hari IN ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')),
  jam_ke integer NOT NULL CHECK (jam_ke >= 1 AND jam_ke <= 12),
  kelas_id uuid NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  mata_pelajaran text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jadwal_kbms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_jadwal_kbms" ON jadwal_kbms;
CREATE POLICY "select_jadwal_kbms" ON jadwal_kbms FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_jadwal_kbms" ON jadwal_kbms;
CREATE POLICY "insert_jadwal_kbms" ON jadwal_kbms FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_jadwal_kbms" ON jadwal_kbms;
CREATE POLICY "update_jadwal_kbms" ON jadwal_kbms FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_jadwal_kbms" ON jadwal_kbms;
CREATE POLICY "delete_jadwal_kbms" ON jadwal_kbms FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_jadwal_kbms_guru_id ON jadwal_kbms(guru_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_kbms_hari ON jadwal_kbms(hari);

-- =====================
-- Table: agenda_gurus
-- =====================
CREATE TABLE IF NOT EXISTS agenda_gurus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id uuid NOT NULL REFERENCES gurus(id) ON DELETE CASCADE,
  jadwal_kbm_id uuid REFERENCES jadwal_kbms(id) ON DELETE SET NULL,
  tanggal date NOT NULL,
  status_kehadiran text NOT NULL CHECK (status_kehadiran IN ('Hadir','Tidak Hadir')),
  catatan_materi text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agenda_gurus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_agenda_gurus" ON agenda_gurus;
CREATE POLICY "select_agenda_gurus" ON agenda_gurus FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_agenda_gurus" ON agenda_gurus;
CREATE POLICY "insert_agenda_gurus" ON agenda_gurus FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_agenda_gurus" ON agenda_gurus;
CREATE POLICY "update_agenda_gurus" ON agenda_gurus FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_agenda_gurus" ON agenda_gurus;
CREATE POLICY "delete_agenda_gurus" ON agenda_gurus FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_agenda_gurus_guru_id ON agenda_gurus(guru_id);
CREATE INDEX IF NOT EXISTS idx_agenda_gurus_tanggal ON agenda_gurus(tanggal);

-- =====================
-- Table: jadwal_pikets
-- =====================
CREATE TABLE IF NOT EXISTS jadwal_pikets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id uuid NOT NULL REFERENCES gurus(id) ON DELETE CASCADE,
  hari_piket text NOT NULL CHECK (hari_piket IN ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jadwal_pikets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_jadwal_pikets" ON jadwal_pikets;
CREATE POLICY "select_jadwal_pikets" ON jadwal_pikets FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_jadwal_pikets" ON jadwal_pikets;
CREATE POLICY "insert_jadwal_pikets" ON jadwal_pikets FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_jadwal_pikets" ON jadwal_pikets;
CREATE POLICY "update_jadwal_pikets" ON jadwal_pikets FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_jadwal_pikets" ON jadwal_pikets;
CREATE POLICY "delete_jadwal_pikets" ON jadwal_pikets FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_jadwal_pikets_guru_id ON jadwal_pikets(guru_id);

-- =====================
-- Table: izin_guru_pikets
-- =====================
CREATE TABLE IF NOT EXISTS izin_guru_pikets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_izin_id uuid NOT NULL REFERENCES gurus(id) ON DELETE CASCADE,
  tanggal_izin date NOT NULL,
  alasan_izin text NOT NULL,
  titipan_tugas text NOT NULL,
  kelas_id uuid NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  mata_pelajaran text NOT NULL,
  status_penanganan text NOT NULL DEFAULT 'Menunggu' CHECK (status_penanganan IN ('Menunggu','Ditangani')),
  guru_piket_id uuid REFERENCES gurus(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE izin_guru_pikets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_izin_guru_pikets" ON izin_guru_pikets;
CREATE POLICY "select_izin_guru_pikets" ON izin_guru_pikets FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_izin_guru_pikets" ON izin_guru_pikets;
CREATE POLICY "insert_izin_guru_pikets" ON izin_guru_pikets FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_izin_guru_pikets" ON izin_guru_pikets;
CREATE POLICY "update_izin_guru_pikets" ON izin_guru_pikets FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_izin_guru_pikets" ON izin_guru_pikets;
CREATE POLICY "delete_izin_guru_pikets" ON izin_guru_pikets FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_izin_guru_pikets_tanggal ON izin_guru_pikets(tanggal_izin);
CREATE INDEX IF NOT EXISTS idx_izin_guru_pikets_guru_piket ON izin_guru_pikets(guru_piket_id);
CREATE INDEX IF NOT EXISTS idx_izin_guru_pikets_status ON izin_guru_pikets(status_penanganan);
