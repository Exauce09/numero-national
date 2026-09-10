import { useMemo, useState } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import ExportToolbar from "../components/ExportToolbar";
import {
  DOSSIER_STATUS_LABELS,
  SEVERITY_LABELS,
  synopticAlertes,
  synopticCoordination,
  synopticDomaines,
  synopticDossiers,
} from "../primatureData";

const TABS = [
  { slug: "coordination", label: "Coordination" },
  { slug: "domaines", label: "Domaines" },
  { slug: "dossiers", label: "Dossiers" },
  { slug: "alertes", label: "Alertes" },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];

function Coordination() {
  const { rows, tot } = synopticCoordination();
  return (
    <>
      <ExportToolbar
        filename="primature_synoptique_coordination"
        title="Synoptique Primature — Coordination"
        rows={rows}
        tableName="primature_syn_coordination"
      />
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE — COORDINATION GOUVERNEMENTALE
        <br />
        PRIMATURE — LECTURE SEULE
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>MINISTÈRE / MODULE</th>
              <th>CODE</th>
              <th>DOMAINE</th>
              <th>STATUT</th>
              <th>COUVERTURE %</th>
              <th>ALERTES</th>
              <th>DERNIER RAPPORT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="syn-commune-cell">{r.ministere}</td>
                <td>
                  <code>{r.code}</code>
                </td>
                <td>{r.domaine}</td>
                <td>{r.statut}</td>
                <td>{r.couverture_pct}</td>
                <td>{r.alertes_ouvertes}</td>
                <td>{r.dernier_rapport}</td>
              </tr>
            ))}
            <tr>
              <td className="syn-commune-cell" colSpan={3}>
                <strong>TOTAL PRIMATURE</strong>
              </td>
              <td>
                OK {tot.ok} · Att. {tot.attention} · Crit. {tot.critique}
              </td>
              <td>
                <strong>{tot.couverture_moy}</strong>
              </td>
              <td>
                <strong>{tot.alertes}</strong>
              </td>
              <td>{tot.ministeres} modules</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function Domaines() {
  const { rows, updated_at } = synopticDomaines();
  return (
    <>
      <ExportToolbar
        filename="primature_synoptique_domaines"
        title="Synoptique Primature — Domaines"
        rows={rows}
        tableName="primature_syn_domaines"
      />
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE — DOMAINES DU SYSTÈME CONCERNANT LA PRIMATURE
        <br />
        AGRÉGATS NATIONAUX EN LECTURE SEULE
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>DOMAINE</th>
              <th>VALEUR</th>
              <th>UNITÉ</th>
              <th>SOURCE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.domaine}>
                <td className="syn-commune-cell">{r.domaine}</td>
                <td>
                  <strong>{r.valeur.toLocaleString("fr-FR")}</strong>
                </td>
                <td>{r.unite}</td>
                <td>{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ marginTop: "0.75rem" }}>
        Consolidation : {new Date(updated_at).toLocaleString("fr-CD")} — pas d&apos;accès opérationnel aux modules
        sources.
      </p>
    </>
  );
}

