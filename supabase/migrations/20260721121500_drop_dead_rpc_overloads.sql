-- Drop dead function overloads left over from superseded migrations.
-- Neither is called anywhere in the app; keeping them around risks a
-- future caller accidentally binding to the wrong overload.

-- Old 2-arg update_order_status_rbac (no cancel-reason param) — superseded
-- by the 3-arg version in 20260702180000_checkout_payment_channels_and_notifications.sql,
-- which is the only signature the client calls.
drop function if exists public.update_order_status_rbac(uuid, text);

-- estimate_bolt_delivery_fee — built, never wired to any component/service/edge
-- function. All three overloads are unreferenced in the codebase.
drop function if exists public.estimate_bolt_delivery_fee(uuid, numeric, numeric, numeric);
drop function if exists public.estimate_bolt_delivery_fee(uuid, uuid, numeric, numeric);
drop function if exists public.estimate_bolt_delivery_fee(uuid, uuid, numeric, numeric, numeric);
