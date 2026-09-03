/**
 * messagesService — the ONLY messaging data path.
 *
 * Before this, each of the three inboxes reached into AppContext's
 * fetchMessages(), which selected the user's entire message history (with
 * four joins, plus a second query for every reaction on the account) and
 * re-ran it on every realtime event. Conversations were then reconstructed
 * client-side by grouping that array in a useMemo.
 *
 * Everything now goes through SECURITY DEFINER RPCs that return exactly one
 * page of one conversation, or one row per conversation for the sidebar.
 * Components never touch `supabase.from('messages')`.
 *
 * See supabase/migrations/20260903100000_messaging_surgery.sql.
 */
import { supabase } from './supabaseClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PeerRole = 'buyer' | 'seller' | 'admin';

/** One row per conversation — everything the sidebar renders. */
export interface Conversation {
  peerId: string;
  name: string;
  avatarUrl: string | null;
  role: PeerRole;
  lastSeenAt: string | null;
  lastMessageId: string;
  /** null when the last message is a tombstone — render "Message deleted". */
  lastBody: string | null;
  lastSenderId: string;
  lastMessageAt: string;
  lastAttachmentType: string | null;
  lastDeleted: boolean;
  unreadCount: number;
  isBlocked: boolean;
  pinned: boolean;
  archived: boolean;
}

export interface Reaction {
  emoji: string;
  user_id: string;
}

/** One message, hydrated server-side — no client-side joins remain. */
export interface ThreadMessage {
  id: string;
  senderId: string;
  receiverId: string;
  /** null when deleted — the RPC never ships a tombstone's text. */
  body: string | null;
  read: boolean;
  createdAt: string;
  deletedAt: string | null;
  attachmentUrl: string | null;
  attachmentType: 'image' | 'file' | null;
  replyToId: string | null;
  replyToBody: string | null;
  replyToSenderId: string | null;
  product: { id: string; name: string; price: number; slug: string | null; image: string | null } | null;
  orderId: string | null;
  /** The items of the referenced order — what someone actually wants when a
   *  message says "about this order": something that links to the products,
   *  not an opaque id. Scoped server-side: a seller only sees the items they
   *  sold on that order, never a buyer's items from another seller. */
  orderItems: Array<{ id: string; name: string; image: string | null; quantity: number; price: number }>;
  reactions: Reaction[];
  /** True only for a message shown optimistically before the server confirms. */
  pending?: boolean;
  /** Set when an optimistic send failed, so the UI can offer a retry. */
  failed?: boolean;
}

/** How many messages one page of a thread holds. */
export const PAGE_SIZE = 30;

// ─── Row mappers ─────────────────────────────────────────────────────────────

const toConversation = (r: any): Conversation => ({
  peerId: r.peer_id,
  name: r.peer_name || 'User',
  avatarUrl: r.peer_avatar ?? null,
  role: (r.peer_role as PeerRole) ?? 'buyer',
  lastSeenAt: r.peer_last_seen ?? null,
  lastMessageId: r.last_message_id,
  lastBody: r.last_body ?? null,
  lastSenderId: r.last_sender_id,
  lastMessageAt: r.last_created_at,
  lastAttachmentType: r.last_attachment_type ?? null,
  lastDeleted: !!r.last_deleted_at,
  unreadCount: Number(r.unread_count ?? 0),
  isBlocked: !!r.is_blocked,
  pinned: !!r.pinned_at,
  archived: !!r.archived_at,
});

export const toThreadMessage = (r: any): ThreadMessage => ({
  id: r.id,
  senderId: r.sender_id,
  receiverId: r.receiver_id,
  body: r.body ?? null,
  read: !!r.read,
  createdAt: r.created_at,
  deletedAt: r.deleted_at ?? null,
  attachmentUrl: r.attachment_url ?? null,
  attachmentType: (r.attachment_type as 'image' | 'file' | null) ?? null,
  replyToId: r.reply_to_id ?? null,
  replyToBody: r.reply_to_body ?? null,
  replyToSenderId: r.reply_to_sender_id ?? null,
  product: r.product ?? null,
  orderId: r.order_id ?? null,
  orderItems: Array.isArray(r.order_items) ? r.order_items : [],
  reactions: Array.isArray(r.reactions) ? r.reactions : [],
});

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Every conversation, one row each, newest first with pins on top. */
export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('get_my_conversations_v2');
  if (error) { console.error('listConversations failed', error); throw error; }
  return (data ?? []).map(toConversation);
}

