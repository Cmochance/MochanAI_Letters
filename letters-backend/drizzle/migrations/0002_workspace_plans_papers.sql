-- Migration: workspace plans + async jobs + papers domain + note embeddings

CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE workspace_type AS ENUM ('novel', 'paper');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE expand_job_status AS ENUM ('pending', 'running', 'succeeded', 'failed', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE paper_note_category AS ENUM (
    'research_question',
    'literature_review',
    'methodology',
    'data_experiment',
    'result_analysis',
    'discussion_limitations',
    'citations_todo'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS ai_plan_documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_type workspace_type NOT NULL,
  workspace_id INTEGER NOT NULL,
  section_number INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_plan_documents_scope_unique UNIQUE (user_id, workspace_type, workspace_id, section_number)
);

CREATE TABLE IF NOT EXISTS ai_plan_versions (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES ai_plan_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  theme TEXT NOT NULL,
  framework TEXT NOT NULL,
  conflicts TEXT NOT NULL,
  interactions TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_plan_versions_unique UNIQUE (document_id, version)
);

CREATE TABLE IF NOT EXISTS ai_expand_jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_type workspace_type NOT NULL,
  workspace_id INTEGER NOT NULL,
  outline TEXT NOT NULL,
  target_words INTEGER NOT NULL DEFAULT 4000,
  plan_document_id INTEGER REFERENCES ai_plan_documents(id) ON DELETE SET NULL,
  status expand_job_status NOT NULL DEFAULT 'pending',
  result_content TEXT,
  error_message TEXT,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS papers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_words INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_sections (
  id SERIAL PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category paper_note_category NOT NULL DEFAULT 'research_question',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_section_embeddings (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES paper_sections(id) ON DELETE CASCADE,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  content_chunk TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_note_embeddings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id INTEGER NOT NULL REFERENCES paper_notes(id) ON DELETE CASCADE,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  category paper_note_category NOT NULL,
  content_chunk TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS note_embeddings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  category note_category NOT NULL,
  content_chunk TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_plan_documents_user_scope_idx
ON ai_plan_documents (user_id, workspace_type, workspace_id, section_number);

CREATE INDEX IF NOT EXISTS ai_plan_versions_document_idx
ON ai_plan_versions (document_id, version DESC);

CREATE INDEX IF NOT EXISTS ai_expand_jobs_user_status_idx
ON ai_expand_jobs (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS papers_user_id_idx ON papers(user_id);
CREATE INDEX IF NOT EXISTS paper_sections_paper_id_idx ON paper_sections(paper_id);
CREATE INDEX IF NOT EXISTS paper_notes_paper_id_idx ON paper_notes(paper_id);
CREATE INDEX IF NOT EXISTS paper_notes_user_id_idx ON paper_notes(user_id);

CREATE INDEX IF NOT EXISTS paper_section_embeddings_embedding_idx
ON paper_section_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS paper_section_embeddings_paper_id_idx
ON paper_section_embeddings (paper_id);
CREATE INDEX IF NOT EXISTS paper_section_embeddings_section_id_idx
ON paper_section_embeddings (section_id);

CREATE INDEX IF NOT EXISTS paper_note_embeddings_embedding_idx
ON paper_note_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS paper_note_embeddings_paper_id_idx
ON paper_note_embeddings (paper_id);
CREATE INDEX IF NOT EXISTS paper_note_embeddings_note_id_idx
ON paper_note_embeddings (note_id);

CREATE INDEX IF NOT EXISTS note_embeddings_embedding_idx
ON note_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS note_embeddings_novel_id_idx
ON note_embeddings (novel_id);
CREATE INDEX IF NOT EXISTS note_embeddings_note_id_idx
ON note_embeddings (note_id);
