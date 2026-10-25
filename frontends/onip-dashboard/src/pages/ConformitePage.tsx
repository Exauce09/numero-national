import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { getSession } from "../auth";

type Compliance = {
  official_nin_format_confirmed: boolean;
  official_generation_enabled: boolean;
  block_reason: string | null;
  provisional_algorithm: string;
  audit_doc: string;
  plan_matrix: string;
  decree_ref: string;
};

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export default function ConformitePage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [data, setData] = useState<Compliance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken) return;
    const token = getSession()?.accessToken;
    void fetch(`${BASE}/onip/nin/compliance`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new ApiError(await res.text(), res.status);
        return (await res.json()) as Compliance;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }, [hasToken]);

  return (
    <div>
      <div className="hero-banner">
        <h1>Conformité FGP / NIN</h1>
        <p>
          Suivi du plan SIGPOP-RDC / ONIP. Le générateur NIN officiel reste bloqué tant que
          l&apos;arrêté et l&apos;annexe technique ne sont pas confirmés (Décret 22/07 art. 8).
        </p>
      </div>

      <div className="panel" style={{ borderLeft: "4px solid #c0392b" }}>
        <strong>Prototype / développement — pas une homologation ONIP</strong>
        <p className="muted" style={{ marginBottom: 0 }}>
          Les numéros actuellement émis sont <em>provisoires</em>. Ils ne doivent pas être présentés
          comme NIN officiels ni utilisés pour une CIN de production.
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
              Algorithme provisoire : <code>{data.provisional_algorithm}</code>
            </li>
            <li>Référence : {data.decree_ref}</li>
          </ul>
          {data.block_reason ? (
            <p className="muted small">{data.block_reason}</p>
          ) : null}
          <p className="muted small">
            Docs dépôt : <code>{data.audit_doc}</code> · <code>{data.plan_matrix}</code>
          </p>
        </div>
      ) : (
        <div className="panel muted">Chargement…</div>
      )}

      <div className="panel">
        <h2 className="panel-title">Prochaines étapes (plan)</h2>
        <ol>
          <li>Obtenir l&apos;arrêté + annexe NIN signés (ONIP / Intérieur).</li>
          <li>Basculer <code>OFFICIAL_NIN_FORMAT_CONFIRMED</code> après validation écrite.</li>
          <li>Inventaire données : <code>python scripts/inventory_nic_nin.py</code></li>
          <li>
            Continuer les modules manquants :{" "}
            <Link to="/feuille-de-route">feuille de route</Link>
          </li>
        </ol>
      </div>
    </div>
  );
}
