// =====================================================================
// NotificationsPanel.tsx — dropdown/sheet with the cancel/delete UX
// users expect: mark all read, multi-select delete, clear read.
// Reads/writes go through useComms()'s shared notifications state (which
// itself calls ownership-enforced RPCs) instead of keeping a private copy
// — a private copy is why marking read or deleting here never used to
// move the unread badge in the navbar, which reads that same shared state.
// =====================================================================
import { useState } from "react";
import { Link } from "react-router-dom";
import { useComms } from "../context/AppContext";
import { clearReadNotifications, deleteNotifications } from "../services/accountApi";

const ICONS: Record<string, string> = {
  order: "📦", message: "💬", payment: "💳", system: "⚙️", promo: "🏷️",
};

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markNotificationRead, markAllNotificationsRead, deleteAllNotifications, refreshNotifications } = useComms();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [working, setWorking] = useState(false);

  const items = notifications ?? [];

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const removeSelected = async () => {
    const ids = [...selected];
    setWorking(true);
    try {
      await deleteNotifications(ids);
      await refreshNotifications();
      setSelected(new Set()); setSelecting(false);
    } finally { setWorking(false); }
  };

  return (
    <div className="w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-2xl">
      <header className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <div className="flex gap-2 text-xs">
          {selecting ? (
            <>
              <button onClick={removeSelected} disabled={selected.size === 0 || working}
                className="font-semibold text-red-600 disabled:opacity-40">
                Delete ({selected.size})
              </button>
              <button onClick={() => { setSelecting(false); setSelected(new Set()); }}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => markAllNotificationsRead()}>
                Mark all read
              </button>
              <button onClick={() => setSelecting(true)}>Select</button>
            </>
          )}
        </div>
      </header>

      <div className="max-h-[60vh] overflow-y-auto">
        {items.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground/45">
            You're all caught up. New order and message updates will appear here.
          </p>
        )}
        {items.map((n: any) => {
          const inner = (
            <div className={`flex gap-3 px-4 py-3 transition-colors ${n.read ? "" : "bg-emerald-500/10"}`}>
              {selecting && (
                <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggle(n.id)}
                  onClick={(e) => e.stopPropagation()} className="mt-1 accent-emerald-500" />
              )}
              <span className="text-lg">{ICONS[n.type] ?? "🔔"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="line-clamp-2 text-xs text-foreground/45">{n.message}</p>
                <p className="mt-0.5 text-[11px] text-foreground/35">
                  {new Date(n.created_at).toLocaleString("en-TZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />}
            </div>
          );
          return selecting || !n.link ? (
            <div key={n.id} onClick={() => selecting && toggle(n.id)} className="cursor-pointer border-b border-foreground/8 last:border-0">
              {inner}
            </div>
          ) : (
            <Link key={n.id} to={n.link} onClick={() => { if (!n.read) markNotificationRead(n.id); onClose(); }}
              className="block border-b border-foreground/8 last:border-0 hover:bg-foreground/[0.04]">
              {inner}
            </Link>
          );
        })}
      </div>

      <footer className="flex items-center justify-center gap-4 border-t border-foreground/10 px-4 py-2.5 text-center">
        <button
          onClick={async () => { await clearReadNotifications(); await refreshNotifications(); }}
          className="text-xs font-medium text-foreground/45 hover:text-foreground"
        >
          Clear read
        </button>
        {items.length > 0 && (
          <button
            onClick={async () => {
              await deleteAllNotifications();
              setSelected(new Set()); setSelecting(false);
            }}
            className="text-xs font-semibold text-foreground/45 hover:text-red-600"
          >
            Delete all
          </button>
        )}
      </footer>
    </div>
  );
}
