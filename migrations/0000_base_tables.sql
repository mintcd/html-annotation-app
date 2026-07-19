CREATE TABLE IF NOT EXISTS pages (
  id                    TEXT PRIMARY KEY,
  url                   TEXT NOT NULL UNIQUE,
  title                 TEXT NOT NULL,
  number_of_scripts     INTEGER,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  number_of_annotations INTEGER
);

CREATE TABLE IF NOT EXISTS annotations (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL,
  text       TEXT NOT NULL,
  html       TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  color      TEXT NOT NULL,
  comment    TEXT,
  position   TEXT
);
