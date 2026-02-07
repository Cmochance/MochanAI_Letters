-- Migration: bind novel plan documents to chapter scope

ALTER TABLE ai_plan_documents
ADD COLUMN IF NOT EXISTS chapter_id INTEGER;

DO $$ BEGIN
  ALTER TABLE ai_plan_documents
  ADD CONSTRAINT ai_plan_documents_chapter_id_fkey
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ai_plan_documents_novel_chapter_unique
ON ai_plan_documents (user_id, workspace_type, workspace_id, chapter_id)
WHERE chapter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_plan_documents_chapter_idx
ON ai_plan_documents (user_id, workspace_type, workspace_id, chapter_id, updated_at DESC);
