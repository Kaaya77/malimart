-- The categories table carried two near-duplicate top-level entries —
-- "Food & Groceries" and "Food & Spices" — from separate seeding passes.
-- No products reference either (verified before writing this migration),
-- so this is a pure data cleanup: drop the narrower "Food & Spices" and
-- keep "Food & Groceries", which already covers spices as a subcategory.
delete from public.categories
where name = 'Food & Spices' and parent_id is null;
