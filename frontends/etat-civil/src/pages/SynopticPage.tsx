/** Tableaux synoptiques — vue provinces, détail province, puis forme Justicia par commune. */

import { useMemo, useState } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import { getSession } from "../auth";
import { type OfficerCommune } from "../commune";
import type { FlatCommune } from "../geoFallback";
import { isJudicialRole } from "../rbac";
import {
  listSynopticCommunes,
  synopticAdoptions,
  synopticBirths,
  synopticDeaths,
  synopticDocuments,
  synopticMarriagesDivorces,
  synopticNationalByProvince,
  synopticNationalByVille,
  synopticNationalTerritory,
  synopticQuartiersForCommune,
  type Gft,
  type SynopticProvinceRollup,
  type SynopticTerritoryRow,
  type SynopticVilleRollup,
} from "../synoptic";
import { listActs } from "../registry";
import { communeInViewerScope, viewerScope } from "../viewerScope";

const TABS = [
  {
    slug: "naissances",
    label: "Naissances",
    createLabel: "Naissance",
    createPath: "/births",
    managePath: "/manage/naissance",
  },
  {
    slug: "deces",
    label: "Décès",
    createLabel: "Décès",
    createPath: "/deaths",
    managePath: "/manage/deces",
  },
  {
    slug: "mariage",
    label: "Mariage",
    createLabel: "Mariages",
    createPath: "/marriages",
    managePath: "/manage/mariage",
  },
  {
    slug: "divorce",
    label: "Divorce",
    createLabel: "Divorce",
    createPath: "/divorces",
    managePath: "/manage/divorce",
  },
  {
    slug: "adoption",
    label: "Adoption",
    createLabel: "Adoption",
    createPath: "/adoptions",
    managePath: "/manage/adoption",
  },
  {
    slug: "documents",
    label: "Liste des Actes",
    createLabel: "Délivrer un document",
    createPath: "/documents",
    managePath: "/manage/document",
  },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];
type CommuneSel = OfficerCommune | FlatCommune;

function spreadGft(prefix: string, v: Gft): Record<string, number> {
  return {
    [`${prefix}_G`]: v.g,
    [`${prefix}_F`]: v.f,
    [`${prefix}_T`]: v.t,
  };
}

function GftHeads() {
  return (
    <>
      <th>G</th>
      <th>F</th>
      <th>T</th>
    </>
  );
}

function GftCells({ v }: { v: Gft }) {
  return (
    <>
      <td>{v.g}</td>
      <td>{v.f}</td>
      <td>{v.t}</td>
    </>
  );
}

