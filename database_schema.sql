
-- 0. Enable Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Teachers Table
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  nfc_uid text UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Students Table
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

-- 3. Create Counselors Table
CREATE TABLE IF NOT EXISTS public.counselors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Appointment Statuses Table
CREATE TABLE IF NOT EXISTS public.appointment_statuses (
  status text PRIMARY KEY
);

INSERT INTO public.appointment_statuses (status) VALUES
('PENDING'),
('CONFIRMED'),
('CANCELLED'),
('COMPLETED'),
('VERIFYING'),
('ACCEPTED'),
('DENIED')
ON CONFLICT (status) DO NOTHING;

-- 5. Create Appointments Table
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

-- 6. Add Missing Columns (Transfers, Rescheduling)
DO $$
BEGIN
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transfer_request_to_id uuid;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transfer_request_to_name text;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transfer_counselor_accepted boolean DEFAULT false;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transfer_student_accepted boolean DEFAULT false;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reschedule_proposed_date text;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reschedule_proposed_time text;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_status_fkey') THEN
        ALTER TABLE public.appointments 
        ADD CONSTRAINT appointments_status_fkey 
        FOREIGN KEY (status) REFERENCES public.appointment_statuses(status);
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 7. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Create Availability Table
CREATE TABLE IF NOT EXISTS public.availability (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  counselor_id uuid REFERENCES public.counselors(id) NOT NULL,
  date text NOT NULL,
  slots jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(counselor_id, date)
);

-- 9. Cleanup legacy entry functions
DROP FUNCTION IF EXISTS get_nfc_appointment(text);

-- 10. Insert Initial Data
INSERT INTO public.students (student_id_number, password, name, section, parent_phone_number)
VALUES 
  ('02000385842', 'password', 'Ashly Misha C. Espina', 'MAWD-202', '0917-123-4567'),
  ('02000123456', 'password', 'Will Byers', 'STEM-101', '0917-987-6543')
ON CONFLICT (student_id_number) DO NOTHING;

INSERT INTO public.counselors (name, email)
VALUES 
  ('Ms. Christina Sharah K. Manangguit', 'wackylooky@gmail.com'),
  ('Ms. Mary Jane M. Lalamunan', 'tlga.ashlyespina@gmail.com')
ON CONFLICT (email) DO NOTHING;
