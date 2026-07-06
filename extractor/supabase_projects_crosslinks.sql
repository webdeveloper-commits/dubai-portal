-- ─────────────────────────────────────────────────────────────────────────────
-- Add cross-link slug columns to projects table
-- Run this once in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS developer_slug text,
  ADD COLUMN IF NOT EXISTS area_slug      text;

-- Backfill existing rows: match developer by whatsapp_share_text vs developers.name
-- and area by geo_summary vs areas.name
UPDATE projects p
SET
  developer_slug = (
    SELECT d.slug FROM developers d
    WHERE lower(d.name) LIKE '%' || lower(split_part(p.whatsapp_share_text, ' ', 1)) || '%'
    LIMIT 1
  ),
  area_slug = (
    SELECT a.slug FROM areas a
    WHERE lower(p.geo_summary) LIKE '%' || lower(split_part(a.name, ' ', 1)) || '%'
      AND a.is_published = true
    LIMIT 1
  )
WHERE developer_slug IS NULL OR area_slug IS NULL;
