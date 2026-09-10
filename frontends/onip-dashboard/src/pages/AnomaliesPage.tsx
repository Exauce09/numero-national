import { useEffect, useState } from "react";
import { fetchOnipDashboard } from "../api";
import { getSession } from "../auth";

export default function AnomaliesPage() {
  const [items, setItems] = useState<Array<{ code: string; message: string; count: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        void getSession();
        const d = await fetchOnipDashboard();
        if (cancelled) return;
        setItems(d.anomalies ?? []);
      } catch (e) {
        if (cancelled) return;
        setItems([]);
        setError(e instanceof Error ? e.message : "Impossible de charger les anomalies");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="hero-banner">
        <h1>Anomalies &amp; doublons</h1>
        <p>Signaux nationaux et règles de détection démographique.</p>
      </div>

      <div className="panel">
        <h2>Qu’est-ce qu’un doublon ?</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Le registre crée un candidat doublon lorsqu’un citoyen a <strong>exactement</strong> les
          mêmes valeurs (sans tenir compte de la casse pour les noms) :
        </p>
        <ul>
          <li>
            <strong>Nom de famille</strong> (family_name)
          </li>
          <li>
            <strong>Prénom(s)</strong> (given_names)
          </li>
          <li>
            <strong>Date de naissance</strong>
          </li>
        </ul>
        <p className="muted">
          Score = 1,0 (correspondance démographique exacte). Tant qu’un doublon est{" "}
          <strong>ouvert</strong>, l’attribution du NIC est bloquée (sauf forçage justifié).
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Non utilisés aujourd’hui pour le doublon démographique : NIC, adresse, photo, empreinte
          téléphone, iris photo. La biométrie ABIS (si branchée) est un flux séparé.
        </p>
      </div>

      <div className="panel">
        <h2>Anomalies courantes</h2>
        {loading ? <p className="muted">Chargement…</p> : null}
        {error ? <div className="login-error">{error}</div> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="muted">Aucune anomalie détectée.</p>
        ) : null}
        {!loading && items.length > 0 ? (
          <ul>
            {items.map((a) => (
              <li key={a.code}>
                <strong>{a.code}</strong>: {a.message} ({a.count})
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
