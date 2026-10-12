-- Add status and priority columns to announcements table
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS priority   TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Update existing rows: derive status from posted_at
-- null posted_at → draft, future → scheduled, past → published
UPDATE announcements SET status = 'draft'     WHERE posted_at IS NULL;
UPDATE announcements SET status = 'scheduled'  WHERE posted_at > now();
UPDATE announcements SET status = 'published'  WHERE posted_at <= now() AND posted_at IS NOT NULL;
