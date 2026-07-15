-- Ballotpedia is always offered as a secondary reference link on the metrics page
-- (alongside whatever polling source was actually used), independent of which
-- source ppl_metrics ended up using for approval/disapproval/votes.
ALTER TABLE ppl_profiles ADD COLUMN IF NOT EXISTS ballotpedia_link TEXT;

COMMENT ON COLUMN ppl_profiles.ballotpedia_link IS 'Politician''s Ballotpedia page URL, resolved once by ppl_metrics and cached — shown as a secondary link on the metrics page whenever the primary source is an approval/disapproval poll.';
