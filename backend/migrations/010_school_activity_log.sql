-- Minimal audit feed for the Super-Admin school operations overview.
-- The log deliberately omits names, email addresses, IDs, and announcement bodies.

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
