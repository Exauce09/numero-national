import { useMemo, useState } from "react";
import ExportToolbar from "../components/ExportToolbar";
import { getPrimatureSnapshot, systemPortals } from "../primatureData";

export default function SystemPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getPrimatureSnapshot(), [tick]);
  const portals = systemPortals();

  const exportRows = portals.map((p) => ({
    portail: p.name,
    role: p.role,
    port: p.port,
    perimetre: p.scope,
    acces_primature:
      p.id === "primature"
        ? "Portail courant"
        : "Lecture des agrégats uniquement — pas d'accès opérationnel",
  }));

  const ministryByCode = Object.fromEntries(snap.ministries.map((m) => [m.code.toLowerCase(), m]));

  return (
    <div className="print-area">
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Vue système</h2>
          <p className="page-lead">
            Cartographie des modules E-GOUV dont la Primature lit les informations qui la concernent.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm no-print" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="read-only-banner no-print">
        Lecture seule : la Primature consulte les informations consolidées du système. Elle n&apos;ouvre pas les
        portails des autres institutions et ne réalise aucune tâche d&apos;administration ou d&apos;opération.
      </div>

      <ExportToolbar
        filename="primature_vue_systeme"
        title="Vue système E-GOUV — Primature"
        rows={exportRows}
        tableName="primature_systeme"
      />

      <div className="system-grid">
        {portals.map((p) => {
          const linked =
            ministryByCode[p.id === "interieur" ? "int" : p.id === "presidence" ? "pres" : p.id === "sante" ? "sante" : p.id === "civil" ? "ec" : p.id === "onip" ? "onip" : p.id === "citoyen" ? "cit" : ""];
          return (
            <article key={p.id} className={`panel system-card${p.id === "primature" ? " current" : ""}`}>
              <div className="system-card-head">
                <div>
                  <h3 className="panel-title" style={{ marginBottom: "0.2rem" }}>
                    {p.name}
                  </h3>
                  <p className="muted small" style={{ margin: 0 }}>
                    {p.role} · port {p.port}
                  </p>
                </div>
                <span className={`pill-status${p.access === "lecture" ? "" : " status-deplace"}`}>
                  {p.access === "lecture" ? "Lecture" : "Agrégats"}
                </span>
              </div>
              <p style={{ margin: "0.65rem 0" }}>{p.scope}</p>
              {linked ? (
                <p className="muted small" style={{ margin: "0 0 0.65rem" }}>
                  Statut consolidé : <strong style={{ color: linked.status === "OK" ? "#1a5f4a" : "#8a4b1a" }}>{linked.status}</strong>
                  {" · "}
                  couverture {linked.coverage_pct}% · {linked.open_alerts} alerte(s)
                </p>
              ) : p.id === "primature" ? (
                <p className="muted small" style={{ margin: "0 0 0.65rem" }}>
                  Portail courant — coordination gouvernementale.
                </p>
              ) : null}
              {p.id === "primature" ? (
                <span className="muted small">Vous êtes ici</span>
              ) : (
                <span className="muted small">Consultation d&apos;agrégats uniquement — accès module fermé</span>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
