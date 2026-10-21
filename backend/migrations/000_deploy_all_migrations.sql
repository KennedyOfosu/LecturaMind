-- ============================================================================
-- LECTURAMIND DEPLOYMENT MIGRATIONS
-- Run in Supabase SQL Editor in order: 007 → 008 → 011 → 012 → 009 → 010
-- Then apply all RLS policies at the end
-- ============================================================================

-- ============================================================================
-- MIGRATION 007: Registration Identity Uniqueness
-- ============================================================================
-- Enforce case-insensitive, whitespace-normalized identity uniqueness.
-- Review and resolve any rows returned by these queries before applying:
--   SELECT lower(regexp_replace(btrim(full_name), '[[:space:]]+', ' ', 'g')), count(*)
--   FROM profiles GROUP BY 1 HAVING count(*) > 1;
--   SELECT lower(btrim(email)), count(*)
--   FROM profiles WHERE email IS NOT NULL GROUP BY 1 HAVING count(*) > 1;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name_normalized text,
  ADD COLUMN IF NOT EXISTS email_normalized text;

UPDATE profiles
SET full_name = regexp_replace(btrim(full_name), '[[:space:]]+', ' ', 'g'),
    email = lower(btrim(email)),
    full_name_normalized = lower(regexp_replace(btrim(full_name), '[[:space:]]+', ' ', 'g')),
    email_normalized = lower(btrim(email));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE full_name_normalized IS NOT NULL AND full_name_normalized <> ''
    GROUP BY full_name_normalized HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized full names exist in profiles. Resolve them before applying migration 007.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE email_normalized IS NOT NULL AND email_normalized <> ''
    GROUP BY email_normalized HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized emails exist in profiles. Resolve them before applying migration 007.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION normalize_profile_registration_identity()
RETURNS trigger AS $$
BEGIN
  NEW.full_name := regexp_replace(btrim(coalesce(NEW.full_name, '')), '[[:space:]]+', ' ', 'g');
  NEW.email := lower(btrim(coalesce(NEW.email, '')));
  NEW.full_name_normalized := lower(NEW.full_name);
  NEW.email_normalized := NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_normalize_registration_identity ON profiles;
CREATE TRIGGER profiles_normalize_registration_identity
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_profile_registration_identity();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_full_name_normalized_key
  ON profiles (full_name_normalized)
  WHERE full_name_normalized IS NOT NULL AND full_name_normalized <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_normalized_key
  ON profiles (email_normalized)
  WHERE email_normalized IS NOT NULL AND email_normalized <> '';


-- ============================================================================
-- MIGRATION 008: Lecturer Activation, Account State, and Lecturer-to-Classroom Assignments
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id_number IS NOT NULL AND btrim(user_id_number) <> ''
    GROUP BY upper(btrim(user_id_number)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate staff/student IDs exist in profiles. Resolve them before applying migration 008.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_number_normalized_key
  ON public.profiles (upper(btrim(user_id_number)))
  WHERE user_id_number IS NOT NULL AND btrim(user_id_number) <> '';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('pending_activation', 'active', 'deactivated'));

CREATE TABLE IF NOT EXISTS public.lecturer_classrooms (
  lecturer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lecturer_id, classroom_id)
);
ALTER TABLE public.lecturer_classrooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lecturer_activation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  claim_id uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lecturer_activation_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_pending_lecturer_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_staff_id text,
  p_classroom_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile public.profiles%ROWTYPE;
  requested_count integer;
  valid_count integer;
