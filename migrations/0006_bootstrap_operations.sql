-- Migration: 0006_bootstrap_operations.sql
-- Bootstrap existing rows into the operations table so clients can replicate

-- Remove any prior bootstrap markers from earlier runs
DELETE FROM operations WHERE client_id = 'migration-0006-bootstrap';

-- Bootstrap PAGES
INSERT INTO operations (id, entity, op_type, payload, created_at, processed, attempts, client_id, client_op_id)
SELECT
  'bootstrap-pages-' || id,
  'pages',
  'insert',
  json_object(
    'action', 'insert',
    'data', json_object(
      'id', id,
      'url', url,
      'title', title,
      'number_of_scripts', number_of_scripts,
      'number_of_annotations', number_of_annotations,
      'created_at', created_at,
      'updated_at', updated_at
    )
  ),
  CAST((strftime('%s', COALESCE(updated_at, created_at)) * 1000) AS INTEGER),
  1,
  0,
  'migration-0006-bootstrap',
  'bootstrap-pages-' || id
FROM pages;

-- Bootstrap ANNOTATIONS
INSERT INTO operations (id, entity, op_type, payload, created_at, processed, attempts, client_id, client_op_id)
SELECT
  'bootstrap-annotations-' || id,
  'annotations',
  'insert',
  json_object(
    'action', 'insert',
    'data', json_object(
      'id', id,
      'page_id', page_id,
      'text', text,
      'html', html,
      'color', color,
      'comment', comment,
      'position', json(position),
      'created_at', created_at,
      'updated_at', updated_at
    )
  ),
  CAST((strftime('%s', COALESCE(updated_at, created_at)) * 1000) AS INTEGER),
  1,
  0,
  'migration-0006-bootstrap',
  'bootstrap-annotations-' || id
FROM annotations;

-- Bootstrap WEBSITES
INSERT INTO operations (id, entity, op_type, payload, created_at, processed, attempts, client_id, client_op_id)
SELECT
  'bootstrap-websites-' || id,
  'websites',
  'insert',
  json_object(
    'action', 'insert',
    'data', json_object(
      'id', id,
      'origin', origin,
      'created_at', created_at,
      'updated_at', updated_at
    )
  ),
  CAST((strftime('%s', COALESCE(updated_at, created_at)) * 1000) AS INTEGER),
  1,
  0,
  'migration-0006-bootstrap',
  'bootstrap-websites-' || id
FROM websites;
