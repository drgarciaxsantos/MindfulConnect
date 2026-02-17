
-- 0. Enable Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Teachers Table
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  nfc_uid text UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure nfc_uid exists if table was already created without it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='nfc_uid') THEN
        ALTER TABLE public.teachers ADD COLUMN nfc_uid text UNIQUE;
    END IF;
END $$;

-- 2. MANAGE TEACHERS (EDIT THIS SECTION TO ADD MORE)
INSERT INTO public.teachers (name, nfc_uid)
VALUES 
  ('Jem Palaganas', '04:84:c8:d1:2e:61:80'),
  ('Example Teacher', '00:00:00:00:00:00:00')
ON CONFLICT (nfc_uid) DO UPDATE 
SET name = EXCLUDED.name;

-- 3. Create Students Table
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id_number text UNIQUE NOT NULL,
  password text NOT NULL, 
  name text NOT NULL,
  section text,
  parent_phone_number text,
  nfc_uid text UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure nfc_uid exists on students
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='nfc_uid') THEN
        ALTER TABLE public.students ADD COLUMN nfc_uid text UNIQUE;
    END IF;
END $$;

-- 4. Create Counselors Table
CREATE TABLE IF NOT EXISTS public.counselors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Appointment Statuses Table
CREATE TABLE IF NOT EXISTS public.appointment_statuses (
  status text PRIMARY KEY
);

INSERT INTO public.appointment_statuses (status) VALUES
('PENDING'),
('CONFIRMED'),
('CANCELLED'),
('COMPLETED'),
('VERIFYING'),
('DEPARTED')
ON CONFLICT (status) DO NOTHING;

-- Data Migration: Convert old statuses to new ones
UPDATE public.appointments SET status = 'CONFIRMED' WHERE status = 'ACCEPTED';
UPDATE public.appointments SET status = 'CANCELLED' WHERE status = 'DENIED';

-- Cleanup: Remove old statuses if they exist
DELETE FROM public.appointment_statuses WHERE status IN ('ACCEPTED', 'DENIED');

-- 6. Create Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid REFERENCES public.students(id),
  student_id_number text,
  student_name text,
  section text,
  parent_phone_number text,
  has_consent boolean DEFAULT false,
  counselor_id uuid REFERENCES public.counselors(id),
  counselor_name text,
  date text,
  time text,
  reason text,
  description text,
  status text DEFAULT 'PENDING' REFERENCES public.appointment_statuses(status),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Add Missing Columns (Transfers, Rescheduling, Verification)
DO $$
BEGIN
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transfer_request_to_id uuid;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transfer_request_to_name text;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transfer_counselor_accepted boolean DEFAULT false;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transfer_student_accepted boolean DEFAULT false;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reschedule_proposed_date text;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reschedule_proposed_time text;
    
    -- Added column for teacher verification
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS verified_by_teacher_name text;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_status_fkey') THEN
        ALTER TABLE public.appointments 
        ADD CONSTRAINT appointments_status_fkey 
        FOREIGN KEY (status) REFERENCES public.appointment_statuses(status);
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 8. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Create Availability Table
CREATE TABLE IF NOT EXISTS public.availability (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  counselor_id uuid REFERENCES public.counselors(id) NOT NULL,
  date text NOT NULL,
  slots jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(counselor_id, date)
);

-- 10. HELPER FUNCTION FOR AUTHENTICATOR
DROP FUNCTION IF EXISTS get_nfc_appointment(text);

