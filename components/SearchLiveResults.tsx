import React, { useState } from "react";

export const SearchLiveResults: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; title: string }>>([]);

  // TODO: wire to real search endpoint with debounce
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    // placeholder: fake results
    if (e.target.value.length > 1) {
      setResults([
        { id: "1", title: `${e.target.value} — Example product A` },
        { id: "2", title: `${e.target.value} — Example product B` },
        { id: "3", title: `${e.target.value} — Example product C` },
      ]);
    } else {
      setResults([]);
    }
  };

  return (
    <div className="search-live-results">
      <input aria-label="Search" value={query} onChange={onChange} className="input" placeholder="Search products" />
      {results.length > 0 && (
        <ul className="mt-2 bg-white shadow rounded">
          {results.map((r) => (
            <li key={r.id} className="p-2 border-b last:border-b-0">{r.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchLiveResults;
