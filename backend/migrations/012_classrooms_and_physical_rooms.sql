-- Separate academic class groups from the physical rooms used by their meetings.
-- Existing classroom IDs and all foreign-key assignments are retained.

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

-- The existing rows are class groups. Parse only the explicit trailing
-- " - Level NNN" pattern, and only when it agrees with the current course data.
-- No physical room is invented because the existing records contain no room name.
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

-- Preserve an auditable report instead of guessing absent or ambiguous room data.
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
