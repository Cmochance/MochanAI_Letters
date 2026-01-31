-- Migration: Enable pgvector extension and update schema
-- This migration enables the pgvector extension for vector similarity search
-- and updates the chapter_embeddings table to use proper vector columns

-- Step 1: Enable pgvector extension
-- Note: This requires superuser privileges or the extension to be pre-installed
-- In Supabase, pgvector is pre-installed and can be enabled via the dashboard
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add chunk_index column if it doesn't exist
ALTER TABLE chapter_embeddings 
ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0 NOT NULL;

-- Step 3: Convert embedding column from text to vector
-- First, create a temporary column with the new type
ALTER TABLE chapter_embeddings 
ADD COLUMN IF NOT EXISTS embedding_new vector(1536);

-- Step 4: Migrate existing data (if any)
-- This converts JSON array strings to vector format
-- Note: This will fail if existing data is not valid JSON arrays
-- In that case, you may need to clear the table first
UPDATE chapter_embeddings 
SET embedding_new = embedding::vector(1536)
WHERE embedding IS NOT NULL AND embedding != '[]' AND embedding != '';

-- Step 5: Drop old column and rename new one
ALTER TABLE chapter_embeddings DROP COLUMN IF EXISTS embedding;
ALTER TABLE chapter_embeddings RENAME COLUMN embedding_new TO embedding;

-- Step 6: Make embedding column NOT NULL
ALTER TABLE chapter_embeddings ALTER COLUMN embedding SET NOT NULL;

-- Step 7: Create HNSW index for fast similarity search
-- HNSW (Hierarchical Navigable Small World) provides excellent query performance
-- Using cosine distance operator for semantic similarity
CREATE INDEX IF NOT EXISTS chapter_embeddings_embedding_idx 
ON chapter_embeddings 
USING hnsw (embedding vector_cosine_ops);

-- Step 8: Create additional indexes for filtering
CREATE INDEX IF NOT EXISTS chapter_embeddings_novel_id_idx 
ON chapter_embeddings (novel_id);

CREATE INDEX IF NOT EXISTS chapter_embeddings_chapter_id_idx 
ON chapter_embeddings (chapter_id);

-- Step 9: Add new columns to user_settings for embedding configuration
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS embedding_api_key TEXT;

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS embedding_base_url VARCHAR(500);

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);
