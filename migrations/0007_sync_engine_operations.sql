-- Bring the existing operations log up to the schema required by
-- @mintcd/sync-engine. Existing operations remain valid and unsent rows keep
-- their current state.
ALTER TABLE operations ADD COLUMN undone INTEGER NOT NULL DEFAULT 0;
ALTER TABLE operations ADD COLUMN instance_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS operations_by_client_operation
  ON operations (client_id, client_op_id)
  WHERE client_id IS NOT NULL AND client_op_id IS NOT NULL;