function Dossiers() {
  const { rows, byStatus, byPriority, total } = synopticDossiers();
  const resume = [
    {
      perimetre: "National / Primature",
      ouverts: byStatus.OUVERT,
      en_cours: byStatus.EN_COURS,
      en_attente: byStatus.EN_ATTENTE,
      clotures: byStatus.CLOTURE,
      priorite_haute: byPriority.HAUTE,
      priorite_moyenne: byPriority.MOYENNE,
      priorite_basse: byPriority.BASSE,
      total,
    },
  ];
  return (
    <>
      <ExportToolbar
        filename="primature_synoptique_dossiers"
        title="Synoptique Primature — Dossiers"
        rows={resume}
        tableName="primature_syn_dossiers"
      />
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE — DOSSIERS DE COORDINATION
        <br />
        PRIMATURE — LECTURE SEULE
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={2}>PÉRIMÈTRE</th>
              <th colSpan={4}>PAR STATUT</th>
              <th colSpan={3}>PAR PRIORITÉ</th>
              <th rowSpan={2}>TOTAL</th>
            </tr>
            <tr>
              <th>{DOSSIER_STATUS_LABELS.OUVERT}</th>
              <th>{DOSSIER_STATUS_LABELS.EN_COURS}</th>
              <th>{DOSSIER_STATUS_LABELS.EN_ATTENTE}</th>
              <th>{DOSSIER_STATUS_LABELS.CLOTURE}</th>
              <th>HAUTE</th>
              <th>MOYENNE</th>
              <th>BASSE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">Primature</td>
              <td>{byStatus.OUVERT}</td>
              <td>{byStatus.EN_COURS}</td>
              <td>{byStatus.EN_ATTENTE}</td>
              <td>{byStatus.CLOTURE}</td>
              <td>{byPriority.HAUTE}</td>
              <td>{byPriority.MOYENNE}</td>
              <td>{byPriority.BASSE}</td>
              <td>
                <strong>{total}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Détail des dossiers</h3>
        <ExportToolbar
          filename="primature_synoptique_dossiers_detail"
          title="Dossiers — détail"
          rows={rows}
          tableName="primature_syn_dossiers_detail"
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Réf.</th>
              <th>Titre</th>
              <th>Ministère</th>
              <th>Statut</th>
              <th>Priorité</th>
              <th>Maj</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ref}>
                <td>
                  <code>{r.ref}</code>
                </td>
                <td>{r.titre}</td>
                <td>{r.ministere}</td>
                <td>{r.statut}</td>
                <td>{r.priorite}</td>
                <td>{r.maj}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Alertes() {
  const { rows, bySeverity, total_ouvertes, total } = synopticAlertes();
  const resume = [
    {
      perimetre: "Primature",
      critiques: bySeverity.CRITICAL,
      avertissements: bySeverity.WARNING,
      infos: bySeverity.INFO,
      ouvertes: total_ouvertes,
      total_signalees: total,
    },
  ];
  return (
    <>
      <ExportToolbar
        filename="primature_synoptique_alertes"
        title="Synoptique Primature — Alertes"
        rows={resume}
        tableName="primature_syn_alertes"
      />
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE — ALERTES DE COORDINATION
        <br />
        PRIMATURE — LECTURE SEULE
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>PÉRIMÈTRE</th>
              <th>{SEVERITY_LABELS.CRITICAL}</th>
              <th>{SEVERITY_LABELS.WARNING}</th>
              <th>{SEVERITY_LABELS.INFO}</th>
              <th>OUVERTES</th>
              <th>TOTAL SIGNALÉES</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">Primature</td>
              <td>{bySeverity.CRITICAL}</td>
              <td>{bySeverity.WARNING}</td>
              <td>{bySeverity.INFO}</td>
              <td>
                <strong>{total_ouvertes}</strong>
              </td>
              <td>{total}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Alertes ouvertes</h3>
        <ExportToolbar
          filename="primature_synoptique_alertes_detail"
          title="Alertes ouvertes — détail"
          rows={rows}
          tableName="primature_syn_alertes_detail"
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Sévérité</th>
              <th>Domaine</th>
              <th>Ministère</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.titre}-${i}`}>
                <td>{r.titre}</td>
                <td>{r.severite}</td>
                <td>{r.domaine}</td>
                <td>{r.ministere}</td>
                <td>{r.date}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucune alerte ouverte.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function SynopticPage() {
  const { section } = useParams<{ section?: string }>();
  const [tick, setTick] = useState(0);
  if (!section) return <Navigate to="/synoptique/coordination" replace />;
  const tab = (TABS.some((t) => t.slug === section) ? section : "coordination") as TabSlug;

  const content = useMemo(() => {
    if (tab === "domaines") return <Domaines />;
    if (tab === "dossiers") return <Dossiers />;
    if (tab === "alertes") return <Alertes />;
    return <Coordination />;
  }, [tab, tick]);

  return (
    <div className="syn-page print-area">
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Tableau synoptique
          </p>
          <h2 className="page-title">Tableau synoptique</h2>
          <p className="page-lead">
            Vue consolidée des seuls éléments relevant de la Primature — lecture seule, sans accès aux autres modules.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm no-print" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>
      <div className="read-only-banner no-print">
        Synoptique Primature : coordination, domaines, dossiers et alertes — consultation uniquement.
      </div>
      <div className="syn-tabs no-print">
        {TABS.map((t) => (
          <NavLink
            key={t.slug}
            to={`/synoptique/${t.slug}`}
            className={({ isActive }) => `syn-tab${isActive || tab === t.slug ? " active" : ""}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <div className="syn-official-wrap">{content}</div>
    </div>
  );
}
