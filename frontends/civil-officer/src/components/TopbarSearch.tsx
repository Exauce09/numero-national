import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchEveryone, searchFormDrafts, type DraftSearchHit } from "../nationalSearch";
import { displayName, personOrigin, type Person } from "../registry";

export default function TopbarSearch() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Person[]>([]);
  const [drafts, setDrafts] = useState<DraftSearchHit[]>([]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 1) {
      setHits([]);
      setDrafts([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void Promise.all([searchEveryone(needle), searchFormDrafts(needle)]).then(([rows, draftRows]) => {
        if (!cancelled) {
          setHits(rows.slice(0, 6));
          setDrafts(draftRows.slice(0, 4));
        }
      });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

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

  function selectDraft(d: DraftSearchHit) {
    setOpen(false);
    navigate(`/census?draft=${encodeURIComponent(d.id)}`);
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
          placeholder="NIC, nom, brouillon…"
          aria-label="Recherche intelligente"
          autoComplete="off"
        />
      </form>
      {open && q.trim() ? (
        <div className="topbar-search-dropdown" role="listbox">
          {hits.length === 0 && drafts.length === 0 ? (
            <div className="topbar-search-empty">Aucun résultat</div>
          ) : (
            <>
              {hits.map((p) => {
                const loc = personOrigin(p);
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
              })}
              {drafts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="topbar-search-hit"
                  role="option"
                  onClick={() => selectDraft(d)}
                >
                  <strong>Brouillon · {d.title || d.local_id || d.id.slice(0, 8)}</strong>
                  <span>
                    {d.system} / {d.form_type}
                  </span>
                </button>
              ))}
            </>
          )}
          <button type="button" className="topbar-search-all" onClick={() => goSearch(q)}>
            Voir tous les résultats
          </button>
        </div>
      ) : null}
    </div>
  );
}
