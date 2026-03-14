-- Add location fields to search_profiles for proximity scoring
ALTER TABLE search_profiles
  ADD COLUMN IF NOT EXISTS current_address text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS desired_area text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workplace_address text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN search_profiles.current_address IS 'User current residence address (for context)';
COMMENT ON COLUMN search_profiles.desired_area IS 'Preferred neighborhood/area to move to';
COMMENT ON COLUMN search_profiles.workplace_address IS 'Workplace address for commute scoring';
