import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import { getSession } from "../auth";
import { searchEveryone } from "../nationalSearch";
import {
  displayName,
  getPerson,
  personOrigin,
  type Person,
} from "../registry";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const hasApi = Boolean(getSession()?.accessToken);

  const runSearch = useCallback(async (value: string) => {
    const needle = value.trim();
    setBusy(true);
    setHint(null);
    try {
      const rows = await searchEveryone(needle);
      setHits(rows);
      if (!needle) {
        setHint(null);
      } else if (!rows.length && !getSession()?.accessToken) {
        setHint(
          "Connectez-vous avec un compte API (ex. officier) pour chercher dans le registre national. Mode local uniquement pour l’instant.",
        );
      } else if (!rows.length) {
        setHint("Aucun résultat national ni local pour cette recherche.");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const next = params.get("q") ?? "";
    setQ(next);
    void runSearch(next);
  }, [params, runSearch]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = q.trim();
    setParams(value ? { q: value } : {});
    void runSearch(value);
  }

  const rows = hits.map((p) => {
    const origin = personOrigin(p);
    return {
      nic: p.nic,
      nom: p.nom,
      postnom: p.postnom,
      prenom: p.prenom,
      date_naissance: p.date_naissance,
      province: origin.province,
      ville: origin.ville,
      origine_source:
        origin.source === "father" ? "Père" : origin.source === "mother" ? "Mère" : origin.source === "self" ? "Propre" : "",
      sexe: p.sexe,
      etat_civil: p.etat_civil,
    };
  });

  return (
    <div>
      <h2 className="page-title">Recherche</h2>
      <p className="page-lead">
        Recherche nationale (registre + NIC) et locale : NIC, nom, postnom, prénom, date de naissance,
        province et ville.
        {hasApi ? " · Connecté au registre national." : " · Sans jeton API : résultats locaux seulement."}
      </p>
      <div className="panel">
        <form className="toolbar" onSubmit={onSubmit}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="form-label">Critères</label>
            <input
              className="form-control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex. Azerty — ou un NIC"
            />
          </div>
          <button className="btn-primary" style={{ width: "auto", minWidth: 140 }} type="submit" disabled={busy}>
            {busy ? "…" : "Rechercher"}
          </button>
        </form>
        {hint ? <p className="muted" style={{ marginTop: 8 }}>{hint}</p> : null}
        <div className="panel-head" style={{ marginTop: "1rem" }}>
          <h3 className="panel-title">{hits.length} résultat(s)</h3>
          <DataToolbar filename="recherche_personnes" rows={rows} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>NIC</th>
              <th>Nom</th>
              <th>Postnom</th>
              <th>Prénom</th>
              <th>Naissance</th>
              <th>Province</th>
              <th>Ville</th>
              <th>Origine</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {hits.map((p) => {
              const origin = personOrigin(p);
              return (
                <tr key={p.id}>
                  <td>
                    <code>{p.nic}</code>
                  </td>
                  <td>{p.nom}</td>
                  <td>{p.postnom}</td>
                  <td>{p.prenom}</td>
                  <td>{p.date_naissance || "—"}</td>
                  <td>{origin.province || "—"}</td>
                  <td>{origin.ville || "—"}</td>
                  <td>
                    {origin.source === "father"
                      ? "Père"
                      : origin.source === "mother"
                        ? "Mère"
                        : origin.source === "self"
                          ? "Propre"
                          : "—"}
                  </td>
                  <td>
                    <button type="button" className="btn-secondary" onClick={() => setSelected(getPerson(p.id) ?? p)}>
                      Détail
                    </button>
                  </td>
                </tr>
              );
            })}
            {!hits.length ? (
              <tr>
                <td colSpan={9} className="muted">
                  Aucune personne trouvée.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>{displayName(selected)}</h3>
            <dl className="act-print-fields">
              <div>
                <dt>NIC</dt>
                <dd>{selected.nic}</dd>
              </div>
              <div>
                <dt>Naissance</dt>
                <dd>
                  {selected.date_naissance || "—"} · {selected.lieu_naissance || "—"}
                </dd>
              </div>
              {(() => {
                const origin = personOrigin(selected);
                const father = selected.father_id ? getPerson(selected.father_id) : undefined;
                const mother = selected.mother_id ? getPerson(selected.mother_id) : undefined;
                return (
                  <>
                    <div>
                      <dt>Père</dt>
                      <dd>{father ? `${displayName(father)} (${father.nic})` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Mère</dt>
                      <dd>{mother ? `${displayName(mother)} (${mother.nic})` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Origine (province / ville…)</dt>
                      <dd>
                        {origin.label || "—"}
                        {origin.source === "father"
                          ? ` — via père ${origin.source_name}`
                          : origin.source === "mother"
                            ? ` — via mère ${origin.source_name}`
                            : origin.source === "self"
                              ? " — infos propres"
                              : ""}
                      </dd>
                    </div>
                  </>
                );
              })()}
            </dl>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
