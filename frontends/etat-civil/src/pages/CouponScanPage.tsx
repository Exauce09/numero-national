import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import jsQR from "jsqr";
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

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = (
    window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

async function openCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Caméra non supportée par ce navigateur.");
  }
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: { facingMode: { ideal: "user" } }, audio: false },
    { video: true, audio: false },
  ];
  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }
  const name = lastError instanceof DOMException ? lastError.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    throw new Error("Permission caméra refusée — autorisez l'accès dans Edge puis réessayez.");
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    throw new Error("Aucune caméra détectée sur cet appareil.");
  }
  throw new Error("Impossible d'ouvrir la caméra — vérifiez qu'elle n'est pas utilisée ailleurs.");
}

export default function CouponScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const resolvingRef = useRef(false);

  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hit, setHit] = useState<CouponHit | null>(null);
  const [scanning, setScanning] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [starting, setStarting] = useState(false);

  function clearScanTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopCamera() {
    clearScanTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamOn(false);
    setScanning(false);
    setStarting(false);
  }

  useEffect(() => {
    return () => {
      clearScanTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function readFrame(): Promise<string | null> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const detector = getBarcodeDetector();
    if (detector) {
      try {
        const codes = await detector.detect(video);
        const value = codes[0]?.rawValue?.trim();
        if (value) return value;
      } catch {
        /* fall through to jsQR */
      }
    }

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (w < 8 || h < 8) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    const code = jsQR(image.data, image.width, image.height, {
      inversionAttempts: "dontInvert",
    });
    return code?.data?.trim() || null;
  }

  async function startCamera() {
    setCamError(null);
    setError(null);
    setHit(null);
    setStarting(true);
    stopCamera();
    setStarting(true);

    try {
      const stream = await openCameraStream();
      streamRef.current = stream;
      setCamOn(true);

      // Attendre le prochain paint pour que la vidéo soit visible dans le DOM
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const video = videoRef.current;
      if (!video) {
        throw new Error("Élément vidéo indisponible.");
      }
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      await video.play();

      setScanning(true);
      setStarting(false);

      timerRef.current = window.setInterval(() => {
        if (resolvingRef.current) return;
        void (async () => {
          const value = await readFrame();
          if (!value || resolvingRef.current) return;
          resolvingRef.current = true;
          clearScanTimer();
          setRaw(value);
          setScanning(false);
          try {
            await resolve(value);
          } finally {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            setCamOn(false);
            resolvingRef.current = false;
          }
        })();
      }, 450);
    } catch (err) {
      stopCamera();
      setCamError(err instanceof Error ? err.message : "Impossible de démarrer la caméra.");
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
        Cliquez sur <strong>Démarrer la caméra</strong>, autorisez l&apos;accès, puis présentez le QR{" "}
        <code>nn_census_coupon</code>. Vous pouvez aussi coller le JSON ou la réf. locale.
      </p>

      <div className="panel">
        <div
          style={{
            position: "relative",
            width: "100%",
            minHeight: camOn || starting ? 220 : 0,
            background: camOn || starting ? "#111" : "transparent",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{
              width: "100%",
              maxHeight: 320,
              display: camOn ? "block" : "none",
              objectFit: "cover",
            }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
        {starting ? <p className="muted">Ouverture de la caméra…</p> : null}
        {scanning ? <p className="muted">Recherche du QR… présentez le coupon devant la caméra.</p> : null}
        {camError ? <div className="login-error" style={{ marginTop: 8 }}>{camError}</div> : null}

        <div className="toolbar" style={{ marginTop: "0.75rem", flexWrap: "wrap", gap: 8 }}>
          {!camOn ? (
            <button
              type="button"
              className="btn-primary"
              style={{ width: "auto" }}
              disabled={starting || busy}
              onClick={() => void startCamera()}
            >
              {starting ? "Démarrage…" : "Démarrer la caméra"}
            </button>
          ) : (
            <button type="button" className="btn-secondary" style={{ width: "auto" }} onClick={stopCamera}>
              Arrêter la caméra
            </button>
          )}
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
