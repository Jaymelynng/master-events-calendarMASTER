-- acknowledged_patterns: temp overrides that apply to ALL events of a program type at a gym
-- "Dismiss for all OPEN GYM events at RBA" instead of just this one event
CREATE TABLE IF NOT EXISTS acknowledged_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id VARCHAR NOT NULL REFERENCES gyms(id),
  event_type VARCHAR NOT NULL,
  error_message TEXT NOT NULL,
  note TEXT,
  dismissed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ack_patterns_lookup ON acknowledged_patterns(gym_id, event_type);
ALTER TABLE acknowledged_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON acknowledged_patterns FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON acknowledged_patterns FOR ALL USING (true);
