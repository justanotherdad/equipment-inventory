-- Equipment Requests (run after schema.sql)
CREATE TABLE IF NOT EXISTS equipment_requests (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_phone TEXT NOT NULL,
  building TEXT NOT NULL,
  equipment_number_to_test TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link sign_outs to requests when approved
ALTER TABLE sign_outs ADD COLUMN IF NOT EXISTS equipment_request_id INTEGER REFERENCES equipment_requests(id);
ALTER TABLE sign_outs ADD COLUMN IF NOT EXISTS building TEXT;
ALTER TABLE sign_outs ADD COLUMN IF NOT EXISTS equipment_number_to_test TEXT;
ALTER TABLE sign_outs ADD COLUMN IF NOT EXISTS date_from DATE;
ALTER TABLE sign_outs ADD COLUMN IF NOT EXISTS date_to DATE;

CREATE INDEX IF NOT EXISTS idx_equipment_requests_equipment ON equipment_requests(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_requests_status ON equipment_requests(status);
