import { FormEvent, useEffect, useRef, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import { getAct, listActs, type Act } from "../registry";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

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
    // Correspondance partielle sur le payload QR stocké
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
  const streamRef = useRef<MediaStream | null>(null);
  const [raw, setRaw] = useState("");
  const [camError, setCamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [act, setAct] = useState<Act | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const Detector = (
      window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }
    ).BarcodeDetector;

    (async () => {
      if (!Detector) {
        setCamError("Scanner caméra non supporté — collez le contenu du QR ou le N° d'acte.");
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
              resolve(value);
            }
          } catch {
            /* frame skip */
          }
        }, 700);
      } catch {
        setCamError("Caméra indisponible — saisissez le QR manuellement.");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

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
        Scannez le QR imprimé sur un acte pour retrouver la fiche (N° d&apos;acte, NIC ou code de vérification).
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
