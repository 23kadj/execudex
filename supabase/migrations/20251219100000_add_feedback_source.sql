-- Migration: Add source column to feedback table
-- Purpose: Track where feedback originated from (profile pages, card pages, or account page)
-- Format: 
--   - Profile pages: "ppl123" or "legi456" (type + profile index_id)
--   - Card pages: "ppl123/789" or "legi456/1011" (type + profile index_id / card_id)
--   - Account page: NULL (no source tracking)

-- Add source column to feedback table
ALTER TABLE feedback 
ADD COLUMN IF NOT EXISTS source TEXT;

-- Add comment to document the column
COMMENT ON COLUMN feedback.source IS 'Source of feedback: NULL for account page, "ppl{id}" or "legi{id}" for profile pages, "ppl{id}/{card_id}" or "legi{id}/{card_id}" for card pages';

