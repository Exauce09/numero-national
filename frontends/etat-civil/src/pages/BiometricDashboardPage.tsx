/** Tableau de bord biométrique — KPI DEMO / agrégats API. */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { getSession } from "../auth";

export default function BiometricDashboardPage() {
  const hasApi = Boolean(getSession()?.accessToken);
  const [stats, setStats] = useState<{
    enrollments: number;
    fingerprints_active: number;
    matches_total: number;
    strong_matches: number;
    pending_reviews: number;
    blocked_enrollments: number;
    average_quality: number | null;
    note: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApi) return;
    void api
      .biometricStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Stats indisponibles"));
  }, [hasApi]);

  return (
    <div>
      <p className="eg-breadcrumb">
        <Link to="/">Accueil</Link> / Biométrie
      </p>
      <h2 className="page-title">Tableau de bord biométrique</h2>
      <p className="page-lead">Enrôlement 3 doigts · déduplication 1:N · revue des correspondances</p>
      <div className="dash-demo-banner" role="note">
        DONNÉES DE DÉMONSTRATION — seuils techniques (environment=demo), pas des statistiques
        nationales officielles de la RDC.
      </div>

      <div className="action-row" style={{ marginBottom: "1rem" }}>
        <Link className="btn-primary btn-sm" to="/biometrie/identification">
          Identification 1:N
        </Link>
        <Link className="btn-secondary btn-sm" to="/population">
          Ouvrir un dossier population
        </Link>
      </div>

      {error ? (
        <div className="login-error" role="alert">
          {error}
        </div>
      ) : null}

      {!hasApi ? (
        <p className="muted">Connexion API requise (permission biometric:match).</p>
      ) : stats ? (
        <>
          <p className="muted small">{stats.note}</p>
          <div className="dash-kpi-grid">
            <div className="dash-kpi">
              <div className="dash-kpi-title">Enrôlements</div>
              <div className="dash-kpi-value">{stats.enrollments}</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-title">Empreintes actives</div>
              <div className="dash-kpi-value">{stats.fingerprints_active}</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-title">Correspondances</div>
              <div className="dash-kpi-value">{stats.matches_total}</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-title">Correspondances fortes</div>
              <div className="dash-kpi-value">{stats.strong_matches}</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-title">À vérifier</div>
              <div className="dash-kpi-value">{stats.pending_reviews}</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-title">Enrôlements bloqués</div>
              <div className="dash-kpi-value">{stats.blocked_enrollments}</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-title">Qualité moyenne</div>
              <div className="dash-kpi-value">
                {stats.average_quality != null ? `${stats.average_quality.toFixed(0)} %` : "—"}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="muted">Chargement…</p>
      )}
    </div>
  );
}