function QuartiersPanel({ commune }: { commune: CommuneSel }) {
  const q = synopticQuartiersForCommune(commune);
  return (
    <div className="panel" style={{ marginTop: "1rem" }}>
      <h3 className="panel-title">
        Quartiers de {q.commune.name} ({q.rows.length})
      </h3>
      <div className="table-scroll">
        <table className="syn-official data-table">
          <thead>
            <tr>
              <th rowSpan={2}>Quartier</th>
              <th colSpan={3}>NAISSANCES SANS PROCURATION (1)</th>
              <th colSpan={3}>NAISSANCES AVEC PROCURATION (2)</th>
              <th colSpan={3}>NAISSANCES PAR JUGEMENT SUPPLÉTIF (3)</th>
              <th colSpan={3}>TOTAL</th>
            </tr>
            <tr>
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
            </tr>
          </thead>
          <tbody>
            {q.rows.map((r) => (
              <tr key={r.quartier}>
                <td>{r.quartier}</td>
                <GftCells v={r.sans} />
                <GftCells v={r.avec} />
                <GftCells v={r.jugement} />
                <td>{r.g}</td>
                <td>{r.f}</td>
                <td>{r.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        G = Garçons · F = Filles · T = Total — enregistrés rattachés aux quartiers : {q.total}
      </p>
    </div>
  );
}

function BirthsTable({ commune }: { commune: CommuneSel }) {
  const d = synopticBirths(commune);
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      ...spreadGft("cong_sans", d.cong.sans),
      ...spreadGft("cong_avec", d.cong.avec),
      ...spreadGft("cong_jugement", d.cong.jugement),
      ...spreadGft("etr_sans", d.etr.sans),
      ...spreadGft("etr_avec", d.etr.avec),
      ...spreadGft("etr_jugement", d.etr.jugement),
      ...spreadGft("tot_sans", d.totSans),
      ...spreadGft("tot_avec", d.totAvec),
      ...spreadGft("tot_delai", d.dansDelai),
      ...spreadGft("tot_jugement", d.totJug),
      ...spreadGft("tot_naissances", d.totalNaissances),
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_naissances_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DES NAISSANCES
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={3}>COMMUNE</th>
              <th colSpan={9}>POPULATION CONGOLAISE (I)</th>
              <th colSpan={9}>POPULATION ÉTRANGÈRE (II)</th>
              <th colSpan={15}>TOTAUX (I + II)</th>
            </tr>
            <tr>
              <th colSpan={3}>NAISSANCES SANS PROCURATION (1)</th>
              <th colSpan={3}>NAISSANCES AVEC PROCURATION (2)</th>
              <th colSpan={3}>NAISSANCES PAR JUGEMENT SUPPLÉTIF (3)</th>
              <th colSpan={3}>NAISSANCES SANS PROCURATION (4)</th>
              <th colSpan={3}>NAISSANCES AVEC PROCURATION (5)</th>
              <th colSpan={3}>NAISSANCES PAR JUGEMENT SUPPLÉTIF (6)</th>
              <th colSpan={3}>NAISSANCES SANS PROCURATION (1+4)=(7)</th>
              <th colSpan={3}>NAISSANCES AVEC PROCURATION (2+5)=(8)</th>
              <th colSpan={3}>NAISSANCES ENREGISTRÉES DANS LE DÉLAI (7+8)=(A)</th>
              <th colSpan={3}>NAISSANCES PAR JUGEMENT SUPPLÉTIF (3+6)=(B)</th>
              <th colSpan={3}>TOTAL NAISSANCES (A+B)</th>
            </tr>
            <tr>
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{d.commune.name}</td>
              <GftCells v={d.cong.sans} />
              <GftCells v={d.cong.avec} />
              <GftCells v={d.cong.jugement} />
              <GftCells v={d.etr.sans} />
              <GftCells v={d.etr.avec} />
              <GftCells v={d.etr.jugement} />
              <GftCells v={d.totSans} />
              <GftCells v={d.totAvec} />
              <GftCells v={d.dansDelai} />
              <GftCells v={d.totJug} />
              <GftCells v={d.totalNaissances} />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="syn-legend muted small">G = Garçons · F = Filles · T = Total</p>
      <QuartiersPanel commune={commune} />
    </>
  );
}

function MatrimonialTable({
  commune,
  mode,
}: {
  commune: CommuneSel;
  mode: "mariage" | "divorce";
}) {
  const d = synopticMarriagesDivorces(commune);
  const block = mode === "mariage" ? d.mariage : d.divorce;
  const title = mode === "mariage" ? "MARIAGES" : "DIVORCES";
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      nationaux: block.nationaux,
      etrangers: block.etrangers,
      mixtes: block.mixtes,
      total: block.total,
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_${mode}_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DES {title}
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>COMMUNE</th>
              <th>NATIONAUX</th>
              <th>ÉTRANGERS</th>
              <th>MIXTES</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{d.commune.name}</td>
              <td>{block.nationaux}</td>
              <td>{block.etrangers}</td>
              <td>{block.mixtes}</td>
              <td>{block.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <QuartiersPanel commune={commune} />
    </>
  );
}

function AdoptionsTable({ commune }: { commune: CommuneSel }) {
  const d = synopticAdoptions(commune);
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      adoptions: d.total,
    },
  ];
  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_adoption_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES ADOPTIONS
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>COMMUNE</th>
              <th>ADOPTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{d.commune.name}</td>
              <td>{d.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <QuartiersPanel commune={commune} />
    </>
  );
}

function DeathsTable({ commune }: { commune: CommuneSel }) {
  const d = synopticDeaths(commune);
  const totalMineurs = d.garcons + d.filles;
  const totalMajeurs = d.hommes + d.femmes;
  const totalGeneral = totalMineurs + totalMajeurs;
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      garcon: d.garcons,
      fille: d.filles,
      total_mineurs: totalMineurs,
      homme: d.hommes,
      femme: d.femmes,
      total_majeurs: totalMajeurs,
      total_general: totalGeneral,
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_deces_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DES DÉCÈS
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={2}>COMMUNE</th>
              <th colSpan={2}>MINEURS</th>
              <th rowSpan={2}>TOTAL MINEURS</th>
              <th colSpan={2}>MAJEURS</th>
              <th rowSpan={2}>TOTAL MAJEURS</th>
              <th rowSpan={2}>TOTAL GÉNÉRAL</th>
            </tr>
            <tr>
              <th>GARÇON</th>
              <th>FILLE</th>
              <th>HOMME</th>
              <th>FEMME</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{d.commune.name}</td>
              <td>{d.garcons}</td>
              <td>{d.filles}</td>
              <td>
                <strong>{totalMineurs}</strong>
              </td>
              <td>{d.hommes}</td>
              <td>{d.femmes}</td>
              <td>
                <strong>{totalMajeurs}</strong>
              </td>
              <td>
                <strong>{totalGeneral}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="syn-legend muted small">
        Mineurs = Garçon + Fille · Majeurs = Homme + Femme · Total Général = Mineurs + Majeurs
      </p>
    </>
  );
}

