import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import { ministrySynopticBirths, ministrySynopticDeaths, type Gft } from "../../santeData";

const TABS = [
  { slug: "naissances", label: "Naissances" },
  { slug: "deces", label: "Décès" },
  { slug: "structures", label: "Par structure" },
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

function BirthsTable() {
  const d = ministrySynopticBirths();
  return (
    <>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DES NAISSANCES
        <br />
        {d.label.toUpperCase()}
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
              <th colSpan={3}>JUGEMENT SUPPLÉTIF</th>
              <th colSpan={3}>SANS PROCURATION</th>
              <th colSpan={3}>AVEC PROCURATION</th>
              <th colSpan={3}>JUGEMENT SUPPLÉTIF</th>
              <th colSpan={3}>SANS PROCURATION</th>
              <th colSpan={3}>AVEC PROCURATION</th>
              <th colSpan={3}>DANS LE DÉLAI</th>
              <th colSpan={3}>JUGEMENT</th>
              <th colSpan={3}>TOTAL</th>
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
      <p className="muted small">G = Garçons · F = Filles · T = Total — source : déclarations structures sanitaires.</p>
    </>
  );
}

function DeathsTable() {
  const d = ministrySynopticDeaths();
  return (
    <>
      <h2 className="syn-official-title">
        TABLEAU RÉCAPITULATIF DES STATISTIQUES DES DÉCÈS
        <br />
        {d.label.toUpperCase()}
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

function ByFacilityTable() {
  const births = ministrySynopticBirths().byFacility;
  const deaths = ministrySynopticDeaths().byFacility;
  const names = new Map<string, { name: string; commune: string; births: number; deaths: number }>();
  for (const b of births) {
    names.set(b.name, { name: b.name, commune: b.commune, births: b.n, deaths: 0 });
  }
  for (const d of deaths) {
    const cur = names.get(d.name) ?? { name: d.name, commune: d.commune, births: 0, deaths: 0 };
    cur.deaths = d.n;
    names.set(d.name, cur);
  }
  const rows = [...names.values()].sort((a, b) => b.births + b.deaths - (a.births + a.deaths));

  return (
    <>
      <h2 className="syn-official-title">RÉPARTITION PAR STRUCTURE SANITAIRE</h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>Structure</th>
              <th>Commune</th>
              <th>Naissances</th>
              <th>Décès</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="syn-commune-cell">{r.name}</td>
                <td>{r.commune || "—"}</td>
                <td>{r.births}</td>
                <td>{r.deaths}</td>
                <td>{r.births + r.deaths}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5}>Aucune déclaration pour l&apos;instant.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function SynopticPage() {
  const { section } = useParams<{ section?: string }>();
  if (!section) return <Navigate to="/sante/synoptique/naissances" replace />;
  const tab = (TABS.some((t) => t.slug === section) ? section : "naissances") as TabSlug;

  return (
    <div className="syn-page">
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/sante">Accueil</Link> / Tableau synoptique
          </p>
          <h2 className="page-title">Tableau synoptique</h2>
          <p className="page-lead">
            Forme officielle — agrégats nationaux du département Santé (toutes structures).
          </p>
        </div>
      </div>

      <div className="syn-tabs">
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
        {tab === "deces" ? <DeathsTable /> : null}
        {tab === "structures" ? <ByFacilityTable /> : null}
      </div>
    </div>
  );
}
