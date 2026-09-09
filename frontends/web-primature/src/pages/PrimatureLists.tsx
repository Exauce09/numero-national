import { useMemo, useState, type ReactNode } from "react";
import ExportToolbar from "../components/ExportToolbar";
import {
  DOSSIER_STATUS_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  TREND_LABELS,
  getPrimatureSnapshot,
  type AlertSeverity,
  type DossierStatus,
  type MinistryStatus,
} from "../primatureData";

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
      <div className="read-only-banner no-print">Lecture seule — données du système concernant la Primature.</div>
      {children}
    </div>
  );
}

function statusColor(s: MinistryStatus | DossierStatus | AlertSeverity): string {
  if (s === "OK" || s === "CLOTURE" || s === "INFO") return "#1a5f4a";
  if (s === "ATTENTION" || s === "EN_COURS" || s === "EN_ATTENTE" || s === "WARNING") return "#8a4b1a";
  if (s === "CRITIQUE" || s === "CRITICAL" || s === "OUVERT") return "#9b2c2c";
  return "#5a6b63";
}

export function MinistriesPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getPrimatureSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const rows = snap.ministries.filter((m) => {
    if (status && m.status !== status) return false;
    return `${m.name} ${m.code} ${m.domain} ${m.summary}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  const exportRows = rows.map((m) => ({
    code: m.code,
    ministere: m.name,
    domaine: m.domain,
    statut: STATUS_LABELS[m.status],
    couverture_pct: m.coverage_pct,
    alertes: m.open_alerts,
    dernier_rapport: new Date(m.last_report_at).toLocaleString("fr-FR"),
    resume: m.summary,
  }));

  return (
    <PageShell
      title="Ministères & domaines"
      lead="État de mise en œuvre des modules du système — vue coordination Primature."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous statuts</option>
          {(Object.keys(STATUS_LABELS) as MinistryStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <ExportToolbar filename="primature_ministeres" title="Ministères — Primature" rows={exportRows} tableName="primature_ministeres" />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Ministère / module</th>
              <th>Domaine</th>
              <th>Statut</th>
              <th>Couverture</th>
              <th>Alertes</th>
              <th>Dernier rapport</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <code>{m.code}</code>
                </td>
                <td>
                  <strong>{m.name}</strong>
                  <div className="muted small">{m.summary}</div>
                </td>
                <td>{m.domain}</td>
                <td style={{ fontWeight: 700, color: statusColor(m.status) }}>{STATUS_LABELS[m.status]}</td>
                <td>{m.coverage_pct}%</td>
                <td>{m.open_alerts}</td>
                <td>{new Date(m.last_report_at).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function IndicatorsPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getPrimatureSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("");
  const domains = useMemo(() => [...new Set(snap.indicators.map((i) => i.domain))].sort(), [snap]);

  const rows = snap.indicators.filter((i) => {
    if (domain && i.domain !== domain) return false;
    return `${i.label} ${i.key} ${i.source}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  const exportRows = rows.map((i) => ({
    cle: i.key,
    libelle: i.label,
    domaine: i.domain,
    valeur: i.value,
    unite: i.unit,
    periode: i.period,
    tendance: i.trend,
    source: i.source,
  }));

  return (
    <PageShell
      title="Indicateurs transversaux"
      lead="Indicateurs du système général utiles à la Primature (agrégats en lecture)."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="">Tous domaines</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <ExportToolbar filename="primature_indicateurs" title="Indicateurs Primature" rows={exportRows} tableName="primature_indicateurs" />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Indicateur</th>
              <th>Domaine</th>
              <th>Valeur</th>
              <th>Période</th>
              <th>Tendance</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>{i.label}</strong>
                  <div className="muted small">
                    <code>{i.key}</code>
                  </div>
                </td>
                <td>{i.domain}</td>
                <td>
                  {i.value.toLocaleString("fr-FR")} {i.unit}
                </td>
                <td>{i.period}</td>
                <td>{TREND_LABELS[i.trend]}</td>
                <td>{i.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function DossiersPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getPrimatureSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const rows = snap.dossiers.filter((d) => {
    if (status && d.status !== status) return false;
    return `${d.ref} ${d.title} ${d.ministry} ${d.note}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  const exportRows = rows.map((d) => ({
    ref: d.ref,
    titre: d.title,
    ministere: d.ministry,
    statut: DOSSIER_STATUS_LABELS[d.status],
    priorite: d.priority,
    ouvert_le: new Date(d.opened_at).toLocaleDateString("fr-FR"),
    maj: new Date(d.updated_at).toLocaleString("fr-FR"),
    responsable: d.owner,
    note: d.note,
  }));

  return (
    <PageShell
      title="Dossiers gouvernementaux"
      lead="Dossiers de coordination suivis par la Primature (consultation uniquement)."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous statuts</option>
          {(Object.keys(DOSSIER_STATUS_LABELS) as DossierStatus[]).map((s) => (
            <option key={s} value={s}>
              {DOSSIER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <ExportToolbar filename="primature_dossiers" title="Dossiers Primature" rows={exportRows} tableName="primature_dossiers" />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Réf.</th>
              <th>Titre</th>
              <th>Ministère</th>
              <th>Statut</th>
              <th>Priorité</th>
              <th>Mise à jour</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <code>{d.ref}</code>
                </td>
                <td>
                  <strong>{d.title}</strong>
                  <div className="muted small">{d.note}</div>
                </td>
                <td>{d.ministry}</td>
                <td style={{ fontWeight: 700, color: statusColor(d.status) }}>{DOSSIER_STATUS_LABELS[d.status]}</td>
                <td style={{ fontWeight: d.priority === "HAUTE" ? 700 : 400 }}>{d.priority}</td>
                <td>{new Date(d.updated_at).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function AlertsPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getPrimatureSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");

  const rows = snap.alerts.filter((a) => {
    if (severity && a.severity !== severity) return false;
    return `${a.title} ${a.body} ${a.ministry}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  const exportRows = rows.map((a) => ({
    titre: a.title,
    detail: a.body,
    severite: SEVERITY_LABELS[a.severity],
    domaine: a.domain,
    ministere: a.ministry,
    date: new Date(a.created_at).toLocaleString("fr-FR"),
    accuse: a.acknowledged ? "Oui" : "Non",
  }));

  return (
    <PageShell
      title="Alertes de coordination"
      lead="Alertes remontées par les modules du système — consultation Primature."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">Toutes sévérités</option>
          {(Object.keys(SEVERITY_LABELS) as AlertSeverity[]).map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <ExportToolbar filename="primature_alertes" title="Alertes Primature" rows={exportRows} tableName="primature_alertes" />
      <div className="panel">
        {rows.map((a) => (
          <article key={a.id} className={`alert-card severity-${a.severity.toLowerCase()}${a.acknowledged ? " ack" : ""}`}>
            <div className="alert-card-head">
              <strong>{a.title}</strong>
              <span style={{ fontWeight: 700, color: statusColor(a.severity) }}>{SEVERITY_LABELS[a.severity]}</span>
            </div>
            <p className="muted" style={{ margin: "0.35rem 0" }}>
              {a.body}
            </p>
            <p className="muted small" style={{ margin: 0 }}>
              {a.ministry} · {a.domain} · {new Date(a.created_at).toLocaleString("fr-FR")}
              {a.acknowledged ? " · accusé" : " · non accusé"}
            </p>
          </article>
        ))}
        {!rows.length ? <p className="muted">Aucune alerte pour ces filtres.</p> : null}
      </div>
    </PageShell>
  );
}

export function BriefingPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getPrimatureSnapshot(), [tick]);

  const exportRows = snap.briefing.map((b) => ({
    section: b.section,
    titre: b.title,
    contenu: b.body,
    ministere: b.ministry,
    date: new Date(b.at).toLocaleString("fr-FR"),
  }));

  return (
    <PageShell
      title="Briefing exécutif"
      lead="Synthèse consolidée destinée à la Primature — informations du système général."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <ExportToolbar filename="primature_briefing" title="Briefing Primature" rows={exportRows} tableName="primature_briefing" />
      <div className="briefing-list">
        {snap.briefing.map((b) => (
          <article key={b.id} className="panel briefing-card">
            <p className="muted small" style={{ margin: "0 0 0.35rem" }}>
              {b.section} · {b.ministry} · {new Date(b.at).toLocaleString("fr-FR")}
            </p>
            <h3 className="panel-title" style={{ marginBottom: "0.4rem" }}>
              {b.title}
            </h3>
            <p style={{ margin: 0 }}>{b.body}</p>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