BEGIN
  requested_count := coalesce(cardinality(p_classroom_ids), 0);
  IF requested_count = 0 THEN
    RAISE EXCEPTION 'At least one classroom assignment is required.' USING ERRCODE = '22023';
  END IF;
  SELECT count(DISTINCT id) INTO valid_count
  FROM public.classrooms WHERE id = ANY(p_classroom_ids);
  IF valid_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected classrooms do not exist.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, user_id_number, account_status)
  VALUES (p_user_id, p_full_name, lower(btrim(p_email)), 'lecturer', upper(btrim(p_staff_id)), 'pending_activation')
  RETURNING * INTO new_profile;

  INSERT INTO public.lecturer_classrooms (lecturer_id, classroom_id)
  SELECT p_user_id, classroom_id
  FROM (SELECT DISTINCT unnest(p_classroom_ids) AS classroom_id) selected;

  RETURN jsonb_build_object(
    'id', new_profile.id,
    'full_name', new_profile.full_name,
    'email', new_profile.email,
    'role', new_profile.role,
    'user_id_number', new_profile.user_id_number,
    'account_status', new_profile.account_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_lecturer_activation(
  p_token_hash text,
  p_claim_id uuid
) RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_user_id uuid;
BEGIN
  UPDATE public.lecturer_activation_tokens AS activation
  SET claim_id = p_claim_id, claimed_at = now()
  WHERE activation.token_hash = p_token_hash
    AND activation.expires_at > now()
    AND activation.used_at IS NULL
    AND (activation.claimed_at IS NULL OR activation.claimed_at < now() - interval '5 minutes')
    AND EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = activation.user_id
        AND profile.role = 'lecturer'
        AND profile.account_status = 'pending_activation'
    )
  RETURNING activation.user_id INTO claimed_user_id;

  IF claimed_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT profile.id, profile.email, profile.full_name
    FROM public.profiles AS profile WHERE profile.id = claimed_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_lecturer_activation(
  p_user_id uuid,
  p_claim_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count integer;
BEGIN
  UPDATE public.lecturer_activation_tokens
  SET used_at = now(), claim_id = NULL, claimed_at = NULL
  WHERE user_id = p_user_id AND claim_id = p_claim_id
    AND used_at IS NULL AND expires_at > now();
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'Activation claim is no longer valid.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET account_status = 'active', activated_at = now()
  WHERE id = p_user_id AND role = 'lecturer' AND account_status = 'pending_activation';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'Lecturer account is no longer pending activation.' USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_lecturer_activation_claim(
  p_user_id uuid,
  p_claim_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lecturer_activation_tokens
  SET claim_id = NULL, claimed_at = NULL
  WHERE user_id = p_user_id AND claim_id = p_claim_id AND used_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_lecturer_classrooms(
  p_lecturer_id uuid,
  p_classroom_ids uuid[]
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_count integer;
  valid_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_lecturer_id AND role = 'lecturer'
  ) THEN
    RAISE EXCEPTION 'Lecturer account not found.' USING ERRCODE = 'P0002';
  END IF;
  requested_count := coalesce(cardinality(p_classroom_ids), 0);
  IF requested_count = 0 THEN
    RAISE EXCEPTION 'At least one classroom assignment is required.' USING ERRCODE = '22023';
  END IF;
  SELECT count(DISTINCT id) INTO valid_count
  FROM public.classrooms WHERE id = ANY(p_classroom_ids);
  IF valid_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected classrooms do not exist.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.lecturer_classrooms WHERE lecturer_id = p_lecturer_id;
  INSERT INTO public.lecturer_classrooms (lecturer_id, classroom_id)
  SELECT p_lecturer_id, classroom_id
  FROM (SELECT DISTINCT unnest(p_classroom_ids) AS classroom_id) selected;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pending_lecturer_profile(uuid, text, text, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_lecturer_activation(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_lecturer_activation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_lecturer_activation_claim(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lecturer_classrooms(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_lecturer_profile(uuid, text, text, text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_lecturer_activation(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_lecturer_activation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_lecturer_activation_claim(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lecturer_classrooms(uuid, uuid[]) TO service_role;


-- ============================================================================
-- MIGRATION 011: Account ID Generation
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id_number IS NOT NULL AND btrim(user_id_number) <> ''
    GROUP BY upper(btrim(user_id_number)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized IDs exist in profiles. Resolve them before applying migration 011.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_number_normalized_key
  ON public.profiles (upper(btrim(user_id_number)))
  WHERE user_id_number IS NOT NULL AND btrim(user_id_number) <> '';

CREATE SEQUENCE IF NOT EXISTS public.lecturer_id_sequence
  AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.student_id_sequence
  AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 NO CYCLE;

DO $$
DECLARE
  existing_max integer;
  sequence_last integer;
  sequence_called boolean;
BEGIN
  SELECT coalesce(max(substring(upper(btrim(user_id_number)) FROM 5)::integer), 0)
  INTO existing_max FROM public.profiles
  WHERE role = 'lecturer' AND upper(btrim(user_id_number)) ~ '^LEC-[0-9]{4}$';
  SELECT last_value, is_called INTO sequence_last, sequence_called FROM public.lecturer_id_sequence;
  IF sequence_called OR existing_max > 0 THEN
    PERFORM setval('public.lecturer_id_sequence', greatest(sequence_last, existing_max, 1), true);
  ELSE
    PERFORM setval('public.lecturer_id_sequence', 1, false);
  END IF;

  SELECT coalesce(max(substring(upper(btrim(user_id_number)) FROM 5)::integer), 0)
  INTO existing_max FROM public.profiles
  WHERE role = 'student' AND upper(btrim(user_id_number)) ~ '^STU-[0-9]{4}$';
  SELECT last_value, is_called INTO sequence_last, sequence_called FROM public.student_id_sequence;
  IF sequence_called OR existing_max > 0 THEN
    PERFORM setval('public.student_id_sequence', greatest(sequence_last, existing_max, 1), true);
  ELSE
    PERFORM setval('public.student_id_sequence', 1, false);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.account_id_reservations (
  reservation_token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_number text NOT NULL,
  role text NOT NULL CHECK (role IN ('lecturer', 'student')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS account_id_reservations_normalized_id_key
  ON public.account_id_reservations (upper(btrim(user_id_number)));
CREATE INDEX IF NOT EXISTS account_id_reservations_expiry_idx
  ON public.account_id_reservations (expires_at);
ALTER TABLE public.account_id_reservations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_account_id_reservation(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_role text := lower(btrim(coalesce(p_role, '')));
  id_prefix text;
  sequence_name regclass;
  next_number integer;
  candidate text;
  new_token uuid;
  expires timestamptz;
BEGIN
  IF normalized_role = 'lecturer' THEN
    id_prefix := 'LEC';
    sequence_name := 'public.lecturer_id_sequence'::regclass;
  ELSIF normalized_role = 'student' THEN
    id_prefix := 'STU';
    sequence_name := 'public.student_id_sequence'::regclass;
  ELSE
    RAISE EXCEPTION 'Unsupported account role.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.account_id_reservations WHERE expires_at <= now();

  LOOP
    BEGIN
      next_number := nextval(sequence_name);
    EXCEPTION WHEN SQLSTATE '2200H' THEN
      RAISE EXCEPTION 'ID_EXHAUSTED:%', normalized_role USING ERRCODE = 'P0001';
    END;

    candidate := id_prefix || '-' || lpad(next_number::text, 4, '0');
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE upper(btrim(user_id_number)) = candidate
    ) THEN
      CONTINUE;
    END IF;

    new_token := gen_random_uuid();
    expires := now() + interval '30 minutes';
    INSERT INTO public.account_id_reservations (
      reservation_token, user_id_number, role, expires_at
    ) VALUES (new_token, candidate, normalized_role, expires)
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'user_id_number', candidate,
        'reservation_token', new_token,
        'expires_at', expires
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_account_id_reservation(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.account_id_reservations WHERE reservation_token = p_token;
  RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.create_pending_lecturer_profile(uuid, text, text, text, uuid[]);
DROP FUNCTION IF EXISTS public.create_pending_lecturer_profile(uuid, text, text, text, uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.create_pending_lecturer_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_staff_id text,
  p_reservation_token uuid,
  p_classroom_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile public.profiles%ROWTYPE;
  requested_count integer;
  valid_count integer;
  reserved_id text;
BEGIN
  SELECT user_id_number INTO reserved_id
  FROM public.account_id_reservations
  WHERE reservation_token = p_reservation_token
    AND role = 'lecturer'
    AND user_id_number = upper(btrim(coalesce(p_staff_id, '')))
    AND expires_at > now()
  FOR UPDATE;
  IF reserved_id IS NULL OR reserved_id !~ '^LEC-[0-9]{4}$' THEN
    RAISE EXCEPTION 'ID_RESERVATION_INVALID' USING ERRCODE = 'P0001';
  END IF;

  requested_count := coalesce(cardinality(p_classroom_ids), 0);
  IF requested_count = 0 THEN
    RAISE EXCEPTION 'At least one classroom assignment is required.' USING ERRCODE = '22023';
  END IF;
  SELECT count(DISTINCT id) INTO valid_count
  FROM public.classrooms WHERE id = ANY(p_classroom_ids);
  IF valid_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected classrooms do not exist.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, user_id_number, account_status)
  VALUES (p_user_id, p_full_name, lower(btrim(p_email)), 'lecturer', reserved_id, 'pending_activation')
  RETURNING * INTO new_profile;

  INSERT INTO public.lecturer_classrooms (lecturer_id, classroom_id)
  SELECT p_user_id, classroom_id
  FROM (SELECT DISTINCT unnest(p_classroom_ids) AS classroom_id) selected;

  DELETE FROM public.account_id_reservations WHERE reservation_token = p_reservation_token;

  RETURN jsonb_build_object(
    'id', new_profile.id,
    'full_name', new_profile.full_name,
    'email', new_profile.email,
    'role', new_profile.role,
    'user_id_number', new_profile.user_id_number,
    'account_status', new_profile.account_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_student_profile_with_id_reservation(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_user_id_number text,
  p_reservation_token uuid,
  p_programme text,
  p_level integer,
  p_academic_year text,
  p_classroom_id uuid,
  p_section text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile public.profiles%ROWTYPE;
  reserved_id text;
BEGIN
  SELECT user_id_number INTO reserved_id
  FROM public.account_id_reservations
  WHERE reservation_token = p_reservation_token
    AND role = 'student'
    AND user_id_number = upper(btrim(coalesce(p_user_id_number, '')))
    AND expires_at > now()
  FOR UPDATE;
  IF reserved_id IS NULL OR reserved_id !~ '^STU-[0-9]{4}$' THEN
    RAISE EXCEPTION 'ID_RESERVATION_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_classroom_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.classrooms WHERE id = p_classroom_id
  ) THEN
    RAISE EXCEPTION 'Selected class does not exist.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, email, role, user_id_number, programme, level,
    academic_year, classroom_id, section
  ) VALUES (
    p_user_id, p_full_name, lower(btrim(p_email)), 'student', reserved_id,
    nullif(btrim(coalesce(p_programme, '')), ''), p_level,
    nullif(btrim(coalesce(p_academic_year, '')), ''), p_classroom_id,
    nullif(btrim(coalesce(p_section, '')), '')
  ) RETURNING * INTO new_profile;

  DELETE FROM public.account_id_reservations WHERE reservation_token = p_reservation_token;
  RETURN jsonb_build_object(
    'id', new_profile.id,
    'full_name', new_profile.full_name,
    'email', new_profile.email,
    'role', new_profile.role,
    'user_id_number', new_profile.user_id_number,
    'classroom_id', new_profile.classroom_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_account_id_reservation(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_account_id_reservation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_pending_lecturer_profile(uuid, text, text, text, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_student_profile_with_id_reservation(uuid, text, text, text, uuid, text, integer, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_account_id_reservation(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_account_id_reservation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_pending_lecturer_profile(uuid, text, text, text, uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_student_profile_with_id_reservation(uuid, text, text, text, uuid, text, integer, text, uuid, text) TO service_role;


-- ============================================================================
-- MIGRATION 012: Classrooms and Physical Rooms
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.physical_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  building text,
  campus text,
  capacity integer NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS physical_rooms_code_normalized_key
  ON public.physical_rooms (upper(btrim(code)));
CREATE UNIQUE INDEX IF NOT EXISTS physical_rooms_location_identity_key
  ON public.physical_rooms (
    upper(btrim(name)), upper(btrim(coalesce(building, ''))), upper(btrim(coalesce(campus, '')))
  );

ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS programme text,
  ADD COLUMN IF NOT EXISTS level integer,
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.physical_rooms(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.classrooms'::regclass
      AND conname = 'classrooms_level_valid_check'
  ) THEN
    ALTER TABLE public.classrooms
      ADD CONSTRAINT classrooms_level_valid_check
      CHECK (level IS NULL OR level IN (100, 200, 300, 400));
  END IF;
END;
$$;

WITH parsed AS (
  SELECT c.id, btrim((regexp_match(c.name, '^(.*)\s+-\s+Level\s+(100|200|300|400)$', 'i'))[1]) AS programme,
         ((regexp_match(c.name, '^(.*)\s+-\s+Level\s+(100|200|300|400)$', 'i'))[2])::integer AS level
  FROM public.classrooms c
), verified AS (
  SELECT p.* FROM parsed p
  WHERE p.programme IS NOT NULL AND p.programme <> '' AND p.level IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.courses c WHERE lower(btrim(c.programme)) = lower(p.programme) AND c.level = p.level)
)
UPDATE public.classrooms target
SET programme = verified.programme, level = verified.level
FROM verified WHERE target.id = verified.id
  AND (target.programme IS NULL OR target.level IS NULL);

CREATE TABLE IF NOT EXISTS public.classroom_migration_review (
  classroom_id uuid PRIMARY KEY REFERENCES public.classrooms(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  reason text NOT NULL,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.classroom_migration_review (classroom_id, original_name, reason)
SELECT c.id, c.name,
       CASE WHEN c.programme IS NULL OR c.level IS NULL
         THEN 'Program and level could not be verified from the existing classroom name and course records; physical room is also missing.'
         ELSE 'Program and level were verified, but the source record has no physical room name or room code. Assign an existing room or create one.'
       END
FROM public.classrooms c
WHERE c.room_id IS NULL
ON CONFLICT (classroom_id) DO UPDATE SET original_name = EXCLUDED.original_name, reason = EXCLUDED.reason;

ALTER TABLE public.course_schedules
  ADD COLUMN IF NOT EXISTS physical_room_id uuid REFERENCES public.physical_rooms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_course_schedules_physical_room
  ON public.course_schedules(physical_room_id, academic_year, semester, day_of_week, start_time);

CREATE OR REPLACE FUNCTION public.save_classroom_with_room(
  p_classroom_id uuid,
  p_programme text,
  p_level integer,
  p_room_id uuid,
  p_room_name text,
  p_room_code text,
  p_building text,
  p_campus text,
  p_capacity integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_programme text := btrim(coalesce(p_programme, ''));
  room_record public.physical_rooms%ROWTYPE;
  class_record public.classrooms%ROWTYPE;
  class_code text;
BEGIN
  IF normalized_programme = '' THEN
    RAISE EXCEPTION 'Program is required.' USING ERRCODE = '22023';
  END IF;
  IF p_level IS NULL OR p_level NOT IN (100, 200, 300, 400) THEN
    RAISE EXCEPTION 'Level must be 100, 200, 300, or 400.' USING ERRCODE = '22023';
  END IF;
  IF btrim(coalesce(p_room_name, '')) = '' OR btrim(coalesce(p_room_code, '')) = '' THEN
    RAISE EXCEPTION 'Room name and room code are required.' USING ERRCODE = '22023';
  END IF;
  IF p_capacity IS NULL OR p_capacity < 1 THEN
    RAISE EXCEPTION 'Room capacity must be at least one.' USING ERRCODE = '22023';
  END IF;

  IF p_room_id IS NULL THEN
    INSERT INTO public.physical_rooms (name, code, building, campus, capacity)
    VALUES (btrim(p_room_name), btrim(p_room_code), nullif(btrim(coalesce(p_building, '')), ''),
            nullif(btrim(coalesce(p_campus, '')), ''), p_capacity)
    RETURNING * INTO room_record;
  ELSE
    UPDATE public.physical_rooms
    SET name = btrim(p_room_name), code = btrim(p_room_code),
        building = nullif(btrim(coalesce(p_building, '')), ''),
        campus = nullif(btrim(coalesce(p_campus, '')), ''), capacity = p_capacity
    WHERE id = p_room_id
    RETURNING * INTO room_record;
    IF room_record.id IS NULL THEN
      RAISE EXCEPTION 'Selected physical room does not exist.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_classroom_id IS NULL THEN
    class_code := 'CLASS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    INSERT INTO public.classrooms (name, code, programme, level, room_id, capacity)
    VALUES (normalized_programme || ' - Level ' || p_level::text, class_code,
            normalized_programme, p_level, room_record.id, 0)
    RETURNING * INTO class_record;
  ELSE
    UPDATE public.classrooms
    SET name = normalized_programme || ' - Level ' || p_level::text,
        programme = normalized_programme, level = p_level, room_id = room_record.id
    WHERE id = p_classroom_id
    RETURNING * INTO class_record;
    IF class_record.id IS NULL THEN
      RAISE EXCEPTION 'Class group does not exist.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.classroom_migration_review WHERE classroom_id = class_record.id;
  RETURN jsonb_build_object(
    'id', class_record.id, 'name', class_record.name, 'code', class_record.code,
    'programme', class_record.programme, 'level', class_record.level,
    'room_id', room_record.id,
    'physical_room', jsonb_build_object(
      'id', room_record.id, 'name', room_record.name, 'code', room_record.code,
      'building', room_record.building, 'campus', room_record.campus, 'capacity', room_record.capacity
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_classroom_with_room(uuid, text, integer, uuid, text, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_classroom_with_room(uuid, text, integer, uuid, text, text, text, text, integer)
  TO service_role;

ALTER TABLE public.physical_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_migration_review ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- MIGRATION 009: Course Schedules
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES lecturer_assignments(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lecturer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT,
  programme VARCHAR(255) NOT NULL,
  level INTEGER NOT NULL CHECK (level IN (100, 200, 300, 400)),
  academic_year VARCHAR(100) NOT NULL,
  semester VARCHAR(100) NOT NULL,
  session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('weekday', 'weekend')),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_id UUID REFERENCES timetable_slots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time),
  CHECK (start_time >= TIME '08:00' AND end_time <= TIME '14:00'),
  CHECK (
    (session_type = 'weekday' AND day_of_week BETWEEN 1 AND 5)
    OR (session_type = 'weekend' AND day_of_week IN (0, 6))
  )
);

CREATE INDEX IF NOT EXISTS idx_course_schedules_lecturer
  ON course_schedules(lecturer_id, academic_year, semester, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_course_schedules_classroom
  ON course_schedules(classroom_id, academic_year, semester, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_course_schedules_course
  ON course_schedules(course_id);

-- Seed one weekly one-hour meeting for every current lecturer assignment.
DO $$
DECLARE
  assignment_row RECORD;
  candidate_day INTEGER;
  candidate_hour INTEGER;
  teaching_days INTEGER[];
  target_room UUID;
  target_slot UUID;
  slot_found BOOLEAN;
BEGIN
  FOR assignment_row IN
    WITH programme_counts AS (
      SELECT lecturer_id, programme, COUNT(*) AS assignment_count
      FROM lecturer_assignments
      WHERE programme IS NOT NULL
      GROUP BY lecturer_id, programme
    ), primary_programme AS (
      SELECT DISTINCT ON (lecturer_id) lecturer_id, programme
      FROM programme_counts
      ORDER BY lecturer_id, assignment_count DESC, programme
    ), lecturer_modes AS (
      SELECT p.id,
             CASE WHEN pp.programme = 'BSc Information Technology'
                  THEN 'weekday' ELSE 'weekend' END AS session_type
      FROM profiles p
      JOIN primary_programme pp ON pp.lecturer_id = p.id
      WHERE p.role = 'lecturer' AND COALESCE(p.account_status, 'active') = 'active'
    )
    SELECT la.id AS assignment_id,
           la.course_id,
           la.lecturer_id,
           la.programme,
           la.level,
           COALESCE(la.academic_year, c.academic_year, '2026/2027') AS academic_year,
           COALESCE(la.semester, c.semester, 'Semester 1') AS semester,
           lm.session_type,
           CASE
             WHEN la.programme = 'BSc Information Technology' THEN 'BIT'
             WHEN la.programme = 'BSc Information Systems' THEN 'BIS'
             WHEN la.programme = 'BSc Business Administration' THEN 'BBA'
           END || '-' || la.level::TEXT AS classroom_code
    FROM lecturer_assignments la
    JOIN courses c ON c.id = la.course_id
    JOIN lecturer_modes lm ON lm.id = la.lecturer_id
    WHERE la.programme IS NOT NULL
      AND la.level IN (100, 200, 300, 400)
      AND NOT EXISTS (
        SELECT 1 FROM course_schedules existing
        WHERE existing.assignment_id = la.id
      )
    ORDER BY la.lecturer_id, la.academic_year, la.semester, la.level, c.course_code
  LOOP
    SELECT id INTO target_room
    FROM classrooms
    WHERE code = assignment_row.classroom_code
    LIMIT 1;

    IF target_room IS NULL THEN
      RAISE NOTICE 'Skipping schedule for assignment %: classroom % was not found',
        assignment_row.assignment_id, assignment_row.classroom_code;
      CONTINUE;
    END IF;

    teaching_days := CASE
      WHEN assignment_row.session_type = 'weekday' THEN ARRAY[1, 3, 5]
      ELSE ARRAY[6, 0]
    END;
    slot_found := FALSE;

    FOR candidate_day IN
      SELECT d.day
      FROM unnest(teaching_days) AS d(day)
      ORDER BY (
        SELECT COUNT(*)
        FROM course_schedules existing
        WHERE existing.lecturer_id = assignment_row.lecturer_id
          AND existing.academic_year = assignment_row.academic_year
          AND existing.semester = assignment_row.semester
          AND existing.day_of_week = d.day
      ), array_position(teaching_days, d.day)
    LOOP
      FOR candidate_hour IN 8..13 LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM course_schedules existing
          WHERE existing.academic_year = assignment_row.academic_year
            AND existing.semester = assignment_row.semester
            AND existing.day_of_week = candidate_day
            AND (candidate_hour::TEXT || ':00')::TIME < existing.end_time
            AND ((candidate_hour + 1)::TEXT || ':00')::TIME > existing.start_time
            AND (existing.lecturer_id = assignment_row.lecturer_id
                 OR existing.classroom_id = target_room)
        ) THEN
          SELECT id INTO target_slot
          FROM timetable_slots
          WHERE day_of_week = candidate_day
            AND start_time = (candidate_hour::TEXT || ':00')::TIME
            AND end_time = ((candidate_hour + 1)::TEXT || ':00')::TIME
          ORDER BY id
          LIMIT 1;

          IF target_slot IS NULL THEN
            INSERT INTO timetable_slots(day_of_week, start_time, end_time)
            VALUES (candidate_day, (candidate_hour::TEXT || ':00')::TIME, ((candidate_hour + 1)::TEXT || ':00')::TIME)
            RETURNING id INTO target_slot;
          END IF;

          INSERT INTO course_schedules (
            assignment_id, course_id, lecturer_id, classroom_id, programme, level,
            academic_year, semester, session_type, day_of_week, start_time, end_time, slot_id
          ) VALUES (
            assignment_row.assignment_id, assignment_row.course_id, assignment_row.lecturer_id,
            target_room, assignment_row.programme, assignment_row.level,
            assignment_row.academic_year, assignment_row.semester, assignment_row.session_type,
            candidate_day, (candidate_hour::TEXT || ':00')::TIME, ((candidate_hour + 1)::TEXT || ':00')::TIME, target_slot
          ) ON CONFLICT (assignment_id) DO NOTHING;

          target_slot := NULL;
          slot_found := TRUE;
          EXIT;
        END IF;
      END LOOP;
      EXIT WHEN slot_found;
    END LOOP;

    IF NOT slot_found THEN
      RAISE NOTICE 'No free class hour found for assignment %', assignment_row.assignment_id;
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- MIGRATION 010: School Activity Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.school_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_activity_log_occurred_at_idx
  ON public.school_activity_log (occurred_at DESC);

ALTER TABLE public.school_activity_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_activity_log FROM anon, authenticated;
GRANT SELECT ON public.school_activity_log TO service_role;

CREATE OR REPLACE FUNCTION public.log_school_profile_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  class_name text;
  class_code text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.school_activity_log (event_type, details)
    VALUES ('account_created', jsonb_build_object(
      'role', NEW.role,
      'status', COALESCE(NEW.account_status, 'active')
    ));

    IF NEW.role = 'student' AND NEW.classroom_id IS NOT NULL THEN
      SELECT name, code INTO class_name, class_code
      FROM public.classrooms WHERE id = NEW.classroom_id;
      INSERT INTO public.school_activity_log (event_type, details)
      VALUES ('student_class_assigned', jsonb_build_object(
        'class_name', class_name,
        'class_code', class_code
      ));
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    IF NEW.account_status = 'active' AND OLD.account_status = 'pending_activation' THEN
      INSERT INTO public.school_activity_log (event_type, details)
      VALUES ('account_activated', jsonb_build_object('role', NEW.role));
    ELSIF NEW.account_status = 'deactivated' THEN
      INSERT INTO public.school_activity_log (event_type, details)
      VALUES ('account_deactivated', jsonb_build_object('role', NEW.role));
    ELSIF OLD.account_status = 'deactivated' AND NEW.account_status = 'active' THEN
      INSERT INTO public.school_activity_log (event_type, details)
      VALUES ('account_reactivated', jsonb_build_object('role', NEW.role));
    END IF;
  END IF;

  IF NEW.role = 'student' AND NEW.classroom_id IS DISTINCT FROM OLD.classroom_id THEN
    IF NEW.classroom_id IS NOT NULL THEN
      SELECT name, code INTO class_name, class_code
      FROM public.classrooms WHERE id = NEW.classroom_id;
      INSERT INTO public.school_activity_log (event_type, details)
      VALUES ('student_class_assigned', jsonb_build_object(
        'class_name', class_name,
        'class_code', class_code
      ));
    ELSE
      INSERT INTO public.school_activity_log (event_type, details)
      VALUES ('student_class_unassigned', '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_profile_activity_trigger ON public.profiles;
CREATE TRIGGER school_profile_activity_trigger
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_school_profile_activity();

CREATE OR REPLACE FUNCTION public.log_school_lecturer_classroom_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  class_name text;
  class_code text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT name, code INTO class_name, class_code
    FROM public.classrooms WHERE id = OLD.classroom_id;
    INSERT INTO public.school_activity_log (event_type, details)
    VALUES ('lecturer_class_unassigned', jsonb_build_object('class_name', class_name, 'class_code', class_code));
    RETURN OLD;
  END IF;

  SELECT name, code INTO class_name, class_code
  FROM public.classrooms WHERE id = NEW.classroom_id;
  INSERT INTO public.school_activity_log (event_type, details)
  VALUES ('lecturer_class_assigned', jsonb_build_object('class_name', class_name, 'class_code', class_code));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_lecturer_classroom_activity_trigger ON public.lecturer_classrooms;
CREATE TRIGGER school_lecturer_classroom_activity_trigger
AFTER INSERT OR DELETE ON public.lecturer_classrooms
FOR EACH ROW EXECUTE FUNCTION public.log_school_lecturer_classroom_activity();

CREATE OR REPLACE FUNCTION public.log_school_announcement_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.school_activity_log (event_type, details)
    VALUES ('announcement_published', jsonb_build_object('announcement_title', NEW.title));
  ELSIF NEW.status = 'published' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.school_activity_log (event_type, details)
    VALUES ('announcement_published', jsonb_build_object('announcement_title', NEW.title));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_announcement_activity_trigger ON public.announcements;
CREATE TRIGGER school_announcement_activity_trigger
AFTER INSERT OR UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.log_school_announcement_activity();

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- RLS POLICIES FOR ALL SECURED TABLES
-- ============================================================================

-- profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Lecturers can read student profiles in their classrooms" ON public.profiles
  FOR SELECT TO authenticated USING (
    role = 'student' AND classroom_id IN (
      SELECT classroom_id FROM lecturer_classrooms WHERE lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- classrooms table
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.classrooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.classrooms
  FOR SELECT TO authenticated USING (true);

-- courses table
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.courses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.courses
  FOR SELECT TO authenticated USING (true);

-- lecturer_assignments table
ALTER TABLE public.lecturer_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.lecturer_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Lecturers read own assignments" ON public.lecturer_assignments
  FOR SELECT TO authenticated USING (lecturer_id = auth.uid());

CREATE POLICY "Admins read all assignments" ON public.lecturer_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- lecturer_classrooms table
ALTER TABLE public.lecturer_classrooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.lecturer_classrooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Lecturer read own" ON public.lecturer_classrooms
  FOR SELECT TO authenticated USING (lecturer_id = auth.uid());

-- lecturer_activation_tokens table
ALTER TABLE public.lecturer_activation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.lecturer_activation_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- account_id_reservations table
ALTER TABLE public.account_id_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.account_id_reservations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- physical_rooms table
ALTER TABLE public.physical_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.physical_rooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.physical_rooms
  FOR SELECT TO authenticated USING (true);

-- classroom_migration_review table
ALTER TABLE public.classroom_migration_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.classroom_migration_review
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.classroom_migration_review
  FOR SELECT TO authenticated USING (true);

-- school_activity_log table
ALTER TABLE public.school_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.school_activity_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admin read" ON public.school_activity_log
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- student_marks table
ALTER TABLE public.student_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.student_marks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own marks" ON public.student_marks
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Lecturers read marks for their courses" ON public.student_marks
  FOR SELECT TO authenticated USING (
    lecturer_id = auth.uid() OR
    course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
  );

CREATE POLICY "Admins read all marks" ON public.student_marks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- fee_records table
ALTER TABLE public.fee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.fee_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own fee records" ON public.fee_records
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Admins read all fee records" ON public.fee_records
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- fee_payments table
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.fee_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own fee payments" ON public.fee_payments
  FOR SELECT TO authenticated USING (
    fee_record_id IN (SELECT id FROM fee_records WHERE student_id = auth.uid())
  );

CREATE POLICY "Admins read all fee payments" ON public.fee_payments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- attendance_records table
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.attendance_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own attendance" ON public.attendance_records
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Lecturers read attendance for their courses" ON public.attendance_records
  FOR SELECT TO authenticated USING (
    lecturer_id = auth.uid() OR
    course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
  );

CREATE POLICY "Admins read all attendance" ON public.attendance_records
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- announcements table
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.announcements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read published announcements" ON public.announcements
  FOR SELECT TO authenticated USING (
    status = 'published' 
    OR course_id IN (
      SELECT id FROM courses WHERE lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access announcements" ON public.announcements
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- report_cards table
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.report_cards
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own report cards" ON public.report_cards
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Lecturers read report cards for their courses" ON public.report_cards
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM report_card_courses rc
      JOIN lecturer_assignments la ON la.course_id = rc.course_id
      WHERE rc.report_card_id = report_cards.id AND la.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all report cards" ON public.report_cards
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- report_card_courses table
ALTER TABLE public.report_card_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.report_card_courses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own report card courses" ON public.report_card_courses
  FOR SELECT TO authenticated USING (
    report_card_id IN (SELECT id FROM report_cards WHERE student_id = auth.uid())
  );

CREATE POLICY "Lecturers read report card courses for their courses" ON public.report_card_courses
  FOR SELECT TO authenticated USING (
    course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
  );

CREATE POLICY "Admins read all report card courses" ON public.report_card_courses
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- academic_years table
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.academic_years
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.academic_years
  FOR SELECT TO authenticated USING (true);

-- semesters table
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.semesters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.semesters
  FOR SELECT TO authenticated USING (true);

-- grading_scales table
ALTER TABLE public.grading_scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.grading_scales
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.grading_scales
  FOR SELECT TO authenticated USING (true);

-- timetable_slots table
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.timetable_slots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.timetable_slots
  FOR SELECT TO authenticated USING (true);

-- course_schedules table
ALTER TABLE public.course_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.course_schedules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Lecturers read own schedules" ON public.course_schedules
  FOR SELECT TO authenticated USING (lecturer_id = auth.uid());

CREATE POLICY "Students read schedules for their classroom" ON public.course_schedules
  FOR SELECT TO authenticated USING (
    classroom_id = (SELECT classroom_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins read all schedules" ON public.course_schedules
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- fee_types table
ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.fee_types
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.fee_types
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all tables exist and have RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check all policies
-- SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Check all RPCs exist
-- SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN (
--   'create_pending_lecturer_profile', 'finalize_lecturer_activation', 'set_lecturer_classrooms',
--   'create_student_profile_with_id_reservation', 'generate_account_id_reservation',
--   'release_account_id_reservation', 'claim_lecturer_activation', 'release_lecturer_activation_claim',
--   'save_classroom_with_room', 'log_school_profile_activity', 'log_school_lecturer_classroom_activity',
--   'log_school_announcement_activity', 'normalize_profile_registration_identity'
-- );