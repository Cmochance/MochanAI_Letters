-- Migration: bind novel expand jobs to chapter scope

ALTER TABLE ai_expand_jobs
ADD COLUMN IF NOT EXISTS chapter_id INTEGER;

DO $$ BEGIN
  ALTER TABLE ai_expand_jobs
  ADD CONSTRAINT ai_expand_jobs_chapter_id_fkey
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS ai_expand_jobs_novel_chapter_idx
ON ai_expand_jobs (user_id, workspace_type, workspace_id, chapter_id, created_at DESC);
