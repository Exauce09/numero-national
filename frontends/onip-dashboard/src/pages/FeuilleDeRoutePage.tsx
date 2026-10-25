import { Link } from "react-router-dom";

type Item = {
  title: string;
  status: "EXISTANT" | "PARTIEL" | "ABSENT" | "BLOQUE";
  href?: string;
  note: string;
};

const ITEMS: Item[] = [
  {
    title: "Tableau de bord",
    status: "EXISTANT",
    href: "/",
    note: "Agrégats nationaux",
  },
  {
    title: "Comptes agents",
    status: "PARTIEL",
    href: "/accounts",
    note: "MFA sensible à renforcer",
  },
  {
    title: "Campagnes & contrôle",
    status: "EXISTANT",
    href: "/campaigns",
    note: "Promote NIC provisoire",
  },
  {
    title: "Anomalies / doublons",
    status: "PARTIEL",
    href: "/anomalies",
    note: "Tickets SLA à ajouter",
  },
  {
    title: "Cartographie",
    status: "EXISTANT",
    href: "/cartographie",
    note: "Points GPS / milieu",
  },
  {
    title: "Numéros NIC / NIN",
    status: "PARTIEL",
    href: "/nic",
    note: "Provisoire — officiel bloqué",
  },
  {
    title: "Conformité FGP / NIN",
    status: "PARTIEL",
    href: "/conformite",
    note: "Statut juridique live",
  },
  {
    title: "Cartes d'identité",
    status: "PARTIEL",
    href: "/cards",
    note: "Gabarit prototype",
  },
  {
    title: "Population / FGP (recherche dossier)",
    status: "ABSENT",
    note: "À brancher sur registry search",
  },
  {
    title: "Biométrie (revue 1:N)",
    status: "ABSENT",
    note: "API biometric existe — UI ONIP manquante",
  },
  {
    title: "État civil (file événements)",
    status: "ABSENT",
    note: "Sync EC existe — console ONIP manquante",
  },
  {
    title: "Partenaires / API verify",
    status: "PARTIEL",
    note: "Endpoints verify partiels",
  },
  {
    title: "Administration technique",
    status: "ABSENT",
    note: "Health / jobs / files",
  },
  {
    title: "Générateur NIN officiel",
    status: "BLOQUE",
    note: "Attente arrêté + annexe",
  },
];

const COLOR: Record<Item["status"], string> = {
  EXISTANT: "#1e7e34",
  PARTIEL: "#b78103",
  ABSENT: "#666",
  BLOQUE: "#c0392b",
};

export default function FeuilleDeRoutePage() {
  return (
    <div>
      <div className="hero-banner">
        <h1>Feuille de route ONIP</h1>
        <p>
          Matrice issue du plan complet SIGPOP-RDC. Détail :{" "}
          <code>docs/legal/onip/MATRICE_PLAN_VS_EXISTANT.md</code>
        </p>
      </div>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Statut</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((it) => (
              <tr key={it.title}>
                <td>
                  {it.href ? <Link to={it.href}>{it.title}</Link> : it.title}
                </td>
                <td>
                  <span style={{ color: COLOR[it.status], fontWeight: 700 }}>{it.status}</span>
                </td>
                <td className="muted">{it.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
