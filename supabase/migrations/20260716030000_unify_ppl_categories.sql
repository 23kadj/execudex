-- Politician card categories are now unified across tiers (hard/soft/base all show
-- the same 6-category + "More Selections" grid), so the previously soft/base-only
-- category values no longer have a grid button routing to them. Fold existing rows
-- into their nearest real category so they stay reachable instead of going orphaned.
update card_index set category = 'economy'       where is_ppl = true and category = 'social programs';
update card_index set category = 'defense'        where is_ppl = true and category = 'national security';
update card_index set category = 'public image'   where is_ppl = true and category = 'beliefs';
update card_index set category = 'businesses'     where is_ppl = true and category = 'enterprises';
