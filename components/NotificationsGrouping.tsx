import React from "react";

export const NotificationsGrouping: React.FC = () => {
  // TODO: replace with real grouping logic (server or client)
  const grouped = [
    { key: "likes:prod-1", summary: "3 people liked your product", items: ["Like A","Like B","Like C"] },
    { key: "orders", summary: "2 new orders", items: ["Order #123","Order #124"] },
  ];

  return (
    <div className="notifications-grouping">
      {grouped.map((g) => (
        <details key={g.key} className="mb-2">
          <summary className="cursor-pointer">{g.summary}</summary>
          <ul className="mt-2 pl-4 list-disc">
            {g.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
};

export default NotificationsGrouping;
