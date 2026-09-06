import React, { useMemo, useState } from "react";

export type NotificationItem = {
  id: string;
  type: string; // e.g., "like", "order"
  targetId?: string; // e.g., product id
  message: string;
  createdAt: string;
  read?: boolean;
};

export const NotificationsGrouping: React.FC<{ items?: NotificationItem[] }> = ({ items = [] }) => {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map: Record<string, NotificationItem[]> = {};
    items.forEach((it) => {
      const key = `${it.type}:${it.targetId ?? "global"}`;
      map[key] = map[key] || [];
      map[key].push(it);
    });
    return map;
  }, [items]);

  const toggle = (k: string) => setExpandedKeys((s) => ({ ...s, [k]: !s[k] }));

  if (items.length === 0) return <div className="text-muted">No notifications</div>;

  return (
    <div className="notifications-grouping space-y-3">
      {Object.entries(groups).map(([k, list]) => (
        <div key={k} className="border rounded p-2">
          <button className="w-full text-left flex items-center justify-between" onClick={() => toggle(k)} aria-expanded={!!expandedKeys[k]}>
            <div>
              <strong>{list.length} {list[0].type === "like" ? "likes" : list[0].type + "s"} on {list[0].targetId ?? "your account"}</strong>
              <div className="text-xxs text-muted">{list[0].message}</div>
            </div>
            <div className="text-xxs text-muted">{expandedKeys[k] ? "Hide" : "Show"}</div>
          </button>

          {expandedKeys[k] && (
            <ul className="mt-2 pl-4 list-disc">
              {list.map((it) => (
                <li key={it.id} className={`${it.read ? "text-muted" : ""}`}>{it.message} <span className="text-xxs text-muted">• {new Date(it.createdAt).toLocaleString()}</span></li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

export default NotificationsGrouping;
