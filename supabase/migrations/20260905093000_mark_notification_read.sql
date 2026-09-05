-- Opening a single notification (its link) never marked it read — only
-- the bulk "Mark all read" button did, via mark_all_notifications_read.
-- So clicking a notification felt read to the user but the unread badge
-- (and the red dot) never budged. Same ownership pattern as the existing
-- mark_all_notifications_read.
create or replace function public.mark_notification_read(p_id uuid)
returns void
language sql
security definer
set search_path = 'public'
as $$
  update notifications set read = true, updated_at = now()
  where id = p_id and user_id = auth.uid() and read = false and deleted_at is null;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
