-- Add deleted_at column for soft delete functionality
-- This allows events to be marked as deleted without removing them from the database
-- The calendar will filter out events where deleted_at IS NOT NULL

ALTER TABLE events
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN events.deleted_at IS 'Timestamp when event was marked as deleted. NULL means event is active.';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_events_deleted_at IS 'Index for filtering active (non-deleted) events efficiently';


















