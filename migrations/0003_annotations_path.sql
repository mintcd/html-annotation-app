-- Add `path` column to `annotations` table to store a JSON array of child indices.
-- Stored as TEXT (e.g. "[0,2,5]").
ALTER TABLE annotations ADD COLUMN path TEXT;
