-- Buckets screen (Admin > Buckets) - "force one event into a bucket".
-- When Jayme forces a single event, type_locked = true and the sync stops
-- overwriting that event's bucket (events.type) from its iClass category.
-- Additive: every existing row gets false, nothing else changes.
-- Undo: ALTER TABLE public.events DROP COLUMN type_locked;
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS type_locked boolean NOT NULL DEFAULT false;
