-- domain_judgments is internal pipeline state (ppl_round1/ppl_round2, both running
-- as service-role edge functions) with no client-facing use case -- lock it down
-- the same way the rest of the internal tables in this schema are: RLS enabled,
-- no policies, so only service-role callers (which bypass RLS) can touch it.
alter table domain_judgments enable row level security;
