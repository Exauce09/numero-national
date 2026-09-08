import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ActPrintCard from "../components/ActPrintCard";
import DataToolbar from "../components/DataToolbar";
import {
  actTypeLabel,
  ageDays,
  getAct,
  listActs,
  listPersons,
  type Act,
  type ActType,
} from "../registry";

type StatKey =
  | "PERSONS"
  | "ACTS"
  | "BIRTH"
  | "DEATH"
  | "MARRIAGE"
  | "ADOPTION"
  | "DISPLACEMENT"
  | "DIVORCE"
  | "CENSUS"
  | "DOCUMENT"
  | "NEWBORN_M"
  | "NEWBORN_F";

type StatCard = {
  key: StatKey;
  label: string;
  value: number;
  hint: string;
  tone: string;
  href: string;
  filterType?: ActType | "PERSONS" | "NEWBORN_M" | "NEWBORN_F";
};

const CREATE_LINKS: Record<string, string> = {
  BIRTH: "/births",
  DEATH: "/deaths",
  CENSUS: "/census",
  MARRIAGE: "/marriages",
  ADOPTION: "/adoptions",
  DISPLACEMENT: "/displacements",
  DIVORCE: "/divorces",
  DOCUMENT: "/documents",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const persons = listPersons();
  const acts = listActs();
  const [viewAct, setViewAct] = useState<Act | null>(null);
  const [detail, setDetail] = useState<StatCard | null>(null);

  const newborn = useMemo(() => {
    const birthActs = listActs("BIRTH");
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let garcons = 0;
    let filles = 0;
    const recentBirths: Act[] = [];
    for (const act of birthActs) {
      const dob = String(act.payload.date_naissance ?? "");
      const createdOk = new Date(act.created_at).getTime() >= cutoff;
      const ageOk = dob ? ageDays(dob) <= 90 : false;
      if (!createdOk && !ageOk) continue;
      recentBirths.push(act);
      const sexe = String(act.payload.sexe ?? "").toUpperCase();
      if (sexe === "M") garcons += 1;
      else if (sexe === "F") filles += 1;
    }
    return { garcons, filles, total: garcons + filles, recentBirths };
  }, [acts.length]);

  const cards: StatCard[] = [
    {
      key: "PERSONS",
      label: "Personnes",
      value: persons.length,
      hint: "Registre communal",
      tone: "tone-blue",
      href: "/search",
      filterType: "PERSONS",
    },
    {
      key: "ACTS",
      label: "Tous les actes",
      value: acts.length,
      hint: "État civil",
      tone: "tone-indigo",
      href: "/acts",
    },
    {
      key: "BIRTH",
      label: "Naissances",
      value: acts.filter((a) => a.type === "BIRTH").length,
      hint: "Actes de naissance",
      tone: "tone-green",
      href: "/births",
      filterType: "BIRTH",
    },
    {
      key: "DEATH",
      label: "Décès",
      value: acts.filter((a) => a.type === "DEATH").length,
      hint: "Actes de décès",
      tone: "tone-red",
      href: "/deaths",
      filterType: "DEATH",
    },
    {
      key: "MARRIAGE",
      label: "Mariages",
      value: acts.filter((a) => a.type === "MARRIAGE").length,
      hint: "Unions enregistrées",
      tone: "tone-pink",
      href: "/marriages",
      filterType: "MARRIAGE",
    },
    {
      key: "ADOPTION",
      label: "Adoptions",
      value: acts.filter((a) => a.type === "ADOPTION").length,
      hint: "Actes d'adoption",
      tone: "tone-teal",
      href: "/adoptions",
      filterType: "ADOPTION",
    },
    {
      key: "DISPLACEMENT",
      label: "Déplacements",
      value: acts.filter((a) => a.type === "DISPLACEMENT").length,
      hint: "Mouvements",
      tone: "tone-orange",
      href: "/displacements",
      filterType: "DISPLACEMENT",
    },
    {
      key: "DIVORCE",
      label: "Divorces",
      value: acts.filter((a) => a.type === "DIVORCE").length,
      hint: "Dissolutions",
      tone: "tone-purple",
      href: "/divorces",
      filterType: "DIVORCE",
    },
    {
      key: "CENSUS",
      label: "Recensement",
      value: acts.filter((a) => a.type === "CENSUS").length,
      hint: "Fiches recensées",
      tone: "tone-cyan",
      href: "/census",
      filterType: "CENSUS",
    },
    {
      key: "DOCUMENT",
      label: "Documents",
      value: acts.filter((a) => a.type === "DOCUMENT").length,
      hint: "Pièces émises",
      tone: "tone-slate",
      href: "/documents",
      filterType: "DOCUMENT",
    },
    {
      key: "NEWBORN_M",
      label: "Nouveaux-nés (G)",
      value: newborn.garcons,
      hint: "90 derniers jours",
      tone: "tone-sky",
      href: "/births",
      filterType: "NEWBORN_M",
    },
    {
      key: "NEWBORN_F",
      label: "Nouveaux-nés (F)",
      value: newborn.filles,
      hint: "90 derniers jours",
      tone: "tone-rose",
      href: "/births",
      filterType: "NEWBORN_F",
    },
  ];

  const detailRows = useMemo(() => {
    if (!detail) return [] as Act[];
    if (detail.filterType === "PERSONS") return [];
    if (detail.filterType === "NEWBORN_M") {
      return newborn.recentBirths.filter((a) => String(a.payload.sexe ?? "").toUpperCase() === "M");
    }
    if (detail.filterType === "NEWBORN_F") {
      return newborn.recentBirths.filter((a) => String(a.payload.sexe ?? "").toUpperCase() === "F");
    }
    if (detail.filterType) return listActs(detail.filterType);
    return listActs();
  }, [detail, newborn.recentBirths]);

  const recent = acts.slice(0, 12);
  const toolbarRows = recent.map((a) => ({
    act_number: a.act_number,
    type: a.type,
    national_id: a.national_id,
    created_at: a.created_at,
  }));

  return (
    <div>
      <div className="dash-hero">
        <div>
          <h2 className="page-title">Tableau de bord communal</h2>
          <p className="page-lead" style={{ marginBottom: 0 }}>
            Style e-gov — chaque indicateur est cliquable pour afficher le détail (comme{" "}
            <a href="https://www.justicia.website/egouv/COMMUNE/accueil.php" target="_blank" rel="noreferrer">
              Justicia COMMUNE
            </a>
            ).
          </p>
        </div>
      </div>

      <div className="dash-grid">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`dash-card ${c.tone}`}
            onClick={() => setDetail(c)}
          >
            <span className="dash-card-label">{c.label}</span>
            <strong className="dash-card-value">{c.value}</strong>
            <span className="dash-card-hint">{c.hint}</span>
            <span className="dash-card-action">Voir le détail →</span>
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginTop: "1.25rem" }}>
        <div className="panel-head">
          <h3 className="panel-title">Actes récents</h3>
          <DataToolbar filename="actes_recents" rows={toolbarRows} />
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Type</th>
                <th>NIC</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Aucun acte enregistré — cliquez une carte pour ouvrir le module.
                  </td>
                </tr>
              ) : (
                recent.map((a) => (
                  <tr key={a.id}>
                    <td>{a.act_number}</td>
                    <td>{actTypeLabel(a.type)}</td>
                    <td>{a.national_id}</td>
                    <td>{new Date(a.created_at).toLocaleString("fr-CD")}</td>
                    <td className="table-actions">
                      <button type="button" className="btn-add btn-sm" onClick={() => setViewAct(getAct(a.id) ?? a)}>
                        Voir
                      </button>
                      <Link className="btn-add btn-sm" to={CREATE_LINKS[a.type] ?? "/acts"}>
                        Ajouter
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail ? (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <h3 className="panel-title" style={{ margin: 0 }}>
                  {detail.label}
                </h3>
                <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                  {detail.value} élément(s) · {detail.hint}
                </p>
              </div>
              <div className="modal-actions" style={{ margin: 0 }}>
                <button type="button" className="btn-add" onClick={() => navigate(detail.href)}>
                  Ouvrir le module
                </button>
                <button type="button" className="btn-secondary" onClick={() => setDetail(null)}>
                  Fermer
                </button>
              </div>
            </div>

            {detail.filterType === "PERSONS" ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>NIC</th>
                      <th>Sexe</th>
                      <th>Naissance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {persons.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="muted">
                          Aucune personne.
                        </td>
                      </tr>
                    ) : (
                      persons.slice(0, 50).map((p) => (
                        <tr key={p.id}>
                          <td>
                            {p.nom} {p.postnom} {p.prenom}
                          </td>
                          <td>{p.nic}</td>
                          <td>{p.sexe}</td>
                          <td>{p.date_naissance}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Type</th>
                      <th>NIC</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          Aucun enregistrement pour cet indicateur.
                        </td>
                      </tr>
                    ) : (
                      detailRows.map((a) => (
                        <tr key={a.id}>
                          <td>{a.act_number}</td>
                          <td>{actTypeLabel(a.type)}</td>
                          <td>{a.national_id}</td>
                          <td>{new Date(a.created_at).toLocaleString("fr-CD")}</td>
                          <td>
                            <button
                              type="button"
                              className="btn-add btn-sm"
                              onClick={() => {
                                setViewAct(a);
                              }}
                            >
                              Détail
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {viewAct ? (
        <div className="modal-backdrop" onClick={() => setViewAct(null)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-actions" style={{ marginBottom: "1rem" }}>
              <button type="button" className="btn-secondary" onClick={() => window.print()}>
                Imprimer
              </button>
              <button type="button" className="btn-secondary" onClick={() => setViewAct(null)}>
                Fermer
              </button>
            </div>
            <ActPrintCard act={viewAct} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
