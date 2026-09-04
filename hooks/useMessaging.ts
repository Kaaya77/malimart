/**
 * useMessaging — the whole messaging client, in one hook.
 *
 * Replaces the load/subscribe block that was copy-pasted into BuyerMessages,
 * SellerMessages and AdminMessages. That version re-ran a full-history query
 * on EVERY event:
 *
 *   .on('INSERT', ... ) => load()      // whole history
 *   .on('UPDATE', ... ) => load()      // whole history
 *   .on('*', message_reactions, ...)   // UNFILTERED — any reaction, by any
 *                                      // user, anywhere, reloaded everything
 *
 * and the buyer's copy called load() without busting the 30s cache, so an
 * incoming message could sit invisible for half a minute while the seller's
 * copy busted on every event and refetched the lot.
 *
 * Here, a realtime payload is APPLIED to local state. The only refetches are
 * the conversation-summary RPC (one row per conversation, debounced) and a
 * single page of a thread when you open or scroll it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  Conversation, ThreadMessage, PeerProfile, PAGE_SIZE,
  listConversations, listThread, sendMessage as sendMessageRpc, markThreadRead,
  deleteMessage as deleteMessageRpc, deleteConversation as deleteConversationRpc,
  toggleReaction as toggleReactionRpc, setConversationPref, toThreadMessage,
  fetchPeerProfile, SendArgs, searchThread as searchThreadRpc, ThreadSearchHit,
} from '../services/messagesService';

/** A peer is "online" if the server saw them within this window. */
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
/** Coalesce bursts of realtime events into one conversation-list refresh. */
const LIST_REFRESH_DEBOUNCE_MS = 400;
/** Typing indicator lifetime, refreshed by each keystroke burst. */
const TYPING_TTL_MS = 3000;

/** Stable room name for a pair, so both ends join the SAME typing channel. */
const typingRoom = (a: string, b: string) => `typing:${[a, b].sort().join(':')}`;

export interface DraftPeer {
  peerId: string;
  name: string;
  avatar: string | null;
  role: Conversation['role'];
}

export const isOnline = (lastSeenAt: string | null | undefined) =>
  !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;

export interface MessagingOptions {
  /** Called after a thread is marked read, so a global unread badge can refresh. */
  onThreadRead?: () => void;
}

