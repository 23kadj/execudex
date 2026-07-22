-- Migration: Public-read policy for questions + backfill the auth signup trigger
-- Date: 2026-07-21
-- Description:
--   Two loose ends left over from 20260721010000 / 20260721020000.
--
--   1. `questions` was the last table still left with RLS off and GRANT ALL to
--      anon. Unlike users/subs/feedback/impact it is NOT per-user data -- it is
--      shared per-card Q&A (id, created_at, card_id, question, answer) with no
--      user column -- so it gets a public-read policy rather than own-row
--      scoping. The client only ever SELECTs it (app/card-questions.tsx:61,
--      filtered by card_id); the card-questions edge function writes it with
--      SUPABASE_SERVICE_ROLE_KEY and bypasses RLS. So select-only is enough to
--      keep the app working, and it closes the anon INSERT/UPDATE/DELETE that
--      is currently possible against this table.
--
--   2. public.handle_new_user() is in the baseline but the trigger that fires it
--      is not: the baseline was dumped with `-s public`, and the trigger lives on
--      `auth.users`. Production has it (created via Studio, still firing -- a
--      signup during this session correctly produced a public.users row with its
--      uuid set), but it exists nowhere in migration history, so any rebuild from
--      migrations silently loses signup: auth.users gets a row, public.users does
--      not. This is the same class of gap as the ppl_scores backfill.

-- ------------------------------------------------------------------ questions
alter table public.questions enable row level security;

drop policy if exists "Public can read questions" on public.questions;
create policy "Public can read questions" on public.questions
  for select using (true);

-- No insert/update/delete policies: authoring Q&A is service-role only.

-- ------------------------------------------------- auth signup trigger backfill
-- Guarded so this is a genuine no-op on production, where the trigger is already
-- live. The check is by function rather than by trigger name: the production
-- trigger was made by hand in Studio and its name is not recorded anywhere in
-- this repo, so matching on a guessed name could create a duplicate trigger and
-- double-fire the insert. Matching on "does any trigger on auth.users already
-- call handle_new_user" is correct regardless of what it is called there.
do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'auth'
      and c.relname = 'users'
      and p.proname = 'handle_new_user'
      and not t.tgisinternal
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end
$$;