function DocumentsTable({ commune }: { commune: CommuneSel }) {
  const d = synopticDocuments(commune);
  const rows = d.byType.map((r) => ({
    commune: d.commune.name,
    type: r.type,
    count: r.count,
  }));

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_documents_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE — ACTES
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>TYPE DE DOCUMENT</th>
              <th>NOMBRE</th>
            </tr>
          </thead>
          <tbody>
            {d.byType.length === 0 ? (
              <tr>
                <td colSpan={2} className="muted">
                  Aucun document
                </td>
              </tr>
            ) : (
              d.byType.map((r) => (
                <tr key={r.type}>
                  <td>{r.type}</td>
                  <td>{r.count}</td>
                </tr>
              ))
            )}
            <tr>
              <td className="syn-commune-cell">
                <strong>TOTAL</strong>
              </td>
              <td>
                <strong>{d.total}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <QuartiersPanel commune={commune} />
    </>
  );
}

type DeathBreak = {
  deces_garcons: number;
  deces_filles: number;
  deces_hommes: number;
  deces_femmes: number;
};

type MetricRow = {
  naissances: number;
  naissances_g: number;
  naissances_f: number;
  mariages: number;
  divorces: number;
  adoptions: number;
  deces: number;
  deces_garcons: number;
  deces_filles: number;
  deces_hommes: number;
  deces_femmes: number;
  documents: number;
};

const EMPTY_METRICS: MetricRow = {
  naissances: 0,
  naissances_g: 0,
  naissances_f: 0,
  mariages: 0,
  divorces: 0,
  adoptions: 0,
  deces: 0,
  deces_garcons: 0,
  deces_filles: 0,
  deces_hommes: 0,
  deces_femmes: 0,
  documents: 0,
};

function deathTotals(r: DeathBreak) {
  const mineurs = r.deces_garcons + r.deces_filles;
  const majeurs = r.deces_hommes + r.deces_femmes;
  return { mineurs, majeurs, general: mineurs + majeurs };
}

function tabTitle(tab: TabSlug): string {
  if (tab === "naissances") return "TABLEAU SYNOPTIQUE RÉCAPITULATIF DES NAISSANCES PAR PROVINCE";
  if (tab === "deces") return "TABLEAU SYNOPTIQUE RÉCAPITULATIF DES DÉCÈS PAR PROVINCE";
  if (tab === "mariage") return "TABLEAU SYNOPTIQUE RÉCAPITULATIF DES MARIAGES PAR PROVINCE";
  if (tab === "divorce") return "TABLEAU SYNOPTIQUE RÉCAPITULATIF DES DIVORCES PAR PROVINCE";
  if (tab === "adoption") return "TABLEAU SYNOPTIQUE RÉCAPITULATIF DES ADOPTIONS PAR PROVINCE";
  return "TABLEAU SYNOPTIQUE RÉCAPITULATIF DES ACTES PAR PROVINCE";
}

