import { useState } from "react";
import {
  cardStatusLabel,
  displayCitizenName,
  getCitizenProfile,
  reportCardLost,
  type CitizenProfile,
} from "../citizenProfile";
import { getCitizenPrefs } from "../citizenPrefs";

export default function CardPage() {
  const [profile, setProfile] = useState<CitizenProfile>(() => getCitizenProfile());
  const [message, setMessage] = useState<string | null>(null);
  const photo = getCitizenPrefs().photoDataUrl;
  const card = profile.card;
  const lost = card.status === "PERDUE";

  function onReportLost() {
    if (lost) return;
    if (!window.confirm("Confirmer la déclaration de perte de votre carte nationale ?")) return;
    setProfile(reportCardLost());
    setMessage("Perte déclarée. L'état civil a été notifié pour un duplicata.");
  }

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Ma carte</h2>
          <p className="page-lead">Détail de votre carte d&apos;identité nationale et QR de contrôle.</p>
        </div>
      </div>

      {message ? <div className="success-banner">{message}</div> : null}

      <div className="panel citizen-card-panel">
        <div className="citizen-id-card">
          <div className="citizen-id-card-head">
            <img src="/logo-rdc.jpg" alt="" className="citizen-id-logo" />
            <div>
              <strong>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</strong>
              <span>Carte d&apos;identité nationale</span>
            </div>
          </div>
          <div className="citizen-id-card-body">
            <div className="citizen-id-photo">
              {photo ? <img src={photo} alt="" /> : <span className="muted small">Photo</span>}
            </div>
            <div className="citizen-id-fields">
              <div>
                <span className="muted small">Nom</span>
                <p>{profile.nom}</p>
              </div>
              <div>
                <span className="muted small">Post-nom</span>
                <p>{profile.postnom}</p>
              </div>
              <div>
                <span className="muted small">Prénom</span>
                <p>{profile.prenom}</p>
              </div>
              <div>
                <span className="muted small">NIC</span>
                <p>
                  <code>{profile.nic}</code>
                </p>
              </div>
              <div>
                <span className="muted small">N° carte</span>
                <p>
                  <code>{card.number}</code>
                </p>
              </div>
              <div>
                <span className="muted small">Statut</span>
                <p style={{ color: lost ? "#8a1a1a" : "#1a5f4a", fontWeight: 700 }}>
                  {cardStatusLabel(card.status)}
                </p>
              </div>
            </div>
            <div className="citizen-id-qr" title={card.qr_payload}>
              <div className="citizen-qr-box" aria-hidden="true" />
              <span className="muted small">QR de contrôle</span>
            </div>
          </div>
          <div className="citizen-id-card-foot">
            <span>Émise : {card.issued_at}</span>
            <span>Expire : {card.expires_at}</span>
            <span>{profile.commune}</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Détails</h3>
        <div className="form-grid">
          <div>
            <span className="muted small">Titulaire</span>
            <p style={{ margin: "0.2rem 0 0" }}>{displayCitizenName(profile)}</p>
          </div>
          <div>
            <span className="muted small">Date de naissance</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.date_naissance}</p>
          </div>
          <div>
            <span className="muted small">Lieu de naissance</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.lieu_naissance}</p>
          </div>
          <div>
            <span className="muted small">Nationalité</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.nationalite}</p>
          </div>
          <div>
            <span className="muted small">Sexe</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.sexe === "M" ? "Masculin" : "Féminin"}</p>
          </div>
          <div>
            <span className="muted small">Payload QR</span>
            <p style={{ margin: "0.2rem 0 0" }}>
              <code className="small">{card.qr_payload}</code>
            </p>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: "1rem" }}>
          <button type="button" className="btn-secondary" disabled={lost} onClick={onReportLost}>
            {lost ? "Perte déjà déclarée" : "Déclarer la perte"}
          </button>
        </div>
      </div>
    </div>
  );
}
