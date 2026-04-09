-- Migration 084: Alert Acknowledgements table for co-acknowledgement (UC3)
-- Allows multiple users to acknowledge the same alert event with mandatory comments

CREATE TABLE IF NOT EXISTS alert_acknowledgements (
  id SERIAL PRIMARY KEY,
  aauuid TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  event_uuid TEXT NOT NULL REFERENCES alert_events(aeuuid),
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL,
  comments TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by event
CREATE INDEX IF NOT EXISTS idx_alert_ack_event ON alert_acknowledgements(event_uuid);
-- Index for user-based queries
CREATE INDEX IF NOT EXISTS idx_alert_ack_user ON alert_acknowledgements(user_id);
