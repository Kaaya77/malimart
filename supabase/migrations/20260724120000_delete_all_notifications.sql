-- Soft-delete every notification for the calling user (the "Delete all" action
-- in the notifications panel). Mirrors clear_read_notifications but ignores the
-- read flag. SECURITY DEFINER + auth.uid() scope keeps it to the owner's rows.
create or replace function public.delete_all_my_notifications()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n int;
begin
  update notifications set deleted_at = now()
  where user_id = auth.uid() and deleted_at is null;
  get diagnostics n = row_count; return n;
end $function$;

grant execute on function public.delete_all_my_notifications() to authenticated;
