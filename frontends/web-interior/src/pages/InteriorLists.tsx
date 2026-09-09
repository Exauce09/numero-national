import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ExportToolbar from "../components/ExportToolbar";
import {
  DISP_STATUS_LABELS,
  DOC_STATUS_LABELS,
  KIND_LABELS,
  getInteriorSnapshot,
  listProvinces,
  type DisplacementStatus,
  type DocStatus,
  type MovementKind,
} from "../interiorData";

function PageShell({
  title,
  lead,
  onRefresh,
  children,
}: {
  title: string;
  lead: string;
  onRefresh: () => void;
  children: ReactNode;
}) {
  return (
    <div className="print-area">
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="page-lead">{lead}</p>
        </div>
        <button type="button" className="btn-secondary btn-sm no-print" onClick={onRefresh}>
          Actualiser
        </button>
      </div>
      {children}
    </div>
  );
}

function statusColor(kind: "ok" | "warn" | "bad" | "info"): string {
  if (kind === "ok") return "#1a5f4a";
  if (kind === "warn") return "#8a4b1a";
  if (kind === "bad") return "#9b2c2c";
  return "#3b6ea5";
}

export function MovementsPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getInteriorSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [province, setProvince] = useState("");
  const provinces = listProvinces();

  const rows = snap.movements.filter((m) => {
    if (kind && m.kind !== kind) return false;
    if (province && m.from_province !== province && m.to_province !== province) return false;
    return `${m.nom_complet} ${m.nn} ${m.motif} ${m.from_commune} ${m.to_commune}`
      .toLowerCase()
      .includes(q.trim().toLowerCase());
  });

  const exportRows = rows.map((m) => ({
    date: new Date(m.date).toLocaleString("fr-FR"),
    type: KIND_LABELS[m.kind],
    nn: m.nn,
    citoyen: m.nom_complet,
    de: `${m.from_commune} (${m.from_province})`,
    vers: `${m.to_commune} (${m.to_province})`,
    motif: m.motif,
    canal: m.canal,
  }));

  return (
    <PageShell
      title="Mouvements"
      lead="Entrées, sorties, transits et retours consolidés au niveau national."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher citoyen, NN, motif…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Tous types</option>
          {(Object.keys(KIND_LABELS) as MovementKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select className="form-control" value={province} onChange={(e) => setProvince(e.target.value)}>
          <option value="">Toutes provinces</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <ExportToolbar
        filename="interieur_mouvements"
        title="Mouvements de population"
        rows={exportRows}
        tableName="interieur_mouvements"
      />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Citoyen</th>
              <th>De</th>
              <th>Vers</th>
              <th>Motif</th>
              <th>Canal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.date).toLocaleString("fr-FR")}</td>
                <td>
                  <strong style={{ color: statusColor("info") }}>{KIND_LABELS[m.kind]}</strong>
                </td>
                <td>
                  <div>{m.nom_complet}</div>
                  <code className="muted small">{m.nn}</code>
                </td>
                <td>
                  {m.from_commune}
                  <div className="muted small">{m.from_province}</div>
                </td>
                <td>
                  {m.to_commune}
                  <div className="muted small">{m.to_province}</div>
                </td>
                <td>{m.motif}</td>
                <td>{m.canal}</td>
                <td>
                  <Link className="btn-secondary btn-sm" to={`/parcours?c=${m.citizen_id}`}>
                    Parcours
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="muted">
                  Aucun mouvement pour ces filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function DisplacementsPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getInteriorSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [province, setProvince] = useState("");
  const provinces = listProvinces();

  const rows = snap.displacements.filter((d) => {
    if (status && d.status !== status) return false;
    if (province && d.province_origine !== province && d.province_destination !== province) return false;
    return `${d.nom_complet} ${d.nn} ${d.acte_ref} ${d.origine} ${d.destination}`
      .toLowerCase()
      .includes(q.trim().toLowerCase());
  });

  const exportRows = rows.map((d) => ({
    acte: d.acte_ref,
    citoyen: d.nom_complet,
    nn: d.nn,
    origine: d.origine,
    destination: d.destination,
    depart: new Date(d.date_depart).toLocaleString("fr-FR"),
    arrivee: d.date_arrivee ? new Date(d.date_arrivee).toLocaleString("fr-FR") : "",
    motif: d.motif,
    statut: DISP_STATUS_LABELS[d.status],
  }));

  return (
    <PageShell
      title="Déplacements"
      lead="Actes de déplacement et suivi des trajets citoyens."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous statuts</option>
          {(Object.keys(DISP_STATUS_LABELS) as DisplacementStatus[]).map((s) => (
            <option key={s} value={s}>
              {DISP_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="form-control" value={province} onChange={(e) => setProvince(e.target.value)}>
          <option value="">Toutes provinces</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <ExportToolbar
        filename="interieur_deplacements"
        title="Déplacements citoyens"
        rows={exportRows}
        tableName="interieur_deplacements"
      />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Acte</th>
              <th>Citoyen</th>
              <th>Origine</th>
              <th>Destination</th>
              <th>Départ</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <code>{d.acte_ref}</code>
                </td>
                <td>
                  <div>{d.nom_complet}</div>
                  <code className="muted small">{d.nn}</code>
                </td>
                <td>
                  {d.origine}
                  <div className="muted small">{d.province_origine}</div>
                </td>
                <td>
                  {d.destination}
                  <div className="muted small">{d.province_destination}</div>
                </td>
                <td>{new Date(d.date_depart).toLocaleDateString("fr-FR")}</td>
                <td
                  style={{
                    fontWeight: 700,
                    color:
                      d.status === "EN_COURS"
                        ? statusColor("info")
                        : d.status === "ANNULE"
                          ? statusColor("bad")
                          : statusColor("ok"),
                  }}
                >
                  {DISP_STATUS_LABELS[d.status]}
                </td>
                <td>
                  <Link className="btn-secondary btn-sm" to={`/parcours?c=${d.citizen_id}`}>
                    Parcours
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="muted">
                  Aucun déplacement pour ces filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function MissingDocsPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getInteriorSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priorite, setPriorite] = useState("");

  const rows = snap.missing_docs.filter((d) => {
    if (status && d.status !== status) return false;
    if (priorite && d.priorite !== priorite) return false;
    return `${d.nom_complet} ${d.nn} ${d.document} ${d.commune}`
      .toLowerCase()
      .includes(q.trim().toLowerCase());
  });

  const exportRows = rows.map((d) => ({
    citoyen: d.nom_complet,
    nn: d.nn,
    document: d.document,
    categorie: d.categorie,
    statut: DOC_STATUS_LABELS[d.status],
    priorite: d.priorite,
    detecte_le: new Date(d.detecte_le).toLocaleDateString("fr-FR"),
    echeance: d.echeance ? new Date(d.echeance).toLocaleDateString("fr-FR") : "",
    province: d.province,
    commune: d.commune,
  }));

  return (
    <PageShell
      title="Documents manquants"
      lead="Pièces absentes, en cours ou rejetées — suivi pour régularisation."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous statuts</option>
          {(Object.keys(DOC_STATUS_LABELS) as DocStatus[]).map((s) => (
            <option key={s} value={s}>
              {DOC_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="form-control" value={priorite} onChange={(e) => setPriorite(e.target.value)}>
          <option value="">Toutes priorités</option>
          <option value="HAUTE">Haute</option>
          <option value="MOYENNE">Moyenne</option>
          <option value="BASSE">Basse</option>
        </select>
      </div>
      <ExportToolbar
        filename="interieur_documents_manquants"
        title="Documents manquants"
        rows={exportRows}
        tableName="interieur_docs_manquants"
      />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Citoyen</th>
              <th>Document</th>
              <th>Catégorie</th>
              <th>Statut</th>
              <th>Priorité</th>
              <th>Détecté</th>
              <th>Lieu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <div>{d.nom_complet}</div>
                  <code className="muted small">{d.nn}</code>
                </td>
                <td>{d.document}</td>
                <td>{d.categorie}</td>
                <td
                  style={{
                    fontWeight: 700,
                    color:
                      d.status === "MANQUANT" || d.status === "REJETE"
                        ? statusColor("bad")
                        : d.status === "EN_COURS"
                          ? statusColor("warn")
                          : statusColor("ok"),
                  }}
                >
                  {DOC_STATUS_LABELS[d.status]}
                </td>
                <td style={{ fontWeight: 700, color: d.priorite === "HAUTE" ? statusColor("bad") : undefined }}>
                  {d.priorite}
                </td>
                <td>{new Date(d.detecte_le).toLocaleDateString("fr-FR")}</td>
                <td>
                  {d.commune}
                  <div className="muted small">{d.province}</div>
                </td>
                <td>
                  <Link className="btn-secondary btn-sm" to={`/parcours?c=${d.citizen_id}`}>
                    Parcours
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="muted">
                  Aucun document pour ces filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
