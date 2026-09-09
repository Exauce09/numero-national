import { useNavigate } from "react-router-dom";
import {
  cardStatusLabel,
  computeRegularite,
  displayCitizenName,
  getCitizenProfile,
} from "../citizenProfile";

function toneFor(status: string): string {
  switch (status) {
    case "REGULIER":
      return "#1a5f4a";
    case "EN_COURS":
      return "#8a6d1a";
    case "INCOMPLET":
      return "#8a4b1a";
    default:
      return "#8a1a1a";
  }
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const profile = getCitizenProfile();
  const reg = computeRegularite(profile);

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord</h2>
          <p className="page-lead">
            Situation personnelle et état de régularité de {displayCitizenName(profile)}.
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title">État de régularité</h3>
        <p style={{ margin: "0 0 0.5rem", fontSize: "1.35rem", fontWeight: 700, color: toneFor(reg.status) }}>
          {reg.label}
        </p>
        <p className="muted" style={{ marginTop: 0 }}>
          {reg.detail}
        </p>
        <div className="metrics-row" style={{ marginTop: "1rem" }}>
          <div className="metric-card">
            <span className="muted small">Complétude dossier</span>
            <strong>{reg.score}%</strong>
          </div>
          <div className="metric-card">
            <span className="muted small">Documents manquants</span>
            <strong>{reg.missingRequired.length}</strong>
          </div>
          <div className="metric-card">
            <span className="muted small">En attente état civil</span>
            <strong>{reg.pending.length}</strong>
          </div>
          <div className="metric-card">
            <span className="muted small">Carte</span>
            <strong>{cardStatusLabel(profile.card.status)}</strong>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: "1rem" }}>
          <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={() => navigate("/documents")}>
            Compléter mon dossier
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/card")}>
            Voir ma carte
          </button>
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Ma situation</h3>
        <div className="form-grid">
          <div>
            <span className="muted small">NIC</span>
            <p style={{ margin: "0.2rem 0 0" }}>
              <code>{profile.nic}</code>
            </p>
          </div>
          <div>
            <span className="muted small">Nom complet</span>
            <p style={{ margin: "0.2rem 0 0" }}>{displayCitizenName(profile)}</p>
          </div>
          <div>
            <span className="muted small">Sexe</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.sexe === "M" ? "Masculin" : "Féminin"}</p>
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
            <span className="muted small">État civil</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.etat_civil}</p>
          </div>
          <div>
            <span className="muted small">Nationalité</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.nationalite}</p>
          </div>
          <div>
            <span className="muted small">Commune</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.commune}</p>
          </div>
          <div className="full">
            <span className="muted small">Adresse</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.adresse}</p>
          </div>
          <div>
            <span className="muted small">Téléphone</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.telephone}</p>
          </div>
          <div>
            <span className="muted small">E-mail</span>
            <p style={{ margin: "0.2rem 0 0" }}>{profile.email}</p>
          </div>
        </div>
      </div>

      {reg.missingRequired.length > 0 ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3 className="panel-title">Documents obligatoires manquants</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {reg.missingRequired.map((d) => (
              <li key={d.id}>{d.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
