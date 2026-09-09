import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { IconBaby, IconClipboard, IconCross } from "../components/Icons";
import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations } from "../civilDeclarations";

type Tone = "primary" | "success" | "danger" | "warning";

type DashItem = {
  id: string;
  title: string;
  value: number;
  subtitle: string;
  tone: Tone;
  href: string;
  icon: ReactNode;
};

export default function HealthDashboardPage() {
  const navigate = useNavigate();
  const session = getHealthSession()!;
  const rows = listFacilityDeclarations(session.facilityId);
  const pending = rows.filter((d) => d.status === "PENDING_OFFICER").length;
  const births = rows.filter((d) => d.declaration_type === "BIRTH").length;
  const deaths = rows.filter((d) => d.declaration_type === "DEATH").length;
  const validated = rows.filter((d) => d.status === "VALIDATED").length;

  const items: DashItem[] = [
    {
      id: "birth",
      title: "Nouveau-né",
      value: births,
      subtitle: "Déclarations de naissance envoyées",
      tone: "success",
      href: "/sante/births",
      icon: <IconBaby size={26} />,
    },
    {
      id: "death",
      title: "Décès",
      value: deaths,
      subtitle: "Déclarations de décès envoyées",
      tone: "danger",
      href: "/sante/deaths",
      icon: <IconCross size={26} />,
    },
    {
      id: "pending",
      title: "En attente",
      value: pending,
      subtitle: "Notifications état civil non validées",
      tone: "warning",
      href: "/sante/births",
      icon: <IconClipboard size={26} />,
    },
    {
      id: "ok",
      title: "Validés",
      value: validated,
      subtitle: "Pris en compte par l'officier",
      tone: "primary",
      href: "/sante",
      icon: <IconClipboard size={26} />,
    },
  ];

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord</h2>
          <p className="page-lead">
            {session.facilityName} · {session.commune_name}. Cliquez une carte pour gérer les enregistrements ;
            chaque saisie notifie l&apos;état civil.
          </p>
        </div>
      </div>

      <div className="eg-widget-grid">
        {items.map((item) => (
          <button key={item.id} type="button" className="eg-widget" onClick={() => navigate(item.href)}>
            <div className="eg-widget-body">
              <div className="eg-widget-text">
                <span className="eg-widget-value">{item.value}</span>
                <span className="eg-widget-title">{item.title}</span>
                <span className="eg-widget-sub">{item.subtitle}</span>
              </div>
              <span className={`eg-widget-icon tone-${item.tone}`}>{item.icon}</span>
            </div>
            <span className="eg-widget-foot">
              Voir le détail <span aria-hidden="true">→</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
