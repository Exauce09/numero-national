import { useMemo, useState } from "react";
import { TYPE_LABELS, getNationalSnapshot } from "../nationalData";

export function PopulationPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getNationalSnapshot(), [tick]);
  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Population</h2>
          <p className="page-lead">Effectifs nationaux consolidés (lecture Présidence).</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>
      <div className="grid" style={{ marginBottom: "1rem" }}>
        <div className="metric">
          <div className="label">Total</div>
          <div className="value">{snap.population_total.toLocaleString("fr-FR")}</div>
        </div>
        <div className="metric">
          <div className="label">Hommes</div>
          <div className="value">{snap.population_m.toLocaleString("fr-FR")}</div>
        </div>
        <div className="metric">
          <div className="label">Femmes</div>
          <div className="value">{snap.population_f.toLocaleString("fr-FR")}</div>
        </div>
      </div>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Province</th>
              <th>Total</th>
              <th>Hommes</th>
              <th>Femmes</th>
            </tr>
          </thead>
          <tbody>
            {snap.population_by_province.map((p) => (
              <tr key={p.province}>
                <td>{p.province}</td>
                <td>{p.total.toLocaleString("fr-FR")}</td>
                <td>{p.m.toLocaleString("fr-FR")}</td>
                <td>{p.f.toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CivilOfficesPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getNationalSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const rows = snap.civil_offices.filter((o) =>
    `${o.commune} ${o.province} ${o.officer} ${o.code}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">États civils</h2>
          <p className="page-lead">Toutes les communes / bureaux d&apos;état civil du système.</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>
      <div className="toolbar">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Commune</th>
              <th>Code</th>
              <th>Province</th>
              <th>Ville</th>
              <th>Officier</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{o.commune}</td>
                <td>
                  <code>{o.code}</code>
                </td>
                <td>{o.province}</td>
                <td>{o.ville}</td>
                <td>{o.officer}</td>
                <td style={{ color: o.active ? "#1a5f4a" : "#8a4b1a", fontWeight: 700 }}>
                  {o.active ? "Actif" : "Inactif"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FacilitiesPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getNationalSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const rows = snap.health_facilities.filter((f) =>
    `${f.name} ${f.commune} ${f.province} ${f.type}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Structures sanitaires</h2>
          <p className="page-lead">Toutes les structures sanitaires du système national.</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>
      <div className="toolbar">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Province</th>
              <th>Commune</th>
              <th>Statut</th>
              <th>Naissances</th>
              <th>Décès</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{TYPE_LABELS[f.type] ?? f.type}</td>
                <td>{f.province}</td>
                <td>{f.commune}</td>
                <td style={{ color: f.active ? "#1a5f4a" : "#8a4b1a", fontWeight: 700 }}>
                  {f.active ? "Actif" : "Désactivé"}
                </td>
                <td>{f.births}</td>
                <td>{f.deaths}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActsPage({
  title,
  lead,
  type,
}: {
  title: string;
  lead: string;
  type: string;
}) {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getNationalSnapshot(), [tick]);
  const rows = snap.acts.filter((a) => a.type === type);
  const total =
    type === "BIRTH"
      ? snap.births
      : type === "DEATH"
        ? snap.deaths
        : type === "MARRIAGE"
          ? snap.marriages
          : type === "DIVORCE"
            ? snap.divorces
            : rows.length;

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="page-lead">{lead}</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>
      <div className="metric" style={{ marginBottom: "1rem", maxWidth: 240 }}>
        <div className="label">Total national</div>
        <div className="value">{total.toLocaleString("fr-FR")}</div>
      </div>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Résumé</th>
              <th>Commune</th>
              <th>Province</th>
              <th>Sexe</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.summary}</td>
                <td>{a.commune}</td>
                <td>{a.province}</td>
                <td>{a.sexe ?? "—"}</td>
                <td>{new Date(a.created_at).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun enregistrement récent — total national : {total.toLocaleString("fr-FR")}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BirthsPage() {
  return (
    <ActsPage title="Naissances" lead="Naissances enregistrées / déclarées au niveau national." type="BIRTH" />
  );
}

export function DeathsPage() {
  return <ActsPage title="Décès" lead="Décès enregistrés / déclarés au niveau national." type="DEATH" />;
}

export function MarriagesPage() {
  return <ActsPage title="Mariages" lead="Mariages enregistrés au niveau national." type="MARRIAGE" />;
}

export function DivorcesPage() {
  return <ActsPage title="Divorces" lead="Divorces enregistrés au niveau national." type="DIVORCE" />;
}
