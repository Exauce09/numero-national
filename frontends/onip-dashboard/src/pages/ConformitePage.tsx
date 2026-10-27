import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNinCompliance } from "../api";
import { getSession } from "../auth";

type Compliance = {
  official_nin_format_confirmed: boolean;
  official_generation_enabled: boolean;
  block_reason: string | null;
  provisional_algorithm: string;
  decree_ref: string;
};

export default function ConformitePage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [data, setData] = useState<Compliance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken) return;
    void fetchNinCompliance()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }, [hasToken]);

  return (
    <div>
      <div className="hero-banner">
        <h1>Conformité FGP / NIN</h1>
        <p>
          Suivi du plan SIGPOP-RDC / ONIP. Générateur NIN officiel actif (format opérationnel 14
          chiffres, Décret 22/07 art. 8) — attribution uniquement via le service central.
        </p>
      </div>

      <div className="panel" style={{ borderLeft: "4px solid #1a7f37" }}>
        <strong>NIN générable — format opérationnel confirmé</strong>
        <p className="muted" style={{ marginBottom: 0 }}>
          Attribution via le service central (14 chiffres). Pas de NIN inventé hors service ; pas
          d&apos;attribution hors ligne.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel">
          <p className="muted">Connectez-vous pour charger le statut API.</p>
        </div>
      ) : error ? (
        <div className="panel login-error">{error}</div>
      ) : data ? (
        <div className="panel">
          <h2 className="panel-title">Statut générateur</h2>
          <ul>
            <li>
              Format officiel confirmé :{" "}
              <strong>{data.official_nin_format_confirmed ? "oui" : "non"}</strong>
            </li>
            <li>
              Génération officielle :{" "}
              <strong>{data.official_generation_enabled ? "active" : "bloquée"}</strong>
            </li>
            <li>
              Algorithme : <code>{data.provisional_algorithm}</code>
            </li>
            <li>Référence : {data.decree_ref}</li>
          </ul>
          {data.block_reason ? <p className="muted small">{data.block_reason}</p> : null}
        </div>
      ) : (
        <div className="panel muted">Chargement…</div>
      )}

      <div className="panel">
        <h2 className="panel-title">Prochaines étapes</h2>
        <ol>
          <li>
            Inventaire NIN : <code>python scripts/inventory_nic_nin.py</code>
          </li>
          <li>
            Homologuer le gabarit CIN physique (Module 9 — prototype actuel).
          </li>
          <li>
            Modules opérationnels : <Link to="/feuille-de-route">feuille de route</Link>
          </li>
        </ol>
      </div>
    </div>
  );
}
