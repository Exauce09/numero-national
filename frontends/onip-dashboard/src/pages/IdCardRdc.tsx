import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { NationalCard } from "../api";

function mrzPad(s: string, len: number): string {
  return (s.toUpperCase().replace(/[^A-Z0-9<]/g, "<") + "<".repeat(len)).slice(0, len);
}

function buildMrz(
  card: NationalCard,
  holder: {
    nic?: string | null;
    family_name?: string | null;
    given_names?: string | null;
    sex?: string | null;
    date_of_birth?: string | null;
  },
): [string, string, string] {
  const doc = mrzPad((card.serial_number || "CD").replace(/-/g, ""), 9);
  const nic = mrzPad((holder.nic || "").replace(/\D/g, ""), 14);
  const sex = (holder.sex || "X").toUpperCase().startsWith("F") ? "F" : "M";
  const dob = (holder.date_of_birth || "00000000").replace(/-/g, "");
  const yy = dob.slice(2, 4) || "00";
  const mm = dob.slice(4, 6) || "00";
  const dd = dob.slice(6, 8) || "00";
  const exp = card.expires_at
    ? new Date(card.expires_at).toISOString().slice(2, 10).replace(/-/g, "")
    : "000000";
  const family = mrzPad(holder.family_name || "X", 20);
  const given = mrzPad((holder.given_names || "X").replace(/[\s,]+/g, "<"), 20);
  return [
    `IDCOD${doc}<<<<<<<<<<<<<<<`,
    `${yy}${mm}${dd}${sex}${exp}COD${nic}<<<<<<<`,
    `${family}<<${given}`.slice(0, 30).padEnd(30, "<"),
  ];
}

