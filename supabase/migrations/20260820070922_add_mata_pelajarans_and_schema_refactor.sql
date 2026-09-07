/*
# Schema Update: mata_pelajarans table + mapel_id foreign keys + time-based schedule + izin/agenda changes

## New Table
- `mata_pelajarans` (id, nama_mapel) - normalized subject list

## Modified Tables
1. `gurus` - add `mapel_id` (nullable FK to mata_pelajarans)
2. `jadwal_kbms` - add `mapel_id`, `waktu_mulai` (TIME), `waktu_selesai` (TIME)
3. `nilais` - add `mapel_id` (nullable FK)
4. `izin_guru_pikets` - add `mapel_id`, `kategori_izin` ('Sakit'|'Izin'), `keterangan_izin`
5. `agenda_gurus` - add `menit_terlambat` (INT), `alpa_jam_pelajaran` (INT)

## Notes
- Old text columns (mata_pelajaran, alasan_izin) are kept for backward compatibility
- New columns are nullable where existing data must remain valid
- mapel_id columns are nullable so existing rows are not broken
*/

-- =====================
-- Table: mata_pelajarans
-- =====================
CREATE TABLE IF NOT EXISTS mata_pelajarans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_mapel text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mata_pelajarans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_mata_pelajarans" ON mata_pelajarans;
CREATE POLICY "select_mata_pelajarans" ON mata_pelajarans FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_mata_pelajarans" ON mata_pelajarans;
CREATE POLICY "insert_mata_pelajarans" ON mata_pelajarans FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_mata_pelajarans" ON mata_pelajarans;
CREATE POLICY "update_mata_pelajarans" ON mata_pelajarans FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_mata_pelajarans" ON mata_pelajarans;
CREATE POLICY "delete_mata_pelajarans" ON mata_pelajarans FOR DELETE
  TO authenticated USING (true);

-- =====================
-- Alter: gurus (add mapel_id)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gurus' AND column_name = 'mapel_id'
  ) THEN
    ALTER TABLE gurus ADD COLUMN mapel_id uuid REFERENCES mata_pelajarans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================
-- Alter: jadwal_kbms (add mapel_id, waktu_mulai, waktu_selesai)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jadwal_kbms' AND column_name = 'mapel_id'
  ) THEN
    ALTER TABLE jadwal_kbms ADD COLUMN mapel_id uuid REFERENCES mata_pelajarans(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jadwal_kbms' AND column_name = 'waktu_mulai'
  ) THEN
    ALTER TABLE jadwal_kbms ADD COLUMN waktu_mulai time;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jadwal_kbms' AND column_name = 'waktu_selesai'
  ) THEN
    ALTER TABLE jadwal_kbms ADD COLUMN waktu_selesai time;
  END IF;
END $$;

-- =====================
-- Alter: nilais (add mapel_id)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nilais' AND column_name = 'mapel_id'
  ) THEN
    ALTER TABLE nilais ADD COLUMN mapel_id uuid REFERENCES mata_pelajarans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================
-- Alter: izin_guru_pikets (add mapel_id, kategori_izin, keterangan_izin)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'izin_guru_pikets' AND column_name = 'mapel_id'
  ) THEN
    ALTER TABLE izin_guru_pikets ADD COLUMN mapel_id uuid REFERENCES mata_pelajarans(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'izin_guru_pikets' AND column_name = 'kategori_izin'
  ) THEN
    ALTER TABLE izin_guru_pikets ADD COLUMN kategori_izin text
      CHECK (kategori_izin IN ('Sakit', 'Izin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'izin_guru_pikets' AND column_name = 'keterangan_izin'
  ) THEN
    ALTER TABLE izin_guru_pikets ADD COLUMN keterangan_izin text;
  END IF;
END $$;

-- =====================
-- Alter: agenda_gurus (add menit_terlambat, alpa_jam_pelajaran)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agenda_gurus' AND column_name = 'menit_terlambat'
  ) THEN
    ALTER TABLE agenda_gurus ADD COLUMN menit_terlambat integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agenda_gurus' AND column_name = 'alpa_jam_pelajaran'
  ) THEN
    ALTER TABLE agenda_gurus ADD COLUMN alpa_jam_pelajaran integer NOT NULL DEFAULT 0;
  END IF;
END $$;
