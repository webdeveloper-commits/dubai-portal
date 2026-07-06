-- ─────────────────────────────────────────────────────────────────────────────
-- Fix areas table: add all missing columns + open RLS for admin operations
-- Run this in your Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Add all missing columns (IF NOT EXISTS so safe to re-run)
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS tagline                text,
  ADD COLUMN IF NOT EXISTS hero_image             text,
  ADD COLUMN IF NOT EXISTS about                  text,
  ADD COLUMN IF NOT EXISTS highlight_why_buy      text,
  ADD COLUMN IF NOT EXISTS highlight_who_lives    text,
  ADD COLUMN IF NOT EXISTS highlight_best_streets text,
  ADD COLUMN IF NOT EXISTS highlight_vibe         text,
  ADD COLUMN IF NOT EXISTS roi_pct                numeric(5,2),
  ADD COLUMN IF NOT EXISTS area_size              text,
  ADD COLUMN IF NOT EXISTS best_for               text,
  ADD COLUMN IF NOT EXISTS avg_price_studio       numeric,
  ADD COLUMN IF NOT EXISTS avg_price_1br          numeric,
  ADD COLUMN IF NOT EXISTS avg_price_2br          numeric,
  ADD COLUMN IF NOT EXISTS avg_price_3br          numeric,
  ADD COLUMN IF NOT EXISTS avg_rent_studio        numeric,
  ADD COLUMN IF NOT EXISTS avg_rent_1br           numeric,
  ADD COLUMN IF NOT EXISTS avg_rent_2br           numeric,
  ADD COLUMN IF NOT EXISTS avg_rent_3br           numeric,
  ADD COLUMN IF NOT EXISTS avg_ppsf_studio        numeric,
  ADD COLUMN IF NOT EXISTS avg_ppsf_1br           numeric,
  ADD COLUMN IF NOT EXISTS avg_ppsf_2br           numeric,
  ADD COLUMN IF NOT EXISTS avg_ppsf_3br           numeric,
  ADD COLUMN IF NOT EXISTS avg_roi_studio         numeric(5,2),
  ADD COLUMN IF NOT EXISTS avg_roi_1br            numeric(5,2),
  ADD COLUMN IF NOT EXISTS avg_roi_2br            numeric(5,2),
  ADD COLUMN IF NOT EXISTS avg_roi_3br            numeric(5,2),
  ADD COLUMN IF NOT EXISTS lifestyle_dining_text    text,
  ADD COLUMN IF NOT EXISTS lifestyle_dining_image   text,
  ADD COLUMN IF NOT EXISTS lifestyle_parks_text     text,
  ADD COLUMN IF NOT EXISTS lifestyle_parks_image    text,
  ADD COLUMN IF NOT EXISTS lifestyle_shopping_text  text,
  ADD COLUMN IF NOT EXISTS lifestyle_shopping_image text,
  ADD COLUMN IF NOT EXISTS map_image              text,
  ADD COLUMN IF NOT EXISTS commute_times          jsonb  DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS schools                jsonb  DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS hospitals              jsonb  DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS malls                  jsonb  DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS nearby_areas           jsonb  DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS faqs                   jsonb  DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS agent_name             text,
  ADD COLUMN IF NOT EXISTS agent_phone            text,
  ADD COLUMN IF NOT EXISTS agent_photo            text,
  ADD COLUMN IF NOT EXISTS seo_title              text,
  ADD COLUMN IF NOT EXISTS seo_description        text,
  ADD COLUMN IF NOT EXISTS seo_keywords           text,
  ADD COLUMN IF NOT EXISTS latitude               numeric(10,6),
  ADD COLUMN IF NOT EXISTS longitude              numeric(10,6),
  ADD COLUMN IF NOT EXISTS updated_at             timestamptz DEFAULT now();

-- Allow anon key to read/write (same as your projects table)
ALTER TABLE areas DISABLE ROW LEVEL SECURITY;
