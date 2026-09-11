import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "../auth";
import {
  IconBaby,
  IconCar,
  IconClipboard,
  IconCross,
  IconFile,
  IconRing,
  IconSplit,
  IconUsers,
} from "../components/Icons";
import { dashboardVariant } from "../rbac";
import { ageDays, listActs, listPopulationPersons } from "../registry";

type Tone = "primary" | "success" | "danger" | "warning" | "info" | "secondary" | "pink" | "indigo";

type DashItem = {
  id: string;
  title: string;
  value: number;
  subtitle: string;
  tone: Tone;
  href: string;
  icon: ReactNode;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const session = getSession();
  const variant = dashboardVariant(session?.roles ?? ["OFFICIER_ETAT_CIVIL"]);
  const population = listPopulationPersons();
  const acts = listActs();
  const [query, setQuery] = useState("");

  const births = useMemo(() => {
    const birthActs = listActs("BIRTH");
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let garcons = 0;
    let filles = 0;
    for (const act of birthActs) {
      const dob = String(act.payload.date_naissance ?? "");
      const createdOk = new Date(act.created_at).getTime() >= cutoff;
      const ageOk = dob ? ageDays(dob) <= 90 : false;
      if (!createdOk && !ageOk) continue;
      const sexe = String(act.payload.sexe ?? "").toUpperCase();
      if (sexe === "M") garcons += 1;
      else if (sexe === "F") filles += 1;
    }
    return {
      total: birthActs.length,
      newborns: garcons + filles,
      garcons,
      filles,
    };
  }, [acts.length]);

  const actStatus = (a: (typeof acts)[number]) => String(a.payload?.status ?? "").toUpperCase();
  const drafts = acts.filter((a) => actStatus(a) === "DRAFT").length;
  const submitted = acts.filter((a) =>
    ["SUBMITTED", "UNDER_REVIEW", "VERIFIED"].includes(actStatus(a)),
  ).length;
  const validated = acts.filter((a) =>
    ["VALIDATED", "AUTHENTICATED"].includes(actStatus(a)),
  ).length;

  const lead = useMemo(() => {
    switch (variant) {
      case "national":
        return "Vue nationale — synthèse population, actes et bureaux.";
      case "provincial":
        return `Province : ${session?.commune_province ?? "—"}. Données limitées à votre périmètre.`;
      case "bureau":
        return `Bureau / commune : ${session?.commune_name ?? "—"}. Pilotage opérationnel du bureau.`;
      case "officier":
        return "File de validation et authentification — dossiers à traiter.";
      default:
        return "Déclarations et dossiers en cours — préparation des actes.";
    }
  }, [variant, session?.commune_province, session?.commune_name]);

  const items: DashItem[] = useMemo(() => {
    const baseOps: DashItem[] = [
      {
        id: "pop",
        title: "Population",
        value: population.length,
        subtitle: "Personnes enregistrées (registre local)",
        tone: "primary",
        href: "/personnes",
        icon: <IconUsers size={26} />,
      },
      {
        id: "birth",
        title: "Naissances",
        value: births.total,
        subtitle: `Nouveaux-nés 90 j : ${births.newborns} (G ${births.garcons} · F ${births.filles})`,
        tone: "success",
        href: "/lists/naissance",
        icon: <IconBaby size={26} />,
      },
      {
        id: "death",
        title: "Décès",
        value: acts.filter((a) => a.type === "DEATH").length,
        subtitle: "Actes de décès",
        tone: "danger",
        href: "/lists/deces",
        icon: <IconCross size={26} />,
      },
      {
        id: "marriage",
        title: "Mariages",
        value: acts.filter((a) => a.type === "MARRIAGE").length,
        subtitle: "Unions",
        tone: "warning",
        href: "/lists/mariage",
        icon: <IconRing size={26} />,
      },
      {
        id: "divorce",
        title: "Divorces",
        value: acts.filter((a) => a.type === "DIVORCE").length,
        subtitle: "Dissolutions",
        tone: "secondary",
        href: "/lists/divorce",
        icon: <IconSplit size={26} />,
      },
      {
        id: "docs",
        title: "Documents / actes",
        value: acts.length,
        subtitle: "Tous types",
        tone: "info",
        href: "/acts",
        icon: <IconFile size={26} />,
      },
    ];

    if (variant === "agent") {
      return [
        {
          id: "drafts",
          title: "Brouillons",
          value: drafts,
          subtitle: "À compléter",
          tone: "warning",
          href: "/manage/naissance",
          icon: <IconClipboard size={26} />,
        },
        {
          id: "submitted",
          title: "Soumis",
          value: submitted,
          subtitle: "En attente de vérification",
          tone: "info",
          href: "/declarations",
          icon: <IconClipboard size={26} />,
        },
        baseOps[1],
        baseOps[2],
        {
          id: "decl",
          title: "Déclarations santé",
          value: 0,
          subtitle: "File hôpital → état civil",
          tone: "pink",
          href: "/declarations",
          icon: <IconBaby size={26} />,
        },
        {
          id: "search",
          title: "Personnes",
          value: population.length,
          subtitle: "Recherche personne",
          tone: "primary",
          href: "/personnes",
          icon: <IconUsers size={26} />,
        },
      ];
    }

    if (variant === "officier") {
      return [
        {
          id: "to-verify",
          title: "À vérifier / valider",
          value: submitted,
          subtitle: "Dossiers soumis",
          tone: "warning",
          href: "/declarations",
          icon: <IconClipboard size={26} />,
        },
        {
          id: "authenticated",
          title: "Validés",
          value: validated,
          subtitle: "Actes authentifiés / validés",
          tone: "success",
          href: "/acts",
          icon: <IconFile size={26} />,
        },
        baseOps[1],
        baseOps[2],
        baseOps[3],
        baseOps[4],
      ];
    }

    if (variant === "bureau") {
      return [
        ...baseOps.slice(0, 4),
        {
          id: "queue",
          title: "File du bureau",
          value: drafts + submitted,
          subtitle: "Brouillons + soumis",
          tone: "indigo",
          href: "/declarations",
          icon: <IconClipboard size={26} />,
        },
        {
          id: "census",
          title: "Recensement",
          value: 0,
          subtitle: "Campagnes / coupons",
          tone: "info",
          href: "/census",
          icon: <IconCar size={26} />,
        },
      ];
    }

    // provincial / national — full set
    return baseOps;
  }, [variant, population.length, births, acts, drafts, submitted, validated]);

  const filtered = items.filter((it) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return it.title.toLowerCase().includes(q) || it.subtitle.toLowerCase().includes(q);
  });

  return (
    <div>
      <h2 className="page-title">Tableau de bord</h2>
      <p className="page-lead">{lead}</p>
      <div className="toolbar">
        <input
          className="form-control"
          placeholder="Filtrer les indicateurs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="eg-widget-grid">
        {filtered.map((it) => (
          <button
            key={it.id}
            type="button"
            className={`eg-widget eg-widget-${it.tone}`}
            onClick={() => navigate(it.href)}
          >
            <div className="eg-widget-icon">{it.icon}</div>
            <div className="eg-widget-body">
              <div className="eg-widget-title">{it.title}</div>
              <div className="eg-widget-value">{it.value}</div>
              <div className="eg-widget-sub">{it.subtitle}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
