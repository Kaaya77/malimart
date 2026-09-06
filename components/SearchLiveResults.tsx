import React, { useEffect, useRef, useState } from "react";

type Result = { id: string; title: string; price?: string };

export const SearchLiveResults: React.FC<{ fetchResults?: (q: string) => Promise<Result[]> }> = ({ fetchResults }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [highlight, setHighlight] = useState<number>(-1);
  const debouncer = useRef<number | null>(null);

  useEffect(() => {
    if (debouncer.current) window.clearTimeout(debouncer.current);
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    debouncer.current = window.setTimeout(async () => {
      try {
        if (fetchResults) {
          const res = await fetchResults(query);
          setResults(res.slice(0, 4));
        } else {
          // fallback mock
          setResults([
            { id: "1", title: `${query} — Example product A`, price: "$9.99" },
            { id: "2", title: `${query} — Example product B`, price: "$14.99" },
            { id: "3", title: `${query} — Example product C`, price: "$7.99" },
          ]);
        }
      } catch (e) {
        setResults([]);
      }
    }, 250) as unknown as number;

    return () => {
      if (debouncer.current) window.clearTimeout(debouncer.current);
    };
  }, [query, fetchResults]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlight((h) => Math.max(h - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (highlight >= 0 && results[highlight]) {
        window.location.href = `/p/${results[highlight].id}`;
      }
    }
  };

  return (
    <div className="search-live-results relative" data-testid="search-live">
      <input
        aria-label="Search products"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className="input w-full"
        placeholder="Search products"
      />

      {results.length > 0 && (
        <ul className="mt-2 bg-white border rounded shadow max-h-60 overflow-auto z-20 absolute w-full">
          {results.map((r, idx) => (
            <li
              key={r.id}
              className={`p-2 flex justify-between items-center cursor-pointer ${highlight === idx ? "bg-gray-100" : ""}`}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => (window.location.href = `/p/${r.id}`)}
            >
              <div className="truncate">
                <div className="font-medium">{r.title}</div>
                {r.price && <div className="text-xxs text-muted">{r.price}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchLiveResults;
