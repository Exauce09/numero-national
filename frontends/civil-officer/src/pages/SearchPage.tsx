import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import { getSession } from "../auth";
import { searchEveryone, searchFormDrafts, type DraftSearchHit } from "../nationalSearch";
import {
  personOrigin,
  type Person,
} from "../registry";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Person[]>([]);
  const [drafts, setDrafts] = useState<DraftSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const hasApi = Boolean(getSession()?.accessToken);

  const runSearch = useCallback(async (value: string) => {
    const needle = value.trim();
    setBusy(true);
    setHint(null);
    try {
      const [rows, draftRows] = await Promise.all([
        searchEveryone(needle),
        searchFormDrafts(needle),
      ]);
      setHits(rows);
      setDrafts(draftRows);
      if (!needle) {
        setHint(null);
      } else if (!rows.length && !draftRows.length && !getSession()?.accessToken) {
        setHint(
          "Connectez-vous avec un compte API (ex. officier) pour chercher dans le registre national et les brouillons.",
        );
      } else if (!rows.length && !draftRows.length) {
        setHint("Aucun résultat (personnes ni brouillons) pour cette recherche.");
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
        Registre national, fiches locales et brouillons partagés (APK / commune) : NIC, nom, titre, local_id…
        {hasApi ? " · Connecté à l’API." : " · Sans jeton API : résultats locaux seulement."}
      </p>
      <div className="panel">
        <form className="toolbar" onSubmit={onSubmit}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="form-label">Critères</label>
            <input
              className="form-control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex. Azerty — NIC — ou titre de brouillon"
            />
          </div>
          <button className="btn-primary" style={{ width: "auto", minWidth: 140 }} type="submit" disabled={busy}>
            {busy ? "…" : "Rechercher"}
          </button>
        </form>
        {hint ? <p className="muted" style={{ marginTop: 8 }}>{hint}</p> : null}
        <div className="panel-head" style={{ marginTop: "1rem" }}>
          <h3 className="panel-title">{hits.length} personne(s)</h3>
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
                    <Link className="btn-secondary" to={`/personnes/${p.id}`}>
                      Voir
                    </Link>
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

      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-head">
          <h3 className="panel-title">{drafts.length} brouillon(s)</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Système</th>
              <th>Type</th>
              <th>Réf. locale</th>
              <th>Maj</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id}>
                <td>{d.title || "—"}</td>
                <td>{d.system}</td>
                <td>{d.form_type}</td>
                <td>
                  <code>{d.local_id || "—"}</code>
                </td>
                <td>{d.updated_at ? new Date(d.updated_at).toLocaleString("fr-CD") : "—"}</td>
                <td>
                  <Link className="btn-secondary" to={`/census?draft=${encodeURIComponent(d.id)}`}>
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
            {!drafts.length ? (
              <tr>
                <td colSpan={6} className="muted">
                  Aucun brouillon pour cette recherche.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
