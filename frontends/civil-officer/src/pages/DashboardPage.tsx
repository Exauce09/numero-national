import { Link } from "react-router-dom";

const TASKS = [
  { to: "/search", title: "Recherche population", desc: "Retrouver un citoyen / référence" },
  { to: "/births", title: "Naissances", desc: "Enregistrer et consulter les actes" },
  { to: "/marriages", title: "Mariages", desc: "Actes de mariage" },
  { to: "/divorces", title: "Divorces", desc: "Actes de divorce" },
  { to: "/deaths", title: "Décès", desc: "Actes de décès" },
  { to: "/recognitions", title: "Reconnaissances", desc: "Reconnaissance d'enfant" },
  { to: "/rectifications", title: "Rectifications", desc: "Correction d'actes" },
  { to: "/declarations", title: "Déclarations", desc: "File d'attente hôpital / commune" },
  { to: "/residence", title: "Résidence", desc: "Attestations de résidence" },
  { to: "/statistics", title: "Statistiques", desc: "Indicateurs par commune" },
];

export default function DashboardPage() {
  return (
    <div>
      <h2 className="page-title">Tableau de bord — Officier d&apos;état civil</h2>
      <p className="page-lead">
        Module communal E-GOUV : toutes les tâches d&apos;état civil rattachées au registre national (NIC).
      </p>
      <div className="grid">
        {TASKS.map((t) => (
          <Link key={t.to} className="card-link" to={t.to}>
            <strong>{t.title}</strong>
            <p className="muted" style={{ margin: "0.4rem 0 0" }}>
              {t.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
