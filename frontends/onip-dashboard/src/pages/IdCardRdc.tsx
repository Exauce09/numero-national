import type { NationalCard } from "../api";

function qrImgUrl(payload: Record<string, unknown> | null | undefined): string {
  const data = encodeURIComponent(JSON.stringify(payload ?? {}));
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${data}`;
}

function mrzPad(s: string, len: number): string {
  return (s.toUpperCase().replace(/[^A-Z0-9<]/g, "<") + "<".repeat(len)).slice(0, len);
}

function buildMrz(card: NationalCard, holder: NonNullable<NationalCard["holder"]>): [string, string, string] {
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

type Props = {
  card: NationalCard;
  /** Fallback si holder API absent */
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

  return (
    <div className="id-card-print-wrap">
      {/* RECTO */}
      <article className="rdc-card rdc-card-front" aria-label="Carte d'identité nationale — recto">
        <div className="rdc-card-guilloche" aria-hidden />
        <header className="rdc-card-header">
          <div className="rdc-flag-badge" aria-hidden>
            <span className="rdc-star">★</span>
          </div>
          <div className="rdc-card-titles">
            <strong>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</strong>
            <span>CARTE NATIONALE D&apos;IDENTITÉ / IDENTITY CARD</span>
          </div>
          <div className="rdc-country-code" title="Code pays">
            CD
          </div>
        </header>

        <div className="rdc-card-main">
          <div className="rdc-photo-col">
            <div className="rdc-photo" aria-hidden>
              {sexLabel}
            </div>
            <div className="rdc-chip" title="Puce électronique" aria-hidden />
            <div className="rdc-heritage" title="Patrimoine national">
              Virunga · Congo · Léopard
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

      {/* VERSO */}
      <article className="rdc-card rdc-card-back" aria-label="Carte d'identité nationale — verso">
        <div className="rdc-card-guilloche rdc-card-guilloche-back" aria-hidden />
        <div className="rdc-back-top">
          <div className="rdc-qr-block">
            <img src={qrImgUrl(card.qr_payload)} alt="QR vérification" width={120} height={120} />
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
                <strong>RDC — Fleuve · Parcs · Cultures</strong>
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
