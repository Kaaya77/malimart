-- Message reactions and soft-deletes weren't updating in realtime:
--   * message_reactions was not part of the supabase_realtime publication, so
--     reaction INSERT/DELETE were never broadcast.
--   * Soft-deletes are UPDATEs that don't change sender_id/receiver_id; a
--     filtered realtime UPDATE subscription needs those columns in the WAL,
--     which requires REPLICA IDENTITY FULL.
alter table public.messages replica identity full;
alter table public.message_reactions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
