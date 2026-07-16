-- legi_index previously only allowed SELECT for the "authenticated" role, unlike
-- ppl_index which also allows the "anon" role via an unrestricted USING(true) policy.
-- Any moment a client request goes out without a fully-attached session (cold-start
-- race before getSession() resolves, token refresh hiccup, etc.) silently returns
-- zero legislation rows with no error, while politician data keeps working fine.
-- Bring legi_index in line with ppl_index's read policy.
create policy "Public can read legi_index" on "public"."legi_index" for select using (true);
