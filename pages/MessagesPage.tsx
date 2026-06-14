// MessagesPage.tsx — Modern unified messaging for buyer, seller and admin.
// Uses accountApi RPCs. All roles share this one page.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import {
  Conversation, Message, getConversations, getThread,
  sendMessage, deleteMessage, deleteConversation,
} from "../services/accountApi";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  MessageSquare, Search, ChevronLeft, MoreVertical,
  Reply, Trash2, X, Send, CheckCheck, Check, Filter,
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────
const timeAgo = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-TZ", { day: "numeric", month: "short" });
};

const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

const avatarFallback = (name: string) =>
  `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name ?? "U")}`;

// ── sub-components ─────────────────────────────────────────────────────────

const ConvoItem = ({
  c, active, me, onClick,
}: { c: Conversation; active: boolean; me: string | null; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors
      ${active
        ? "bg-[var(--mm-accent-soft,#f0fdf4)] dark:bg-emerald-950/30 border-r-2 border-[var(--mm-accent,#16a34a)]"
        : "hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
      }`}
  >
    <div className="relative shrink-0">
      <img
        src={c.peer_avatar || avatarFallback(c.peer_name ?? "U")}
        alt=""
        className="h-12 w-12 rounded-full object-cover ring-2 ring-transparent transition-all"
      />
      {c.unread_count > 0 && !active && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--mm-accent,#16a34a)] px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-neutral-950">
          {c.unread_count > 9 ? "9+" : c.unread_count}
        </span>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <p className={`truncate text-sm ${c.unread_count > 0 && !active ? "font-bold text-neutral-900 dark:text-white" : "font-medium text-neutral-800 dark:text-neutral-200"}`}>
          {c.peer_name ?? "User"}
        </p>
        <span className={`shrink-0 text-[11px] ${c.unread_count > 0 && !active ? "font-bold text-[var(--mm-accent,#16a34a)]" : "text-neutral-400"}`}>
          {timeAgo(c.last_created_at)}
        </span>
      </div>
      <p className={`truncate text-xs mt-0.5 ${c.unread_count > 0 && !active ? "font-semibold text-neutral-700 dark:text-neutral-300" : "text-neutral-500"}`}>
        {c.last_sender_id === me && <span className="text-neutral-400">You: </span>}
        {c.last_body || (c.last_attachment_type ? "📎 Attachment" : <em className="opacity-50">Message deleted</em>)}
      </p>
    </div>
  </button>
);

const DaySep = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 px-4 py-2 my-1">
    <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
    <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 whitespace-nowrap">
      {label}
    </span>
    <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
  </div>
);

// ── main ───────────────────────────────────────────────────────────────────
export function MessagesPage() {
  const { peerId } = useParams<{ peerId: string }>();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: "msg-me" | "msg-all" | "convo"; id: string }>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activePeer = useMemo(
    () => convos.find((c) => c.peer_id === peerId) ?? null,
    [convos, peerId]
  );

  const filteredConvos = useMemo(() => {
    let list = convos;
    if (filterUnread) list = list.filter((c) => c.unread_count > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.peer_name ?? "").toLowerCase().includes(q) ||
          (c.last_body ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [convos, search, filterUnread]);

  const totalUnread = useMemo(() => convos.reduce((n, c) => n + (c.unread_count || 0), 0), [convos]);

  // Group thread by day
  const groupedThread = useMemo(() => {
    const groups: { label: string; msgs: Message[] }[] = [];
    thread.forEach((m) => {
      const label = dayLabel(m.created_at);
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) groups.push({ label, msgs: [m] });
      else last.msgs.push(m);
    });
    return groups;
  }, [thread]);

  const refreshConvos = useCallback(async () => {
    setConvos(await getConversations());
  }, []);

  const loadThread = useCallback(async (peer: string) => {
    const msgs = await getThread(peer);
    setThread(msgs.reverse());
    refreshConvos();
  }, [refreshConvos]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data.user?.id ?? null);
      await refreshConvos();
      setLoading(false);
    })();
  }, [refreshConvos]);

  useEffect(() => { if (peerId) loadThread(peerId); }, [peerId, loadThread]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [thread.length]);

  // Close menus on outside click
  useEffect(() => {
    const handler = () => { setMenuMsgId(null); setHeaderMenu(false); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Realtime
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`inbox-${me}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${me}` },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id === peerId) loadThread(peerId!);
          else refreshConvos();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, peerId, loadThread, refreshConvos]);

  // Auto-resize textarea
  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
  };

  const send = async () => {
    const body = draft.trim();
    if (!peerId || !body) return;
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setReplyTo(null);
    try {
      const m = await sendMessage({ receiverId: peerId, body, replyToId: replyTo?.id });
      setThread((t) => [...t, m]);
      refreshConvos();
    } catch (e) {
      setDraft(body);
      alert(e instanceof Error ? e.message : "Failed to send");
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === "convo") {
      await deleteConversation(confirm.id);
      setThread([]);
      navigate("/messages");
    } else {
      await deleteMessage(confirm.id, confirm.kind === "msg-all");
      setThread((t) =>
        confirm.kind === "msg-all"
          ? t.map((m) => m.id === confirm.id ? { ...m, deleted_at: new Date().toISOString(), body: "" } : m)
          : t.filter((m) => m.id !== confirm.id)
      );
    }
    refreshConvos();
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-6xl overflow-hidden bg-white dark:bg-neutral-950 sm:rounded-2xl sm:border border-neutral-200 dark:border-neutral-800 sm:shadow-sm">

      {/* ── Sidebar ── */}
      <aside className={`${peerId ? "hidden md:flex" : "flex"} w-full md:w-80 flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950`}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Messages</h1>
            {totalUnread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--mm-accent,#16a34a)] px-1.5 text-[10px] font-black text-white">
                {totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={() => setFilterUnread((v) => !v)}
            className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors
              ${filterUnread ? "bg-[var(--mm-accent,#16a34a)] text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"}`}
          >
            <Filter className="w-3 h-3" />
            Unread
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--mm-accent,#16a34a)]/30 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation list */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col gap-3 p-4">
              {[1,2,3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
                    <div className="h-2.5 w-1/2 rounded bg-neutral-100 dark:bg-neutral-800/60" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && filteredConvos.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center h-48">
              <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-neutral-400" />
              </div>
              <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                {filterUnread ? "No unread messages" : search ? "No results" : "No conversations yet"}
              </p>
              {!filterUnread && !search && (
                <p className="text-xs text-neutral-400 mt-1">Message a seller from any product page.</p>
              )}
            </div>
          )}
          {filteredConvos.map((c) => (
            <ConvoItem
              key={c.peer_id}
              c={c}
              active={c.peer_id === peerId}
              me={me}
              onClick={() => navigate(`/messages/${c.peer_id}`)}
            />
          ))}
        </div>
      </aside>

      {/* ── Chat pane ── */}
      <section className={`${peerId ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        {!activePeer ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <MessageSquare className="w-9 h-9 text-neutral-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-neutral-700 dark:text-neutral-300">Your messages</p>
              <p className="text-sm text-neutral-400 mt-1">Select a conversation to start chatting.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <header className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-sm">
              <button
                className="md:hidden -ml-1 flex items-center justify-center w-9 h-9 rounded-full text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                onClick={() => navigate("/messages")}
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <img
                src={activePeer.peer_avatar || avatarFallback(activePeer.peer_name ?? "U")}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-2 ring-neutral-100 dark:ring-neutral-800"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{activePeer.peer_name ?? "User"}</p>
                <p className="text-xs text-neutral-400 capitalize">
                  {activePeer.peer_role}
                  {activePeer.peer_last_seen
                    ? ` · active ${timeAgo(activePeer.peer_last_seen)} ago`
                    : ""}
                </p>
              </div>
              {/* Header action menu */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setHeaderMenu((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <MoreVertical className="w-4.5 h-4.5" />
                </button>
                {headerMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1 z-50">
                    <button
                      onClick={() => { setHeaderMenu(false); setConfirm({ kind: "convo", id: activePeer.peer_id }); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete chat
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-neutral-50/50 dark:bg-neutral-950">
              {groupedThread.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center pt-12">
                  <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <MessageSquare className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                  </div>
                  <p className="text-sm text-neutral-400">No messages yet. Say hello!</p>
                </div>
              )}
              {groupedThread.map(({ label, msgs }) => (
                <div key={label}>
                  <DaySep label={label} />
                  {msgs.map((m, idx) => {
                    const mine = m.sender_id === me;
                    const replied = m.reply_to_id ? thread.find((x) => x.id === m.reply_to_id) : null;
                    const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                    const nextMsg = idx < msgs.length - 1 ? msgs[idx + 1] : null;
                    const isFirst = !prevMsg || prevMsg.sender_id !== m.sender_id;
                    const isLast = !nextMsg || nextMsg.sender_id !== m.sender_id;
                    const isMenuOpen = menuMsgId === m.id;

                    return (
                      <div
                        key={m.id}
                        className={`group flex ${mine ? "justify-end" : "justify-start"} ${isFirst ? "mt-3" : "mt-0.5"}`}
                      >
                        {/* Avatar for received (only on last in group) */}
                        {!mine && (
                          <div className="w-8 shrink-0 self-end mr-2">
                            {isLast && (
                              <img
                                src={activePeer.peer_avatar || avatarFallback(activePeer.peer_name ?? "U")}
                                alt=""
                                className="w-7 h-7 rounded-full object-cover"
                              />
                            )}
                          </div>
                        )}

                        <div className={`relative max-w-[72%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                          {/* Reply context */}
                          {replied && (
                            <div
                              className={`mb-1 flex items-start gap-2 rounded-xl px-3 py-2 text-xs max-w-full
                                ${mine
                                  ? "bg-[var(--mm-accent,#16a34a)]/10 border-l-2 border-[var(--mm-accent,#16a34a)] self-end"
                                  : "bg-neutral-200/60 dark:bg-neutral-800/60 border-l-2 border-neutral-400 self-start"
                                }`}
                            >
                              <span className="truncate text-neutral-600 dark:text-neutral-400">
                                {replied.deleted_at ? <em>Deleted message</em> : replied.body.slice(0, 80)}
                              </span>
                            </div>
                          )}

                          {/* Bubble */}
                          <div
                            className={`relative px-4 py-2.5 text-sm leading-relaxed shadow-sm
                              ${mine
                                ? `bg-[var(--mm-accent,#16a34a)] text-white
                                   ${isFirst && isLast ? "rounded-2xl rounded-br-sm" : isFirst ? "rounded-2xl rounded-br-sm" : isLast ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-r-sm"}`
                                : `bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700
                                   ${isFirst && isLast ? "rounded-2xl rounded-bl-sm" : isFirst ? "rounded-2xl rounded-bl-sm" : isLast ? "rounded-2xl rounded-bl-sm" : "rounded-2xl rounded-l-sm"}`
                              }`}
                          >
                            {m.deleted_at ? (
                              <em className="opacity-50 text-xs">This message was deleted</em>
                            ) : (
                              <span className="whitespace-pre-wrap break-words">{m.body}</span>
                            )}

                            {/* Timestamp + read receipt */}
                            <div className={`flex items-center gap-1 mt-1 ${mine ? "justify-end" : "justify-end"}`}>
                              <span className={`text-[10px] ${mine ? "text-white/60" : "text-neutral-400"}`}>
                                {shortTime(m.created_at)}
                              </span>
                              {mine && !m.deleted_at && (
                                m.read
                                  ? <CheckCheck className="w-3 h-3 text-white/80" />
                                  : <Check className="w-3 h-3 text-white/50" />
                              )}
                            </div>

                            {/* Hover action menu */}
                            {!m.deleted_at && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute ${mine ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"}
                                  top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1`}
                              >
                                <div className="flex items-center gap-0.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full px-1.5 py-1 shadow-md">
                                  <button
                                    title="Reply"
                                    onClick={() => setReplyTo(m)}
                                    className="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                  >
                                    <Reply className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    title="More"
                                    onClick={() => setMenuMsgId(isMenuOpen ? null : m.id)}
                                    className="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {isMenuOpen && (
                                  <div className={`absolute ${mine ? "right-full mr-1" : "left-full ml-1"} top-0 w-44 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl py-1 z-50`}>
                                    <button
                                      onClick={() => { setMenuMsgId(null); setConfirm({ kind: "msg-me", id: m.id }); }}
                                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" /> Delete for me
                                    </button>
                                    {mine && (
                                      <button
                                        onClick={() => { setMenuMsgId(null); setConfirm({ kind: "msg-all", id: m.id }); }}
                                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" /> Delete for everyone
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Reply preview */}
            {replyTo && (
              <div className="flex items-center gap-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-4 py-2.5">
                <Reply className="w-4 h-4 text-[var(--mm-accent,#16a34a)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--mm-accent,#16a34a)]">Replying to</p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                    {replyTo.body.slice(0, 80)}
                  </p>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="p-1.5 rounded-full text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Composer */}
            <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3">
              <div className={`flex items-end gap-2 rounded-2xl border transition-all
                ${activePeer.is_blocked
                  ? "border-neutral-200 dark:border-neutral-800 opacity-60"
                  : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus-within:border-[var(--mm-accent,#16a34a)]/50 focus-within:shadow-sm focus-within:shadow-[var(--mm-accent,#16a34a)]/10"
                }`}
              >
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1}
                  maxLength={4000}
                  placeholder={activePeer.is_blocked ? "You blocked this user" : "Write a message…"}
                  disabled={activePeer.is_blocked}
                  className="flex-1 resize-none bg-transparent px-4 py-3 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none min-h-[44px] max-h-32 leading-relaxed"
                />
                <div className="flex items-center gap-1 pr-2 pb-2">
                  <button
                    onClick={send}
                    disabled={!draft.trim() || activePeer.is_blocked}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--mm-accent,#16a34a)] text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1.5 px-1">Press Enter to send · Shift+Enter for new line</p>
            </footer>
          </>
        )}
      </section>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === "convo" ? "Delete this conversation?"
          : confirm?.kind === "msg-all" ? "Delete for everyone?"
          : "Delete this message?"
        }
        description={
          confirm?.kind === "convo"
            ? "Removed from your inbox only. The other person keeps their copy."
            : confirm?.kind === "msg-all"
            ? 'It will show as "This message was deleted" for both of you. Only possible within 1 hour of sending.'
            : "Removed from your view only. The other person still sees it."
        }
        confirmLabel="Delete"
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
