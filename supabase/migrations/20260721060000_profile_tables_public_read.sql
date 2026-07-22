-- Migration: Public read for ppl_profiles, legi_profiles and web_content
-- Date: 2026-07-21
-- Description:
--   The last three tables carrying the anon-read gap that 20260716040000 and
--   20260716050000 fixed for legi_index / card_index / card_content. All three
--   still grant SELECT only to "authenticated", so any request that goes out
--   without a fully attached session -- the cold-start race before getSession()
--   resolves, a token refresh hiccup -- silently returns zero rows with no error.
--
--   Confirmed against production with a bare anon key: ppl_index and card_content
--   return rows while ppl_profiles, legi_profiles and web_content return [].
--
--   These carry the same class of content as the tables already opened: generated
--   synopsis and overview text (ppl_profiles, legi_profiles) and the pointers to
--   the stored source material the cards are generated from (web_content). All
--   three are read directly by the client -- app/profile/synop.tsx:193,
--   app/overview.tsx:354 and :382, app/legislation/overview.tsx:56 -- so the
--   read path is already meant to be reachable by any app user.
--
--   Read-only. Writes stay service-role: these tables are populated by the
--   indexing pipeline (ppl_synopsis, legislation_profile_processor, ppl_round1/2),
--   and no policy here grants insert, update or delete.

create policy "Public can read ppl_profiles" on "public"."ppl_profiles"
  for select using (true);

create policy "Public can read legi_profiles" on "public"."legi_profiles"
  for select using (true);

create policy "Public can read web_content" on "public"."web_content"
  for select using (true);