/**
 * One page of one thread, newest-first from the server, returned
 * oldest-first for rendering. Pass the oldest loaded `createdAt` as `before`
 * to page backwards.
 */
export async function listThread(
  peerId: string,
  before?: string,
  limit: number = PAGE_SIZE,
): Promise<{ messages: ThreadMessage[]; hasMore: boolean }> {
  const { data, error } = await supabase.rpc('get_thread_page', {
    p_peer: peerId,
    p_before: before ?? null,
    p_limit: limit,
  });
  if (error) { console.error('listThread failed', error); throw error; }
  const rows = (data ?? []) as any[];
  return {
    messages: rows.map(toThreadMessage).reverse(),
    hasMore: rows.length >= limit,
  };
}

/** Fetch a single message by id — used to hydrate a realtime INSERT payload. */
export async function fetchMessage(peerId: string, messageId: string): Promise<ThreadMessage | null> {
  // The thread RPC is the only hydrated read; grab the newest page and pick
  // the row out. Cheaper than a second RPC for what is almost always the
  // message that just arrived at the end of the thread.
  const { messages } = await listThread(peerId, undefined, PAGE_SIZE);
  return messages.find(m => m.id === messageId) ?? null;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export interface SendArgs {
  to: string;
  body: string;
  productId?: string | null;
  orderId?: string | null;
  replyToId?: string | null;
  attachment?: { url: string; type: 'image' | 'file' } | null;
}

/**
 * Send + notify the recipient in ONE round trip. The RPC enforces the block
 * list in both directions, the 4000-char cap, and that a reply target belongs
 * to this conversation.
 */
export async function sendMessage(args: SendArgs): Promise<ThreadMessage> {
  const { data, error } = await supabase.rpc('send_message_v2', {
    p_receiver: args.to,
    p_body: args.body,
    p_product: args.productId ?? null,
    p_order: args.orderId ?? null,
    p_reply_to: args.replyToId ?? null,
    p_attachment_url: args.attachment?.url ?? null,
    p_attachment_type: args.attachment?.type ?? null,
  });
  if (error) { console.error('sendMessage failed', error); throw error; }
  return toThreadMessage({ ...data, reactions: [] });
}

/** Mark everything the peer sent me as read. Returns how many rows changed. */
export async function markThreadRead(peerId: string): Promise<number> {
  const { data, error } = await supabase.rpc('mark_thread_read', { p_peer: peerId });
  if (error) { console.error('markThreadRead failed', error); return 0; }
  return Number(data ?? 0);
}

/**
 * Delete a message. `forEveryone` tombstones it for both sides and is only
 * allowed to the sender within one hour; otherwise it is hidden from the
 * caller's side alone.
 */
export async function deleteMessage(messageId: string, forEveryone = false): Promise<void> {
  const { error } = await supabase.rpc('delete_my_message', {
    p_message: messageId,
    p_for_everyone: forEveryone,
  });
  if (error) { console.error('deleteMessage failed', error); throw error; }
}

/**
 * Remove a conversation from MY list only. The peer keeps their copy — which
 * is what the confirm dialog has always promised, and what looping a global
 * soft-delete over every message did not do.
 */
export async function deleteConversation(peerId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_my_conversation', { p_peer: peerId });
  if (error) { console.error('deleteConversation failed', error); throw error; }
}

/** Add the reaction, or remove it if it is already mine. Returns true if added. */
export async function toggleReaction(messageId: string, emoji: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_message_reaction', {
    p_message: messageId,
    p_emoji: emoji,
  });
  if (error) { console.error('toggleReaction failed', error); throw error; }
  return !!data;
}

/** Pin/archive a conversation. Omitted flags are left unchanged. */
export async function setConversationPref(
  peerId: string,
  prefs: { pinned?: boolean; archived?: boolean },
): Promise<void> {
  const { error } = await supabase.rpc('set_conversation_pref', {
    p_peer: peerId,
    p_pinned: prefs.pinned ?? null,
    p_archived: prefs.archived ?? null,
  });
  if (error) { console.error('setConversationPref failed', error); throw error; }
}

