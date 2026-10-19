-- 009_course_schedules.sql
-- Link each lecturer/course assignment to a recurring weekly class meeting.

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
-- Each lecturer is assigned either the weekday or weekend track. Classes are
-- placed in the first free 08:00-14:00 hour that fits both lecturer and room.
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
