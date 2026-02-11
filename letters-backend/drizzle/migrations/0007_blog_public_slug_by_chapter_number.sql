-- Migration: use stable human-facing blog slugs based on novel slug + chapter number
-- Why:
-- - previous slug = chapter-{chapter_id} exposes internal surrogate id (e.g. chapter-4 for chapter 1)
-- - this migration switches to `${novel_slug}-chapter-${chapter_number}` for clearer mapping
-- - backfills existing public posts to avoid stale slugs

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

  chapter_slug := public_novel_row.slug || '-chapter-' || chapter_row.chapter_number::TEXT;

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

-- Backfill all current public posts to the new slug format and latest chapter payload.
WITH source_rows AS (
  SELECT
    c.id AS chapter_id,
    c.novel_id,
    bpn.slug AS novel_slug,
    (bpn.slug || '-chapter-' || c.chapter_number::TEXT) AS slug,
    c.title,
    blog_create_excerpt(c.content) AS excerpt,
    c.content AS content_markdown,
    ARRAY['小说', n.title, '第' || c.chapter_number::TEXT || '章']::TEXT[] AS tags,
    c.chapter_number,
    c.created_at AS source_created_at,
    c.updated_at AS source_updated_at
  FROM chapters c
  JOIN novels n ON n.id = c.novel_id
  JOIN blog_public_novels bpn ON bpn.novel_id = c.novel_id
)
UPDATE blog_public_posts bp
SET
  novel_id = s.novel_id,
  novel_slug = s.novel_slug,
  slug = s.slug,
  title = s.title,
  excerpt = s.excerpt,
  content_markdown = s.content_markdown,
  tags = s.tags,
  chapter_number = s.chapter_number,
  source_created_at = s.source_created_at,
  source_updated_at = s.source_updated_at,
  updated_at = NOW()
FROM source_rows s
WHERE bp.chapter_id = s.chapter_id;
