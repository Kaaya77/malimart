// =====================================================================
// MessagesPage.tsx — WhatsApp-grade messaging for ALL roles (buyer,
// seller, admin share this one page = consistency).
// • Conversation list with unread badges + last-seen
// • Realtime via one postgres_changes channel (egress-friendly)
// • Reply-to, delete for me / delete for everyone (1h window)
// • Delete entire conversation
// Route: /messages and /messages/:peerId
// =====================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Conversation, Message, getConversations, getThread,
  sendMessage, deleteMessage, deleteConversation,
} from "@/lib/api/accountApi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const timeAgo = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(iso).toLocaleDateString("en-TZ", { day: "numeric", month: "short" });
};

export default function MessagesPage() {
  const { peerId } = useParams<{ peerId: string }>();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<null | { kind: "msg-me" | "msg-all" | "convo"; id: string }>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activePeer = useMemo(
    () => convos.find((c) => c.peer_id === peerId) ?? null,
    [convos, peerId]
  );

  const refreshConvos = useCallback(async () => {
    setConvos(await getConversations());
  }, []);

  const loadThread = useCallback(async (peer: string) => {
    const msgs = await getThread(peer);
    setThread(msgs.reverse()); // RPC returns newest-first
    refreshConvos();           // unread badges were just cleared server-side
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
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.length]);

  // One realtime channel for everything addressed to me
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

  const send = async () => {
    if (!peerId || !draft.trim()) return;
    const body = draft.trim();
    setDraft(""); setReplyTo(null);
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
      setThread([]); navigate("/messages");
    } else {
      await deleteMessage(confirm.id, confirm.kind === "msg-all");
      setThread((t) =>
        confirm.kind === "msg-all"
          ? t.map((m) => (m.id === confirm.id ? { ...m, deleted_at: new Date().toISOString(), body: "" } : m))
          : t.filter((m) => m.id !== confirm.id)
      );
    }
    refreshConvos();
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-6xl overflow-hidden rounded-none sm:rounded-2xl sm:border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      {/* ───────── Conversation list ───────── */}
      <aside className={`${peerId ? "hidden md:flex" : "flex"} w-full md:w-80 flex-col border-r border-neutral-200 dark:border-neutral-800`}>
        <div className="px-4 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h1 className="text-lg font-semibold">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="p-4 text-sm text-neutral-500">Loading conversations…</p>}
          {!loading && convos.length === 0 && (
            <div className="p-6 text-center text-sm text-neutral-500">
              No conversations yet. Message a seller from any product page to start one.
            </div>
          )}
          {convos.map((c) => (
            <button
              key={c.peer_id}
              onClick={() => navigate(`/messages/${c.peer_id}`)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900
                ${c.peer_id === peerId ? "bg-[var(--mm-accent-soft)] dark:bg-neutral-900" : ""}`}
            >
              <img
                src={c.peer_avatar || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(c.peer_name ?? "U")}`}
                alt="" className="h-11 w-11 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{c.peer_name ?? "User"}</p>
                  <span className="shrink-0 text-xs text-neutral-400">{timeAgo(c.last_created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-neutral-500">
                    {c.last_sender_id === me ? "You: " : ""}
                    {c.last_body || (c.last_attachment_type ? "📎 Attachment" : "Message deleted")}
                  </p>
                  {c.unread_count > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--mm-accent)] px-1.5 text-[11px] font-bold text-[var(--mm-accent-on)]">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ───────── Chat pane ───────── */}
      <section className={`${peerId ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
        {!activePeer ? (
          <div className="grid flex-1 place-items-center text-sm text-neutral-400">
            Select a conversation
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
              <button className="md:hidden text-xl" onClick={() => navigate("/messages")} aria-label="Back">←</button>
              <img src={activePeer.peer_avatar || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(activePeer.peer_name ?? "U")}`}
                   alt="" className="h-9 w-9 rounded-full object-cover" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{activePeer.peer_name ?? "User"}</p>
                <p className="text-xs text-neutral-400 capitalize">
                  {activePeer.peer_role}{activePeer.peer_last_seen ? ` · active ${timeAgo(activePeer.peer_last_seen)} ago` : ""}
                </p>
              </div>
              <button
                onClick={() => setConfirm({ kind: "convo", id: activePeer.peer_id })}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                Delete chat
              </button>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {thread.map((m) => {
                const mine = m.sender_id === me;
                const replied = m.reply_to_id ? thread.find((x) => x.id === m.reply_to_id) : null;
                return (
                  <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`relative max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm
                      ${mine ? "bg-[var(--mm-accent)] text-[var(--mm-accent-on)] rounded-br-sm"
                             : "bg-neutral-100 dark:bg-neutral-800 rounded-bl-sm"}`}>
                      {replied && (
                        <div className={`mb-1 rounded-lg border-l-2 px-2 py-1 text-xs opacity-80
                          ${mine ? "border-white/60 bg-white/10" : "border-[var(--mm-accent)] bg-black/5 dark:bg-white/5"}`}>
                          {replied.deleted_at ? "Deleted message" : replied.body.slice(0, 80)}
                        </div>
                      )}
                      {m.deleted_at
                        ? <em className="opacity-70">This message was deleted</em>
                        : m.body}
                      <span className="ml-2 align-bottom text-[10px] opacity-70">{timeAgo(m.created_at)}</span>

                      {!m.deleted_at && (
                        <div className={`absolute -top-3 ${mine ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"}
                                         hidden group-hover:flex gap-1`}>
                          <button title="Reply" onClick={() => setReplyTo(m)}
                            className="rounded-full bg-white dark:bg-neutral-700 px-2 py-0.5 text-xs shadow">↩</button>
                          <button title="Delete for me" onClick={() => setConfirm({ kind: "msg-me", id: m.id })}
                            className="rounded-full bg-white dark:bg-neutral-700 px-2 py-0.5 text-xs shadow">🗑</button>
                          {mine && (
                            <button title="Delete for everyone" onClick={() => setConfirm({ kind: "msg-all", id: m.id })}
                              className="rounded-full bg-white dark:bg-neutral-700 px-2 py-0.5 text-xs shadow text-red-500">⛔</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {replyTo && (
              <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-4 py-2 text-xs">
                <span className="truncate">Replying to: {replyTo.body.slice(0, 60)}</span>
                <button onClick={() => setReplyTo(null)} className="ml-3 font-semibold">✕</button>
              </div>
            )}

            <footer className="flex items-end gap-2 border-t border-neutral-200 dark:border-neutral-800 p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1} maxLength={4000}
                placeholder={activePeer.is_blocked ? "You blocked this user" : "Write a message…"}
                disabled={activePeer.is_blocked}
                className="max-h-32 flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-700
                           bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mm-accent)]"
              />
              <button
                onClick={send}
                disabled={!draft.trim() || activePeer.is_blocked}
                className="rounded-xl bg-[var(--mm-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--mm-accent-on)] disabled:opacity-40"
              >
                Send
              </button>
            </footer>
          </>
        )}
      </section>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === "convo" ? "Delete this conversation?"
          : confirm?.kind === "msg-all" ? "Delete for everyone?"
          : "Delete this message?"
        }
        description={
          confirm?.kind === "convo"
            ? "The conversation is removed from your inbox only. The other person keeps their copy."
            : confirm?.kind === "msg-all"
            ? "It will be replaced with “This message was deleted” for both of you. Only possible within 1 hour of sending."
            : "It will be removed from your view only."
        }
        confirmLabel="Delete"
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
