-- Generate and reserve lecturer/student IDs without changing existing IDs.
-- Preflight report (run before applying this migration):
--   SELECT id, role, user_id_number FROM public.profiles
--   WHERE role IN ('lecturer', 'student')
--     AND (user_id_number IS NULL OR
--       (role = 'lecturer' AND upper(btrim(user_id_number)) !~ '^LEC-[0-9]{4}$') OR
--       (role = 'student' AND upper(btrim(user_id_number)) !~ '^STU-[0-9]{4}$'));
--   SELECT upper(btrim(user_id_number)) AS normalized_id, array_agg(id), count(*)
--   FROM public.profiles WHERE user_id_number IS NOT NULL AND btrim(user_id_number) <> ''
--   GROUP BY 1 HAVING count(*) > 1;
-- Resolve any duplicate IDs before applying. Invalid legacy IDs are reported,
-- but are never rewritten by this migration.

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

-- The one shared profiles table and this normalized unique index enforce
-- uniqueness across all roles, including IDs created outside the admin UI.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_number_normalized_key
  ON public.profiles (upper(btrim(user_id_number)))
  WHERE user_id_number IS NOT NULL AND btrim(user_id_number) <> '';

CREATE SEQUENCE IF NOT EXISTS public.lecturer_id_sequence
  AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.student_id_sequence
  AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 NO CYCLE;

-- Start after the highest existing ID, and never move a sequence backwards if
-- this migration is re-run after candidates have already been allocated.
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
    -- Skip any legacy or externally inserted ID that overlaps this sequence.
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
