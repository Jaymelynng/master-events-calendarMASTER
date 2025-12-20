-- Add availability tracking columns to events table
-- These fields come from iClassPro's API response

-- 1. has_openings: Boolean indicating if spots are available
--    iClassPro returns this as hasOpenings: true/false
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS has_openings BOOLEAN DEFAULT true;

-- 2. registration_end_date: When registration closes
--    iClassPro returns this as registrationEndDate
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS registration_end_date DATE;

-- 3. registration_start_date: When registration opens (bonus)
--    iClassPro returns this as registrationStartDate  
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS registration_start_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN events.has_openings IS 'From iClassPro hasOpenings - false means SOLD OUT/FULL';
COMMENT ON COLUMN events.registration_end_date IS 'From iClassPro registrationEndDate - when registration closes';
COMMENT ON COLUMN events.registration_start_date IS 'From iClassPro registrationStartDate - when registration opens';

-- Update the events_with_gym view to include new columns
-- (Run CREATE_EVENTS_WITH_GYM_VIEW.sql after this to refresh the view)

