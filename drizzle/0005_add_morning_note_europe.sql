-- Europe / Frankfurt gets its own block in the morning note.
--
-- A separate column rather than more macroBullets: the panel renders it as its
-- own section, and mixing the two would have meant marking Europe items with a
-- naming convention inside a shared array — a convention nothing enforces.
ALTER TABLE morning_notes ADD COLUMN IF NOT EXISTS europe_bullets jsonb;
