/**
 * Notifications read service (NotificationsPanel).
 *
 * Reads are RLS-scoped to the signed-in user's own rows; all WRITES
 * (mark read, delete, clear) go through the RPCs in accountApi.ts.
 * Components must not call supabase.from directly.
 */
import { supabase } from './supabaseClient';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

/**
 * The user's latest notifications (soft-deleted rows excluded), newest
 * first. Returns [] when the query errors or there are none.
 */
export async function fetchNotifications(limit = 30): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from('notifications')
    .select('id,type,title,message,link,read,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as NotificationRow[]) ?? [];
}
