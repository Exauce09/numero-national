import { useState } from "react";
import { captureGpsWithAddress, type ReverseGeo } from "../gpsCapture";
import type { GeoSelection } from "./GeoCascade";

export function applyGpsToGeo(prev: GeoSelection, g: ReverseGeo): GeoSelection {
  return {
    ...prev,
    province_name: g.province || prev.province_name,
    ville_name: g.ville || prev.ville_name,
    commune_name: g.commune || prev.commune_name,
    quartier_name: g.quartier || prev.quartier_name,
    avenue_name: g.avenue || prev.avenue_name,
    label:
      g.display_name ||
      [g.province, g.ville, g.commune, g.quartier, g.avenue].filter(Boolean).join(" · ") ||
      prev.label,
  };
}

type Props = {
  /** Remplit les champs adresse du formulaire parent. */
  onResolved?: (geo: ReverseGeo) => void;
  title?: string;
};

/** Bouton GPS visible sur les formulaires (connexion → reverse géocode ; sinon coords seules). */
export default function GpsLocatePanel({
  onResolved,
  title = "Localisation GPS",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<ReverseGeo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function locate() {
    setBusy(true);
    setErr(null);
    try {
      const g = await captureGpsWithAddress();
      if (!g) {
        setErr("GPS indisponible — autorisez la localisation ou saisissez l’adresse manuellement.");
        return;
      }
      setInfo(g);
      onResolved?.(g);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec GPS");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ marginBottom: "0.75rem" }}>
      <strong>{title}</strong>
      <p className="muted small" style={{ margin: "0.35rem 0 0.65rem" }}>
        Avec connexion : province, ville, commune… remplies automatiquement. Sans connexion :
        coordonnées GPS seules — complétez la cascade manuellement.
      </p>
      <button type="button" className="btn-secondary" style={{ width: "auto" }} disabled={busy} onClick={() => void locate()}>
        {busy ? "GPS…" : "Localiser par GPS"}
      </button>
      {err ? (
        <p className="login-error" style={{ marginTop: "0.65rem" }}>
          {err}
        </p>
      ) : null}
      {info ? (
        <p style={{ margin: "0.65rem 0 0", fontWeight: 600 }}>
          {info.latitude.toFixed(5)}, {info.longitude.toFixed(5)}
          {info.display_name ? ` — ${info.display_name}` : ""}
          {!info.display_name && info.province
            ? ` — ${[info.province, info.ville, info.commune].filter(Boolean).join(" · ")}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
