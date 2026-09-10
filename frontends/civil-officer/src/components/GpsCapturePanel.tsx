import { useCallback, useEffect, useState } from "react";
import { captureGpsOnSave, type GpsCoords } from "../gpsCapture";

type Props = {
  /** Called whenever coords change (including null after failed refresh). */
  onChange?: (coords: GpsCoords | null) => void;
  /** Auto-capture on mount (default true). */
  auto?: boolean;
};

/** Visible GPS block for civil forms — capture / refresh for cartography. */
export default function GpsCapturePanel({ onChange, auto = true }: Props) {
  const [coords, setCoords] = useState<GpsCoords | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("Localisation GPS non capturée");

  const refresh = useCallback(async () => {
    setStatus("loading");
    setMessage("Capture GPS en cours…");
    const g = await captureGpsOnSave(20000);
    if (g) {
      setCoords(g);
      setStatus("ok");
      setMessage(`GPS OK · ${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}`);
      onChange?.(g);
    } else {
      setCoords(null);
      setStatus("err");
      setMessage("GPS indisponible — autorisez la localisation du navigateur");
      onChange?.(null);
    }
  }, [onChange]);

  useEffect(() => {
    if (auto) void refresh();
  }, [auto, refresh]);

  return (
    <div className={`gps-panel gps-panel--${status}`}>
      <div className="gps-panel-main">
        <strong>Localisation GPS</strong>
        <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
          {message}
        </p>
      </div>
      <button type="button" className="btn-secondary" style={{ width: "auto" }} onClick={() => void refresh()} disabled={status === "loading"}>
        {status === "loading" ? "…" : coords ? "Actualiser GPS" : "Capturer GPS"}
      </button>
    </div>
  );
}

export type { GpsCoords };
