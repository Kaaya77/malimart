// =====================================================================
// AccountMenu.tsx — the navbar avatar dropdown. ONE component, role-
// aware, fed by get_account_overview() in a single round trip.
// Mount inside your Navbar:  <AccountMenu />
// =====================================================================
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { getAccountOverview, AccountOverview } from "../services/accountApi";

interface Item { to: string; label: string; icon: string; badge?: number; roles: string[] }

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [ov, setOv] = useState<AccountOverview | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getAccountOverview().then(setOv).catch(() => setOv(null));
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const p = (ov?.profile ?? {}) as Record<string, any>;
  const role: string = p.role ?? "buyer";
  const name: string = p.display_name || p.full_name || "My account";

  const items: Item[] = [
    { to: "/dashboard",        label: "Dashboard",      icon: "🏠", roles: ["buyer"] },
    { to: "/seller/dashboard", label: "Seller hub",     icon: "📊", roles: ["seller"] },
    { to: "/admin",            label: "Admin console",  icon: "🛡️", roles: ["admin"] },
    { to: "/orders",           label: "Orders",         icon: "📦", badge: ov?.open_orders, roles: ["buyer", "seller", "admin"] },
    { to: "/messages",         label: "Messages",       icon: "💬", badge: ov?.unread_messages, roles: ["buyer", "seller", "admin"] },
    { to: "/wishlist",         label: "Wishlist",       icon: "❤️", badge: ov?.wishlist_count, roles: ["buyer"] },
    { to: "/wallet",           label: "Wallet",         icon: "💳", roles: ["buyer", "seller"] },
    { to: "/account/settings", label: "Settings",       icon: "⚙️", roles: ["buyer", "seller", "admin"] },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!ov) {
    return (
      <Link to="/login" className="rounded-xl bg-[var(--mm-accent)] px-4 py-2 text-sm font-semibold text-[var(--mm-accent-on)]">
        Sign in
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu" aria-expanded={open}
        className="relative flex items-center gap-2 rounded-full p-0.5 ring-2 ring-transparent hover:ring-[var(--mm-accent)]"
      >
        <img
          src={p.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`}
          alt={name} className="h-9 w-9 rounded-full object-cover"
        />
        {(ov.unread_messages + ov.unread_notifications) > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-neutral-950" />
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 bg-[var(--mm-accent-soft)] dark:bg-neutral-900 px-4 py-4">
            <img src={p.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`}
                 alt="" className="h-11 w-11 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name} {p.signature_emoji ?? ""}</p>
              <p className="text-xs capitalize text-neutral-500">{role} · {p.tier ?? "standard"}</p>
            </div>
          </div>

          <nav className="py-1">
            {items.filter((i) => i.roles.includes(role)).map((i) => (
              <Link key={i.to} to={i.to} onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <span className="flex items-center gap-3"><span>{i.icon}</span>{i.label}</span>
                {!!i.badge && (
                  <span className="rounded-full bg-[var(--mm-accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--mm-accent-on)]">
                    {i.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <button onClick={signOut}
            className="w-full border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
