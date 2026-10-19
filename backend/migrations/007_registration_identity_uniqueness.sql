-- Enforce case-insensitive, whitespace-normalized identity uniqueness.
-- Review and resolve any rows returned by these queries before applying:
--   SELECT lower(regexp_replace(btrim(full_name), '[[:space:]]+', ' ', 'g')), count(*)
--   FROM profiles GROUP BY 1 HAVING count(*) > 1;
--   SELECT lower(btrim(email)), count(*)
--   FROM profiles WHERE email IS NOT NULL GROUP BY 1 HAVING count(*) > 1;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name_normalized text,
  ADD COLUMN IF NOT EXISTS email_normalized text;

UPDATE profiles
SET full_name = regexp_replace(btrim(full_name), '[[:space:]]+', ' ', 'g'),
    email = lower(btrim(email)),
    full_name_normalized = lower(regexp_replace(btrim(full_name), '[[:space:]]+', ' ', 'g')),
    email_normalized = lower(btrim(email));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE full_name_normalized IS NOT NULL AND full_name_normalized <> ''
    GROUP BY full_name_normalized HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized full names exist in profiles. Resolve them before applying migration 007.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE email_normalized IS NOT NULL AND email_normalized <> ''
    GROUP BY email_normalized HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized emails exist in profiles. Resolve them before applying migration 007.';
  END IF;
END $$;

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

DROP TRIGGER IF EXISTS profiles_normalize_registration_identity ON profiles;
CREATE TRIGGER profiles_normalize_registration_identity
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_profile_registration_identity();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_full_name_normalized_key
  ON profiles (full_name_normalized)
  WHERE full_name_normalized IS NOT NULL AND full_name_normalized <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_normalized_key
  ON profiles (email_normalized)
  WHERE email_normalized IS NOT NULL AND email_normalized <> '';
