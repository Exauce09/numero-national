import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { displayName, personLocation, searchPersons, type Person } from "../registry";

export default function TopbarSearch() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const hits = useMemo(() => {
    const needle = q.trim();
    if (needle.length < 1) return [] as Person[];
    return searchPersons(needle).slice(0, 8);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function goSearch(query: string) {
    const value = query.trim();
    setOpen(false);
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    goSearch(q);
  }

  function selectPerson(p: Person) {
    setQ(p.nic);
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(p.nic)}`);
  }

  return (
    <div className="topbar-search" ref={rootRef}>
      <form className="topbar-search-form" onSubmit={onSubmit} role="search">
        <svg className="topbar-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          className="topbar-search-input"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="NIC, nom, date, province, ville…"
          aria-label="Recherche intelligente"
          autoComplete="off"
        />
      </form>
      {open && q.trim() ? (
        <div className="topbar-search-dropdown" role="listbox">
          {hits.length === 0 ? (
            <div className="topbar-search-empty">Aucun résultat</div>
          ) : (
            hits.map((p) => {
              const loc = personLocation(p.id, p.nic);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="topbar-search-hit"
                  role="option"
                  onClick={() => selectPerson(p)}
                >
                  <strong>{displayName(p)}</strong>
                  <span>
                    {p.nic} · {p.date_naissance || "—"}
                    {loc.ville || loc.province
                      ? ` · ${[loc.ville, loc.province].filter(Boolean).join(", ")}`
                      : ""}
                  </span>
                </button>
              );
            })
          )}
          <button type="button" className="topbar-search-all" onClick={() => goSearch(q)}>
            Voir tous les résultats
          </button>
        </div>
      ) : null}
    </div>
  );
}
