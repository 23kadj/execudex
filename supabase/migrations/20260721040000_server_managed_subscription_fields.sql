-- Migration: Make subscription/payment fields on users server-managed
-- Date: 2026-07-21
-- Description:
--   RLS scopes rows, not columns. 20260721010000 stopped other people and anon
--   from touching a user's row, but it left the owner able to rewrite their own
--   subscription state -- so any authenticated user could still grant themselves
--   plan='plus' with a single PATCH and no purchase, using nothing but the
--   shipped anon key and their own session.
--
--   These columns are already written authoritatively by service-role code that
--   has actually verified a purchase with Apple: verify_receipt (validates the
--   receipt with Apple before writing plan/cycle/last_transaction_id/
--   last_purchase_date/receipt_validated) and apple_webhook (JWS-verified App
--   Store notifications, writes plan/plus_til on SUBSCRIBED/EXPIRED/etc). The
--   client writes were redundant second writes layered on top -- see the comment
--   at app/subs.tsx:576, "verify_receipt function already updates the
--   subscription, but we'll ensure plan and cycle are correct".
--
--   This trigger makes that split explicit and enforces it at the database, which
--   is the only place it can actually be enforced: removing the client code alone
--   changes nothing, because an attacker never runs your client -- they PATCH
--   /rest/v1/users directly with a valid session.
--
--   NOT security definer, deliberately. A SECURITY DEFINER function reports
--   current_user as the function owner (postgres), which would make the role check
--   pass for everyone. As a plain invoker-rights function, current_user is the
--   role PostgREST has SET ROLE'd into -- anon / authenticated / service_role --
--   which is exactly what needs testing.

create or replace function public.enforce_server_managed_subscription_fields()
returns trigger
language plpgsql
as $$
begin
  -- service_role (edge functions) and the migration/admin roles bypass.
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  -- A client may downgrade itself to the free plan. That grants no entitlement,
  -- and it is a real user-facing action with no purchase behind it, so no
  -- service-role path exists for it: app/subscription.tsx:589 switches to free
  -- directly. Onboarding's free selection goes through the save_onboard_data
  -- edge function instead and is already service-role.
  -- The downgrade may clear cycle and plus_til, but must not touch the columns
  -- that record evidence of a purchase.
  if new.plan = 'free'
     and new.plus_til is null
     and new.receipt_validated   is not distinct from old.receipt_validated
     and new.last_transaction_id is not distinct from old.last_transaction_id
     and new.last_purchase_date  is not distinct from old.last_purchase_date
  then
    return new;
  end if;

  if new.plan                is distinct from old.plan
  or new.cycle               is distinct from old.cycle
  or new.plus_til            is distinct from old.plus_til
  or new.receipt_validated   is distinct from old.receipt_validated
  or new.last_transaction_id is distinct from old.last_transaction_id
  or new.last_purchase_date  is distinct from old.last_purchase_date
  then
    raise exception
      'subscription fields are server-managed and cannot be modified by the client'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists users_enforce_server_managed_subscription_fields on public.users;
create trigger users_enforce_server_managed_subscription_fields
  before update on public.users
  for each row
  execute function public.enforce_server_managed_subscription_fields();

-- pending_transaction_id is deliberately NOT protected. It is the handoff between
-- the client and apple_webhook: the client records the transaction id at purchase
-- time and the webhook promotes it to last_transaction_id once Apple confirms
-- (apple_webhook/index.ts:236-240). It confers no entitlement on its own -- plan
-- is only ever granted by JWS-verified webhook events or a verified receipt -- so
-- leaving it writable keeps subscription reconciliation working. Worth revisiting
-- if verify_receipt is ever changed to record it server-side.
--
-- sub_logs is also left writable: it is an append-only audit string the client
-- adds purchase entries to (app/subs.tsx:663), not an entitlement.
