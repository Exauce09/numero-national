import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ExportToolbar from "../components/ExportToolbar";
import {
  DISP_STATUS_LABELS,
  DOC_STATUS_LABELS,
  JOURNEY_TYPE_LABELS,
  KIND_LABELS,
  findCitizens,
  getCitizenById,
  getCitizenJourney,
  getInteriorSnapshot,
} from "../interiorData";

export default function ParcoursPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("c") ?? "";
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);

  const snap = useMemo(() => getInteriorSnapshot(), [tick]);
  const matches = useMemo(() => findCitizens(q), [q, tick]);
  const citizen = selectedId ? getCitizenById(selectedId) : undefined;
  const journey = citizen ? getCitizenJourney(citizen.id) : [];

  const movements = citizen ? snap.movements.filter((m) => m.citizen_id === citizen.id) : [];
  const displacements = citizen ? snap.displacements.filter((d) => d.citizen_id === citizen.id) : [];
  const docs = citizen ? snap.missing_docs.filter((d) => d.citizen_id === citizen.id) : [];

  const exportRows = journey.map((e) => ({
    date: new Date(e.at).toLocaleString("fr-FR"),
    type: JOURNEY_TYPE_LABELS[e.type],
    titre: e.title,
    detail: e.detail,
    ref: e.ref ?? "",
  }));

  function selectCitizen(id: string) {
    setParams(id ? { c: id } : {});
  }

  return (
    <div className="print-area">
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Parcours citoyen</h2>
          <p className="page-lead">
            Recherchez un citoyen et consultez son parcours : mouvements, déplacements et documents.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm no-print" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="parcours-layout">
        <aside className="panel parcours-search no-print">
          <h3 className="panel-title">Rechercher</h3>
          <input
            className="form-control"
            placeholder="NN, nom, commune…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <ul className="citizen-list">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`citizen-list-item${selectedId === c.id ? " active" : ""}`}
                  onClick={() => selectCitizen(c.id)}
                >
                  <strong>
                    {c.nom} {c.postnom} {c.prenom}
                  </strong>
                  <span className="muted small">
                    <code>{c.nn}</code> · {c.commune_residence}, {c.province_residence}
                  </span>
                  <span className="citizen-status">{c.statut.replace("_", " ")}</span>
                </button>
              </li>
            ))}
            {!matches.length ? <li className="muted small">Aucun citoyen trouvé.</li> : null}
          </ul>
        </aside>

        <section className="parcours-detail">
          {!citizen ? (
            <div className="panel">
              <p className="muted" style={{ margin: 0 }}>
                Sélectionnez un citoyen pour afficher son parcours complet.
              </p>
            </div>
          ) : (
            <>
              <div className="panel citizen-card">
                <div className="citizen-card-head">
                  <div>
                    <h3 className="panel-title" style={{ marginBottom: "0.25rem" }}>
                      {citizen.nom} {citizen.postnom} {citizen.prenom}
                    </h3>
                    <p className="muted small" style={{ margin: 0 }}>
                      <code>{citizen.nn}</code> · {citizen.sexe === "M" ? "Masculin" : "Féminin"} · né(e) le{" "}
                      {new Date(citizen.date_naissance).toLocaleDateString("fr-FR")} à {citizen.lieu_naissance}
                    </p>
                  </div>
                  <span className={`pill-status status-${citizen.statut.toLowerCase()}`}>
                    {citizen.statut.replace("_", " ")}
                  </span>
                </div>
                <div className="grid" style={{ marginTop: "0.85rem", marginBottom: 0 }}>
                  <div className="metric">
                    <div className="label">Résidence</div>
                    <div className="value" style={{ fontSize: "1.05rem" }}>
                      {citizen.commune_residence}
                    </div>
                    <div className="muted small">{citizen.province_residence}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Mouvements</div>
                    <div className="value">{movements.length}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Déplacements</div>
                    <div className="value">{displacements.length}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Documents</div>
                    <div className="value">{docs.length}</div>
                  </div>
                </div>
              </div>

              <ExportToolbar
                filename={`interieur_parcours_${citizen.nn}`}
                title={`Parcours — ${citizen.nom} ${citizen.prenom}`}
                rows={exportRows}
                tableName="interieur_parcours"
              />

              <div className="panel">
                <h3 className="panel-title">Chronologie du parcours</h3>
                <ol className="timeline">
                  {journey.map((e) => (
                    <li key={e.id} className={`timeline-item type-${e.type.toLowerCase()}`}>
                      <div className="timeline-dot" aria-hidden />
                      <div className="timeline-body">
                        <div className="timeline-meta">
                          <span className="timeline-type">{JOURNEY_TYPE_LABELS[e.type]}</span>
                          <time className="muted small">{new Date(e.at).toLocaleString("fr-FR")}</time>
                        </div>
                        <strong>{e.title}</strong>
                        <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                          {e.detail}
                        </p>
                        {e.ref ? (
                          <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                            Réf. <code>{e.ref}</code>
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                  {!journey.length ? <li className="muted">Aucun événement enregistré.</li> : null}
                </ol>
              </div>

              <div className="chart-grid" style={{ marginTop: "1rem" }}>
                <div className="panel">
                  <h3 className="panel-title">Mouvements liés</h3>
                  {movements.length ? (
                    <ul className="compact-list">
                      {movements.map((m) => (
                        <li key={m.id}>
                          <strong>{KIND_LABELS[m.kind]}</strong> — {m.from_commune} → {m.to_commune}
                          <div className="muted small">{new Date(m.date).toLocaleDateString("fr-FR")}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Aucun mouvement.</p>
                  )}
                </div>
                <div className="panel">
                  <h3 className="panel-title">Déplacements liés</h3>
                  {displacements.length ? (
                    <ul className="compact-list">
                      {displacements.map((d) => (
                        <li key={d.id}>
                          <strong>{d.acte_ref}</strong> — {DISP_STATUS_LABELS[d.status]}
                          <div className="muted small">
                            {d.origine} → {d.destination}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Aucun déplacement.</p>
                  )}
                </div>
                <div className="panel">
                  <h3 className="panel-title">Documents</h3>
                  {docs.length ? (
                    <ul className="compact-list">
                      {docs.map((d) => (
                        <li key={d.id}>
                          <strong>{d.document}</strong> — {DOC_STATUS_LABELS[d.status]} ({d.priorite})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Aucun document signalé.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