CREATE OR REPLACE FUNCTION get_nfc_appointment(scan_nfc_uid text)
RETURNS TABLE (
    appointment_id uuid,
    student_name text,
    student_id_number text,
    section text,
    counselor_name text,
    appt_time text,
    status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.student_name,
        a.student_id_number,
        a.section,
        a.counselor_name,
        a.time,
        a.status
    FROM public.appointments a
    JOIN public.students s ON a.student_id = s.id
    WHERE s.nfc_uid = scan_nfc_uid
      AND a.date = to_char(now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')
      AND a.status IN ('PENDING', 'CONFIRMED')
      -- RESTRICTION: Current Time (PH) must be >= Appointment Time - 15 minutes
      AND (now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::timestamp >= ((a.date || ' ' || a.time)::timestamp - interval '15 minutes');
END;
$$ LANGUAGE plpgsql;

-- 11. Insert Data (Students & Counselors)
UPDATE public.students SET nfc_uid = NULL WHERE nfc_uid IN ('04:73:29:D2:2E:61:80', '04:E0:28:D6:2E:61:80');

INSERT INTO public.students (student_id_number, password, name, section, parent_phone_number, nfc_uid)
VALUES 
  ('02000385842', 'password', 'Ashly Misha C. Espina', 'MAWD-202', '0917-123-4567', '04:73:29:D2:2E:61:80'),
  ('02000123456', 'password', 'Will Byers', 'STEM-101', '0917-987-6543', NULL),
  ('02000246810', 'password', 'Viktor Hargreeves', 'MAWD-202', '0977-777-7777', '04:E0:28:D6:2E:61:80'),
  ('02000131313', 'password', 'Banana Joe', 'STEM-103', '0913-131-3131', NULL),
  ('02000654321', 'password', 'Harleen Quinzel', 'HUMSS-205', '0945-678,9101', NULL),
  ('02000111111', 'password', 'Pamela Isley', 'ABM-204', '0924-681-1012', NULL),
  ('02000222222', 'password', 'Caitlyn Kirraman', 'MAWD-202', '0942-863-4851', NULL),
  ('02000333333', 'password', 'Sheldon Cooper', 'STEM-101', '0956-246-9563', NULL)
ON CONFLICT (student_id_number) 
DO UPDATE SET 
  nfc_uid = EXCLUDED.nfc_uid,
  name = EXCLUDED.name,
  section = EXCLUDED.section;

INSERT INTO public.counselors (name, email)
VALUES 
  ('Ms. Christina Sharah K. Manangguit', 'wackylooky@gmail.com'),
  ('Ms. Mary Jane M. Lalamunan', 'tlga.ashlyespina@gmail.com'),
  ('Ms. Elizabeth T. Cape', 'spnashly@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 12. GENERATE TEST APPOINTMENT
-- Uses Asia/Manila time to match the logic in get_nfc_appointment
INSERT INTO public.appointments (
  student_id, student_id_number, student_name, section, 
  counselor_id, counselor_name, 
  date, time, reason, status, verified_by_teacher_name
)
SELECT 
  s.id, s.student_id_number, s.name, s.section,
  c.id, c.name,
  to_char(now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD'),
  to_char(now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'HH24:MI'),
  'NFC Gate Verification Test',
  'VERIFYING',
  'Jem Palaganas'
FROM public.students s, public.counselors c
WHERE s.student_id_number = '02000385842'
AND c.email = 'wackylooky@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM public.appointments a 
    WHERE a.student_id = s.id 
      AND a.date = to_char(now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')
);

-- 13. AUTOMATED SYNC TRIGGERS

CREATE OR REPLACE FUNCTION update_availability_slot(
  p_counselor_id uuid,
  p_date text,
  p_time text,
  p_is_booked boolean
) RETURNS void AS $$
BEGIN
  UPDATE public.availability a
  SET slots = (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'time') = p_time THEN 
          jsonb_set(elem, '{isBooked}', to_jsonb(p_is_booked))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(a.slots) AS elem
  )
  WHERE counselor_id = p_counselor_id AND date = p_date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_appointment_to_availability() RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE
  IF (TG_OP = 'DELETE') THEN
     PERFORM update_availability_slot(OLD.counselor_id, OLD.date, OLD.time, false);
     RETURN OLD;
  END IF;

  -- Handle UPDATE
  IF (TG_OP = 'UPDATE') THEN
     -- Status change: Cancelled/Completed -> Free slot
     IF NEW.status IN ('CANCELLED', 'COMPLETED') AND OLD.status IN ('PENDING', 'CONFIRMED') THEN
        PERFORM update_availability_slot(OLD.counselor_id, OLD.date, OLD.time, false);
     END IF;
     
     -- Status change: Confirmed/Pending -> Book slot
     IF NEW.status IN ('PENDING', 'CONFIRMED') AND OLD.status IN ('CANCELLED', 'COMPLETED') THEN
        PERFORM update_availability_slot(NEW.counselor_id, NEW.date, NEW.time, true);
     END IF;

     -- Reschedule (Time/Date change)
     IF (OLD.date <> NEW.date OR OLD.time <> NEW.time) THEN
        PERFORM update_availability_slot(OLD.counselor_id, OLD.date, OLD.time, false);
        IF NEW.status IN ('PENDING', 'CONFIRMED') THEN
            PERFORM update_availability_slot(NEW.counselor_id, NEW.date, NEW.time, true);
        END IF;
     END IF;
  END IF;

  -- Handle INSERT
  IF (TG_OP = 'INSERT') THEN
     IF NEW.status IN ('PENDING', 'CONFIRMED') THEN
        PERFORM update_availability_slot(NEW.counselor_id, NEW.date, NEW.time, true);
     END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_availability ON public.appointments;
CREATE TRIGGER trigger_sync_availability
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION sync_appointment_to_availability();

-- 14. DATA RE-SYNC SCRIPT
WITH expanded_slots AS (
    SELECT 
        a.id AS avail_id,
        a.counselor_id,
        a.date,
        elem->>'time' as time,
        elem->>'id' as slot_id
    FROM public.availability a,
    jsonb_array_elements(a.slots) elem
),
matched_status AS (
    SELECT 
        es.avail_id,
        es.time,
        es.slot_id,
        EXISTS (
            SELECT 1 FROM public.appointments appt
            WHERE appt.counselor_id = es.counselor_id 
              AND appt.date = es.date 
              AND appt.time = es.time
              AND appt.status IN ('PENDING', 'CONFIRMED')
        ) as is_actually_booked
    FROM expanded_slots es
),
reconstructed_slots AS (
    SELECT 
        avail_id,
        jsonb_agg(
            jsonb_build_object(
                'id', slot_id,
                'time', time,
                'isBooked', is_actually_booked
            ) ORDER BY time
        ) as new_slots
    FROM matched_status
    GROUP BY avail_id
)
UPDATE public.availability a
SET slots = rs.new_slots
FROM reconstructed_slots rs
WHERE a.id = rs.avail_id;


-- 15. MANUAL DATA SEEDING (Specific Slots Requested)
DO $$
DECLARE
    mj_id uuid;
    eliz_id uuid;
    sharah_id uuid;
    s_id uuid;
    s_num text;
    s_name text;
    s_sec text;
BEGIN
    SELECT id INTO mj_id FROM public.counselors WHERE email = 'tlga.ashlyespina@gmail.com';
    SELECT id INTO eliz_id FROM public.counselors WHERE email = 'spnashly@gmail.com';
    SELECT id INTO sharah_id FROM public.counselors WHERE email = 'wackylooky@gmail.com';
    
    SELECT id, student_id_number, name, section 
    INTO s_id, s_num, s_name, s_sec
    FROM public.students LIMIT 1;

    -- Mary Jane M. Lalamunan: Dec 8, 2025 -> 9am, 12pm
    INSERT INTO public.availability (counselor_id, date, slots)
    VALUES (mj_id, '2025-12-08', '[
        {"id": "2025-12-08-09:00", "time": "09:00", "isBooked": true},
        {"id": "2025-12-08-12:00", "time": "12:00", "isBooked": true}
    ]'::jsonb)
    ON CONFLICT (counselor_id, date) DO UPDATE SET slots = EXCLUDED.slots;

    INSERT INTO public.appointments (student_id, student_id_number, student_name, section, counselor_id, counselor_name, date, time, reason, status)
    VALUES 
    (s_id, s_num, s_name, s_sec, mj_id, 'Ms. Mary Jane M. Lalamunan', '2025-12-08', '09:00', 'Manual Booking', 'CONFIRMED'),
    (s_id, s_num, s_name, s_sec, mj_id, 'Ms. Mary Jane M. Lalamunan', '2025-12-08', '12:00', 'Manual Booking', 'CONFIRMED')
    ON CONFLICT DO NOTHING;

    -- Elizabeth T. Cape: Jan 21, 2026 -> 9am
    INSERT INTO public.availability (counselor_id, date, slots)
    VALUES (eliz_id, '2026-01-21', '[
        {"id": "2026-01-21-09:00", "time": "09:00", "isBooked": true}
    ]'::jsonb)
    ON CONFLICT (counselor_id, date) DO UPDATE SET slots = EXCLUDED.slots;

    INSERT INTO public.appointments (student_id, student_id_number, student_name, section, counselor_id, counselor_name, date, time, reason, status)
    VALUES 
    (s_id, s_num, s_name, s_sec, eliz_id, 'Ms. Elizabeth T. Cape', '2026-01-21', '09:00', 'Manual Booking', 'CONFIRMED')
    ON CONFLICT DO NOTHING;

    -- Sharah Manangguit: Dec 8, 2025 -> 12pm
    INSERT INTO public.availability (counselor_id, date, slots)
    VALUES (sharah_id, '2025-12-08', '[
        {"id": "2025-12-08-12:00", "time": "12:00", "isBooked": true}
    ]'::jsonb)
    ON CONFLICT (counselor_id, date) DO UPDATE SET slots = EXCLUDED.slots;

    INSERT INTO public.appointments (student_id, student_id_number, student_name, section, counselor_id, counselor_name, date, time, reason, status)
    VALUES 
    (s_id, s_num, s_name, s_sec, sharah_id, 'Ms. Christina Sharah K. Manangguit', '2025-12-08', '12:00', 'Manual Booking', 'CONFIRMED')
    ON CONFLICT DO NOTHING;
END $$;

-- 16. Verification Logs Table (For ESP32 Realtime)
CREATE TABLE IF NOT EXISTS public.verification_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
