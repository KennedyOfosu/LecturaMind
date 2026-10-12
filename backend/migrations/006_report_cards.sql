-- 006_report_cards.sql
-- Creates report card tables for grade consolidation

CREATE TABLE IF NOT EXISTS report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  total_marks_obtained DECIMAL(10,2) DEFAULT 0,
  total_max_marks DECIMAL(10,2) DEFAULT 0,
  attendance_yield DECIMAL(5,2) DEFAULT 0,
  cumulative_score DECIMAL(5,2) DEFAULT 0,
  grade_letter VARCHAR(2),
  grade_point DECIMAL(3,1),
  is_finalized BOOLEAN DEFAULT false,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, semester_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS report_card_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_card_id UUID REFERENCES report_cards(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  course_name VARCHAR(255),
  course_code VARCHAR(50),
  marks_obtained DECIMAL(10,2) DEFAULT 0,
  max_marks DECIMAL(10,2) DEFAULT 100,
  grade_letter VARCHAR(2),
  grade_point DECIMAL(3,1),
  UNIQUE(report_card_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_report_cards_student ON report_cards(student_id);
CREATE INDEX IF NOT EXISTS idx_report_cards_semester ON report_cards(semester_id);
CREATE INDEX IF NOT EXISTS idx_report_card_courses_report ON report_card_courses(report_card_id);