/** Imprime le HTML réel de la carte (même DOM / CSS), pas une capture image. */
export function printNationalIdCard(rootId = "nn-id-card-print"): void {
  const root = document.getElementById(rootId);
  if (!root) {
    window.print();
    return;
  }

  const clone = root.cloneNode(true) as HTMLElement;
  // Chemins absolus pour que drapeau / armoiries / patrimoine s'impriment
  clone.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && src.startsWith("/")) {
      img.setAttribute("src", `${window.location.origin}${src}`);
    }
  });

  const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => {
      if (n instanceof HTMLLinkElement && n.href) {
        return `<link rel="stylesheet" href="${n.href}" />`;
      }
      return n.outerHTML;
    })
    .join("\n");

  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) {
    window.print();
    return;
  }

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <base href="${window.location.origin}/" />
  <title>Carte d'identité nationale — RDC</title>
  ${styleSheets}
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .id-card-print-wrap {
      display: flex !important;
      flex-direction: column !important;
      gap: 14mm !important;
      margin: 0 auto !important;
      max-width: 180mm !important;
    }
    .rdc-card,
    .rdc-card * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .rdc-card {
      width: 170mm !important;
      height: 107mm !important;
      max-height: none !important;
      max-width: none !important;
      aspect-ratio: auto !important;
      box-shadow: none !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      margin: 0 auto !important;
    }
    .rdc-card-front {
      page-break-after: always;
    }
    .rdc-qr-block svg,
    .rdc-qr-svg svg {
      width: 28mm !important;
      height: 28mm !important;
      display: block;
      background: #fff;
      border: 0.3mm solid #9ab4d0;
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`);
  win.document.close();

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => {
        try {
          win.close();
        } catch {
          /* ignore */
        }
      }, 500);
    }
  };

  // Attendre CSS + images patrimoine
  const imgs = Array.from(win.document.images);
  Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
    ),
  ).then(() => setTimeout(runPrint, 200));
}

const ASSETS = {
  flag: "/card-assets/drapeau-rdc.png",
  arms: "/card-assets/armoiries-rdc.png",
  tour: "/card-assets/tour-echangeur.png",
  okapi: "/card-assets/okapi.png",
};

type Props = {
  card: NationalCard;
  fallback?: {
    family_name?: string;
    given_names?: string;
    date_of_birth?: string;
    sex?: string;
    nic?: string | null;
    place_of_birth?: string | null;
  };
};

export default function IdCardRdc({ card, fallback }: Props) {
  const [qrSvg, setQrSvg] = useState<string>("");

  const holder = {
    family_name: card.holder?.family_name ?? fallback?.family_name ?? "—",
    given_names: card.holder?.given_names ?? fallback?.given_names ?? "—",
    date_of_birth: card.holder?.date_of_birth ?? fallback?.date_of_birth ?? "—",
    sex: card.holder?.sex ?? fallback?.sex ?? "—",
    nic: card.holder?.nic ?? fallback?.nic ?? null,
    place_of_birth: card.holder?.place_of_birth ?? fallback?.place_of_birth ?? "—",
    nationality: card.holder?.nationality ?? "COD",
    address_line: card.holder?.address_line ?? card.delivery_address ?? "—",
    city: card.holder?.city ?? "—",
    province_code: card.holder?.province_code ?? "—",
  };

  const issued = card.issued_at
    ? new Date(card.issued_at).toLocaleDateString("fr-FR")
    : "—";
  const expires = card.expires_at
    ? new Date(card.expires_at).toLocaleDateString("fr-FR")
    : "—";
  const sexLabel = String(holder.sex).toUpperCase().startsWith("F") ? "F" : "M";
  const mrz = buildMrz(card, holder);

  useEffect(() => {
    let cancelled = false;
    const payload = JSON.stringify(card.qr_payload ?? { card_id: card.card_id, v: card.version });
    void QRCode.toString(payload, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b2a4a", light: "#ffffff" },
      width: 160,
    }).then((svg) => {
      if (!cancelled) setQrSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [card.card_id, card.version, card.qr_payload]);

  return (
    <div id="nn-id-card-print" className="id-card-print-wrap">
      {/* RECTO — HTML réel (pas une image) */}
      <article className="rdc-card rdc-card-front" aria-label="Carte d'identité nationale — recto">
        <div className="rdc-card-bg" aria-hidden>
          <img className="rdc-bg-flag" src={ASSETS.flag} alt="" />
          <img className="rdc-bg-arms" src={ASSETS.arms} alt="" />
          <img className="rdc-bg-tour" src={ASSETS.tour} alt="" />
        </div>
        <div className="rdc-card-guilloche" aria-hidden />
        <header className="rdc-card-header">
          <div className="rdc-flag-badge" aria-hidden>
            <img src={ASSETS.flag} alt="" />
          </div>
          <div className="rdc-card-titles">
            <strong>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</strong>
            <span>CARTE NATIONALE D&apos;IDENTITÉ / IDENTITY CARD</span>
          </div>
          <div className="rdc-country-code" title="Code pays">
            <img src={ASSETS.arms} alt="" />
          </div>
        </header>

        <div className="rdc-card-main">
          <div className="rdc-photo-col">
            <div className="rdc-photo" aria-hidden>
              {sexLabel}
            </div>
            <div className="rdc-chip" title="Puce électronique" aria-hidden />
            <div className="rdc-heritage" title="Patrimoine national">
              Tour de l&apos;Échangeur · Okapi · Armoiries
            </div>
          </div>

          <div className="rdc-fields">
            <div>
              <span className="id-label">Nom / Surname</span>
              <strong>{holder.family_name}</strong>
            </div>
            <div>
              <span className="id-label">Prénom(s) / Given names</span>
              <strong>{holder.given_names}</strong>
            </div>
            <div className="rdc-fields-row">
              <div>
                <span className="id-label">Sexe</span>
                <strong>{sexLabel}</strong>
              </div>
              <div>
                <span className="id-label">Nationalité</span>
                <strong>COD</strong>
              </div>
            </div>
            <div>
              <span className="id-label">Date de naissance</span>
              <strong>{holder.date_of_birth}</strong>
            </div>
            <div>
              <span className="id-label">Lieu de naissance</span>
              <strong>{holder.place_of_birth || "—"}</strong>
            </div>
            <div>
              <span className="id-label">N° document</span>
              <strong>{card.serial_number}</strong>
            </div>
            <div>
              <span className="id-label">NIC</span>
              <strong className="nic-code">{holder.nic || "—"}</strong>
            </div>
            <div className="rdc-fields-row">
              <div>
                <span className="id-label">Délivrance</span>
                <strong>{issued}</strong>
              </div>
              <div>
                <span className="id-label">Expiration</span>
                <strong>{expires}</strong>
              </div>
            </div>
          </div>

          <div className="rdc-side-security">
            <div className="rdc-tactile" aria-hidden title="Fenêtre tactile" />
            <div className="rdc-ghost" aria-hidden>
              {sexLabel}
            </div>
          </div>
        </div>

        <div className="rdc-stripe-bar">
          <span className="rdc-stripe-flag" aria-hidden />
          <span>ONIP · Identité nationale · Justice · Paix · Travail</span>
        </div>
      </article>

      {/* VERSO — patrimoine + drapeau + armoiries */}
      <article className="rdc-card rdc-card-back" aria-label="Carte d'identité nationale — verso">
        <div className="rdc-card-bg rdc-card-bg-back" aria-hidden>
          <img className="rdc-bg-flag rdc-bg-flag-back" src={ASSETS.flag} alt="" />
          <img className="rdc-bg-tour rdc-bg-tour-back" src={ASSETS.tour} alt="" />
          <img className="rdc-bg-okapi" src={ASSETS.okapi} alt="" />
          <img className="rdc-bg-arms rdc-bg-arms-back" src={ASSETS.arms} alt="" />
        </div>
        <div className="rdc-card-guilloche rdc-card-guilloche-back" aria-hidden />
        <div className="rdc-back-top">
          <div className="rdc-qr-block">
            {qrSvg ? (
              <div
                className="rdc-qr-svg"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                aria-label="QR vérification"
              />
            ) : (
              <div className="rdc-qr-placeholder" aria-hidden>
                QR…
              </div>
            )}
            <small>2D-Doc / vérification</small>
          </div>
          <div className="rdc-back-meta">
            <div>
              <span className="id-label">Adresse / Address</span>
              <strong>{holder.address_line}</strong>
            </div>
            <div className="rdc-fields-row">
              <div>
                <span className="id-label">Province</span>
                <strong>{holder.province_code || "—"}</strong>
              </div>
              <div>
                <span className="id-label">Commune de livraison</span>
                <strong>{card.commune_name || card.commune_code || "—"}</strong>
              </div>
            </div>
            <div className="rdc-fields-row">
              <div>
                <span className="id-label">Statut circuit</span>
                <strong>{card.status}</strong>
              </div>
              <div>
                <span className="id-label">Patrimoine</span>
                <strong>Échangeur Limete · Okapi · Armoiries</strong>
              </div>
            </div>
          </div>
          <div className="rdc-back-ghost">
            <div className="rdc-ghost rdc-ghost-lg" aria-hidden>
              {sexLabel}
            </div>
            <small>Expire {expires}</small>
          </div>
        </div>

        <div className="rdc-nfc-row">
          <span className="rdc-nfc-icon" aria-hidden />
          <span>Puce sans contact · biometric ready</span>
          <span className="rdc-serial-vert">{card.serial_number.replace(/-/g, "")}</span>
        </div>

        <div className="rdc-mrz" aria-label="Zone MRZ">
          {mrz.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </article>
    </div>
  );
}
