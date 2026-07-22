-- Migration: Let the client clear an expired subscription
-- Date: 2026-07-21
-- Description:
--   Fixes a regression introduced by 20260721040000. That migration allowed the
--   client to downgrade itself to plan='free' but not to clear the plan to NULL,
--   and the app clears rather than frees when a subscription lapses:
--   app/subs.tsx:138-145 and app/subscription.tsx:139 run a "subscription
--   expired" check on mount that writes plan=null, cycle=null, plus_til=null.
--   Those writes started failing with 42501, so a lapsed Plus user kept their
--   stale plan value on the client path.
--
--   (apple_webhook also clears plan on EXPIRED via service role, so entitlement
--   was still corrected server-side when Apple notified -- but the client-side
--   safety net was broken, and it is what covers the window before the
--   notification lands.)
--
--   Clearing the plan is a downgrade and grants nothing, exactly like the
--   existing 'free' carve-out, so it is allowed on the same terms: the columns
--   recording evidence of a purchase must stay untouched. Note the app
--   deliberately preserves last_transaction_id and last_purchase_date here so a
--   later restore can find the purchase -- the guard already required that.
--
--   Everything else is unchanged: setting plan to 'basic' or 'plus', extending
--   plus_til, or forging receipt_validated / last_transaction_id /
--   last_purchase_date remains service-role only.

create or replace function public.enforce_server_managed_subscription_fields()
returns trigger
language plpgsql
as $$
begin
  -- service_role (edge functions) and the migration/admin roles bypass.
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  -- A client may downgrade itself: either to the free plan, or by clearing the
  -- plan when a subscription lapses. Neither grants an entitlement, and neither
  -- has a service-role path in the app. The downgrade may clear cycle and
  -- plus_til, but must not touch the columns recording evidence of a purchase.
  if (new.plan is null or new.plan = 'free')
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
