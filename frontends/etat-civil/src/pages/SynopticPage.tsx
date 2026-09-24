/** Tableaux synoptiques — vue provinces, détail province, puis forme Justicia par commune. */

import { useMemo, useState } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import { getSession } from "../auth";
import { getOfficerCommune, type OfficerCommune } from "../commune";
import { isSuperAdminNational } from "../ecUsers";
import type { FlatCommune } from "../geoFallback";
import { isJudicialRole } from "../rbac";
import {
  listSynopticCommunes,
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

const TABS = [
  {
    slug: "naissances",
    label: "Enregistrement de nouveau-né",
    createLabel: "Enregistrement de nouveau-né",
    createPath: "/births",
    managePath: "/manage/naissance",
  },
  {
    slug: "matrimonial",
    label: "Liste des État-matrimoniaux",
    createLabel: "Enregistrer un mariage",
    createPath: "/marriages",
    managePath: "/manage/mariage",
  },
  {
    slug: "deces",
    label: "Enregistrement de décès",
    createLabel: "Enregistrement de décès",
    createPath: "/deaths",
    managePath: "/manage/deces",
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

function MatrimonialTable({ commune }: { commune: CommuneSel }) {
  const d = synopticMarriagesDivorces(commune);
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      mariage_nationaux: d.mariage.nationaux,
      mariage_etrangers: d.mariage.etrangers,
      mariage_mixtes: d.mariage.mixtes,
      mariage_total: d.mariage.total,
      divorce_nationaux: d.divorce.nationaux,
      divorce_etrangers: d.divorce.etrangers,
      divorce_mixtes: d.divorce.mixtes,
      divorce_total: d.divorce.total,
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_matrimonial_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DE L&apos;ÉTAT CIVIL
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={2}>COMMUNE</th>
              <th colSpan={4}>MARIAGE</th>
              <th colSpan={4}>DIVORCE</th>
            </tr>
            <tr>
              <th>NATIONAUX</th>
              <th>ÉTRANGERS</th>
              <th>MIXTES</th>
              <th>TOTAL</th>
              <th>NATIONAUX</th>
              <th>ÉTRANGERS</th>
              <th>MIXTES</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{d.commune.name}</td>
              <td>{d.mariage.nationaux}</td>
              <td>{d.mariage.etrangers}</td>
              <td>{d.mariage.mixtes}</td>
              <td>{d.mariage.total}</td>
              <td>{d.divorce.nationaux}</td>
              <td>{d.divorce.etrangers}</td>
              <td>{d.divorce.mixtes}</td>
              <td>{d.divorce.total}</td>
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
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      hommes: d.hommes,
      femmes: d.femmes,
      garcons: d.garcons,
      filles: d.filles,
      totalA: d.totalA,
      mortsNesG: d.mortsNesG,
      mortsNesF: d.mortsNesF,
      totalB: d.totalB,
      totalAB: d.totalAB,
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
              <th>COMMUNE</th>
              <th>HOMMES</th>
              <th>FEMMES</th>
              <th>GARÇONS</th>
              <th>FILLES</th>
              <th>TOTAL (A)</th>
              <th>MORTS-NÉS G</th>
              <th>MORTS-NÉS F</th>
              <th>TOTAL (B)</th>
              <th>TOTAL (A+B)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{d.commune.name}</td>
              <td>{d.hommes}</td>
              <td>{d.femmes}</td>
              <td>{d.garcons}</td>
              <td>{d.filles}</td>
              <td>{d.totalA}</td>
              <td>{d.mortsNesG}</td>
              <td>{d.mortsNesF}</td>
              <td>{d.totalB}</td>
              <td>{d.totalAB}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <QuartiersPanel commune={commune} />
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

function tabMetricTotal(
  r: { naissances: number; mariages: number; divorces: number; deces: number; documents: number },
  tab: TabSlug,
): number {
  if (tab === "naissances") return r.naissances;
  if (tab === "matrimonial") return r.mariages + r.divorces;
  if (tab === "deces") return r.deces;
  return r.documents;
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
  const title =
    tab === "naissances"
      ? "TABLEAU SYNOPTIQUE RÉCAPITULATIF DES NOUVEAU-NÉS PAR PROVINCE"
      : tab === "matrimonial"
        ? "TABLEAU SYNOPTIQUE RÉCAPITULATIF DE L'ÉTAT MATRIMONIAL PAR PROVINCE"
        : tab === "deces"
          ? "TABLEAU SYNOPTIQUE RÉCAPITULATIF DES DÉCÈS PAR PROVINCE"
          : "TABLEAU SYNOPTIQUE RÉCAPITULATIF DES ACTES PAR PROVINCE";

  const exportRows = rows.map((r) => {
    const base: Record<string, string | number> = {
      province: r.province,
      total: tabMetricTotal(r, tab),
    };
    if (tab === "naissances") {
      base.naissances_g = r.naissances_g;
      base.naissances_f = r.naissances_f;
      base.naissances_t = r.naissances;
    } else if (tab === "matrimonial") {
      base.mariages = r.mariages;
      base.divorces = r.divorces;
    } else if (tab === "deces") {
      base.deces = r.deces;
    } else {
      base.documents = r.documents;
    }
    return base;
  });

  const sumMetric = rows.reduce((a, r) => a + tabMetricTotal(r, tab), 0);
  const sumG = rows.reduce((a, r) => a + r.naissances_g, 0);
  const sumF = rows.reduce((a, r) => a + r.naissances_f, 0);
  const sumT = rows.reduce((a, r) => a + r.naissances, 0);
  const needsGft = tab === "naissances";

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_provinces_${tab}`} rows={exportRows} />
      </div>
      <h2 className="syn-official-title">
        {title}
        <br />
        RÉPUBLIQUE DÉMOCRATIQUE DU CONGO
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={needsGft ? 2 : 1}>PROVINCE</th>
              {tab === "naissances" ? <th colSpan={3}>NOUVEAU-NÉS</th> : null}
              {tab === "matrimonial" ? (
                <>
                  <th>MARIAGES</th>
                  <th>DIVORCES</th>
                </>
              ) : null}
              {tab === "deces" ? <th>DÉCÈS</th> : null}
              {tab === "documents" ? <th>ACTES</th> : null}
              <th rowSpan={needsGft ? 2 : 1}>TOTAL</th>
            </tr>
            {needsGft ? (
              <tr>
                <GftHeads />
              </tr>
            ) : null}
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
                {tab === "naissances" ? (
                  <>
                    <td>{r.naissances_g}</td>
                    <td>{r.naissances_f}</td>
                    <td>{r.naissances}</td>
                  </>
                ) : null}
                {tab === "matrimonial" ? (
                  <>
                    <td>{r.mariages}</td>
                    <td>{r.divorces}</td>
                  </>
                ) : null}
                {tab === "deces" ? <td>{r.deces}</td> : null}
                {tab === "documents" ? <td>{r.documents}</td> : null}
                <td>
                  <strong>{tabMetricTotal(r, tab)}</strong>
                </td>
              </tr>
            ))}
            <tr>
              <td className="syn-commune-cell">
                <strong>TOTAL RDC</strong>
              </td>
              {tab === "naissances" ? (
                <>
                  <td>
                    <strong>{sumG}</strong>
                  </td>
                  <td>
                    <strong>{sumF}</strong>
                  </td>
                  <td>
                    <strong>{sumT}</strong>
                  </td>
                </>
              ) : null}
              {tab === "matrimonial" ? (
                <>
                  <td>
                    <strong>{rows.reduce((a, r) => a + r.mariages, 0)}</strong>
                  </td>
                  <td>
                    <strong>{rows.reduce((a, r) => a + r.divorces, 0)}</strong>
                  </td>
                </>
              ) : null}
              {tab === "deces" ? (
                <td>
                  <strong>{rows.reduce((a, r) => a + r.deces, 0)}</strong>
                </td>
              ) : null}
              {tab === "documents" ? (
                <td>
                  <strong>{rows.reduce((a, r) => a + r.documents, 0)}</strong>
                </td>
              ) : null}
              <td>
                <strong>{sumMetric}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="syn-legend muted small">
        {needsGft ? "G = Garçons · F = Filles · T = Total — " : ""}
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
  const needsGft = tab === "naissances";
  const rs = needsGft ? 2 : 1;

  function metricHeads(firstLabel: string) {
    return (
      <>
        <th rowSpan={rs}>{firstLabel}</th>
        {tab === "naissances" ? <th colSpan={3}>NOUVEAU-NÉS</th> : null}
        {tab === "matrimonial" ? (
          <>
            <th>MARIAGES</th>
            <th>DIVORCES</th>
          </>
        ) : null}
        {tab === "deces" ? <th>DÉCÈS</th> : null}
        {tab === "documents" ? <th>ACTES</th> : null}
        <th rowSpan={rs}>TOTAL</th>
      </>
    );
  }

  function metricCells(
    r: {
      naissances_g: number;
      naissances_f: number;
      naissances: number;
      mariages: number;
      divorces: number;
      deces: number;
      documents: number;
    },
  ) {
    return (
      <>
        {tab === "naissances" ? (
          <>
            <td>{r.naissances_g}</td>
            <td>{r.naissances_f}</td>
            <td>{r.naissances}</td>
          </>
        ) : null}
        {tab === "matrimonial" ? (
          <>
            <td>{r.mariages}</td>
            <td>{r.divorces}</td>
          </>
        ) : null}
        {tab === "deces" ? <td>{r.deces}</td> : null}
        {tab === "documents" ? <td>{r.documents}</td> : null}
        <td>
          <strong>{tabMetricTotal(r, tab)}</strong>
        </td>
      </>
    );
  }

  const emptyVilleCols =
    1 + (tab === "naissances" ? 3 : tab === "matrimonial" ? 2 : 1) + 1;
  const emptyCommuneCols =
    1 + (tab === "naissances" ? 3 : tab === "matrimonial" ? 2 : 1) + 1;

  return (
    <>
      <h2 className="syn-official-title">
        INFORMATIONS DE LA PROVINCE
        <br />
        {province.toUpperCase()}
      </h2>

      <div className="table-scroll" style={{ marginBottom: "1rem" }}>
        <table className="syn-official">
          <thead>
            <tr>{metricHeads("PROVINCE")}</tr>
            {needsGft ? (
              <tr>
                <GftHeads />
              </tr>
            ) : null}
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{province}</td>
              {summary
                ? metricCells(summary)
                : metricCells({
                    naissances_g: 0,
                    naissances_f: 0,
                    naissances: 0,
                    mariages: 0,
                    divorces: 0,
                    deces: 0,
                    documents: 0,
                  })}
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
            <tr>{metricHeads("VILLE")}</tr>
            {needsGft ? (
              <tr>
                <GftHeads />
              </tr>
            ) : null}
          </thead>
          <tbody>
            {villes.length === 0 ? (
              <tr>
                <td colSpan={emptyVilleCols} className="muted">
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
                  {metricCells(v)}
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
            <tr>{metricHeads("COMMUNE")}</tr>
            {needsGft ? (
              <tr>
                <GftHeads />
              </tr>
            ) : null}
          </thead>
          <tbody>
            {filteredCommunes.length === 0 ? (
              <tr>
                <td colSpan={emptyCommuneCols} className="muted">
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
                  {metricCells(c)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="syn-legend muted small">
        {needsGft ? "G = Garçons · F = Filles · T = Total — " : ""}
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
  const isNational = isSuperAdminNational(session?.roles);
  const officer = getOfficerCommune();
  const [filterProvince, setFilterProvince] = useState("");
  const [filterVille, setFilterVille] = useState("");
  const [selected, setSelected] = useState<FlatCommune | null>(null);

  if (!section) return <Navigate to="/synoptique/naissances" replace />;
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
        ? synopticNationalTerritory().filter((r) => r.province === filterProvince)
        : [],
    [filterProvince, actCount],
  );
  const provinceSummary = useMemo(
    () => provinceRows.find((r) => r.province === filterProvince) ?? null,
    [provinceRows, filterProvince],
  );

  const overviewRows = useMemo(() => {
    if (isNational || !officer.province) return provinceRows;
    const scoped = provinceRows.filter(
      (r) => r.province.toLowerCase() === officer.province.toLowerCase(),
    );
    return scoped.length > 0 ? scoped : provinceRows;
  }, [isNational, officer.province, provinceRows]);

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
      [...new Set(listSynopticCommunes().map((c) => c.province))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [],
  );

  const villes = useMemo(
    () =>
      [
        ...new Set(
          listSynopticCommunes()
            .filter((c) => !filterProvince || c.province === filterProvince)
            .map((c) => c.ville),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [filterProvince],
  );

  const communesOpts = useMemo(
    () =>
      listSynopticCommunes()
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
          <button type="button" className="btn-secondary btn-sm" onClick={resetToGeneral}>
            Vue générale (provinces)
          </button>
        </div>
        <div className="form-grid">
          <div>
            <label className="form-label">Province</label>
            <select
              className="form-control"
              value={filterProvince}
              onChange={(e) => {
                setFilterProvince(e.target.value);
                setFilterVille("");
                setSelected(null);
              }}
            >
              <option value="">— Toutes les provinces —</option>
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
              disabled={!filterProvince}
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
              disabled={!filterProvince}
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
            {tab === "matrimonial" ? <MatrimonialTable commune={commune} /> : null}
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
