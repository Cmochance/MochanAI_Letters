-- Migration: Fresh start with pgvector support
-- This migration creates all tables from scratch with pgvector support
-- Use this for new installations

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create role enum
DO $$ BEGIN
    CREATE TYPE role AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create note_category enum
DO $$ BEGIN
    CREATE TYPE note_category AS ENUM ('inspiration', 'character', 'worldview', 'plot', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    supabase_id UUID NOT NULL UNIQUE,
    name TEXT,
    email VARCHAR(320),
    role role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_signed_in TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Novels table
CREATE TABLE IF NOT EXISTS novels (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_url VARCHAR(500),
    total_words INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
    id SERIAL PRIMARY KEY,
    novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chapter embeddings table with pgvector
CREATE TABLE IF NOT EXISTS chapter_embeddings (
    id SERIAL PRIMARY KEY,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    content_chunk TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    api_key TEXT,
    api_base_url VARCHAR(500),
    model_name VARCHAR(100),
    writing_style TEXT,
    embedding_api_key TEXT,
    embedding_base_url VARCHAR(500),
    embedding_model VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    novel_id INTEGER REFERENCES novels(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category note_category NOT NULL DEFAULT 'inspiration',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS novels_user_id_idx ON novels(user_id);
CREATE INDEX IF NOT EXISTS chapters_novel_id_idx ON chapters(novel_id);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_novel_id_idx ON notes(novel_id);

-- Vector similarity search index (HNSW for fast queries)
CREATE INDEX IF NOT EXISTS chapter_embeddings_embedding_idx 
ON chapter_embeddings 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS chapter_embeddings_novel_id_idx 
ON chapter_embeddings(novel_id);

CREATE INDEX IF NOT EXISTS chapter_embeddings_chapter_id_idx 
ON chapter_embeddings(chapter_id);
