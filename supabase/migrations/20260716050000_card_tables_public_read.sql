-- Same gap as legi_index (see 20260716040000): card_index and card_content only
-- granted SELECT to "authenticated", not "anon". Any request that goes out without
-- a fully-attached session silently returns zero cards with no error -- including
-- the synopsis page's weak-profile card preview, which is otherwise the only way to
-- view a locked profile's content. Bring both in line with ppl_index/legi_index.
create policy "Public can read card_index" on "public"."card_index" for select using (true);
create policy "Public can read card_content" on "public"."card_content" for select using (true);
