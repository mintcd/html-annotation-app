-- Add `start_offset` column to `annotations` table to store the start offset inside the start node.
-- Stored as INTEGER (nullable).
ALTER TABLE annotations ADD COLUMN start_offset INTEGER;
