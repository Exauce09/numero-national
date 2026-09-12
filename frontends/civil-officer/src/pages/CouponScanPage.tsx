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

const DEMO_QR = JSON.stringify({
  type: "nn_census_coupon",
  v: 1,
  local_id: "demo-local-001",
  family_name: "KABILA",
  given_names: "Jean Paul",
  sex: "M",
  date_of_birth: "1990-05-12",
});

function getDetector(): (new (opts: { formats: string[] }) => BarcodeDetectorLike) | null {
  return (
    (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
      .BarcodeDetector ?? null
  );
}

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
  const [camOn, setCamOn] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function startCamera() {
    setCamError(null);
    setError(null);
    const Detector = getDetector();
    if (!Detector) {
      setCamError(
        "Ce navigateur ne lit pas les QR via caméra (BarcodeDetector). Utilisez Edge/Chrome récents, ou collez le JSON / importez une photo.",
      );
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
      setScanning(true);
      const detector = new Detector({ formats: ["qr_code"] });
      const timer = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue?.trim();
          if (value) {
            setRaw(value);
            setScanning(false);
            window.clearInterval(timer);
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            setCamOn(false);
            await resolve(value);
          }
        } catch {
          /* frame skip */
        }
      }, 700);
      (startCamera as unknown as { _timer?: number })._timer = timer;
    } catch {
      setCamError("Caméra indisponible ou refusée — collez le QR ou importez une image.");
      setCamOn(false);
      setScanning(false);
    }
  }

  function stopCamera() {
    const t = (startCamera as unknown as { _timer?: number })._timer;
    if (t) window.clearInterval(t);
    streamRef.current?.getTracks().forEach((x) => x.stop());
    streamRef.current = null;
    setCamOn(false);
    setScanning(false);
  }

  async function onImageFile(file: File | null) {
    if (!file) return;
    setError(null);
    const Detector = getDetector();
    if (!Detector) {
      setCamError("Lecture d'image QR non supportée — collez le JSON du coupon.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new Detector({ formats: ["qr_code"] });
      const codes = await detector.detect(bitmap);
      bitmap.close();
      const value = codes[0]?.rawValue?.trim();
      if (!value) {
        setError("Aucun QR détecté sur l'image.");
        return;
      }
      setRaw(value);
      await resolve(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lecture image impossible.");
    }
  }

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
      setError(err instanceof Error ? err.message : "Résolution impossible");
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
        Scannez un QR <code>nn_census_coupon</code> (APK terrain), collez le JSON, ou importez une photo du
        coupon. Fonctionne même si l&apos;API est temporairement indisponible (lecture locale du QR).
      </p>

      <div className="panel">
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: "100%",
            maxHeight: 280,
            background: "#111",
            borderRadius: 8,
            display: camOn ? "block" : "none",
          }}
        />
        {scanning ? <p className="muted">Recherche du QR…</p> : null}
        {camError ? <p className="muted">{camError}</p> : null}

        <div className="toolbar" style={{ marginTop: "0.75rem", flexWrap: "wrap", gap: 8 }}>
          {!camOn ? (
            <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={() => void startCamera()}>
              Démarrer la caméra
            </button>
          ) : (
            <button type="button" className="btn-secondary" style={{ width: "auto" }} onClick={stopCamera}>
              Arrêter la caméra
            </button>
          )}
          <label className="btn-secondary" style={{ width: "auto", cursor: "pointer", margin: 0 }}>
            Importer une image QR
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => void onImageFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: "auto" }}
            onClick={() => {
              setRaw(DEMO_QR);
              void resolve(DEMO_QR);
            }}
          >
            Tester un coupon démo
          </button>
        </div>

        <form className="toolbar" style={{ marginTop: "1rem" }} onSubmit={onSubmit}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="form-label">Contenu QR ou réf. locale</label>
            <textarea
              className="form-control"
              rows={4}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder='{"type":"nn_census_coupon","local_id":"…","family_name":"…"}'
            />
          </div>
          <button className="btn-primary" type="submit" disabled={busy} style={{ width: "auto", alignSelf: "end" }}>
            {busy ? "…" : "Résoudre"}
          </button>
        </form>

        {error ? (
          <div className="login-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}

        {hit?.found ? (
          <div className="success-banner" style={{ marginTop: 12 }}>
            <strong>
              {(hit.family_name || "").trim()} {(hit.given_names || "").trim()}
              {!hit.family_name && !hit.given_names ? `Réf. ${hit.local_id || "—"}` : null}
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
