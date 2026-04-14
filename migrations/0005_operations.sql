-- operations: store queued client operations for synchronization/audit
-- Mirrors the client `operations` store used by the service worker and local DB.
CREATE TABLE IF NOT EXISTS operations (
  id           TEXT PRIMARY KEY,
  entity       TEXT NOT NULL,
  op_type      TEXT NOT NULL,
  payload      TEXT, -- JSON stored as TEXT
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  processed    INTEGER NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  client_id    TEXT,
  client_op_id TEXT,
  sent_at      TEXT
);

CREATE INDEX IF NOT EXISTS operations_by_processed ON operations (processed);
CREATE INDEX IF NOT EXISTS operations_by_client ON operations (client_id, client_op_id);
CREATE INDEX IF NOT EXISTS operations_by_created_at ON operations (created_at);
