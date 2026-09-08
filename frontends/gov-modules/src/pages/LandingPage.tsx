import { Link } from "react-router-dom";

const PORTALS = [
  {
    to: "/sante/login",
    title: "Ministère de la Santé",
    desc: "Indicateurs nationaux, structures sanitaires et exports anonymisés.",
  },
  {
    to: "/interieur/login",
    title: "Ministère de l'Intérieur",
    desc: "Supervision état civil, cartes nationales et audit de sécurité.",
  },
  {
    to: "/presidence/login",
    title: "Présidence",
    desc: "Tableaux stratégiques, domaines et briefings agrégés.",
  },
  {
    to: "/admin/login",
    title: "Administration",
    desc: "Utilisateurs, rôles, institutions, audit et configuration.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-hero">
        <img src="/logo-rdc.jpg" alt="République Démocratique du Congo" />
        <h1>E-GOUV — Modules gouvernementaux</h1>
        <p>Portails nationaux du registre d&apos;identité — accès réservé aux institutions.</p>
      </div>
      <div className="grid" style={{ maxWidth: 960, margin: "0 auto" }}>
        {PORTALS.map((p) => (
          <Link key={p.to} className="card-link" to={p.to}>
            <strong>{p.title}</strong>
            <p className="muted" style={{ margin: "0.4rem 0 0" }}>
              {p.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
