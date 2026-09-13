CREATE TABLE IF NOT EXISTS note_sections (
  id          serial PRIMARY KEY,
  title       text NOT NULL,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS note_pages (
  id          serial PRIMARY KEY,
  section_id  integer NOT NULL REFERENCES note_sections(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     jsonb,
  pinned      boolean NOT NULL DEFAULT false,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS note_pages_section_idx ON note_pages (section_id, position);
