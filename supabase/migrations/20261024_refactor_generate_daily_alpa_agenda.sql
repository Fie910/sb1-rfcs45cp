-- =============================================================================
-- Refactor pg_cron function: resolve 7 status + hybrid + combined class
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_daily_alpa_agenda(target_date date)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    today_day_name TEXT;
BEGIN
    -- Skip hari libur
    IF EXISTS (SELECT 1 FROM hari_liburs WHERE tanggal = target_date) THEN
        RETURN;
    END IF;

    today_day_name := CASE EXTRACT(DOW FROM target_date)
        WHEN 1 THEN 'Senin' WHEN 2 THEN 'Selasa' WHEN 3 THEN 'Rabu'
        WHEN 4 THEN 'Kamis' WHEN 5 THEN 'Jumat' WHEN 6 THEN 'Sabtu'
        ELSE 'Minggu'
    END;

    -- =========================================================================
    -- STEP 2: Izin/Sakit/Dinas (+ Asistensi/Tugas) — Hybrid full-day/per-sesi
    -- =========================================================================
    INSERT INTO agenda_gurus (
        guru_id, jadwal_kbm_id, tanggal, status_kehadiran,
        alpa_jam_pelajaran, menit_terlambat, catatan_materi
    )
    WITH izin_entries AS (
        SELECT 
            i.*,
            jj.waktu_mulai  AS jadwal_jm,
            jj.waktu_selesai AS jadwal_js
        FROM izin_guru_pikets i
        LEFT JOIN jadwal_kbms jj ON jj.id = i.jadwal_kbm_id
        WHERE i.tanggal_izin = target_date
    )
    SELECT DISTINCT ON (j.id)
        j.guru_id,
        j.id,
        target_date,
        -- Resolve status dari (kategori, delegasi)
        CASE 
            WHEN ie.jenis_delegasi = 'asistensi' THEN 'Asistensi'
            WHEN ie.jenis_delegasi = 'tugas'     THEN ie.kategori_izin || '+tugas'
            ELSE ie.kategori_izin
        END,
        0,
        0,
        -- Catatan materi/instruksi
        CASE
            WHEN ie.jenis_delegasi = 'asistensi' 
                THEN 'Sistem: Asistensi oleh ' || COALESCE(ie.nama_asisten, '-')
            WHEN ie.jenis_delegasi = 'tugas'     
                THEN 'Sistem: ' || ie.kategori_izin || ' (dengan tugas)'
            ELSE 'Sistem: ' || ie.kategori_izin
        END
    FROM jadwal_kbms j
    JOIN izin_entries ie ON ie.guru_izin_id = j.guru_id
    WHERE j.hari = today_day_name
      AND (
        -- (a) Full-day: kena semua jadwal hari itu
        ie.is_full_day = true
        -- (b) Per-sesi dengan jadwal_kbm_id: kena jadwal itu + slot yang sama (kelas gabungan)
        OR (
          ie.jadwal_kbm_id IS NOT NULL AND (
            j.id = ie.jadwal_kbm_id
            OR (j.waktu_mulai = ie.jadwal_jm AND j.waktu_selesai = ie.jadwal_js)
          )
        )
        -- (c) Legacy (jadwal_kbm_id IS NULL tapi tidak full-day): match kelas+mapel
        OR (
          ie.jadwal_kbm_id IS NULL 
          AND ie.is_full_day = false
          AND j.kelas_id = ie.kelas_id 
          AND (ie.mapel_id IS NULL OR j.mapel_id = ie.mapel_id)
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM agenda_gurus a 
        WHERE a.jadwal_kbm_id = j.id AND a.tanggal = target_date
      )
    ORDER BY j.id, ie.id;

    -- =========================================================================
    -- STEP 3: Alpa — hanya jadwal yang TIDAK tersentuh izin & belum ada agenda
    -- =========================================================================
    INSERT INTO agenda_gurus (
        guru_id, jadwal_kbm_id, tanggal, status_kehadiran,
        alpa_jam_pelajaran, menit_terlambat, catatan_materi
    )
    SELECT 
        j.guru_id,
        j.id,
        target_date,
        'Alpa',
        CEIL((EXTRACT(EPOCH FROM (j.waktu_selesai::time - j.waktu_mulai::time)) / 60) / 30)::INT,
        0,
        'Sistem Otomatis: Tidak mengisi presensi agenda'
    FROM jadwal_kbms j
    WHERE j.hari = today_day_name
      AND NOT EXISTS (
        SELECT 1 FROM agenda_gurus a 
        WHERE a.jadwal_kbm_id = j.id AND a.tanggal = target_date
      );
END;
$function$;

-- Keamanan (mengikuti pola migration sebelumnya)
REVOKE EXECUTE ON FUNCTION public.generate_daily_alpa_agenda(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_daily_alpa_agenda(date) FROM authenticated;