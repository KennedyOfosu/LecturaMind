-- Add timer_minutes column to quizzes table
ALTER TABLE quizzes ADD COLUMN timer_minutes INTEGER DEFAULT 30;
