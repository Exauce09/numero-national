import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

type CouponHit = {
  found: boolean;
  source: string;
  local_id?: string | null;
  family_name?: string | null;
  given_names?: string | null;
  sex?: string | null;
  date_of_birth?: string | null;
  message?: string | null;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

export default function CouponScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hit, setHit] = useState<CouponHit | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
      .BarcodeDetector;

    (async () => {
      if (!Detector) {
        setCamError("Scanner caméra non supporté par ce navigateur — collez le JSON du QR ou la réf. locale.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ["qr_code"] });
        setScanning(true);
        timer = window.setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          try {
            const codes = await detector.detect(video);
            const value = codes[0]?.rawValue?.trim();
            if (value) {
              setRaw(value);
              setScanning(false);
              window.clearInterval(timer);
              await resolve(value);
            }
          } catch {
            /* frame skip */
          }
        }, 700);
      } catch {
        setCamError("Caméra indisponible — collez le contenu du QR manuellement.");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolve(payload: string) {
    const text = payload.trim();
    if (!text) {
      setError("QR vide");
      return;
    }
    setBusy(true);
    setError(null);
    setHit(null);
    try {
      const res = await api.resolveCoupon(text);
      setHit(res);
      if (!res.found) {
        setError(res.message || "Coupon introuvable");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Résolution impossible (API)");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void resolve(raw);
  }

  function openCensus() {
    if (!hit?.found) return;
    navigate("/census", {
      state: {
        couponPrefill: {
          nom: hit.family_name || "",
          prenom: hit.given_names || "",
          sexe: (hit.sex || "M").toUpperCase().startsWith("F") ? "F" : "M",
          dateNaissance: (hit.date_of_birth || "").slice(0, 10),
          localId: hit.local_id || "",
        },
      },
    });
  }

  return (
    <div>
      <h2 className="page-title">Scanner coupon recensement</h2>
      <p className="page-lead">
        QR APK <code>nn_census_coupon</code> — même format que l’impression terrain. Après sync APK, la fiche
        apparaît ici pour la commune.
      </p>

      <div className="panel">
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", maxHeight: 280, background: "#111", borderRadius: 8 }}
        />
        {scanning ? <p className="muted">Recherche du QR…</p> : null}
        {camError ? <p className="muted">{camError}</p> : null}

        <form className="toolbar" style={{ marginTop: "1rem" }} onSubmit={onSubmit}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="form-label">Contenu QR ou réf. locale</label>
            <textarea
              className="form-control"
              rows={3}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder='{"type":"nn_census_coupon",...} ou local_id'
            />
          </div>
          <button className="btn-primary" type="submit" disabled={busy} style={{ width: "auto", alignSelf: "end" }}>
            {busy ? "…" : "Résoudre"}
          </button>
        </form>

        {error ? <div className="login-error" style={{ marginTop: 12 }}>{error}</div> : null}

        {hit?.found ? (
          <div className="success-banner" style={{ marginTop: 12 }}>
            <strong>
              {(hit.family_name || "").trim()} {(hit.given_names || "").trim()}
            </strong>
            <div className="muted">
              {hit.message} · source {hit.source} · réf. {hit.local_id || "—"} · sexe {hit.sex || "—"} · né(e){" "}
              {hit.date_of_birth || "—"}
            </div>
            <div className="census-nav-actions" style={{ marginTop: 10 }}>
              <button type="button" className="btn-primary" onClick={openCensus}>
                Ouvrir le recensement prérempli
              </button>
              <Link className="btn-secondary" to="/census">
                Formulaire vide
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
