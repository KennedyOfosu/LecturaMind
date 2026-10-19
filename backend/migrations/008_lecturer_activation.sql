-- Lecturer activation, account state, and lecturer-to-classroom assignments.

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
