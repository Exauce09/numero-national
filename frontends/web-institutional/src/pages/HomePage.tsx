import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div>
      <h1>Portails institutionnels</h1>
      <p className="muted">
        Coquille multi-portails pour l’état civil, les statistiques ministérielles et
        les vues gouvernementales (agrégats uniquement — pas de PII citoyen).
      </p>
      <div className="grid">
        <Link className="card-link" to="/civil">
          <strong>État civil</strong>
          <div className="muted">Actes, déclarations, commune</div>
        </Link>
        <Link className="card-link" to="/ministry">
          <strong>Ministère — statistiques</strong>
          <div className="muted">Indicateurs agrégés</div>
        </Link>
        <Link className="card-link" to="/gov/presidency/overview">
          <strong>Présidence / Primature</strong>
          <div className="muted">Tableaux de bord stratégiques</div>
        </Link>
      </div>
    </div>
  );
}
