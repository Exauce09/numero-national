import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconBaby,
  IconCar,
  IconClipboard,
  IconCross,
  IconFile,
  IconHeart,
  IconRing,
  IconSplit,
  IconUsers,
} from "../components/Icons";
import { ageDays, listActs, listPersons } from "../registry";

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
  const persons = listPersons();
  const acts = listActs();
  const [query, setQuery] = useState("");

  const newborn = useMemo(() => {
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
    return { garcons, filles, total: garcons + filles };
  }, [acts.length]);

  const items: DashItem[] = [
    {
      id: "pop",
      title: "Population",
      value: persons.length,
      subtitle: "Habitants enregistrés",
      tone: "primary",
      href: "/population",
      icon: <IconUsers size={26} />,
    },
    {
      id: "ne",
      title: "Nouveaux-nés",
      value: newborn.total,
      subtitle: "90 derniers jours",
      tone: "success",
      href: "/newborns",
      icon: <IconBaby size={26} />,
    },
    {
      id: "ne-m",
      title: "Nouveaux-nés (G)",
      value: newborn.garcons,
      subtitle: "Garçons",
      tone: "info",
      href: "/newborns?sexe=M",
      icon: <IconBaby size={26} />,
    },
    {
      id: "ne-f",
      title: "Nouveaux-nés (F)",
      value: newborn.filles,
      subtitle: "Filles",
      tone: "pink",
      href: "/newborns?sexe=F",
      icon: <IconHeart size={26} />,
    },
    {
      id: "birth",
      title: "Naissances",
      value: acts.filter((a) => a.type === "BIRTH").length,
      subtitle: "Actes de naissance",
      tone: "success",
      href: "/manage/naissance",
      icon: <IconBaby size={26} />,
    },
    {
      id: "death",
      title: "Décès",
      value: acts.filter((a) => a.type === "DEATH").length,
      subtitle: "Actes de décès",
      tone: "danger",
      href: "/manage/deces",
      icon: <IconCross size={26} />,
    },
    {
      id: "marriage",
      title: "Mariages",
      value: acts.filter((a) => a.type === "MARRIAGE").length,
      subtitle: "Unions",
      tone: "warning",
      href: "/manage/mariage",
      icon: <IconRing size={26} />,
    },
    {
      id: "divorce",
      title: "Divorces",
      value: acts.filter((a) => a.type === "DIVORCE").length,
      subtitle: "Dissolutions",
      tone: "secondary",
      href: "/manage/divorce",
      icon: <IconSplit size={26} />,
    },
    {
      id: "adoption",
      title: "Adoptions",
      value: acts.filter((a) => a.type === "ADOPTION").length,
      subtitle: "Actes d'adoption",
      tone: "indigo",
      href: "/manage/adoption",
      icon: <IconUsers size={26} />,
    },
    {
      id: "move",
      title: "Déplacements",
      value: acts.filter((a) => a.type === "DISPLACEMENT").length,
      subtitle: "Mouvements",
      tone: "info",
      href: "/manage/deplacement",
      icon: <IconCar size={26} />,
    },
    {
      id: "census",
      title: "Recensement",
      value: acts.filter((a) => a.type === "CENSUS").length,
      subtitle: "Fiches",
      tone: "primary",
      href: "/census",
      icon: <IconClipboard size={26} />,
    },
    {
      id: "docs",
      title: "Documents",
      value: acts.filter((a) => a.type === "DOCUMENT").length,
      subtitle: "Pièces émises",
      tone: "secondary",
      href: "/manage/document",
      icon: <IconFile size={26} />,
    },
  ];

  const filtered = items.filter(
    (i) =>
      !query.trim() ||
      i.title.toLowerCase().includes(query.trim().toLowerCase()) ||
      i.subtitle.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord</h2>
          <p className="page-lead">
            Accueil communal style{" "}
            <a href="https://www.justicia.website/egouv/COMMUNE/accueil.php" target="_blank" rel="noreferrer">
              e-gov Justicia
            </a>{" "}
            — cliquez une carte pour ouvrir le détail.
          </p>
        </div>
        <div className="eg-page-tools">
          <input
            className="form-control"
            style={{ marginBottom: 0, minWidth: 220 }}
            placeholder="Filtrer les indicateurs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="eg-widget-grid">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            className="eg-widget"
            onClick={() => navigate(item.href)}
          >
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

      <div className="eg-quick-row">
        <button type="button" className="btn-add" onClick={() => navigate("/population")}>
          Gérer la population
        </button>
        <button type="button" className="btn-next" onClick={() => navigate("/newborns")}>
          Gérer les nouveaux-nés
        </button>
        <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={() => navigate("/births")}>
          Enregistrer une naissance
        </button>
      </div>
    </div>
  );
}
