-- Migration: Enable RLS on users, scoped to the owning auth account
-- Date: 2026-07-21
-- Description:
--   `public.users` had RLS switched off entirely while still carrying
--   `GRANT ALL ... TO anon` from the baseline schema. Verified reproducible with
--   nothing but the shipped anon key (EXPO_PUBLIC_SUPABASE_KEY, extractable from
--   any release bundle): full table read (email, plan, last_transaction_id,
--   receipt_validated, plus_til), PATCH of any row's `plan`, and DELETE of any row.
--
--   Note the three pre-existing "app_users auth *" policies are USING (true) --
--   enabling RLS without dropping them would still let any authenticated user read
--   and update every other user's row. They are dropped here, not kept.
--
--   Ownership column is `uuid` (auth.users.id), NOT the bigint `id`; every client
--   query filters on `.eq('uuid', user.id)`.
--
--   Signup is unaffected: public.handle_new_user() is SECURITY DEFINER and so
--   bypasses RLS when it inserts the row on auth signup.

-- Replace the permissive USING(true) policies with own-row equivalents.
drop policy if exists "app_users auth read"   on public.users;
drop policy if exists "app_users auth insert" on public.users;
drop policy if exists "app_users auth update" on public.users;

alter table public.users enable row level security;

create policy "users select own" on public.users
  for select to authenticated
  using (uuid = auth.uid());

create policy "users insert own" on public.users
  for insert to authenticated
  with check (uuid = auth.uid());

create policy "users update own" on public.users
  for update to authenticated
  using (uuid = auth.uid())
  with check (uuid = auth.uid());

-- Deliberately no DELETE policy and no anon policy: account deletion runs
-- service-role, and anon has no legitimate access to this table.
