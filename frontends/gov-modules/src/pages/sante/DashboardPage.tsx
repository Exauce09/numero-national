import { useEffect, useState } from "react";
import { api, type HealthStats } from "../../api";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [gov, setGov] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void Promise.all([api.healthStats(), api.gov("ministry", "health")]).then(([h, g]) => {
      setStats(h);
      setGov(g);
    });
  }, []);

  const facilities = Number(stats?.facilities ?? 0);
  const births = Number(stats?.births_declared ?? 0);
  const deaths = Number(stats?.deaths_declared ?? 0);
  const verifications = Number(stats?.verifications ?? 0);

  return (
    <div>
      <h2 className="page-title">Tableau de bord — Santé</h2>
      <p className="page-lead">
        Statistiques nationales agrégées et anonymisées (Ministère de la Santé).
      </p>
      {!stats ? (
        <p className="muted">Chargement…</p>
      ) : (
        <div className="grid">
          <Metric label="Structures sanitaires" value={facilities.toLocaleString("fr-FR")} />
          <Metric label="Naissances déclarées" value={births.toLocaleString("fr-FR")} />
          <Metric label="Décès déclarés" value={deaths.toLocaleString("fr-FR")} />
          <Metric label="Vérifications identité" value={verifications.toLocaleString("fr-FR")} />
        </div>
      )}
      {gov?.demo ? (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Données de démonstration (API indisponible).
        </p>
      ) : null}
    </div>
  );
}
