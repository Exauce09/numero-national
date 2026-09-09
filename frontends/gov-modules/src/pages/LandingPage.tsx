import { Link } from "react-router-dom";

const PORTALS = [
  {
    to: "/sante/login",
    title: "Ministère de la Santé",
    desc: "Indicateurs nationaux, structures sanitaires et exports anonymisés.",
    external: false,
  },
  {
    to: "/interieur/login",
    title: "Ministère de l'Intérieur",
    desc: "Mouvements, déplacements, documents manquants et parcours (dédié : localhost:5178).",
    external: false,
  },
  {
    to: "/presidence/login",
    title: "Présidence",
    desc: "Vue nationale — portail dédié recommandé : localhost:5174.",
    external: false,
  },
  {
    to: "http://localhost:5179/login",
    title: "Primature",
    desc: "Coordination gouvernementale — lecture seule (portail dédié : localhost:5179).",
    external: true,
  },
  {
    to: "/admin/login",
    title: "Administration",
    desc: "Utilisateurs, rôles, institutions, audit et configuration.",
    external: false,
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
        {PORTALS.map((p) =>
          p.external ? (
            <a key={p.to} className="card-link" href={p.to} target="_blank" rel="noreferrer">
              <strong>{p.title}</strong>
              <p className="muted" style={{ margin: "0.4rem 0 0" }}>
                {p.desc}
              </p>
            </a>
          ) : (
            <Link key={p.to} className="card-link" to={p.to}>
              <strong>{p.title}</strong>
              <p className="muted" style={{ margin: "0.4rem 0 0" }}>
                {p.desc}
              </p>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