export function useMessaging(userId: string | undefined, options: MessagingOptions = {}) {
  const onThreadReadRef = useRef(options.onThreadRead);
  onThreadReadRef.current = options.onThreadRead;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [peerTyping, setPeerTyping] = useState(false);
  /** True only while the peer has THIS exact thread open right now — a
   *  stronger, instant signal than the last_seen_at heuristic, which lags by
   *  up to the heartbeat interval. Falls back to isOnline(lastSeenAt) when
   *  the peer isn't in this room (e.g. they're online but on another page). */
  const [peerPresent, setPeerPresent] = useState(false);

  // ─── Search ────────────────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<ThreadSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  const searchThread = useCallback(async (peerId: string, query: string) => {
    const seq = ++searchSeq.current;
    const q = query.trim();
    if (!q) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    try {
      const hits = await searchThreadRpc(peerId, q);
      if (seq === searchSeq.current) setSearchResults(hits);
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    searchSeq.current++;
    setSearchResults([]);
    setSearching(false);
  }, []);

  /**
   * Reset the open thread to the page ending just after a found message, so
   * it's on screen, then let the caller scroll to it. Older history is still
   * reachable from there via loadOlder; to return to the live tail, reselect
   * the peer (selectPeer(peerId)) the way opening the conversation fresh does.
   */
  const jumpToMessage = useCallback(async (peerId: string, hit: ThreadSearchHit) => {
    // Jumping only makes sense within the thread that's already open — search
    // itself is scoped to the active conversation.
    if (activePeerRef.current !== peerId) return;
    setThreadLoading(true);
    setThreadError(null);
    try {
      const anchor = new Date(new Date(hit.createdAt).getTime() + 1).toISOString();
      const { messages, hasMore: more } = await listThread(peerId, anchor);
      if (activePeerRef.current !== peerId) return;
      setThread(messages);
      setHasMore(more);
    } catch (e: any) {
      if (activePeerRef.current === peerId) setThreadError(e?.message || 'Could not load this conversation.');
    } finally {
      if (activePeerRef.current === peerId) setThreadLoading(false);
    }
  }, []);

  /**
   * A conversation that does not exist server-side yet — a "Contact seller"
   * deep link, or someone picked from the new-message search. Held separately
   * so it survives conversation-list refreshes until the first message lands.
   */
  const [draftPeers, setDraftPeers] = useState<DraftPeer[]>([]);

  // Refs let the realtime handlers read current state without being torn down
  // and resubscribed every time the selection changes — the old code listed
  // `selectedSeller` and `blockedUsers` as effect deps, so switching
  // conversation dropped and rebuilt the websocket subscription.
  const activePeerRef = useRef<string | null>(null);
  activePeerRef.current = activePeerId;
  const threadRef = useRef<ThreadMessage[]>([]);
  threadRef.current = thread;

  // ─── Conversation list ─────────────────────────────────────────────────────

  const refreshList = useCallback(async () => {
    if (!userId) return;
    try {
      const rows = await listConversations();
      setConversations(rows);
      setListError(null);
      // Once a real conversation exists, the placeholder is redundant.
      setDraftPeers(prev => prev.filter(d => !rows.some(r => r.peerId === d.peerId)));
    } catch (e: any) {
      setListError(e?.message || 'Could not load your conversations.');
    } finally {
      setListLoading(false);
    }
  }, [userId]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleListRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => { void refreshList(); }, LIST_REFRESH_DEBOUNCE_MS);
  }, [refreshList]);

  useEffect(() => {
    if (!userId) { setListLoading(false); return; }
    setListLoading(true);
    void refreshList();
  }, [userId, refreshList]);

  // ─── Thread paging ─────────────────────────────────────────────────────────

  const openThread = useCallback(async (peerId: string) => {
    setThreadLoading(true);
    setThreadError(null);
    try {
      const { messages, hasMore: more } = await listThread(peerId);
      // Guard against a slower response for a conversation the user left.
      if (activePeerRef.current !== peerId) return;
      setThread(messages);
      setHasMore(more);
      const marked = await markThreadRead(peerId);
      if (marked > 0) {
        setConversations(prev => prev.map(c =>
          c.peerId === peerId ? { ...c, unreadCount: 0 } : c));
        // Let the host drop the navbar badge now rather than waiting for the
        // realtime echo of the read UPDATE.
        onThreadReadRef.current?.();
      }
    } catch (e: any) {
      if (activePeerRef.current === peerId) {
        setThreadError(e?.message || 'Could not load this conversation.');
      }
    } finally {
      if (activePeerRef.current === peerId) setThreadLoading(false);
    }
  }, []);

  const selectPeer = useCallback((peerId: string | null) => {
    setActivePeerId(peerId);
    activePeerRef.current = peerId;
    setPeerTyping(false);
    setThread([]);
    setHasMore(false);
    setThreadError(null);
    if (peerId) void openThread(peerId);
  }, [openThread]);

  const loadOlder = useCallback(async () => {
    const peerId = activePeerRef.current;
    const oldest = threadRef.current.find(m => !m.pending);
    if (!peerId || !oldest || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const { messages, hasMore: more } = await listThread(peerId, oldest.createdAt);
      if (activePeerRef.current !== peerId) return;
      setThread(prev => {
        const known = new Set(prev.map(m => m.id));
        return [...messages.filter(m => !known.has(m.id)), ...prev];
      });
      setHasMore(more);
    } catch {
      // Paging back is best-effort; the loaded page stays on screen.
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder]);

  // ─── Realtime ──────────────────────────────────────────────────────────────

  /** Merge one message into the open thread, replacing any pending twin. */
  const upsertIntoThread = useCallback((msg: ThreadMessage) => {
    setThread(prev => {
      const idx = prev.findIndex(m => m.id === msg.id);
      if (idx >= 0) {
        const next = [...prev];
        // Keep locally hydrated fields the realtime payload cannot carry
        // (product/reply previews are joined server-side, not in the WAL row).
        next[idx] = { ...prev[idx], ...msg, product: msg.product ?? prev[idx].product };
        return next;
      }
      return [...prev, msg].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
  }, []);

  useEffect(() => {
    if (!userId) return;

    const concernsMe = (row: any) => row?.sender_id === userId || row?.receiver_id === userId;
    const peerOf = (row: any) => (row.sender_id === userId ? row.receiver_id : row.sender_id);

    /** Did I hide this message from my own side? Then it must stay hidden. */
    const hiddenFromMe = (row: any) =>
      (row.sender_id === userId && row.sender_deleted_at) ||
      (row.receiver_id === userId && row.receiver_deleted_at);

    const apply = (row: any) => {
      if (!concernsMe(row)) return;
      scheduleListRefresh();
      if (peerOf(row) !== activePeerRef.current) return;

      // A per-side delete is an UPDATE, so it arrives here like any other
      // change. Without this, removing a message from your own side made it
      // pop straight back onto the screen when the echo landed.
      if (hiddenFromMe(row)) {
        setThread(prev => prev.filter(m => m.id !== row.id));
        return;
      }

      // The WAL row has every message column but none of the server-side
      // joins, so preserve what upsert already knows for an existing row and
      // hydrate a brand-new one lazily below.
      const msg = toThreadMessage({ ...row, reactions: [] });
      const known = threadRef.current.find(m => m.id === row.id);
      upsertIntoThread(known ? { ...msg, reactions: known.reactions } : msg);

      // A first-sight message carrying a product or reply reference needs the
      // hydrated columns; one page fetch is still far cheaper than the old
      // whole-history reload, and only runs for referencing messages.
      if (!known && (row.product_id || row.reply_to_id)) {
        void listThread(peerOf(row), undefined, PAGE_SIZE).then(({ messages }) => {
          const full = messages.find(m => m.id === row.id);
          if (full && activePeerRef.current === peerOf(row)) upsertIntoThread(full);
        }).catch(() => { /* the un-hydrated bubble still renders */ });
      }
    };

    const channel = supabase
      .channel(`messaging:${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        p => apply(p.new ?? p.old))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` },
        p => apply(p.new ?? p.old))
      // Reactions cannot be filtered server-side by conversation, but the
      // SELECT policy is now scoped to the message's two participants, so
      // this only delivers reactions on OUR messages — where it used to
      // deliver every reaction in the database and trigger a full reload.
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        p => {
          const row: any = p.new ?? p.old;
          const target = threadRef.current.find(m => m.id === row?.message_id);
          if (!target) return;
          setThread(prev => prev.map(m => {
            if (m.id !== row.message_id) return m;
            const others = m.reactions.filter(
              r => !(r.user_id === row.user_id && r.emoji === row.emoji));
            return {
              ...m,
              reactions: p.eventType === 'DELETE'
                ? others
                : [...others, { emoji: row.emoji, user_id: row.user_id }],
            };
          }));
        })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
    // Deliberately depends on userId alone: the socket must outlive selection
    // changes, and every handler reads current state through a ref.
  }, [userId, scheduleListRefresh, upsertIntoThread]);

  // ─── Typing + live presence ─────────────────────────────────────────────────
  // One channel per open pair, shared by both signals: broadcast for typing
  // (already existed), Presence for "the peer has this thread open right
  // now" — a second channel per pair would double the sockets for no reason,
  // and presence is exactly the per-resource scope usePresence's own
  // convention asks for (never a global "who's online" topic).

  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId || !activePeerId) return;
    const ch = supabase
      .channel(typingRoom(userId, activePeerId), { config: { presence: { key: userId } } })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (payload?.userId !== activePeerId) return;
        setPeerTyping(!!payload.isTyping);
        if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
        if (payload.isTyping) {
          typingClearTimer.current = setTimeout(() => setPeerTyping(false), TYPING_TTL_MS);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        setPeerPresent(activePeerId in ch.presenceState());
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void ch.track({ at: Date.now() });
      });
    typingChannelRef.current = ch;

    return () => {
      if (typingSendTimer.current) clearTimeout(typingSendTimer.current);
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      typingChannelRef.current = null;
      setPeerTyping(false);
      setPeerPresent(false);
      void supabase.removeChannel(ch);
    };
  }, [userId, activePeerId]);

  const notifyTyping = useCallback(() => {
    const ch = typingChannelRef.current;
    if (!ch || !userId) return;
    void ch.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping: true } });
    if (typingSendTimer.current) clearTimeout(typingSendTimer.current);
    typingSendTimer.current = setTimeout(() => {
      void typingChannelRef.current?.send({
        type: 'broadcast', event: 'typing', payload: { userId, isTyping: false },
      });
    }, 2000);
  }, [userId]);

  // ─── Writes ────────────────────────────────────────────────────────────────

  const send = useCallback(async (args: Omit<SendArgs, 'to'> & { to?: string }) => {
    const to = args.to ?? activePeerRef.current;
    if (!to || !userId) return;

    const tempId = `pending-${crypto.randomUUID()}`;
    const optimistic: ThreadMessage = {
      id: tempId,
      senderId: userId,
      receiverId: to,
      body: args.body,
      read: false,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      attachmentUrl: args.attachment?.url ?? null,
      attachmentType: args.attachment?.type ?? null,
      replyToId: args.replyToId ?? null,
      replyToBody: null,
      replyToSenderId: null,
      product: null,
      orderId: args.orderId ?? null,
      // The optimistic bubble does not know the order's items yet — the real
      // ones arrive with the RPC response or the realtime echo, which
      // upsertIntoThread merges in without disturbing this placeholder.
      orderItems: [],
      reactions: [],
      pending: true,
    };
    if (to === activePeerRef.current) setThread(prev => [...prev, optimistic]);

    try {
      const saved = await sendMessageRpc({ ...args, to });
      setThread(prev => {
        // The realtime INSERT may have landed first; never show it twice.
        const withoutTemp = prev.filter(m => m.id !== tempId);
        return withoutTemp.some(m => m.id === saved.id)
          ? withoutTemp
          : [...withoutTemp, saved];
      });
      scheduleListRefresh();
      return saved;
    } catch (e: any) {
      setThread(prev => prev.map(m =>
        m.id === tempId ? { ...m, pending: false, failed: true } : m));
      throw e;
    }
  }, [userId, scheduleListRefresh]);

  /** Drop a failed optimistic bubble the user chose not to retry. */
  const discardFailed = useCallback((id: string) => {
    setThread(prev => prev.filter(m => m.id !== id));
  }, []);

  const removeMessage = useCallback(async (messageId: string, forEveryone = false) => {
    await deleteMessageRpc(messageId, forEveryone);
    if (forEveryone) {
      setThread(prev => prev.map(m => m.id === messageId
        ? { ...m, body: null, attachmentUrl: null, deletedAt: new Date().toISOString() }
        : m));
    } else {
      setThread(prev => prev.filter(m => m.id !== messageId));
    }
    scheduleListRefresh();
  }, [scheduleListRefresh]);

  const react = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;
    // Optimistic toggle — the realtime event confirms or corrects it.
    setThread(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const mine = m.reactions.some(r => r.user_id === userId && r.emoji === emoji);
      return {
        ...m,
        reactions: mine
          ? m.reactions.filter(r => !(r.user_id === userId && r.emoji === emoji))
          : [...m.reactions, { emoji, user_id: userId }],
      };
    }));
    try {
      await toggleReactionRpc(messageId, emoji);
    } catch {
      // Re-read the page so the optimistic toggle cannot stick after a failure.
      const peerId = activePeerRef.current;
      if (!peerId) return;
      const { messages } = await listThread(peerId);
      if (activePeerRef.current === peerId) setThread(messages);
    }
  }, [userId]);

  const removeConversation = useCallback(async (peerId: string) => {
    await deleteConversationRpc(peerId);
    setConversations(prev => prev.filter(c => c.peerId !== peerId));
    setDraftPeers(prev => prev.filter(d => d.peerId !== peerId));
    if (activePeerRef.current === peerId) selectPeer(null);
  }, [selectPeer]);

  const setPref = useCallback(async (peerId: string, prefs: { pinned?: boolean; archived?: boolean }) => {
    setConversations(prev => prev.map(c => c.peerId === peerId ? { ...c, ...prefs } : c));
    try {
      await setConversationPref(peerId, prefs);
      // Pin order is computed server-side, so re-read to get the new ordering.
      scheduleListRefresh();
    } catch {
      void refreshList();
    }
  }, [refreshList, scheduleListRefresh]);

  // ─── Draft (not-yet-existing) conversations ────────────────────────────────

  const addDraftPeer = useCallback((peer: DraftPeer) => {
    setDraftPeers(prev => prev.some(p => p.peerId === peer.peerId) ? prev : [...prev, peer]);
  }, []);

  // `conversations` is read inside openPeer but must not re-create it on every
  // list refresh, or a deep-link effect keyed on it would re-fire endlessly.
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  /**
   * Open a peer we may have no thread with yet — a "Contact seller" deep link
   * or a pick from the contact search. Resolves their real name through the
   * peer RPC so the header is never the literal placeholder "Buyer"/"Seller".
   */
  const openPeer = useCallback(async (peerId: string, known?: Partial<DraftPeer>) => {
    selectPeer(peerId);
    if (conversationsRef.current.some(c => c.peerId === peerId)) return;

    if (known?.name) {
      addDraftPeer({
        peerId,
        name: known.name,
        avatar: known.avatar ?? null,
        role: known.role || 'buyer',
      });
      return;
    }
    const profile: PeerProfile | null = await fetchPeerProfile(peerId);
    addDraftPeer({
      peerId,
      name: profile?.name || 'User',
      avatar: profile?.avatar ?? null,
      role: profile?.role || 'buyer',
    });
  }, [selectPeer, addDraftPeer]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  /** Real conversations plus any placeholder the user has navigated into. */
  const allConversations = useMemo<Conversation[]>(() => {
    const drafts: Conversation[] = draftPeers
      .filter(d => !conversations.some(c => c.peerId === d.peerId))
      .map(d => ({
        peerId: d.peerId,
        name: d.name,
        avatarUrl: d.avatar,
        role: d.role,
        lastSeenAt: null,
        lastMessageId: '',
        lastBody: null,
        lastSenderId: '',
        lastMessageAt: new Date().toISOString(),
        lastAttachmentType: null,
        lastDeleted: false,
        unreadCount: 0,
        isBlocked: false,
        pinned: false,
        archived: false,
      }));
    return [...drafts, ...conversations];
  }, [conversations, draftPeers]);

  const activeConversation = useMemo(
    () => allConversations.find(c => c.peerId === activePeerId) ?? null,
    [allConversations, activePeerId],
  );

  const totalUnread = useMemo(
    () => conversations.reduce((n, c) => n + c.unreadCount, 0),
    [conversations],
  );

  return {
    // list
    conversations: allConversations,
    listLoading,
    listError,
    totalUnread,
    refreshList,
    // selection
    activePeerId,
    activeConversation,
    selectPeer,
    openPeer,
    // thread
    thread,
    threadLoading,
    threadError,
    loadingOlder,
    hasMore,
    loadOlder,
    // typing / presence
    peerTyping,
    peerPresent,
    notifyTyping,
    // search
    searchResults,
    searching,
    searchThread,
    clearSearch,
    jumpToMessage,
    // writes
    send,
    discardFailed,
    removeMessage,
    react,
    removeConversation,
    setPref,
  };
}

export type Messaging = ReturnType<typeof useMessaging>;
