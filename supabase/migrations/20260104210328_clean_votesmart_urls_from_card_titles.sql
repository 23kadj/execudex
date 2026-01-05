-- Migration: Clean Vote Smart URLs from card titles
-- Date: 2026-01-04
-- Description: Removes markdown link syntax containing Vote Smart URLs from card_index.title
--              Examples:
--              - "Title](https://votesmart.org/...)" -> "Title"
--              - "[Title](https://votesmart.org/...)" -> "Title"

-- Update card_index titles to remove Vote Smart URLs
-- This handles patterns like:
--   - text](https://votesmart.org/...)
--   - [text](https://votesmart.org/...)
UPDATE card_index
SET title = trim(
  regexp_replace(
    regexp_replace(
      regexp_replace(title, '\[([^\]]+)\]\(https?://[^\)]*votesmart[^\)]*\)', '\1', 'g'),
      '([^\]]+)\]\(https?://[^\)]*votesmart[^\)]*\)', '\1', 'g'
    ),
    '\]\(https?://[^\)]*votesmart[^\)]*\)', '', 'g'
  )
)
WHERE title ~* 'votesmart'
  AND (
    title ~ '\]\(https?://[^\)]*votesmart' OR
    title ~ '\[.*\]\(https?://[^\)]*votesmart'
  );

-- Also clean any trailing URLs that might be left (standalone URLs without markdown syntax)
UPDATE card_index
SET title = trim(regexp_replace(title, '\s+https?://[^\s]*votesmart[^\s]*', '', 'g'))
WHERE title ~* 'votesmart'
  AND title ~ 'https?://[^\s]*votesmart'
  AND title !~ '\]\(https?://[^\)]*votesmart'; -- Only if not already handled by first update

