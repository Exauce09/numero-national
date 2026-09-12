import { FormEvent, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import ActPrintCard from "../components/ActPrintCard";
import { getAct, listActs, type Act } from "../registry";

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

function findActFromQr(raw: string): Act | null {
  const text = raw.trim();
  if (!text) return null;

  const acts = listActs();
  const byNumber = acts.find((a) => a.act_number === text || a.national_id === text);
  if (byNumber) return byNumber;

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const actNumber = String(parsed.act_number ?? parsed.actNumber ?? "").trim();
    const nic = String(parsed.national_id ?? parsed.nic ?? "").trim();
    const id = String(parsed.act_id ?? parsed.id ?? "").trim();
    const code = String(parsed.verification_code ?? parsed.code ?? "").trim();

    if (id) {
      const hit = getAct(id);
      if (hit) return hit;
    }
    if (actNumber) {
      const hit = acts.find((a) => a.act_number === actNumber);
      if (hit) return hit;
    }
    if (nic) {
      const hit = acts.find((a) => a.national_id === nic);
      if (hit) return hit;
    }
    if (code) {
      const hit = acts.find((a) => String(a.payload.verification_code ?? "") === code);
      if (hit) return hit;
    }
    const blob = text.toLowerCase();
    return (
      acts.find((a) => {
        const q = (a.qr_payload || "").toLowerCase();
        return q && (q.includes(blob.slice(0, 40)) || blob.includes(a.act_number.toLowerCase()));
      }) ?? null
    );
  } catch {
    return (
      acts.find(
        (a) =>
          a.qr_payload.includes(text) ||
          String(a.payload.verification_code ?? "") === text,
      ) ?? null
    );
  }
}

export default function ActQrScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const resolvingRef = useRef(false);

  const [raw, setRaw] = useState("");
  const [camError, setCamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [act, setAct] = useState<Act | null>(null);
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
    if (videoRef.current) videoRef.current.srcObject = null;
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
        /* jsQR fallback */
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
    setAct(null);
    setStarting(true);
    stopCamera();
    setStarting(true);

    try {
      const stream = await openCameraStream();
      streamRef.current = stream;
      setCamOn(true);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const video = videoRef.current;
      if (!video) throw new Error("Élément vidéo indisponible.");
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
            resolve(value);
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

  function resolve(payload: string) {
    setError(null);
    const hit = findActFromQr(payload);
    if (!hit) {
      setAct(null);
      setError("Aucun acte trouvé pour ce QR / N° d'acte.");
      return;
    }
    setAct(hit);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    resolve(raw);
  }

  return (
    <div>
      <h2 className="page-title">Scanner QR code d&apos;acte</h2>
      <p className="page-lead">
        Cliquez sur <strong>Démarrer la caméra</strong>, autorisez l&apos;accès, puis présentez le QR imprimé
        sur l&apos;acte. Vous pouvez aussi coller le JSON, le N° d&apos;acte ou le NIC.
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
        {scanning ? <p className="muted">Recherche du QR… présentez l&apos;acte devant la caméra.</p> : null}
        {camError ? (
          <div className="login-error" style={{ marginTop: 8 }}>
            {camError}
          </div>
        ) : null}

        <div className="toolbar" style={{ marginTop: "0.75rem", flexWrap: "wrap", gap: 8 }}>
          {!camOn ? (
            <button
              type="button"
              className="btn-primary"
              style={{ width: "auto" }}
              disabled={starting}
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
            <label className="form-label">Contenu QR, N° d&apos;acte ou NIC</label>
            <textarea
              className="form-control"
              rows={3}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder='{"act_number":"…"} ou ANN-…'
            />
          </div>
          <button className="btn-primary" type="submit" style={{ width: "auto", alignSelf: "end" }}>
            Vérifier
          </button>
        </form>

        {error ? (
          <div className="login-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}
      </div>

      {act ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Acte trouvé — {act.act_number}</div>
          <ActPrintCard act={act} />
        </div>
      ) : null}
    </div>
  );
}
