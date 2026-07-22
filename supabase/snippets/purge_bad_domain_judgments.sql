-- Purge domain_judgments rows blocked by the partisan-keyword regex bug.
--
-- The old code in ppl_round1/ppl_round2 scanned the model's free-text `reasons`
-- for /\bpartisan\b|think.?tank|.../ and blocked on a hit. That matched inside
-- "non-partisan", "no partisan affiliation" and "not an advocacy group", so CBO,
-- GAO, university research, court opinions, Pew and Brookings were cached as
-- permanent blocks. domain_judgments is trusted outright on later hits, so those
-- rows never get re-examined until the row is deleted.
--
-- HOW TO RUN: this file is safe to paste and run in full -- the DELETE in STEP 2
-- is commented out on purpose. Run it, read the STEP 1 output, then uncomment
-- STEP 2 and run again. Deleting is safe: a missing row just means the domain
-- gets re-judged once, under the fixed logic.

-- Mirrors classifyPartisanship() in supabase/functions/_shared/domainJudge.ts:
-- whole-token match on the normalized structured field, never a substring. That
-- equivalence is the point -- this purges exactly what the fixed code would no
-- longer block, rather than a hand-guessed domain list.
CREATE OR REPLACE VIEW _domain_judgment_triage AS
WITH norm AS (
  SELECT
    domain, verdict, score, institution, official_affiliation, partisanship,
    reasons, first_judged_at, last_used_at, use_count,
    regexp_replace(lower(coalesce(partisanship, '')), '[^a-z0-9]', '', 'g') AS p_norm,
    lower(coalesce(institution, ''))                                        AS inst
  FROM domain_judgments
)
SELECT
  *,
  -- Would the fixed code still consider this domain partisan?
  (p_norm IN (
     'partisan','highlypartisan','stronglypartisan','verypartisan','moderatelypartisan',
     'partisanleaning','leaning','left','right','leftleaning','rightleaning',
     'leaningleft','leaningright','liberal','conservative','progressive',
     'biased','high','strong','yes','true','party','partyaligned','campaignaligned'
   )
   OR inst IN ('party','campaign','advocacy')
  ) AS genuinely_partisan,
  -- Legitimate source type per the request: gov / edu / mil / court / research.
  (domain LIKE '%.gov'
   OR domain LIKE '%.edu'
   OR domain LIKE '%.mil'
   OR domain IN (
     'brookings.edu','pewresearch.org','rand.org','urban.org','nber.org','kff.org',
     'taxpolicycenter.org','bipartisanpolicy.org','crsreports.congress.gov',
     'congress.gov','govinfo.gov','federalregister.gov','supremecourt.gov',
     'uscourts.gov','courtlistener.com','law.cornell.edu','oyez.org','justia.com'
   )
  ) AS legit_source_type
FROM norm;


-- ======================= STEP 1: REVIEW (read-only) =======================

-- 1a. THE PURGE SET. Legitimate source types blocked without a real partisan
--     signal in the structured field -- the bug's victims. STEP 2 deletes
--     exactly these rows. brookings.edu should appear here.
SELECT 'PURGE SET' AS list, domain, institution, partisanship, score, reasons, use_count
FROM _domain_judgment_triage
WHERE verdict = 'block' AND legit_source_type AND NOT genuinely_partisan
ORDER BY domain;

-- 1b. WIDER NET (review only, not deleted by STEP 2). Every other blocked
--     domain the fixed logic would no longer call partisan. Expect regex
--     victims here too -- look for `reasons` containing "non-partisan" or
--     "think tank" on a source you consider legitimate.
SELECT 'WIDER NET' AS list, domain, institution, partisanship, score, reasons, use_count
FROM _domain_judgment_triage
WHERE verdict = 'block' AND NOT genuinely_partisan AND NOT legit_source_type
ORDER BY domain;

-- 1c. SANITY CHECK. These are correctly blocked -- their structured field
--     genuinely says partisan. Every row must show genuinely_partisan = true
--     and must NOT appear in 1a or 1b. If one does, stop and re-check the
--     token list above before deleting anything.
SELECT 'SANITY' AS list, domain, partisanship, genuinely_partisan
FROM _domain_judgment_triage
WHERE domain IN ('americanprogress.org','clerycenter.org','hechingerreport.org',
                 'hoyerforcongress.com','rollcall.com','tallahassee.com','flgov.com')
ORDER BY domain;


-- ========================= STEP 2: PURGE (destructive) =========================
-- Uncomment the DELETE below and re-run this file only after reviewing 1a.
-- Note: msa.maryland.gov will NOT be purged -- it is a .gov, but its structured
-- partisanship field says "high", so the fixed logic still blocks it. That is
-- the fix trusting the real signal. If you disagree with that specific call,
-- delete it by hand rather than loosening the token list.

-- DELETE FROM domain_judgments
-- WHERE domain IN (
--   SELECT domain FROM _domain_judgment_triage
--   WHERE verdict = 'block' AND legit_source_type AND NOT genuinely_partisan
-- );

-- 2b. Post-purge verification. On a first run (DELETE still commented out) the
--     first query returns the same rows as 1a -- that is expected. Once the
--     DELETE is uncommented it must return zero rows, and the second query must
--     still return all three domains as 'block'.
SELECT 'empty only after purge' AS check_label, domain
FROM _domain_judgment_triage
WHERE verdict = 'block' AND legit_source_type AND NOT genuinely_partisan;

SELECT 'should all be block' AS check_label, domain, verdict
FROM domain_judgments
WHERE domain IN ('americanprogress.org','clerycenter.org','hechingerreport.org')
ORDER BY domain;

-- Deliberately NOT providing a ready-to-uncomment DELETE for the 1b wider net:
-- it is near-identical to the one above, and a careless find/replace uncomment
-- would drop every non-partisan block row regardless of source type. If you
-- review 1b and want specific domains gone, delete them by name:
--   DELETE FROM domain_judgments WHERE domain IN ('example.org', ...);


-- Cleanup: remove the helper view. Run this last, once you are done.
DROP VIEW IF EXISTS _domain_judgment_triage;
