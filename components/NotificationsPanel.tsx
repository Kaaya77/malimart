// =====================================================================
// NotificationsPanel.tsx — dropdown/sheet with the cancel/delete UX
// users expect: mark all read, multi-select delete, clear read.
// All writes go through RPCs (ownership enforced server-side).
// =====================================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNotifications } from "../services/notificationsService";
import {
  markAllNotificationsRead, deleteNotifications, clearReadNotifications, deleteAllNotifications,
} from "../services/accountApi";

interface Notif {
  id: string; type: string; title: string; message: string;
  link: string | null; read: boolean; created_at: string;
}

const ICONS: Record<string, string> = {
  order: "📦", message: "💬", payment: "💳", system: "⚙️", promo: "🏷️",
};

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const data = await fetchNotifications(30);
    setItems((data as Notif[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const removeSelected = async () => {
    const ids = [...selected];
    await deleteNotifications(ids);
    setItems((it) => it.filter((n) => !selected.has(n.id)));
    setSelected(new Set()); setSelecting(false);
  };

  return (
    <div className="w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-2xl">
      <header className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <div className="flex gap-2 text-xs">
          {selecting ? (
            <>
              <button onClick={removeSelected} disabled={selected.size === 0}
                className="font-semibold text-red-600 disabled:opacity-40">
                Delete ({selected.size})
              </button>
              <button onClick={() => { setSelecting(false); setSelected(new Set()); }}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={async () => { await markAllNotificationsRead();
                setItems((it) => it.map((n) => ({ ...n, read: true }))); }}>
                Mark all read
              </button>
              <button onClick={() => setSelecting(true)}>Select</button>
            </>
          )}
        </div>
      </header>

      <div className="max-h-[60vh] overflow-y-auto">
        {loading && <p className="p-4 text-sm text-foreground/45">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground/45">
            You're all caught up. New order and message updates will appear here.
          </p>
        )}
        {items.map((n) => {
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
            <Link key={n.id} to={n.link} onClick={onClose}
              className="block border-b border-foreground/8 last:border-0 hover:bg-foreground/[0.04]">
              {inner}
            </Link>
          );
        })}
      </div>

      <footer className="flex items-center justify-center gap-4 border-t border-foreground/10 px-4 py-2.5 text-center">
        <button
          onClick={async () => { await clearReadNotifications(); load(); }}
          className="text-xs font-medium text-foreground/45 hover:text-foreground"
        >
          Clear read
        </button>
        {items.length > 0 && (
          <button
            onClick={async () => {
              await deleteAllNotifications();
              setItems([]); setSelected(new Set()); setSelecting(false);
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