// ─── Attachments ─────────────────────────────────────────────────────────────

/**
 * Upload a chat attachment and return its public URL. Paths are namespaced by
 * uploader; images are compressed, other files are sent as-is (compressImage
 * would corrupt a PDF).
 */
export async function uploadAttachment(
  userId: string,
  file: File,
  compress: (f: File) => Promise<Blob | File>,
  cacheControl: string,
): Promise<{ url: string; type: 'image' | 'file' }> {
  const isImage = file.type.startsWith('image/');
  const ext = file.name.split('.').pop() || 'bin';
  const path = `chat-attachments/${userId}/${crypto.randomUUID()}.${ext}`;
  const payload = isImage ? await compress(file) : file;

  const { error } = await supabase.storage
    .from('mali-mart-uploads')
    .upload(path, payload, { cacheControl, contentType: file.type || undefined });
  if (error) throw error;

  const { data } = supabase.storage.from('mali-mart-uploads').getPublicUrl(path);
  return { url: data.publicUrl, type: isImage ? 'image' : 'file' };
}

// ─── Shared history ──────────────────────────────────────────────────────────

export interface SharedEngagement {
  orderId: string;
  createdAt: string;
  status: string;
  total: number;
  itemCount: number;
  /** Which side of the trade the CURRENT user was on. */
  direction: 'i_bought' | 'i_sold';
}

/**
 * The orders the two people in a conversation share, in whichever direction
 * they run — what a seller opening a buyer's chat actually wants to know.
 * Scoped server-side to the caller being one of the two parties.
 */
export async function listSharedEngagements(peerId: string, limit = 6): Promise<SharedEngagement[]> {
  const { data, error } = await supabase.rpc('get_shared_engagements', {
    p_peer: peerId,
    p_limit: limit,
  });
  if (error) { console.error('listSharedEngagements failed', error); return []; }
  return (data ?? []).map((r: any) => ({
    orderId: r.order_id,
    createdAt: r.created_at,
    status: r.status,
    total: Number(r.total ?? 0),
    itemCount: Number(r.item_count ?? 0),
    direction: r.direction,
  }));
}

// ─── Profile lookups ─────────────────────────────────────────────────────────

export interface PeerProfile {
  id: string;
  name: string;
  avatar: string | null;
  role: PeerRole;
  region: string | null;
  lastSeenAt: string | null;
  created_at: string | null;
}

/**
 * The public-safe profile of a chat partner.
 *
 * This used to be `supabase.from('profiles').select('*').eq('id', peer)` in
 * the component. profiles has no client-readable policy for other users'
 * rows, so that returned null for every non-admin caller — which is why the
 * partner profile modal opened empty and the "can't report an admin" guard
 * never fired. The RPC returns identity fields only.
 */
export async function fetchPeerProfile(userId: string): Promise<PeerProfile | null> {
  const { data, error } = await supabase.rpc('get_messaging_peer', { p_peer: userId });
  if (error) { console.error('fetchPeerProfile failed', error); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id,
    name: row.full_name || 'User',
    avatar: row.avatar_url ?? null,
    role: (row.role as PeerRole) ?? 'buyer',
    region: row.region ?? null,
    lastSeenAt: row.last_seen_at ?? null,
    created_at: row.created_at ?? null,
  };
}

/**
 * A peer's role, used to guard report/block actions (admins can't be
 * reported or blocked). Returns null when the profile can't be read.
 */
export async function fetchProfileRole(userId: string): Promise<PeerRole | null> {
  const p = await fetchPeerProfile(userId);
  return p?.role ?? null;
}

/**
 * Search for someone to start a NEW conversation with — profiles has no
 * client-readable policy for other users' rows (only own/admin), so this
 * goes through a SECURITY DEFINER RPC that returns only the minimal public
 * fields needed to start a chat. Pass `role` to scope to buyers/sellers/admins.
 */
export async function searchMessagingContacts(
  query: string,
  role?: PeerRole,
): Promise<Array<{ id: string; full_name: string | null; avatar_url: string | null; role: string }>> {
  const { data, error } = await supabase.rpc('search_messaging_contacts', { p_query: query, p_role: role ?? null });
  if (error) { console.error('searchMessagingContacts failed', error); return []; }
  return data ?? [];
}
