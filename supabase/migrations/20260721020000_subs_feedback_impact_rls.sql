-- Migration: Enable RLS on subs, feedback, impact, scoped to the owning auth account
-- Date: 2026-07-21
-- Description:
--   Companion to 20260721010000 (users). Same root cause: these tables were left
--   with RLS off while the baseline granted ALL to anon, so the shipped anon key
--   could read and write them freely.
--
--   `questions` is intentionally NOT included -- see the note at the bottom.
--
--   Ownership columns differ per table and were read off the live schema:
--     subs.“user”    text  <- auth.uid() stored as text (app passes user.id)
--     feedback.user_id uuid
--     impact.user_id   uuid
--
--   Edge functions (bill_cards, ppl_card_gen) read subs with SUPABASE_SERVICE_ROLE_KEY
--   and bypass RLS, so server-side pipelines are unaffected.

-- ---------------------------------------------------------------- subs
-- Note the quoted "user": it is a reserved word in Postgres.
alter table public.subs enable row level security;

create policy "subs select own" on public.subs
  for select to authenticated
  using ("user" = auth.uid()::text);

create policy "subs insert own" on public.subs
  for insert to authenticated
  with check ("user" = auth.uid()::text);

create policy "subs delete own" on public.subs
  for delete to authenticated
  using ("user" = auth.uid()::text);

-- ---------------------------------------------------------------- feedback
-- The "fb select/insert/update own" policies already exist in the baseline and are
-- already correctly scoped to user_id = auth.uid() -- they have simply been inert
-- this whole time because RLS was never enabled. Turning RLS on activates them;
-- no new policies needed.
alter table public.feedback enable row level security;

-- ---------------------------------------------------------------- impact
alter table public.impact enable row level security;

create policy "impact select own" on public.impact
  for select to authenticated
  using (user_id = auth.uid());

create policy "impact insert own" on public.impact
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "impact update own" on public.impact
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------- questions (excluded)
-- public.questions is (id, created_at, card_id, question, answer) -- there is no user
-- column, so "only their own row" is not expressible. It holds shared per-card Q&A
-- content, read in app/card-questions.tsx by card_id, the same shape as card_content.
-- Locking it per-user would blank the Q&A section for everyone. It needs a public-read
-- policy instead, which is a different decision -- handled separately, not silently
-- bundled in here.