function MetricHeads({ firstLabel, tab }: { firstLabel: string; tab: TabSlug }) {
  if (tab === "naissances") {
    return (
      <>
        <th rowSpan={2}>{firstLabel}</th>
        <th colSpan={2}>NAISSANCES</th>
        <th rowSpan={2}>TOTAL</th>
      </>
    );
  }
  if (tab === "deces") {
    return (
      <>
        <th rowSpan={2}>{firstLabel}</th>
        <th colSpan={2}>MINEURS</th>
        <th rowSpan={2}>TOTAL MINEURS</th>
        <th colSpan={2}>MAJEURS</th>
        <th rowSpan={2}>TOTAL MAJEURS</th>
        <th rowSpan={2}>TOTAL GÉNÉRAL</th>
      </>
    );
  }
  const label =
    tab === "mariage"
      ? "MARIAGE"
      : tab === "divorce"
        ? "DIVORCE"
        : tab === "adoption"
          ? "ADOPTION"
          : "LISTE DES ACTES";
  return (
    <>
      <th>{firstLabel}</th>
      <th>{label}</th>
    </>
  );
}

function MetricSubHeads({ tab }: { tab: TabSlug }) {
  if (tab === "naissances") {
    return (
      <tr>
        <th>GARÇON</th>
        <th>FILLE</th>
      </tr>
    );
  }
  if (tab === "deces") {
    return (
      <tr>
        <th>GARÇON</th>
        <th>FILLE</th>
        <th>HOMME</th>
        <th>FEMME</th>
      </tr>
    );
  }
  return null;
}

function MetricCells({ r, tab }: { r: MetricRow; tab: TabSlug }) {
  if (tab === "naissances") {
    return (
      <>
        <td>{r.naissances_g}</td>
        <td>{r.naissances_f}</td>
        <td>
          <strong>{r.naissances}</strong>
        </td>
      </>
    );
  }
  if (tab === "deces") {
    const t = deathTotals(r);
    return (
      <>
        <td>{r.deces_garcons}</td>
        <td>{r.deces_filles}</td>
        <td>
          <strong>{t.mineurs}</strong>
        </td>
        <td>{r.deces_hommes}</td>
        <td>{r.deces_femmes}</td>
        <td>
          <strong>{t.majeurs}</strong>
        </td>
        <td>
          <strong>{t.general}</strong>
        </td>
      </>
    );
  }
  const value =
    tab === "mariage"
      ? r.mariages
      : tab === "divorce"
        ? r.divorces
        : tab === "adoption"
          ? r.adoptions
          : r.documents;
  return (
    <td>
      <strong>{value}</strong>
    </td>
  );
}

function metricColCount(tab: TabSlug): number {
  if (tab === "naissances") return 4;
  if (tab === "deces") return 8;
  return 2;
}

function sumMetrics(rows: MetricRow[]): MetricRow {
  return rows.reduce(
    (acc, r) => ({
      naissances: acc.naissances + r.naissances,
      naissances_g: acc.naissances_g + r.naissances_g,
      naissances_f: acc.naissances_f + r.naissances_f,
      mariages: acc.mariages + r.mariages,
      divorces: acc.divorces + r.divorces,
      adoptions: acc.adoptions + r.adoptions,
      deces: acc.deces + r.deces,
      deces_garcons: acc.deces_garcons + r.deces_garcons,
      deces_filles: acc.deces_filles + r.deces_filles,
      deces_hommes: acc.deces_hommes + r.deces_hommes,
      deces_femmes: acc.deces_femmes + r.deces_femmes,
      documents: acc.documents + r.documents,
    }),
    { ...EMPTY_METRICS },
  );
}

function exportForTab(r: MetricRow & { label: string }, tab: TabSlug): Record<string, string | number> {
  if (tab === "naissances") {
    return {
      territoire: r.label,
      garcon: r.naissances_g,
      fille: r.naissances_f,
      total: r.naissances,
    };
  }
  if (tab === "deces") {
    const t = deathTotals(r);
    return {
      territoire: r.label,
      garcon: r.deces_garcons,
      fille: r.deces_filles,
      total_mineurs: t.mineurs,
      homme: r.deces_hommes,
      femme: r.deces_femmes,
      total_majeurs: t.majeurs,
      total_general: t.general,
    };
  }
  const key =
    tab === "mariage"
      ? "mariage"
      : tab === "divorce"
        ? "divorce"
        : tab === "adoption"
          ? "adoption"
          : "liste_des_actes";
  const value =
    tab === "mariage"
      ? r.mariages
      : tab === "divorce"
        ? r.divorces
        : tab === "adoption"
          ? r.adoptions
          : r.documents;
  return { territoire: r.label, [key]: value };
}

