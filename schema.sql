CREATE TABLE IF NOT EXISTS partner_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  organization TEXT,
  city TEXT,
  country TEXT NOT NULL,
  interest TEXT NOT NULL,
  message TEXT,
  consent INTEGER NOT NULL DEFAULT 1,
  submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_submissions_date ON partner_submissions(id DESC);
