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

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  section_no INTEGER NOT NULL DEFAULT 1,
  resource_kind TEXT NOT NULL DEFAULT 'document',
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  button_label TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resources_library ON resources(category, published, section_no, sort_order, id);