function ProvincesOverviewTable({
  rows,
  tab,
  onSelect,
}: {
  rows: SynopticProvinceRollup[];
  tab: TabSlug;
  onSelect: (province: string) => void;
}) {
  const exportRows = rows.map((r) => exportForTab({ ...r, label: r.province }, tab));
  const sums = sumMetrics(rows);
  const needsSub = tab === "naissances" || tab === "deces";

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_provinces_${tab}`} rows={exportRows} />
      </div>
      <h2 className="syn-official-title">
        {tabTitle(tab)}
        <br />
        RÉPUBLIQUE DÉMOCRATIQUE DU CONGO
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <MetricHeads firstLabel="PROVINCE" tab={tab} />
            </tr>
            <MetricSubHeads tab={tab} />
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.province}
                className="syn-row-click"
                onClick={() => onSelect(r.province)}
                title={`Voir le détail de ${r.province}`}
              >
                <td className="syn-commune-cell">{r.province}</td>
                <MetricCells r={r} tab={tab} />
              </tr>
            ))}
            <tr>
              <td className="syn-commune-cell">
                <strong>TOTAL RDC</strong>
              </td>
              <MetricCells r={sums} tab={tab} />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="syn-legend muted small">
        {tab === "deces"
          ? "Mineurs = Garçon + Fille · Majeurs = Homme + Femme · Total Général = Mineurs + Majeurs — "
          : needsSub
            ? "Garçon / Fille — "
            : ""}
        Cliquez une province pour afficher ses informations détaillées.
      </p>
    </>
  );
}

function ProvinceDetailView({
  province,
  summary,
  villes,
  communes,
  tab,
  onSelectVille,
  onSelectCommune,
  filterVille,
}: {
  province: string;
  summary: SynopticProvinceRollup | null;
  villes: SynopticVilleRollup[];
  communes: SynopticTerritoryRow[];
  tab: TabSlug;
  filterVille: string;
  onSelectVille: (ville: string) => void;
  onSelectCommune: (code: string) => void;
}) {
  const filteredCommunes = filterVille
    ? communes.filter((c) => c.ville === filterVille)
    : communes;
  const colCount = metricColCount(tab);

  return (
    <>
      <h2 className="syn-official-title">
        INFORMATIONS DE LA PROVINCE — {TABS.find((t) => t.slug === tab)?.label.toUpperCase()}
        <br />
        {province.toUpperCase()}
      </h2>

      <div className="table-scroll" style={{ marginBottom: "1rem" }}>
        <table className="syn-official">
          <thead>
            <tr>
              <MetricHeads firstLabel="PROVINCE" tab={tab} />
            </tr>
            <MetricSubHeads tab={tab} />
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{province}</td>
              <MetricCells r={summary ?? EMPTY_METRICS} tab={tab} />
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="syn-official-title" style={{ fontSize: "0.85rem" }}>
        VILLES DE LA PROVINCE {province.toUpperCase()}
      </h3>
      <div className="table-scroll" style={{ marginBottom: "1rem" }}>
        <table className="syn-official">
          <thead>
            <tr>
              <MetricHeads firstLabel="VILLE" tab={tab} />
            </tr>
            <MetricSubHeads tab={tab} />
          </thead>
          <tbody>
            {villes.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="muted">
                  Aucune ville
                </td>
              </tr>
            ) : (
              villes.map((v) => (
                <tr
                  key={`${v.province}-${v.ville}`}
                  className={`syn-row-click${filterVille === v.ville ? " syn-row-active" : ""}`}
                  onClick={() => onSelectVille(v.ville)}
                  title={`Filtrer les communes de ${v.ville}`}
                >
                  <td className="syn-commune-cell">{v.ville}</td>
                  <MetricCells r={v} tab={tab} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="syn-official-title" style={{ fontSize: "0.85rem" }}>
        COMMUNES{filterVille ? ` — ${filterVille.toUpperCase()}` : ""}
      </h3>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <MetricHeads firstLabel="COMMUNE" tab={tab} />
            </tr>
            <MetricSubHeads tab={tab} />
          </thead>
          <tbody>
            {filteredCommunes.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="muted">
                  Aucune commune
                </td>
              </tr>
            ) : (
              filteredCommunes.map((c) => (
                <tr
                  key={c.code}
                  className="syn-row-click"
                  onClick={() => onSelectCommune(c.code)}
                  title={`Ouvrir le synoptique de ${c.commune}`}
                >
                  <td className="syn-commune-cell">{c.commune}</td>
                  <MetricCells r={c} tab={tab} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="syn-legend muted small">
        Cliquez une ville pour filtrer · Cliquez une commune pour le tableau synoptique détaillé.
      </p>
    </>
  );
}

export default function SynopticPage() {
  const { section } = useParams<{ section?: string }>();
  const session = getSession();
  if (isJudicialRole(session?.roles)) {
    return <Navigate to="/" replace />;
  }
  const scope = viewerScope();
  const [filterProvince, setFilterProvince] = useState(() =>
    scope.level === "national" ? "" : scope.province,
  );
  const [filterVille, setFilterVille] = useState(() => (scope.level === "bureau" ? scope.ville : ""));
  const [selected, setSelected] = useState<FlatCommune | null>(() => {
    if (scope.level !== "bureau") return null;
    return (
      listSynopticCommunes().find((c) => communeInViewerScope(c)) ?? null
    );
  });

  if (!section) return <Navigate to="/synoptique/naissances" replace />;
  if (section === "matrimonial") return <Navigate to="/synoptique/mariage" replace />;
  const tab = (TABS.some((t) => t.slug === section) ? section : "naissances") as TabSlug;
  const commune: CommuneSel | null = selected;

  const actCount = listActs().length;
  const provinceRows = useMemo(() => synopticNationalByProvince(), [actCount]);
  const villeRows = useMemo(
    () => (filterProvince ? synopticNationalByVille(filterProvince) : []),
    [filterProvince, actCount],
  );
  const communeRows = useMemo(
    () =>
      filterProvince
        ? synopticNationalTerritory().filter(
            (r) =>
              r.province === filterProvince &&
              communeInViewerScope({ province: r.province, ville: r.ville, name: r.commune }),
          )
        : [],
    [filterProvince, actCount],
  );
  const provinceSummary = useMemo(
    () => provinceRows.find((r) => r.province === filterProvince) ?? null,
    [provinceRows, filterProvince],
  );

  const overviewRows = useMemo(() => {
    if (scope.level === "national") return provinceRows;
    return provinceRows.filter((r) => communeInViewerScope({ province: r.province }));
  }, [scope.level, provinceRows]);

  function pickCommuneByCode(code: string) {
    const hit = listSynopticCommunes().find((c) => c.code === code) ?? null;
    setSelected(hit);
    if (hit) {
      setFilterProvince(hit.province);
      setFilterVille(hit.ville);
    }
  }

  function selectProvince(province: string) {
    setFilterProvince(province);
    const communes = listSynopticCommunes()
      .filter((c) => c.province === province)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const first = communes[0] ?? null;
    setFilterVille(first?.ville ?? "");
    setSelected(first);
  }

  function resetToGeneral() {
    setSelected(null);
    setFilterProvince("");
    setFilterVille("");
  }

  const provinces = useMemo(
    () =>
      [
        ...new Set(
          listSynopticCommunes()
            .filter((c) => communeInViewerScope({ province: c.province }))
            .map((c) => c.province),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [],
  );

  const villes = useMemo(
    () =>
      [
        ...new Set(
          listSynopticCommunes()
            .filter((c) => communeInViewerScope(c))
            .filter((c) => !filterProvince || c.province === filterProvince)
            .map((c) => c.ville),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [filterProvince],
  );

  const communesOpts = useMemo(
    () =>
      listSynopticCommunes()
        .filter((c) => communeInViewerScope(c))
        .filter((c) => !filterProvince || c.province === filterProvince)
        .filter((c) => !filterVille || c.ville === filterVille)
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [filterProvince, filterVille],
  );

  return (
    <div className="syn-page">
      <div className="eg-page-head no-print">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Tableau synoptique
          </p>
          <h2 className="page-title">Tableau synoptique</h2>
          <p className="page-lead">
            Vue par province · cliquez une province pour ses infos · puis une commune pour le détail
            Justicia.
          </p>
        </div>
      </div>

      <div className="panel no-print" style={{ marginBottom: "1rem" }}>
        <div className="panel-head">
          <h3 className="panel-title" style={{ margin: 0 }}>
            Filtres
          </h3>
          {scope.level === "national" ? (
            <button type="button" className="btn-secondary btn-sm" onClick={resetToGeneral}>
              Vue générale (provinces)
            </button>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              {scope.level === "province"
                ? `Votre niveau : province ${scope.province}`
                : `Votre niveau : ${scope.commune} · ${scope.ville} · ${scope.province}`}
            </p>
          )}
        </div>
        <div className="form-grid">
          <div>
            <label className="form-label">Province</label>
            <select
              className="form-control"
              value={filterProvince}
              disabled={scope.level !== "national"}
              onChange={(e) => {
                setFilterProvince(e.target.value);
                setFilterVille("");
                setSelected(null);
              }}
            >
              {scope.level === "national" ? <option value="">— Toutes les provinces —</option> : null}
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Ville</label>
            <select
              className="form-control"
              value={filterVille}
              onChange={(e) => {
                setFilterVille(e.target.value);
                setSelected(null);
              }}
              disabled={!filterProvince || scope.level === "bureau"}
            >
              <option value="">— Toutes les villes —</option>
              {villes.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Commune (détail)</label>
            <select
              className="form-control"
              value={selected?.code ?? ""}
              onChange={(e) => {
                if (!e.target.value) {
                  setSelected(null);
                  return;
                }
                pickCommuneByCode(e.target.value);
              }}
              disabled={!filterProvince || scope.level === "bureau"}
            >
              <option value="">— Choisir la commune —</option>
              {communesOpts.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} — {c.ville}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="syn-tabs no-print">
        {TABS.map((t) => (
          <NavLink
            key={t.slug}
            to={`/synoptique/${t.slug}`}
            className={({ isActive }) => `syn-tab${isActive || tab === t.slug ? " active" : ""}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      {(() => {
        const active = TABS.find((t) => t.slug === tab) ?? TABS[0];
        return (
          <div
            className="panel no-print"
            style={{
              marginBottom: "1rem",
              padding: "0.85rem 1rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <p className="muted small" style={{ margin: 0, flex: "1 1 220px" }}>
              {selected ? (
                <>
                  Détail commune <strong>{selected.name}</strong> — onglet {active.label}
                </>
              ) : filterProvince ? (
                <>
                  Province <strong>{filterProvince}</strong>
                  {filterVille ? (
                    <>
                      {" "}
                      · ville <strong>{filterVille}</strong>
                    </>
                  ) : null}{" "}
                  — cliquez une commune pour le détail
                </>
              ) : (
                <>Tableau national par province — cliquez une ligne pour le détail.</>
              )}
            </p>
            <Link className="btn-primary" style={{ width: "auto" }} to={active.createPath}>
              + {active.createLabel}
            </Link>
            <Link className="btn-secondary" style={{ width: "auto" }} to={active.managePath}>
              Voir la liste gérable
            </Link>
            {selected || filterProvince ? (
              <button
                type="button"
                className="btn-secondary"
                style={{ width: "auto" }}
                onClick={selected ? () => setSelected(null) : resetToGeneral}
              >
                {selected ? "Retour province" : "Retour provinces"}
              </button>
            ) : null}
          </div>
        );
      })()}

      <div className="syn-official-wrap">
        {commune ? (
          <>
            {tab === "naissances" ? <BirthsTable commune={commune} /> : null}
            {tab === "mariage" ? <MatrimonialTable commune={commune} mode="mariage" /> : null}
            {tab === "divorce" ? <MatrimonialTable commune={commune} mode="divorce" /> : null}
            {tab === "adoption" ? <AdoptionsTable commune={commune} /> : null}
            {tab === "deces" ? <DeathsTable commune={commune} /> : null}
            {tab === "documents" ? <DocumentsTable commune={commune} /> : null}
          </>
        ) : filterProvince ? (
          <ProvinceDetailView
            province={filterProvince}
            summary={provinceSummary}
            villes={villeRows}
            communes={communeRows}
            tab={tab}
            filterVille={filterVille}
            onSelectVille={(ville) => {
              setFilterVille((prev) => (prev === ville ? "" : ville));
              setSelected(null);
            }}
            onSelectCommune={pickCommuneByCode}
          />
        ) : (
          <ProvincesOverviewTable rows={overviewRows} tab={tab} onSelect={selectProvince} />
        )}
      </div>
    </div>
  );
}
