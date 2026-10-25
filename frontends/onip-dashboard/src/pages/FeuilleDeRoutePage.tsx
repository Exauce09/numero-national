import { Link } from "react-router-dom";

type Item = {
  title: string;
  status: "EXISTANT" | "PARTIEL" | "ABSENT" | "BLOQUE";
  href?: string;
  note: string;
};

const ITEMS: Item[] = [
  { title: "Tableau de bord", status: "EXISTANT", href: "/", note: "Agrégats nationaux" },
  { title: "Comptes agents", status: "PARTIEL", href: "/accounts", note: "MFA sensible à renforcer" },
  { title: "Campagnes & contrôle", status: "EXISTANT", href: "/campaigns", note: "Promote NIC provisoire" },
  { title: "Anomalies / doublons", status: "PARTIEL", href: "/anomalies", note: "Tickets SLA à ajouter" },
  { title: "Cartographie", status: "EXISTANT", href: "/cartographie", note: "Points GPS / milieu" },
  { title: "Population / FGP", status: "EXISTANT", href: "/population", note: "Recherche registry" },
  { title: "Numéros NIC / NIN", status: "PARTIEL", href: "/nic", note: "Provisoire — officiel bloqué" },
  { title: "Biométrie", status: "PARTIEL", href: "/biometrie", note: "Stats ; revue humaine via API" },
  { title: "État civil → FGP", status: "PARTIEL", href: "/etat-civil", note: "File actes / déclarations" },
  { title: "Cartes d'identité", status: "PARTIEL", href: "/cards", note: "Gabarit prototype" },
  { title: "Conformité FGP / NIN", status: "EXISTANT", href: "/conformite", note: "Statut juridique live" },
  { title: "Administration technique", status: "EXISTANT", href: "/admin", note: "Ops health + inventaire" },
  { title: "Générateur NIN officiel", status: "BLOQUE", note: "Attente arrêté + annexe (non inventé)" },
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
          Matrice plan complet SIGPOP-RDC — modules branchés progressivement. Détail dépôt :{" "}
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
                <td>{it.href ? <Link to={it.href}>{it.title}</Link> : it.title}</td>
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
