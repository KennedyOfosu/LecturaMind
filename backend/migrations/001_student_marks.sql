-- Run this once in Supabase → SQL Editor
-- Creates the student_marks table for manual and auto grading records.

create table if not exists student_marks (
  id              uuid default gen_random_uuid() primary key,
  student_id      uuid references profiles(id) on delete cascade not null,
  course_id       uuid references courses(id)  on delete cascade not null,
  lecturer_id     uuid references profiles(id) on delete set null,
  assessment_type text    not null default 'Other',   -- Quiz | Midterm | Test | Assignment | Presentation | Other
  title           text    not null,
  score           numeric(6,2) not null,
  max_score       numeric(6,2) not null default 100,
  notes           text,
  source          text    not null default 'manual',  -- 'manual' | 'auto'
  awarded_at      timestamp with time zone default now()
);

create index if not exists idx_student_marks_lookup
  on student_marks(student_id, course_id);
