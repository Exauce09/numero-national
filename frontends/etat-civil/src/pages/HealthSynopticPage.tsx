/** Tableaux synoptiques — structure sanitaire (même forme officielle que l'état civil). */

import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import { getHealthSession } from "../healthAuth";
import {
  healthSynopticBirths,
  healthSynopticDeaths,
  healthSynopticDocuments,
  healthSynopticMarriagesDivorces,
} from "../healthSynoptic";
import type { Gft } from "../synoptic";

const TABS = [
  { slug: "naissances", label: "Liste des Nouveaux-nés" },
  { slug: "matrimonial", label: "Liste des État-matrimoniaux" },
  { slug: "deces", label: "Liste des Décès" },
  { slug: "documents", label: "Liste des Documents" },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];

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

function BirthsTable() {
  const d = healthSynopticBirths();
  const rows = [
    {
      structure: d.scope.facilityName,
      commune: d.scope.commune_name,
      code: d.scope.commune_code,
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
        <DataToolbar filename={`synoptique_sante_naissances_${d.scope.commune_code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DES NAISSANCES
        <br />
        {d.scope.facilityName.toUpperCase()}
        <br />
        COMMUNE DE {d.scope.commune_name.toUpperCase()} ({d.scope.commune_code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={3}>STRUCTURE / COMMUNE</th>
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
              <td className="syn-commune-cell">
                {d.scope.facilityName}
                <br />
                <span className="muted small">{d.scope.commune_name}</span>
              </td>
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
      <p className="syn-legend muted small">
        G = Garçons · F = Filles · T = Total — données de votre structure (déclarations + actes liés).
      </p>
    </>
  );
}

function MatrimonialTable() {
  const d = healthSynopticMarriagesDivorces();
  const rows = [
    {
      structure: d.scope.facilityName,
      commune: d.scope.commune_name,
      code: d.scope.commune_code,
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
        <DataToolbar filename={`synoptique_sante_matrimonial_${d.scope.commune_code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DE L&apos;ÉTAT CIVIL
        <br />
        {d.scope.facilityName.toUpperCase()}
        <br />
        COMMUNE DE {d.scope.commune_name.toUpperCase()} ({d.scope.commune_code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={2}>STRUCTURE / COMMUNE</th>
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
              <td className="syn-commune-cell">
                {d.scope.facilityName}
                <br />
                <span className="muted small">{d.scope.commune_name}</span>
              </td>
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
      <p className="syn-legend muted small">
        Habituellement vide pour une structure sanitaire (mariages / divorces sont enregistrés à l&apos;état
        civil).
      </p>
    </>
  );
}

function DeathsTable() {
  const d = healthSynopticDeaths();
  const rows = [
    {
      structure: d.scope.facilityName,
      commune: d.scope.commune_name,
      code: d.scope.commune_code,
      hommes: d.hommes,
      femmes: d.femmes,
      garcons: d.garcons,
      filles: d.filles,
      total_a: d.totalA,
      morts_nes_garcons: d.mortsNesG,
      morts_nes_filles: d.mortsNesF,
      total_b: d.totalB,
      totaux_ab: d.totalAB,
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_sante_deces_${d.scope.commune_code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU RÉCAPITULATIF DES STATISTIQUES DES DÉCÈS
        <br />
        {d.scope.facilityName.toUpperCase()}
        <br />
        COMMUNE DE {d.scope.commune_name.toUpperCase()} ({d.scope.commune_code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={2}>STRUCTURE / COMMUNE</th>
              <th colSpan={4}>DÉCÈS</th>
              <th rowSpan={2}>TOTAL (a)</th>
              <th colSpan={2}>MORTS NÉS</th>
              <th rowSpan={2}>TOTAL (b)</th>
              <th rowSpan={2}>TOTAUX (a+b)</th>
            </tr>
            <tr>
              <th>HOMMES</th>
              <th>FEMMES</th>
              <th>GARÇONS</th>
              <th>FILLES</th>
              <th>GARÇONS</th>
              <th>FILLES</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">
                {d.scope.facilityName}
                <br />
                <span className="muted small">{d.scope.commune_name}</span>
              </td>
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
    </>
  );
}

function DocumentsTable() {
  const d = healthSynopticDocuments();
  const rows =
    d.byType.length === 0
      ? [{ structure: d.scope.facilityName, commune: d.scope.commune_name, type_document: "—", nombre: 0 }]
      : d.byType.map((r) => ({
          structure: d.scope.facilityName,
          commune: d.scope.commune_name,
          type_document: r.type,
          nombre: r.count,
        }));

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_sante_documents_${d.scope.commune_code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE DES DOCUMENTS / DÉCLARATIONS
        <br />
        {d.scope.facilityName.toUpperCase()}
        <br />
        COMMUNE DE {d.scope.commune_name.toUpperCase()} ({d.scope.commune_code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>STRUCTURE / COMMUNE</th>
              <th>TYPE</th>
              <th>NOMBRE</th>
            </tr>
          </thead>
          <tbody>
            {d.byType.length === 0 ? (
              <tr>
                <td className="syn-commune-cell">{d.scope.facilityName}</td>
                <td colSpan={2}>Aucun document / déclaration</td>
              </tr>
            ) : (
              d.byType.map((r) => (
                <tr key={r.type}>
                  <td className="syn-commune-cell">{d.scope.facilityName}</td>
                  <td>{r.type}</td>
                  <td>{r.count}</td>
                </tr>
              ))
            )}
            <tr>
              <td className="syn-commune-cell" colSpan={2}>
                <strong>TOTAL</strong>
              </td>
              <td>
                <strong>{d.total}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function HealthSynopticPage() {
  const { section } = useParams<{ section?: string }>();
  const session = getHealthSession()!;
  if (!section) return <Navigate to="/sante/synoptique/naissances" replace />;
  const tab = (TABS.some((t) => t.slug === section) ? section : "naissances") as TabSlug;

  return (
    <div className="syn-page">
      <div className="eg-page-head no-print">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/sante">Accueil</Link> / Tableau synoptique
          </p>
          <h2 className="page-title">Tableau synoptique</h2>
          <p className="page-lead">
            Forme officielle — données limitées à votre structure : <strong>{session.facilityName}</strong>{" "}
            (commune {session.commune_name}).
          </p>
        </div>
      </div>

      <div className="syn-tabs no-print">
        {TABS.map((t) => (
          <NavLink
            key={t.slug}
            to={`/sante/synoptique/${t.slug}`}
            className={({ isActive }) => `syn-tab${isActive || tab === t.slug ? " active" : ""}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <div className="syn-official-wrap">
        {tab === "naissances" ? <BirthsTable /> : null}
        {tab === "matrimonial" ? <MatrimonialTable /> : null}
        {tab === "deces" ? <DeathsTable /> : null}
        {tab === "documents" ? <DocumentsTable /> : null}
      </div>
    </div>
  );
}
