-- Migration: public blog projection for Mochan-Blog static frontend
-- Purpose:
-- 1) whitelist novels that can be exposed publicly
-- 2) project chapters into a read-only blog table
-- 3) keep projection synced via triggers
-- 4) expose read access via Supabase anon/authenticated + RLS

CREATE TABLE IF NOT EXISTS blog_public_novels (
  novel_id INTEGER PRIMARY KEY REFERENCES novels(id) ON DELETE CASCADE,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_public_posts (
  chapter_id INTEGER PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  novel_slug VARCHAR(120) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT,
  content_markdown TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  chapter_number INTEGER NOT NULL,
  source_created_at TIMESTAMP NOT NULL,
  source_updated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_public_posts_novel_id_idx
ON blog_public_posts (novel_id);

CREATE INDEX IF NOT EXISTS blog_public_posts_novel_slug_idx
ON blog_public_posts (novel_slug);

CREATE INDEX IF NOT EXISTS blog_public_posts_source_updated_at_idx
ON blog_public_posts (source_updated_at DESC);

CREATE INDEX IF NOT EXISTS blog_public_posts_chapter_number_idx
ON blog_public_posts (novel_id, chapter_number);

CREATE OR REPLACE FUNCTION blog_slugify(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  slug TEXT;
BEGIN
  slug := lower(coalesce(input_text, ''));
  slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
  slug := regexp_replace(slug, '(^-|-$)', '', 'g');

  IF slug = '' THEN
    RETURN NULL;
  END IF;

  RETURN slug;
END;
$$;

CREATE OR REPLACE FUNCTION blog_create_excerpt(input_markdown TEXT, max_length INTEGER DEFAULT 150)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  plain TEXT;
BEGIN
  plain := coalesce(input_markdown, '');
  plain := regexp_replace(plain, '[#*`>\-\[\]\(\)]', ' ', 'g');
  plain := regexp_replace(plain, '[[:space:]]+', ' ', 'g');
  plain := btrim(plain);

  IF plain = '' THEN
    RETURN '';
  END IF;

  IF char_length(plain) <= max_length THEN
    RETURN plain;
  END IF;

  RETURN left(plain, max_length) || '...';
END;
$$;

CREATE OR REPLACE FUNCTION blog_sync_post_from_chapter(chapter_row chapters)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  novel_row novels%ROWTYPE;
  public_novel_row blog_public_novels%ROWTYPE;
  chapter_slug TEXT;
BEGIN
  SELECT *
  INTO novel_row
  FROM novels
  WHERE id = chapter_row.novel_id
  LIMIT 1;

  IF NOT FOUND THEN
    DELETE FROM blog_public_posts WHERE chapter_id = chapter_row.id;
    RETURN;
  END IF;

  SELECT *
  INTO public_novel_row
  FROM blog_public_novels
  WHERE novel_id = chapter_row.novel_id
  LIMIT 1;

  IF NOT FOUND THEN
    DELETE FROM blog_public_posts WHERE chapter_id = chapter_row.id;
    RETURN;
  END IF;

  chapter_slug := 'chapter-' || chapter_row.id::TEXT;

  INSERT INTO blog_public_posts (
    chapter_id,
    novel_id,
    novel_slug,
    slug,
    title,
    excerpt,
    content_markdown,
    tags,
    chapter_number,
    source_created_at,
    source_updated_at,
    created_at,
    updated_at
  )
  VALUES (
    chapter_row.id,
    chapter_row.novel_id,
    public_novel_row.slug,
    chapter_slug,
    chapter_row.title,
    blog_create_excerpt(chapter_row.content),
    chapter_row.content,
    ARRAY['小说', novel_row.title, '第' || chapter_row.chapter_number::TEXT || '章']::TEXT[],
    chapter_row.chapter_number,
    chapter_row.created_at,
    chapter_row.updated_at,
    NOW(),
    NOW()
  )
  ON CONFLICT (chapter_id)
  DO UPDATE SET
    novel_id = EXCLUDED.novel_id,
    slug = EXCLUDED.slug,
    novel_slug = EXCLUDED.novel_slug,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content_markdown = EXCLUDED.content_markdown,
    tags = EXCLUDED.tags,
    chapter_number = EXCLUDED.chapter_number,
    source_created_at = EXCLUDED.source_created_at,
    source_updated_at = EXCLUDED.source_updated_at,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION blog_public_novels_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  source_title TEXT;
  generated_slug TEXT;
BEGIN
  SELECT title
  INTO source_title
  FROM novels
  WHERE id = NEW.novel_id
  LIMIT 1;

  IF NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    NEW.title := coalesce(source_title, 'novel-' || NEW.novel_id::TEXT);
  END IF;

  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    generated_slug := blog_slugify(NEW.title);
    NEW.slug := coalesce(generated_slug, 'novel-' || NEW.novel_id::TEXT);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_public_novels_before_insert ON blog_public_novels;
CREATE TRIGGER trg_blog_public_novels_before_insert
BEFORE INSERT ON blog_public_novels
FOR EACH ROW
EXECUTE FUNCTION blog_public_novels_before_insert();

CREATE OR REPLACE FUNCTION blog_sync_post_after_chapter_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM blog_sync_post_from_chapter(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_sync_post_after_chapter_write ON chapters;
CREATE TRIGGER trg_blog_sync_post_after_chapter_write
AFTER INSERT OR UPDATE OF novel_id, chapter_number, title, content, created_at, updated_at
ON chapters
FOR EACH ROW
EXECUTE FUNCTION blog_sync_post_after_chapter_write();

CREATE OR REPLACE FUNCTION blog_sync_post_after_chapter_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM blog_public_posts WHERE chapter_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_sync_post_after_chapter_delete ON chapters;
CREATE TRIGGER trg_blog_sync_post_after_chapter_delete
AFTER DELETE ON chapters
FOR EACH ROW
EXECUTE FUNCTION blog_sync_post_after_chapter_delete();

CREATE OR REPLACE FUNCTION blog_backfill_public_posts_after_novel_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  chapter_row chapters%ROWTYPE;
BEGIN
  FOR chapter_row IN
    SELECT *
    FROM chapters
    WHERE novel_id = NEW.novel_id
  LOOP
    PERFORM blog_sync_post_from_chapter(chapter_row);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_backfill_public_posts_after_novel_insert ON blog_public_novels;
CREATE TRIGGER trg_blog_backfill_public_posts_after_novel_insert
AFTER INSERT ON blog_public_novels
FOR EACH ROW
EXECUTE FUNCTION blog_backfill_public_posts_after_novel_insert();

DROP TRIGGER IF EXISTS trg_blog_backfill_public_posts_after_novel_update ON blog_public_novels;
CREATE TRIGGER trg_blog_backfill_public_posts_after_novel_update
AFTER UPDATE OF slug, title ON blog_public_novels
FOR EACH ROW
EXECUTE FUNCTION blog_backfill_public_posts_after_novel_insert();

CREATE OR REPLACE FUNCTION blog_purge_public_posts_after_novel_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM blog_public_posts WHERE novel_id = OLD.novel_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_purge_public_posts_after_novel_delete ON blog_public_novels;
CREATE TRIGGER trg_blog_purge_public_posts_after_novel_delete
AFTER DELETE ON blog_public_novels
FOR EACH ROW
EXECUTE FUNCTION blog_purge_public_posts_after_novel_delete();

ALTER TABLE blog_public_novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_public_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blog_public_novels_read ON blog_public_novels;
CREATE POLICY blog_public_novels_read
ON blog_public_novels
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS blog_public_posts_read ON blog_public_posts;
CREATE POLICY blog_public_posts_read
ON blog_public_posts
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM blog_public_novels
    WHERE blog_public_novels.novel_id = blog_public_posts.novel_id
  )
);

GRANT SELECT ON TABLE blog_public_novels TO anon, authenticated;
GRANT SELECT ON TABLE blog_public_posts TO anon, authenticated;

-- Example: expose the novel named "几时休" to the public blog
-- INSERT INTO blog_public_novels (novel_id, slug, title)
-- SELECT id, 'jishi-xiu', title
-- FROM novels
-- WHERE title = '几时休'
-- LIMIT 1
-- ON CONFLICT (novel_id) DO NOTHING;
