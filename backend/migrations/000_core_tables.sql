-- ============================================================================
-- MIGRATION 000: Core Tables (Base Schema)
-- Creates: profiles, courses, enrolments, lecturer_assignments,
--          chat_messages, quizzes, quiz_attempts, announcements, materials
-- Run this FIRST before all other migrations
-- ============================================================================

-- profiles references classrooms, so create the base classroom table before
-- profiles. Migration 004 adds the academic structure around this table.
CREATE TABLE IF NOT EXISTS public.classrooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    capacity integer DEFAULT 0,
    building varchar(255),
    created_at timestamptz DEFAULT now()
);

-- profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    email text,
    role text NOT NULL CHECK (role IN ('student', 'lecturer', 'superadmin')),
    user_id_number text,
    programme text,
    level integer,
    academic_year text,
    classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL,
    section text,
    avatar_url text,
    account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('pending_activation', 'active', 'deactivated')),
    activated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    full_name_normalized text,
    email_normalized text
);

-- Normalization trigger for profiles
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

DROP TRIGGER IF EXISTS profiles_normalize_registration_identity ON public.profiles;
CREATE TRIGGER profiles_normalize_registration_identity
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION normalize_profile_registration_identity();

-- Unique indexes for normalized identity
CREATE UNIQUE INDEX IF NOT EXISTS profiles_full_name_normalized_key
    ON public.profiles (full_name_normalized)
    WHERE full_name_normalized IS NOT NULL AND full_name_normalized <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_normalized_key
    ON public.profiles (email_normalized)
    WHERE email_normalized IS NOT NULL AND email_normalized <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_number_normalized_key
    ON public.profiles (upper(btrim(user_id_number)))
    WHERE user_id_number IS NOT NULL AND btrim(user_id_number) <> '';

-- courses table
CREATE TABLE IF NOT EXISTS public.courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_name text NOT NULL,
    course_code text NOT NULL,
    description text,
    level integer NOT NULL CHECK (level IN (100, 200, 300, 400)),
    programme text,
    lecturer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lecturer_id, course_code)
);

-- enrolments table
CREATE TABLE IF NOT EXISTS public.enrolments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrolments_student ON public.enrolments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_course ON public.enrolments (course_id);

-- lecturer_assignments table
CREATE TABLE IF NOT EXISTS public.lecturer_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lecturer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    programme text NOT NULL,
    level integer NOT NULL CHECK (level IN (100, 200, 300, 400)),
    semester text,
    academic_year text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lecturer_id, course_id, programme, level)
);

CREATE INDEX IF NOT EXISTS idx_lecturer_assignments_lecturer ON public.lecturer_assignments (lecturer_id);
CREATE INDEX IF NOT EXISTS idx_lecturer_assignments_course ON public.lecturer_assignments (course_id);
CREATE INDEX IF NOT EXISTS idx_lecturer_assignments_programme_level ON public.lecturer_assignments (programme, level);

-- chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query text NOT NULL,
    response text,
    timestamp timestamptz NOT NULL DEFAULT now(),
    flagged boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_course ON public.chat_messages (course_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_student ON public.chat_messages (student_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON public.chat_messages (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_flagged ON public.chat_messages (flagged) WHERE flagged = true;

-- quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title text NOT NULL,
    timer_minutes integer NOT NULL DEFAULT 30,
    questions jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active boolean NOT NULL DEFAULT false,
    generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_course ON public.quizzes (course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_active ON public.quizzes (is_active) WHERE is_active = true;

-- quiz_attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score integer,
    completed_at timestamptz,
    answers jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (quiz_id, student_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON public.quiz_attempts (student_id);

-- announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL,
    status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
    priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    is_archived boolean NOT NULL DEFAULT false,
    posted_at timestamptz,
    event_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_course ON public.announcements (course_id);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements (status);
CREATE INDEX IF NOT EXISTS idx_announcements_posted_at ON public.announcements (posted_at DESC);

-- materials table
CREATE TABLE IF NOT EXISTS public.materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_type text NOT NULL,
    extracted_text text,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_course ON public.materials (course_id);

-- student_marks table
CREATE TABLE IF NOT EXISTS public.student_marks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lecturer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assessment_type text NOT NULL DEFAULT 'Other',
    title text NOT NULL,
    score numeric(6,2) NOT NULL,
    max_score numeric(6,2) NOT NULL DEFAULT 100,
    notes text,
    source text NOT NULL DEFAULT 'manual',
    awarded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_marks_lookup ON public.student_marks (student_id, course_id);

-- Enable RLS on all core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for profiles
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Lecturers can read student profiles in their classrooms" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

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

-- ============================================================================
-- RLS Policies for courses
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.courses;
DROP POLICY IF EXISTS "Authenticated read" ON public.courses;
DROP POLICY IF EXISTS "Lecturers can manage own courses" ON public.courses;
DROP POLICY IF EXISTS "Admins full access courses" ON public.courses;

CREATE POLICY "Service role full access" ON public.courses
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.courses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Lecturers can manage own courses" ON public.courses
    FOR ALL TO authenticated USING (lecturer_id = auth.uid()) WITH CHECK (lecturer_id = auth.uid());

CREATE POLICY "Admins full access courses" ON public.courses
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- ============================================================================
-- RLS Policies for enrolments
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.enrolments;
DROP POLICY IF EXISTS "Students read own enrolments" ON public.enrolments;
DROP POLICY IF EXISTS "Students can self-enrol" ON public.enrolments;
DROP POLICY IF EXISTS "Students can self-unenrol" ON public.enrolments;
DROP POLICY IF EXISTS "Lecturers read enrolments for their courses" ON public.enrolments;
DROP POLICY IF EXISTS "Lecturers can enrol students in their courses" ON public.enrolments;
DROP POLICY IF EXISTS "Admins full access enrolments" ON public.enrolments;

CREATE POLICY "Service role full access" ON public.enrolments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own enrolments" ON public.enrolments
    FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Students can self-enrol" ON public.enrolments
    FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can self-unenrol" ON public.enrolments
    FOR DELETE TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Lecturers read enrolments for their courses" ON public.enrolments
    FOR SELECT TO authenticated USING (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Lecturers can enrol students in their courses" ON public.enrolments
    FOR INSERT TO authenticated WITH CHECK (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Admins full access enrolments" ON public.enrolments
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- ============================================================================
-- RLS Policies for lecturer_assignments
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.lecturer_assignments;
DROP POLICY IF EXISTS "Lecturers read own assignments" ON public.lecturer_assignments;
DROP POLICY IF EXISTS "Lecturers manage own assignments" ON public.lecturer_assignments;
DROP POLICY IF EXISTS "Admins full access assignments" ON public.lecturer_assignments;

CREATE POLICY "Service role full access" ON public.lecturer_assignments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Lecturers read own assignments" ON public.lecturer_assignments
    FOR SELECT TO authenticated USING (lecturer_id = auth.uid());

CREATE POLICY "Lecturers manage own assignments" ON public.lecturer_assignments
    FOR ALL TO authenticated USING (lecturer_id = auth.uid()) WITH CHECK (lecturer_id = auth.uid());

CREATE POLICY "Admins full access assignments" ON public.lecturer_assignments
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- ============================================================================
-- RLS Policies for chat_messages
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.chat_messages;
DROP POLICY IF EXISTS "Students read own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Students can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Lecturers read messages for their courses" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins full access chat_messages" ON public.chat_messages;

CREATE POLICY "Service role full access" ON public.chat_messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own messages" ON public.chat_messages
    FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Students can send messages" ON public.chat_messages
    FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "Lecturers read messages for their courses" ON public.chat_messages
    FOR SELECT TO authenticated USING (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Admins full access chat_messages" ON public.chat_messages
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- ============================================================================
-- RLS Policies for quizzes
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.quizzes;
DROP POLICY IF EXISTS "Students read active quizzes for enrolled courses" ON public.quizzes;
DROP POLICY IF EXISTS "Lecturers read all quizzes for their courses" ON public.quizzes;
DROP POLICY IF EXISTS "Lecturers manage own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Admins full access quizzes" ON public.quizzes;

CREATE POLICY "Service role full access" ON public.quizzes
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read active quizzes for enrolled courses" ON public.quizzes
    FOR SELECT TO authenticated USING (
        is_active = true AND course_id IN (
            SELECT course_id FROM enrolments WHERE student_id = auth.uid()
        )
    );

CREATE POLICY "Lecturers read all quizzes for their courses" ON public.quizzes
    FOR SELECT TO authenticated USING (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Lecturers manage own quizzes" ON public.quizzes
    FOR ALL TO authenticated USING (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    ) WITH CHECK (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Admins full access quizzes" ON public.quizzes
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- ============================================================================
-- RLS Policies for quiz_attempts
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Students read own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Students can submit attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Lecturers read attempts for their courses" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Admins full access quiz_attempts" ON public.quiz_attempts;

CREATE POLICY "Service role full access" ON public.quiz_attempts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own attempts" ON public.quiz_attempts
    FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Students can submit attempts" ON public.quiz_attempts
    FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "Lecturers read attempts for their courses" ON public.quiz_attempts
    FOR SELECT TO authenticated USING (
        quiz_id IN (SELECT id FROM quizzes WHERE course_id IN (
            SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid()
        ))
    );

CREATE POLICY "Admins full access quiz_attempts" ON public.quiz_attempts
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- ============================================================================
-- RLS Policies for announcements
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.announcements;
DROP POLICY IF EXISTS "Authenticated read published announcements" ON public.announcements;
DROP POLICY IF EXISTS "Lecturers manage announcements for their courses" ON public.announcements;
DROP POLICY IF EXISTS "Admins full access announcements" ON public.announcements;

CREATE POLICY "Service role full access" ON public.announcements
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read published announcements" ON public.announcements
    FOR SELECT TO authenticated USING (
        status = 'published'
        OR course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
        OR course_id IN (SELECT course_id FROM enrolments WHERE student_id = auth.uid())
    );

CREATE POLICY "Lecturers manage announcements for their courses" ON public.announcements
    FOR ALL TO authenticated USING (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    ) WITH CHECK (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Admins full access announcements" ON public.announcements
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- ============================================================================
-- RLS Policies for materials
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.materials;
DROP POLICY IF EXISTS "Authenticated read materials for enrolled courses" ON public.materials;
DROP POLICY IF EXISTS "Lecturers manage materials for their courses" ON public.materials;
DROP POLICY IF EXISTS "Admins full access materials" ON public.materials;

CREATE POLICY "Service role full access" ON public.materials
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read materials for enrolled courses" ON public.materials
    FOR SELECT TO authenticated USING (
        course_id IN (SELECT course_id FROM enrolments WHERE student_id = auth.uid())
        OR course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Lecturers manage materials for their courses" ON public.materials
    FOR ALL TO authenticated USING (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    ) WITH CHECK (
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Admins full access materials" ON public.materials
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- ============================================================================
-- RLS Policies for student_marks
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.student_marks;
DROP POLICY IF EXISTS "Students read own marks" ON public.student_marks;
DROP POLICY IF EXISTS "Lecturers read marks for their courses" ON public.student_marks;
DROP POLICY IF EXISTS "Lecturers manage marks for their courses" ON public.student_marks;
DROP POLICY IF EXISTS "Admins read all marks" ON public.student_marks;

CREATE POLICY "Service role full access" ON public.student_marks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Students read own marks" ON public.student_marks
    FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Lecturers read marks for their courses" ON public.student_marks
    FOR SELECT TO authenticated USING (
        lecturer_id = auth.uid() OR
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Lecturers manage marks for their courses" ON public.student_marks
    FOR ALL TO authenticated USING (
        lecturer_id = auth.uid() OR
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    ) WITH CHECK (
        lecturer_id = auth.uid() OR
        course_id IN (SELECT course_id FROM lecturer_assignments WHERE lecturer_id = auth.uid())
    );

CREATE POLICY "Admins read all marks" ON public.student_marks
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- ============================================================================
-- NOTIFY PostgREST to reload schema
-- ============================================================================
NOTIFY pgrst, 'reload schema';
