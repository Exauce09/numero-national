import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import {
  synopticBirthsNational,
  synopticDeathsNational,
  synopticMatrimonialNational,
  type Gft,
} from "../nationalData";

const TABS = [
  { slug: "naissances", label: "Naissances" },
  { slug: "deces", label: "Décès" },
  { slug: "matrimonial", label: "État matrimonial" },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];

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

function Births() {
  const d = synopticBirthsNational();
  return (
    <>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE NATIONAL DES NAISSANCES
        <br />
        PRÉSIDENCE DE LA RÉPUBLIQUE — VUE CONSOLIDÉE
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={3}>PÉRIMÈTRE</th>
              <th colSpan={9}>POPULATION CONGOLAISE (I)</th>
              <th colSpan={9}>POPULATION ÉTRANGÈRE (II)</th>
              <th colSpan={15}>TOTAUX (I + II)</th>
            </tr>
            <tr>
              <th colSpan={3}>SANS PROCURATION</th>
              <th colSpan={3}>AVEC PROCURATION</th>
              <th colSpan={3}>JUGEMENT</th>
              <th colSpan={3}>SANS PROCURATION</th>
              <th colSpan={3}>AVEC PROCURATION</th>
              <th colSpan={3}>JUGEMENT</th>
              <th colSpan={3}>SANS PROC.</th>
              <th colSpan={3}>AVEC PROC.</th>
              <th colSpan={3}>DANS LE DÉLAI</th>
              <th colSpan={3}>JUGEMENT</th>
              <th colSpan={3}>TOTAL</th>
            </tr>
            <tr>
              {Array.from({ length: 11 }).map((_, i) => (
                <GftHeads key={i} />
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">National</td>
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
    </>
  );
}

function Deaths() {
  const d = synopticDeathsNational();
  return (
    <>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE NATIONAL DES DÉCÈS
        <br />
        PRÉSIDENCE DE LA RÉPUBLIQUE — VUE CONSOLIDÉE
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={2}>PÉRIMÈTRE</th>
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
              <td className="syn-commune-cell">National</td>
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

function Matrimonial() {
  const d = synopticMatrimonialNational();
  return (
    <>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE NATIONAL — ÉTAT MATRIMONIAL
        <br />
        PRÉSIDENCE DE LA RÉPUBLIQUE
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={2}>PÉRIMÈTRE</th>
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
              <td className="syn-commune-cell">National</td>
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
    </>
  );
}

export default function SynopticPage() {
  const { section } = useParams<{ section?: string }>();
  if (!section) return <Navigate to="/synoptique/naissances" replace />;
  const tab = (TABS.some((t) => t.slug === section) ? section : "naissances") as TabSlug;

  return (
    <div className="syn-page">
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Tableau synoptique
          </p>
          <h2 className="page-title">Tableau synoptique national</h2>
          <p className="page-lead">Consolidation générale du système — lecture Présidence.</p>
        </div>
      </div>
      <div className="syn-tabs">
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
      <div className="syn-official-wrap">
        {tab === "naissances" ? <Births /> : null}
        {tab === "deces" ? <Deaths /> : null}
        {tab === "matrimonial" ? <Matrimonial /> : null}
      </div>
    </div>
  );
}
