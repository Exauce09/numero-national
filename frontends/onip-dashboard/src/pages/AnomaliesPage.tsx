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
          Le registre crée un candidat doublon lorsqu&apos;un citoyen a <strong>exactement</strong>{" "}
          les mêmes valeurs :
        </p>
        <ul>
          <li>
            <strong>Nom de famille</strong>
          </li>
          <li>
            <strong>Prénom(s)</strong>
          </li>
          <li>
            <strong>Province</strong>
          </li>
          <li>
            <strong>Territoire</strong> (commune / ville)
          </li>
          <li>
            <strong>Sexe</strong>
          </li>
          <li>
            <strong>Année de naissance</strong> (pas le jour/mois)
          </li>
        </ul>
        <p className="muted">
          Score = 1,0. Tant qu&apos;un doublon est <strong>ouvert</strong>, l&apos;attribution du NIC
          est bloquée (sauf forçage justifié).
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Non utilisés pour ce doublon démographique : NIC, photo, empreinte téléphone, iris photo.
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
