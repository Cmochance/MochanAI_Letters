-- Migration: paper figures + bilingual writing fields + docx export support

DO $$ BEGIN
  CREATE TYPE paper_data_type AS ENUM (
    'line_chart',
    'bar_chart',
    'stacked_bar_chart',
    'scatter_plot',
    'histogram',
    'box_plot',
    'heatmap',
    'pie_chart',
    'table',
    'map',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE paper_sections
  ADD COLUMN IF NOT EXISTS data_type paper_data_type,
  ADD COLUMN IF NOT EXISTS content_en TEXT,
  ADD COLUMN IF NOT EXISTS figure_key VARCHAR(500),
  ADD COLUMN IF NOT EXISTS figure_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS figure_content_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS figure_filename VARCHAR(255),
  ADD COLUMN IF NOT EXISTS figure_caption_zh TEXT,
  ADD COLUMN IF NOT EXISTS figure_caption_en TEXT;

DO $$ BEGIN
  ALTER TABLE paper_sections
    ADD CONSTRAINT paper_sections_paper_data_type_unique UNIQUE (paper_id, data_type);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS ai_title_zh TEXT,
  ADD COLUMN IF NOT EXISTS ai_title_en TEXT,
  ADD COLUMN IF NOT EXISTS ai_abstract_zh TEXT,
  ADD COLUMN IF NOT EXISTS ai_abstract_en TEXT,
  ADD COLUMN IF NOT EXISTS ai_keywords_zh TEXT,
  ADD COLUMN IF NOT EXISTS ai_keywords_en TEXT,
  ADD COLUMN IF NOT EXISTS ai_introduction_zh TEXT,
  ADD COLUMN IF NOT EXISTS ai_introduction_en TEXT,
  ADD COLUMN IF NOT EXISTS ai_body_zh TEXT,
  ADD COLUMN IF NOT EXISTS ai_body_en TEXT,
  ADD COLUMN IF NOT EXISTS ai_conclusion_zh TEXT,
  ADD COLUMN IF NOT EXISTS ai_conclusion_en TEXT;

