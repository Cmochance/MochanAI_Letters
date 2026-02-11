-- Migration: paper vertex knowledge-base sync state

DO $$ BEGIN
  CREATE TYPE paper_kb_entity_type AS ENUM ('section', 'note', 'part');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE paper_kb_sync_status AS ENUM (
    'pending',
    'syncing',
    'synced',
    'error',
    'delete_pending'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE paper_kb_lang AS ENUM ('zh', 'en');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS vertex_rag_corpus_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vertex_rag_ready_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS vertex_last_sync_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS paper_kb_sync_items (
  id SERIAL PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  entity_type paper_kb_entity_type NOT NULL,
  entity_id INTEGER,
  part_key VARCHAR(64),
  lang paper_kb_lang NOT NULL,
  gcs_uri VARCHAR(1000),
  content_hash VARCHAR(128),
  rag_file_name VARCHAR(500),
  status paper_kb_sync_status NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS paper_kb_sync_items_entity_unique
  ON paper_kb_sync_items(paper_id, entity_type, entity_id, lang)
  WHERE entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS paper_kb_sync_items_part_unique
  ON paper_kb_sync_items(paper_id, entity_type, part_key, lang)
  WHERE part_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS paper_kb_sync_items_paper_status_idx
  ON paper_kb_sync_items(paper_id, status, updated_at DESC);
